import type {
  BusinessRule,
  DomainEntity,
  DomainRelation,
  ImpactNode,
  ImpactSimulationInput,
  ImpactSimulationResult,
} from "../contracts.js";

type InternalGraph = {
  entities: Map<string, DomainEntity>;
  rules: Map<string, BusinessRule>;
  relations: DomainRelation[];
};

function normalize(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, value / max));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function isFileLike(nodeId: string): boolean {
  const lower = nodeId.toLowerCase();
  return lower.includes("/") || lower.includes("\\") || lower.endsWith(".ts") || lower.endsWith(".tsx");
}

function isEntityLike(nodeId: string, entities: Map<string, DomainEntity>): boolean {
  return entities.has(nodeId);
}

function isMethodLike(nodeId: string): boolean {
  return nodeId.includes(".") || nodeId.includes("#");
}

function nodeType(nodeId: string, graph: InternalGraph, rootRuleId: string): ImpactNode["type"] {
  if (nodeId === rootRuleId || graph.rules.has(nodeId)) {
    return "RULE";
  }
  if (isEntityLike(nodeId, graph.entities)) {
    return "ENTITY";
  }
  if (isFileLike(nodeId)) {
    return "FILE";
  }
  return isMethodLike(nodeId) ? "METHOD" : "METHOD";
}

function stateMutationWeight(rule: BusinessRule): number {
  switch (rule.type) {
    case "STATE_TRANSITION":
      return 1;
    case "INVARIANT":
      return 0.9;
    case "POLICY":
      return 0.7;
    case "CALCULATION":
      return 0.6;
    case "CONTEXT_RESTRICTION":
      return 0.5;
    default:
      return 0.5;
  }
}

function crossLayerViolationWeight(rule: BusinessRule): number {
  const path = rule.filePath.toLowerCase();
  if (path.includes("controller")) {
    return 1;
  }
  if (path.includes("service")) {
    return 0.7;
  }
  if (rule.entity) {
    return 0.2;
  }
  return 1;
}

function buildGraph(input: ImpactSimulationInput): InternalGraph {
  return {
    entities: new Map(input.domainEntities.map((entity) => [entity.name, entity])),
    rules: new Map(input.businessRules.map((rule) => [rule.id, rule])),
    relations: input.domainRelations,
  };
}

class GraphTraversal {
  constructor(private readonly graph: InternalGraph) {}

  getOutgoingDependencies(nodeId: string): DomainRelation[] {
    return this.graph.relations.filter((relation) => relation.from === nodeId);
  }

  getIncomingDependencies(nodeId: string): DomainRelation[] {
    return this.graph.relations.filter((relation) => relation.to === nodeId);
  }

  getFanOut(nodeId: string): number {
    return new Set(this.getOutgoingDependencies(nodeId).map((relation) => relation.to)).size;
  }

  getFanIn(nodeId: string): number {
    return new Set(this.getIncomingDependencies(nodeId).map((relation) => relation.from)).size;
  }

  getCallDepth(nodeId: string): number {
    const visited = new Set<string>([nodeId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
    let maxDepth = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      maxDepth = Math.max(maxDepth, current.depth);
      if (current.depth >= 5) {
        continue;
      }

      for (const relation of this.getOutgoingDependencies(current.id)) {
        if (!["CALLS", "DEPENDS_ON", "MODIFIES"].includes(relation.type)) {
          continue;
        }
        if (visited.has(relation.to)) {
          continue;
        }
        visited.add(relation.to);
        queue.push({ id: relation.to, depth: current.depth + 1 });
      }
    }

    return maxDepth;
  }

  impactedSubgraph(rootNodeId: string): {
    directFanOut: number;
    indirectFanOut: number;
    impactedNodeIds: Set<string>;
    callDepth: number;
  } {
    const visited = new Set<string>([rootNodeId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: rootNodeId, depth: 0 }];
    const direct = new Set<string>();
    const indirect = new Set<string>();
    let maxDepth = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      maxDepth = Math.max(maxDepth, current.depth);
      if (current.depth >= 5) {
        continue;
      }

      for (const relation of this.getOutgoingDependencies(current.id)) {
        if (!["CALLS", "DEPENDS_ON", "MODIFIES"].includes(relation.type)) {
          continue;
        }

        const nextId = relation.to;
        if (visited.has(nextId)) {
          continue;
        }
        visited.add(nextId);

        if (current.depth === 0) {
          direct.add(nextId);
        } else {
          indirect.add(nextId);
        }

        queue.push({ id: nextId, depth: current.depth + 1 });
      }
    }

    return {
      directFanOut: direct.size,
      indirectFanOut: indirect.size,
      impactedNodeIds: visited,
      callDepth: maxDepth,
    };
  }
}

