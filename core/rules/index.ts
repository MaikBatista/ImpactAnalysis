import {
  Node,
  Scope,
  SyntaxKind,
  type BinaryExpression,
  type ClassDeclaration,
  type IfStatement,
  type MethodDeclaration,
} from "ts-morph";
import type {
  BusinessRule,
  BusinessRuleExtractionInput,
  BusinessRuleType,
  DomainEntity,
  RuleContext,
} from "../contracts.js";
import { calculateConfidence } from "./confidence.js";

function isTechnicalLayer(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/controller") || normalized.includes("/infra") || normalized.includes("/adapter");
}

function classAndMethod(node: Node): {
  classNode?: ClassDeclaration;
  method?: MethodDeclaration;
} {
  return {
    classNode: node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration),
    method: node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration),
  };
}

function isAssignment(binary: BinaryExpression): boolean {
  return [
    SyntaxKind.EqualsToken,
    SyntaxKind.PlusEqualsToken,
    SyntaxKind.MinusEqualsToken,
    SyntaxKind.AsteriskEqualsToken,
    SyntaxKind.SlashEqualsToken,
    SyntaxKind.PercentEqualsToken,
  ].includes(binary.getOperatorToken().getKind());
}

function assignedThisField(binary: BinaryExpression): string | null {
  if (!isAssignment(binary)) {
    return null;
  }
  const left = binary.getLeft();
  if (!Node.isPropertyAccessExpression(left) || left.getExpression().getText() !== "this") {
    return null;
  }
  return left.getName();
}

function hasThrow(node: Node): boolean {
  return node.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
}

function hasReturn(node: Node): boolean {
  return node.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;
}

function hasStateMutation(method: MethodDeclaration, entity?: DomainEntity): boolean {
  if (!entity) {
    return false;
  }
  return method
    .getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .some((binary) => {
      const field = assignedThisField(binary);
      return Boolean(field) && entity.stateFields.includes(field!);
    });
}

function usesEnumState(node: Node): boolean {
  const propertyAccesses = node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  return propertyAccesses.some((access) => {
    const symbol = access.getExpression().getSymbol() ?? access.getSymbol();
    const declaration = symbol?.getDeclarations()[0];
    return (
      declaration?.getKind() === SyntaxKind.EnumDeclaration ||
      declaration?.getKind() === SyntaxKind.EnumMember
    );
  });
}

function isPublicMethod(method?: MethodDeclaration): boolean {
  if (!method) {
    return false;
  }
  const scope = method.getScope();
  return scope === Scope.Public || scope === undefined;
}

function isStrongStructuralPattern(type: BusinessRuleType, node: Node): boolean {
  if (type === "STATE_TRANSITION") {
    return true;
  }
  if (type === "INVARIANT") {
    return hasThrow(node) || hasReturn(node);
  }
  if (type === "CALCULATION") {
    return Node.isBinaryExpression(node);
  }
  if (type === "POLICY") {
    return Node.isIfStatement(node) && Boolean(node.getElseStatement());
  }
  if (type === "CONTEXT_RESTRICTION") {
    return Node.isIfStatement(node);
  }
  return false;
}

function isIsolatedCalculation(binary: BinaryExpression): boolean {
  const hasMutation = Boolean(assignedThisField(binary));
  const insideIf = Boolean(binary.getFirstAncestorByKind(SyntaxKind.IfStatement));
  return !hasMutation && !insideIf;
}

function ruleId(type: BusinessRuleType, filePath: string, start: number): string {
  return `${type}:${filePath}:${start}`;
}

