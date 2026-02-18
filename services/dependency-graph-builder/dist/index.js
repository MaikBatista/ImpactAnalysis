export class GraphBuilder {
    graph = {
        nodes: new Map(),
        edges: []
    };
    upsertNode(node) {
        this.graph.nodes.set(node.id, node);
    }
    addEdge(edge) {
        const id = `${edge.type}:${edge.from}->${edge.to}`;
        if (this.graph.edges.some((existing) => existing.id === id)) {
            return;
        }
        this.graph.edges.push({ id, ...edge });
    }
    getGraph() {
        return this.graph;
    }
    serialize() {
        return {
            nodes: [...this.graph.nodes.values()],
            edges: this.graph.edges
        };
    }
}
//# sourceMappingURL=index.js.map