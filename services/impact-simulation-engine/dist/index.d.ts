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
export declare class ImpactSimulationEngine {
    private readonly nodes;
    private readonly edges;
    constructor(nodes: Map<string, GraphNode>, edges: GraphEdge[]);
    simulate(request: ImpactRequest): ImpactResult;
}
