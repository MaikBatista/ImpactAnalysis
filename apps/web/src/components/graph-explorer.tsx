"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

interface GraphExplorerProps {
  nodes: Node[];
  edges: Edge[];
}

export function GraphExplorer({ nodes, edges }: GraphExplorerProps) {
  const colorByType = (type: string): string => {
    switch (type) {
      case "BusinessRule":
        return "#c05a00";
      case "DomainEntity":
        return "#0b7a57";
      case "UseCase":
        return "#0053a6";
      case "ArchitectureSmell":
        return "#b42318";
      case "Endpoint":
        return "#7348c9";
      default:
        return "#1e5dd7";
    }
  };

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => {
        const type = String(node.data?.label ?? "").split(":")[0] || "File";
        const border = colorByType(type);
        return {
          ...node,
          style: {
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 10,
            width: 200,
            maxWidth: 200,
            background: "linear-gradient(165deg, #f9fbff 0%, #e9f0ff 100%)",
            boxShadow: "0 8px 18px rgba(24, 58, 128, 0.15)",
            fontSize: 12,
            fontWeight: 600,
            color: "#16306a",
            whiteSpace: "normal" as const,
            overflowWrap: "anywhere" as const,
          },
        };
      }),
    [nodes]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: false,
        style: { stroke: "#4f7dde", strokeWidth: 1.7 },
        labelStyle: { fill: "#1c3b7a", fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: "#f0f5ff", fillOpacity: 0.95 }
      })),
    [edges]
  );

  return (
    <div style={{ height: "70vh", border: "1px solid #bfd4ff", borderRadius: 12, overflow: "hidden" }}>
      <ReactFlow fitView nodes={styledNodes} edges={styledEdges}>
        <MiniMap style={{ background: "#f3f7ff" }} nodeStrokeColor={() => "#2e66d6"} nodeColor={() => "#d6e4ff"} />
        <Controls />
        <Background color="#d4e2ff" gap={18} />
      </ReactFlow>
    </div>
  );
}
