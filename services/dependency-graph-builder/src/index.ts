export type NodeType =
  | "File"
  | "Class"
  | "Function"
  | "Endpoint"
  | "Table"
  | "Column"
  | "BusinessRule"
  | "DomainEntity"
  | "UseCase";

export type EdgeType =
  | "calls"
  | "depends_on"
  | "writes_to"
  | "reads_from"
  | "implements_rule"
  | "exposes_endpoint"
  | "triggers_event";

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

export class GraphBuilder {
  private readonly graph: KnowledgeGraph = {
    nodes: new Map(),
    edges: []
  };

  upsertNode(node: GraphNode): void {
    this.graph.nodes.set(node.id, node);
  }

  addEdge(edge: Omit<GraphEdge, "id">): void {
    const id = `${edge.type}:${edge.from}->${edge.to}`;
    if (this.graph.edges.some((existing) => existing.id === id)) {
      return;
    }

    this.graph.edges.push({ id, ...edge });
  }

  getGraph(): KnowledgeGraph {
    return this.graph;
  }

  serialize(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: [...this.graph.nodes.values()],
      edges: this.graph.edges
    };
  }
}
