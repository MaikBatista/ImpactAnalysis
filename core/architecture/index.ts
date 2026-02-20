import { SyntaxKind } from "ts-morph";
import type {
  ArchitecturalViolation,
  RuleAnalysis,
} from "../contracts.js";

function hasLayerSegment(filePath: string, segment: string): boolean {
  return filePath.replace(/\\/g, "/").split("/").includes(segment);
}

export class ArchitecturalAnalyzer {
  analyze(analysis: RuleAnalysis): ArchitecturalViolation[] {
    const semanticNodes = analysis.domainModel.semanticNodes;
    const entities = analysis.domainModel.entities;
    const relations = analysis.domainModel.relations;
    const rules = analysis.rules;
    const violations: ArchitecturalViolation[] = [];

    for (const relation of relations) {
      if (relation.type === "CALLS" && relation.from.includes("domain") && relation.to.toLowerCase().includes("infra")) {
        violations.push({
          id: `violation:domain-calling-infra:${relation.from}`,
          type: "DOMAIN_CALLING_INFRA",
          message: "Domain layer calling infrastructure component.",
          relatedIds: [relation.from, relation.to],
        });
      }
    }

    for (const rule of rules) {
      if ((rule.method ?? "").endsWith("Controller") || rule.filePath.includes("controller")) {
        violations.push({
          id: `violation:rule-in-controller:${rule.id}`,
          type: "RULE_IN_CONTROLLER",
          message: "Business rule found in controller layer.",
          filePath: rule.filePath,
          relatedIds: [rule.id],
        });
      }
    }

    for (const entity of entities) {
      const modifies = relations.filter(
        (relation) => relation.type === "MODIFIES" && relation.from.startsWith(`${entity.name}.`),
      );
      if (entity.stateFields.length > 0 && modifies.length === 0) {
        violations.push({
          id: `violation:anemic-entity:${entity.name}`,
          type: "ANEMIC_ENTITY",
          message: `Entity ${entity.name} has state but no detected state mutations.`,
          filePath: entity.filePath,
          relatedIds: [entity.name],
        });
      }
    }

    const classes = semanticNodes
      .filter((node) => node.kind === "ClassDeclaration")
      .map((node) => node.astNode)
      .filter((node) => node.getKind() === SyntaxKind.ClassDeclaration);

    for (const classNode of classes) {
      const serviceCandidate = classNode.asKindOrThrow(SyntaxKind.ClassDeclaration);
      if (!(serviceCandidate.getName() ?? "").endsWith("Service")) {
        continue;
      }

      const methodCount = serviceCandidate.getMethods().length;
      if (methodCount < 8) {
        continue;
      }
      const filePath = serviceCandidate.getSourceFile().getFilePath();
      violations.push({
        id: `violation:fat-service:${filePath}:${serviceCandidate.getName()}`,
        type: "FAT_SERVICE",
        message: `Service ${serviceCandidate.getName() ?? "<unknown>"} exposes ${methodCount} methods.`,
        filePath,
        relatedIds: [serviceCandidate.getName() ?? filePath],
      });
    }

    const importNodes = semanticNodes
      .filter((node) => node.kind === "ImportDeclaration")
      .map((node) => node.astNode)
      .filter((node) => node.getKind() === SyntaxKind.ImportDeclaration);

    for (const importNode of importNodes) {
      const declaration = importNode.asKindOrThrow(SyntaxKind.ImportDeclaration);
      const filePath = declaration.getSourceFile().getFilePath();
      if (!hasLayerSegment(filePath, "domain")) {
        continue;
      }
      if (!declaration.getModuleSpecifierValue().includes("infra")) {
        continue;
      }

      violations.push({
        id: `violation:layer:${filePath}`,
        type: "LAYER_VIOLATION",
        message: "Domain module importing infrastructure module.",
        filePath,
        relatedIds: [filePath],
      });
    }

    const ruleGroups = new Map<string, Set<string>>();
    for (const rule of rules) {
      const key = `${rule.entity ?? "none"}:${rule.type}`;
      const fileSet = ruleGroups.get(key) ?? new Set<string>();
      fileSet.add(rule.filePath);
      ruleGroups.set(key, fileSet);
    }

    for (const [key, fileSet] of ruleGroups.entries()) {
      if (fileSet.size < 3) {
        continue;
      }
      violations.push({
        id: `violation:scattered-rule:${key}`,
        type: "SCATTERED_RULE",
        message: `Rule pattern ${key} appears across ${fileSet.size} files.`,
        relatedIds: [...fileSet],
      });
    }

    return violations;
  }
}
