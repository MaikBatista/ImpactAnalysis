import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type ClassDeclaration,
  type MethodDeclaration,
  type PropertyDeclaration,
} from "ts-morph";
import type { DomainEntity, DomainModel, DomainRelation, SemanticNode } from "../contracts.js";

const TECHNICAL_SUFFIXES = [
  "Controller",
  "Service",
  "Repository",
  "Adapter",
  "Gateway",
];

function isTechnicalClass(className: string): boolean {
  return TECHNICAL_SUFFIXES.some((suffix) => className.endsWith(suffix));
}

function classKey(classNode: ClassDeclaration): string {
  const sourceFile = classNode.getSourceFile().getFilePath();
  return `${sourceFile}:${classNode.getStart()}:${classNode.getEnd()}`;
}

function classOwnMethods(classNode: ClassDeclaration): MethodDeclaration[] {
  return classNode.getMethods();
}

function classOwnProperties(classNode: ClassDeclaration): PropertyDeclaration[] {
  return classNode.getProperties();
}

function assignmentOperatorKinds(): Set<SyntaxKind> {
  return new Set([
    SyntaxKind.EqualsToken,
    SyntaxKind.PlusEqualsToken,
    SyntaxKind.MinusEqualsToken,
    SyntaxKind.AsteriskEqualsToken,
    SyntaxKind.SlashEqualsToken,
    SyntaxKind.PercentEqualsToken,
  ]);
}

function isAssignment(binary: BinaryExpression): boolean {
  return assignmentOperatorKinds().has(binary.getOperatorToken().getKind());
}

function assignedThisField(binary: BinaryExpression): string | null {
  if (!isAssignment(binary)) {
    return null;
  }
  const left = binary.getLeft();
  if (!Node.isPropertyAccessExpression(left)) {
    return null;
  }
  if (left.getExpression().getText() !== "this") {
    return null;
  }
  return left.getName();
}

function hasEnumState(classNode: ClassDeclaration): boolean {
  return classOwnProperties(classNode).some((property) => {
    const type = property.getType();
    if (type.isEnum() || type.isEnumLiteral()) {
      return true;
    }

    const declaration = type.getSymbol()?.getDeclarations()[0];
    return declaration?.getKind() === SyntaxKind.EnumDeclaration;
  });
}

function hasInternalIf(classNode: ClassDeclaration): boolean {
  return classOwnMethods(classNode).some(
    (method) => method.getDescendantsOfKind(SyntaxKind.IfStatement).length > 0,
  );
}

function hasConditionalAssignment(classNode: ClassDeclaration): boolean {
  for (const method of classOwnMethods(classNode)) {
    const assignments = method.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    if (
      assignments.some(
        (assignment) => isAssignment(assignment) && Boolean(assignment.getFirstAncestorByKind(SyntaxKind.IfStatement)),
      )
    ) {
      return true;
    }
  }
  return false;
}

function getMutatedFieldsAndMethods(classNode: ClassDeclaration): {
  mutatedFields: Set<string>;
  mutatorMethods: Set<string>;
} {
  const mutatedFields = new Set<string>();
  const mutatorMethods = new Set<string>();

  for (const method of classOwnMethods(classNode)) {
    const assignments = method.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const assignment of assignments) {
      const field = assignedThisField(assignment);
      if (!field) {
        continue;
      }
      mutatedFields.add(field);
      mutatorMethods.add(method.getName());
    }
  }

  return { mutatedFields, mutatorMethods };
}

function fromForCall(call: CallExpression): string {
  const classNode = call.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
  const method = call.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
  if (classNode?.getName() && method?.getName()) {
    return `${classNode.getName()}.${method.getName()}`;
  }

  const fn = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
  if (fn?.getName()) {
    return `${call.getSourceFile().getFilePath()}#${fn.getName()}`;
  }

  return `${call.getSourceFile().getFilePath()}#<anonymous>`;
}

export class DomainModelBuilder {
  build(semanticNodes: SemanticNode[]): DomainModel {
    const entities: DomainEntity[] = [];
    const relations = new Map<string, DomainRelation>();

    const classNodes = new Map<string, ClassDeclaration>();
    const callNodes: CallExpression[] = [];
    const assignmentNodes: BinaryExpression[] = [];

    for (const semanticNode of semanticNodes) {
      if (Node.isClassDeclaration(semanticNode.astNode)) {
        classNodes.set(classKey(semanticNode.astNode), semanticNode.astNode);
      }

      if (Node.isCallExpression(semanticNode.astNode)) {
        callNodes.push(semanticNode.astNode);
      }

      if (Node.isBinaryExpression(semanticNode.astNode)) {
        assignmentNodes.push(semanticNode.astNode);
      }
    }

    for (const classNode of classNodes.values()) {
      const className = classNode.getName();
      if (!className || isTechnicalClass(className)) {
        continue;
      }

      const properties = classOwnProperties(classNode).map((property) => property.getName());
      const methods = classOwnMethods(classNode).map((method) => method.getName());

      const mutableFields = new Set(
        classOwnProperties(classNode)
          .filter((property) => !property.isReadonly())
          .map((property) => property.getName()),
      );

      const { mutatedFields, mutatorMethods } = getMutatedFieldsAndMethods(classNode);
      const stateFields = [...mutatedFields].filter((field) => mutableFields.has(field));

      const qualifiesAsEntity =
        mutableFields.size > 0 &&
        mutatorMethods.size > 0 &&
        (hasEnumState(classNode) || hasInternalIf(classNode) || hasConditionalAssignment(classNode));

      if (!qualifiesAsEntity) {
        continue;
      }

      entities.push({
        name: className,
        properties,
        methods,
        stateFields,
        filePath: classNode.getSourceFile().getFilePath(),
      });

      for (const method of classOwnMethods(classNode)) {
        for (const assignment of method.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
          const field = assignedThisField(assignment);
          if (!field || !stateFields.includes(field)) {
            continue;
          }
          const relation: DomainRelation = {
            from: `${className}.${method.getName()}`,
            to: `${className}.${field}`,
            type: "MODIFIES",
          };
          relations.set(`${relation.type}:${relation.from}:${relation.to}`, relation);
        }
      }
    }

    for (const call of callNodes) {
      const relation: DomainRelation = {
        from: fromForCall(call),
        to: call.getExpression().getText(),
        type: "CALLS",
      };
      relations.set(`${relation.type}:${relation.from}:${relation.to}`, relation);

      const useRelation: DomainRelation = {
        from: relation.from,
        to: relation.to,
        type: "USES",
      };
      relations.set(`${useRelation.type}:${useRelation.from}:${useRelation.to}`, useRelation);
    }

    for (const assignment of assignmentNodes) {
      if (!isAssignment(assignment)) {
        continue;
      }
      const method = assignment.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
      const classNode = assignment.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
      const field = assignedThisField(assignment);
      if (!method || !classNode?.getName() || !field) {
        continue;
      }

      const relation: DomainRelation = {
        from: `${classNode.getName()}.${method.getName()}`,
        to: `${classNode.getName()}.${field}`,
        type: "MODIFIES",
      };
      relations.set(`${relation.type}:${relation.from}:${relation.to}`, relation);
    }

    return {
      semanticNodes,
      entities,
      relations: [...relations.values()],
    };
  }
}