function createContext(input: {
  rule: BusinessRule;
  node: Node;
  method?: MethodDeclaration;
  entity?: DomainEntity;
  mutatesStateField: boolean;
  hasExplicitThrow: boolean;
  usesStateEnum: boolean;
  isolatedCalculation: boolean;
}): RuleContext {
  const inController = input.rule.filePath.toLowerCase().includes("controller");
  return {
    inDomainEntity: Boolean(input.entity),
    mutatesStateField: input.mutatesStateField,
    hasExplicitThrow: input.hasExplicitThrow,
    inPublicMethod: isPublicMethod(input.method),
    usesStateEnum: input.usesStateEnum,
    outsideControllerInfra: !isTechnicalLayer(input.rule.filePath),
    strongStructuralPattern: isStrongStructuralPattern(input.rule.type, input.node),
    inController,
    isolatedCalculation: input.isolatedCalculation,
  };
}

function detectContextRestriction(ifNode: IfStatement, entity?: DomainEntity): boolean {
  const condition = ifNode.getExpression();

  const hasDateCheck =
    condition.getDescendantsOfKind(SyntaxKind.NewExpression).some((exp) => exp.getExpression().getText() === "Date") ||
    condition
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getText() === "Date.now");

  const hasStatusCheck = condition
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((access) => access.getName().toLowerCase() === "status");

  const hasFeatureFlag = condition
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((access) => {
      const left = access.getExpression().getText().toLowerCase();
      const right = access.getName().toLowerCase();
      return (
        left === "process.env" ||
        right.includes("flag") ||
        right.includes("feature")
      );
    });

  const hasExternalContext = (() => {
    const method = ifNode.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
    if (!method) {
      return false;
    }

    const params = new Set(method.getParameters().map((param) => param.getName()));
    const identifiers = condition.getDescendantsOfKind(SyntaxKind.Identifier);
    return identifiers.some((identifier) => {
      const text = identifier.getText();
      if (params.has(text)) {
        return true;
      }
      if (text === "process") {
        return true;
      }
      if (entity?.stateFields.includes(text)) {
        return false;
      }
      return false;
    });
  })();

  return hasDateCheck || hasStatusCheck || hasFeatureFlag || hasExternalContext;
}

function detectPolicy(ifNode: IfStatement): boolean {
  const hasElse = Boolean(ifNode.getElseStatement());
  const thenReturns = hasReturn(ifNode.getThenStatement());
  const elseReturns = ifNode.getElseStatement() ? hasReturn(ifNode.getElseStatement()!) : false;
  const thenAssignments = ifNode.getThenStatement().getDescendantsOfKind(SyntaxKind.BinaryExpression).length;
  const elseAssignments = ifNode.getElseStatement()?.getDescendantsOfKind(SyntaxKind.BinaryExpression).length ?? 0;
  return hasElse || (thenReturns && elseReturns) || (thenAssignments > 0 && elseAssignments > 0);
}

function detectInvariant(ifNode: IfStatement, method: MethodDeclaration, entity?: DomainEntity): boolean {
  const thenStatement = ifNode.getThenStatement();
  const guardClause = hasThrow(thenStatement) || hasReturn(thenStatement);
  if (!guardClause) {
    return false;
  }

  if (!entity) {
    return true;
  }

  const subsequentMutations = method
    .getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .some((binary) => {
      const field = assignedThisField(binary);
      return Boolean(field) && entity.stateFields.includes(field!);
    });

  return guardClause || subsequentMutations;
}

function detectCalculation(binary: BinaryExpression, entity?: DomainEntity): boolean {
  const operator = binary.getOperatorToken().getKind();
  const arithmetic = [
    SyntaxKind.PlusToken,
    SyntaxKind.MinusToken,
    SyntaxKind.AsteriskToken,
    SyntaxKind.SlashToken,
    SyntaxKind.PercentToken,
  ].includes(operator);

  if (!arithmetic) {
    return false;
  }

  const hasNumericLiteral = binary.getDescendantsOfKind(SyntaxKind.NumericLiteral).length > 0;
  const hasEntityProperty = entity
    ? binary
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((access) => access.getExpression().getText() === "this" && entity.properties.includes(access.getName()))
    : false;

  return hasNumericLiteral || hasEntityProperty;
}

