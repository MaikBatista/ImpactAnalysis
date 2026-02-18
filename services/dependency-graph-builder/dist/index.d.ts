export type NodeType = "File" | "Class" | "Function" | "Endpoint" | "Table" | "Column" | "BusinessRule" | "DomainEntity" | "UseCase";
export type EdgeType = "calls" | "depends_on" | "writes_to" | "reads_from" | "implements_rule" | "exposes_endpoint" | "triggers_event";
export interface GraphNode {
    id: string;
    type: NodeType;
    label: string;
    metadata: Record<string, unknown>;
}
export interface GraphEdge {
    id: string;
    from: string;
    to: string;
    type: EdgeType;
    metadata?: Record<string, unknown>;
}
export interface KnowledgeGraph {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
}
export declare class GraphBuilder {
    private readonly graph;
    upsertNode(node: GraphNode): void;
    addEdge(edge: Omit<GraphEdge, "id">): void;
    getGraph(): KnowledgeGraph;
    serialize(): {
        nodes: GraphNode[];
        edges: GraphEdge[];
    };
}
