"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

interface GraphExplorerProps {
  nodes: Node[];
  edges: Edge[];
}

export function GraphExplorer({ nodes, edges }: GraphExplorerProps) {
  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        style: { border: "1px solid #1b5e20", borderRadius: 8, padding: 8, background: "#f1f8e9" }
      })),
    [nodes]
  );

  return (
    <div style={{ height: "70vh", border: "1px solid #ddd", borderRadius: 8 }}>
      <ReactFlow fitView nodes={styledNodes} edges={edges}>
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
