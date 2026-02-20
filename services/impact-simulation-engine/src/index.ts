import type { GraphEdge, GraphNode } from "@impact/dependency-graph-builder";

export interface ImpactRequest {
  changedNodeId: string;
}

export interface ImpactResult {
  directImpacts: GraphNode[];
  indirectImpacts: GraphNode[];
  riskLevel: "low" | "medium" | "high";
  suggestedRegressionAreas: string[];
}

export class ImpactSimulationEngine {
  constructor(
    private readonly nodes: Map<string, GraphNode>,
    private readonly edges: GraphEdge[]
  ) {}

  simulate(request: ImpactRequest): ImpactResult {
    const directIds = new Set<string>();
    const visited = new Set<string>([request.changedNodeId]);
    const indirectIds = new Set<string>();

    const queue: Array<{ id: string; depth: number }> = [{ id: request.changedNodeId, depth: 0 }];

    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      const outgoing = this.edges.filter((edge) => edge.from === current.id || edge.to === current.id);
      for (const edge of outgoing) {
        const nextId = edge.from === current.id ? edge.to : edge.from;
        if (visited.has(nextId)) {
          continue;
        }
        visited.add(nextId);

        if (current.depth === 0) {
          directIds.add(nextId);
        } else {
          indirectIds.add(nextId);
        }

        if (current.depth < 3) {
          queue.push({ id: nextId, depth: current.depth + 1 });
        }
      }
    }

    const directImpacts = [...directIds].flatMap((id) => (this.nodes.get(id) ? [this.nodes.get(id)!] : []));
    const indirectImpacts = [...indirectIds].flatMap((id) => (this.nodes.get(id) ? [this.nodes.get(id)!] : []));

    const score = directImpacts.length * 2 + indirectImpacts.length;
    const riskLevel: ImpactResult["riskLevel"] = score > 20 ? "high" : score > 8 ? "medium" : "low";

    const suggestedRegressionAreas = [
      ...new Set(
        [...directImpacts, ...indirectImpacts]
          .filter((node) =>
            [
              "Endpoint",
              "BusinessRule",
              "Function",
              "DomainEntity",
              "UseCase",
              "ArchitectureSmell",
            ].includes(node.type),
          )
          .map((node) => `Validate ${node.type}: ${node.label}`)
      )
    ];

    return {
      directImpacts,
      indirectImpacts,
      riskLevel,
      suggestedRegressionAreas
    };
  }
}