export class BusinessRuleEngine {
  extract(input: BusinessRuleExtractionInput): BusinessRule[] {
    const rules: BusinessRule[] = [];
    const byClass = new Map(input.domainEntities.map((entity) => [entity.name, entity]));

    for (const semanticNode of input.semanticNodes) {
      const { classNode, method } = classAndMethod(semanticNode.astNode);
      const className = classNode?.getName();
      const entity = className ? byClass.get(className) : undefined;
      const methodName = method?.getName();
      const filePath = semanticNode.filePath;

      if (Node.isIfStatement(semanticNode.astNode) && method) {
        const ifNode = semanticNode.astNode;

        let type: BusinessRuleType | null = null;
        if (detectInvariant(ifNode, method, entity)) {
          type = "INVARIANT";
        } else if (detectContextRestriction(ifNode, entity)) {
          type = "CONTEXT_RESTRICTION";
        } else if (detectPolicy(ifNode)) {
          type = "POLICY";
        }

        if (type) {
          const baseRule: BusinessRule = {
            id: ruleId(type, filePath, ifNode.getStart()),
            type,
            entity: entity?.name,
            method: methodName,
            filePath,
            condition: ifNode.getExpression().getText(),
            consequence: ifNode.getThenStatement().getText(),
            astLocation: {
              start: ifNode.getStart(),
              end: ifNode.getEnd(),
            },
            confidence: 0,
          };

          const context = createContext({
            rule: baseRule,
            node: ifNode,
            method,
            entity,
            mutatesStateField: hasStateMutation(method, entity),
            hasExplicitThrow: hasThrow(ifNode),
            usesStateEnum: usesEnumState(ifNode),
            isolatedCalculation: false,
          });

          baseRule.confidence = calculateConfidence(baseRule, context);
          rules.push(baseRule);
        }
      }

      if (Node.isBinaryExpression(semanticNode.astNode) && method) {
        const binary = semanticNode.astNode;
        const stateField = entity ? assignedThisField(binary) : null;

        if (stateField && entity?.stateFields.includes(stateField)) {
          const baseRule: BusinessRule = {
            id: ruleId("STATE_TRANSITION", filePath, binary.getStart()),
            type: "STATE_TRANSITION",
            entity: entity.name,
            method: methodName,
            filePath,
            condition: `${stateField} assignment`,
            consequence: binary.getText(),
            astLocation: {
              start: binary.getStart(),
              end: binary.getEnd(),
            },
            confidence: 0,
          };

          const context = createContext({
            rule: baseRule,
            node: binary,
            method,
            entity,
            mutatesStateField: true,
            hasExplicitThrow: hasThrow(method),
            usesStateEnum: usesEnumState(binary),
            isolatedCalculation: false,
          });

          baseRule.confidence = calculateConfidence(baseRule, context);
          rules.push(baseRule);
          continue;
        }

        if (detectCalculation(binary, entity)) {
          const baseRule: BusinessRule = {
            id: ruleId("CALCULATION", filePath, binary.getStart()),
            type: "CALCULATION",
            entity: entity?.name,
            method: methodName,
            filePath,
            condition: binary.getLeft().getText(),
            consequence: binary.getText(),
            astLocation: {
              start: binary.getStart(),
              end: binary.getEnd(),
            },
            confidence: 0,
          };

          const context = createContext({
            rule: baseRule,
            node: binary,
            method,
            entity,
            mutatesStateField: false,
            hasExplicitThrow: hasThrow(method),
            usesStateEnum: usesEnumState(binary),
            isolatedCalculation: isIsolatedCalculation(binary),
          });

          baseRule.confidence = calculateConfidence(baseRule, context);
          rules.push(baseRule);
        }
      }
    }

    const deduped = new Map<string, BusinessRule>();
    for (const rule of rules) {
      deduped.set(rule.id, rule);
    }

    return [...deduped.values()];
  }
}