function resolveRootNode(rule: BusinessRule): string {
  if (rule.entity && rule.method) {
    return `${rule.entity}.${rule.method}`;
  }
  if (rule.method) {
    return `${rule.filePath}#${rule.method}`;
  }
  if (rule.entity) {
    return rule.entity;
  }
  return rule.id;
}

function entityCriticalityWeight(input: {
  entityName?: string;
  rules: BusinessRule[];
  traversal: GraphTraversal;
  graph: InternalGraph;
}): number {
  const { entityName, rules, traversal, graph } = input;
  if (!entityName) {
    return 1;
  }

  const entityRules = rules.filter((rule) => rule.entity === entityName).length;
  const entityNames = [...graph.entities.keys()];
  const maxRulesPerEntity = Math.max(
    1,
    ...entityNames.map((name) => rules.filter((rule) => rule.entity === name).length),
  );

  const fanIn = traversal.getFanIn(entityName);
  const maxFanIn = Math.max(1, ...entityNames.map((name) => traversal.getFanIn(name)));

  return round2((normalize(entityRules, maxRulesPerEntity) + normalize(fanIn, maxFanIn)) / 2);
}

function crossLayerViolationsCount(impactedNodeIds: Set<string>): number {
  let count = 0;
  for (const nodeId of impactedNodeIds) {
    const lower = nodeId.toLowerCase();
    if (lower.includes("controller") || lower.includes("infra")) {
      count += 1;
    }
  }
  return count;
}

export class ImpactSimulationEngine {
  simulate(ruleId: string, input: ImpactSimulationInput): ImpactSimulationResult {
    const graph = buildGraph(input);
    const traversal = new GraphTraversal(graph);

    const rootRule = graph.rules.get(ruleId);
    if (!rootRule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const rootNodeId = resolveRootNode(rootRule);
    const subgraph = traversal.impactedSubgraph(rootNodeId);

    if (rootRule.entity && !subgraph.impactedNodeIds.has(rootRule.entity)) {
      subgraph.impactedNodeIds.add(rootRule.entity);
    }

    if (rootRule.method && rootRule.entity) {
      subgraph.impactedNodeIds.add(`${rootRule.entity}.${rootRule.method}`);
    }

    const projectNodeIds = new Set<string>();
    for (const relation of graph.relations) {
      projectNodeIds.add(relation.from);
      projectNodeIds.add(relation.to);
    }

    const maxFanOut = Math.max(1, ...[...projectNodeIds].map((id) => traversal.getFanOut(id)));
    const maxCallDepth = Math.max(1, ...[...projectNodeIds].map((id) => traversal.getCallDepth(id)));

    const fanOut = subgraph.directFanOut + subgraph.indirectFanOut;
    const callDepth = subgraph.callDepth;

    const fanOutWeight = normalize(fanOut, maxFanOut);
    const callDepthWeight = normalize(callDepth, maxCallDepth);
    const mutationWeight = stateMutationWeight(rootRule);
    const layerWeight = crossLayerViolationWeight(rootRule);
    const criticalityWeight = entityCriticalityWeight({
      entityName: rootRule.entity,
      rules: input.businessRules,
      traversal,
      graph,
    });

    let globalRiskScore =
      fanOutWeight * 0.25 +
      callDepthWeight * 0.15 +
      mutationWeight * 0.2 +
      layerWeight * 0.2 +
      criticalityWeight * 0.2;

    if (!rootRule.entity) {
      globalRiskScore = Math.max(globalRiskScore, 0.85);
    }

    globalRiskScore = round2(Math.max(0, Math.min(1, globalRiskScore)));

    const impactedNodes: ImpactNode[] = [
      {
        id: rootRule.id,
        type: "RULE",
        riskScore: globalRiskScore,
      },
      ...[...subgraph.impactedNodeIds]
        .filter((id) => id !== rootRule.id)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => ({
          id,
          type: nodeType(id, graph, rootRule.id),
          riskScore: globalRiskScore,
        })),
    ];

    const affectedFiles = new Set<string>();
    const affectedEntities = new Set<string>();

    for (const nodeId of subgraph.impactedNodeIds) {
      if (isFileLike(nodeId)) {
        affectedFiles.add(nodeId);
      }
      if (graph.entities.has(nodeId)) {
        affectedEntities.add(nodeId);
      }
    }

    if (rootRule.filePath) {
      affectedFiles.add(rootRule.filePath);
    }
    if (rootRule.entity) {
      affectedEntities.add(rootRule.entity);
    }

    return {
      rootRule,
      impactedNodes,
      globalRiskScore,
      explanation: {
        fanOut,
        callDepth,
        affectedFiles: affectedFiles.size,
        affectedEntities: affectedEntities.size,
        crossLayerViolations: crossLayerViolationsCount(subgraph.impactedNodeIds),
      },
    };
  }
}
