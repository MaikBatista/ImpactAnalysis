"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

interface GraphExplorerProps {
  nodes: Node[];
  edges: Edge[];
  impactedNodeIds?: Set<string>;
}

function borderFor(kind: string): string {
  if (kind === "ENTITY") return "#245d57";
  if (kind === "RULE") return "#ad6e2f";
  if (kind === "METHOD") return "#355f9c";
  return "#6a5f4f";
}

export function GraphExplorer({
  nodes,
  edges,
  impactedNodeIds,
}: GraphExplorerProps) {
  const styledNodes = useMemo(
    () =>
      nodes.map((node) => {
        const kind = String(node.data?.kind ?? "FILE");
        const impacted = impactedNodeIds?.has(node.id) ?? false;
        const border = borderFor(kind);
        return {
          ...node,
          style: {
            border: `2px solid ${border}`,
            borderRadius: 14,
            padding: 10,
            width: 230,
            maxWidth: 230,
            background: impacted
              ? "linear-gradient(155deg, #fff3c8 0%, #ffe8b8 100%)"
              : "linear-gradient(160deg, #fffef8 0%, #f2eee2 100%)",
            boxShadow: impacted
              ? "0 0 0 2px rgba(173,110,47,0.35), 0 10px 24px rgba(43,40,31,0.18)"
              : "0 10px 24px rgba(49,45,35,0.14)",
            fontSize: 12,
            fontWeight: 600,
            color: "#1f2924",
            whiteSpace: "normal" as const,
            overflowWrap: "anywhere" as const,
          },
        };
      }),
    [impactedNodeIds, nodes],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: false,
        style: { stroke: "#746a59", strokeWidth: 1.6 },
        labelStyle: { fill: "#3e433f", fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: "#f6f2e7", fillOpacity: 0.9 },
      })),
    [edges],
  );

  return (
    <div
      style={{
        height: "72vh",
        border: "1px solid #d3c6b1",
        borderRadius: 14,
        overflow: "hidden",
        background: "#f7f2e7",
      }}
    >
      <ReactFlow fitView nodes={styledNodes} edges={styledEdges}>
        <MiniMap
          style={{ background: "#e9dfcd" }}
          nodeStrokeColor={() => "#4c594f"}
          nodeColor={() => "#f6f1e6"}
        />
        <Controls />
        <Background color="#d8cfbf" gap={20} />
      </ReactFlow>
    </div>
  );
}
