"use client";

import { useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import { GraphExplorer } from "../components/graph-explorer";

const seedNodes: Node[] = [
  { id: "file:user-service.ts", position: { x: 50, y: 50 }, data: { label: "User Service" } },
  { id: "endpoint:users_get", position: { x: 350, y: 40 }, data: { label: "GET /users" } },
  { id: "table:users", position: { x: 350, y: 180 }, data: { label: "users table" } },
  { id: "rule:premium-check", position: { x: 650, y: 120 }, data: { label: "Premium Eligibility Rule" } }
];

const seedEdges: Edge[] = [
  { id: "a", source: "file:user-service.ts", target: "endpoint:users_get", label: "exposes_endpoint" },
  { id: "b", source: "file:user-service.ts", target: "table:users", label: "reads_from" },
  { id: "c", source: "endpoint:users_get", target: "rule:premium-check", label: "implements_rule" }
];

export default function HomePage() {
  const [selectedNode, setSelectedNode] = useState("table:users");

  const impact = useMemo(
    () =>
      seedEdges
        .filter((edge) => edge.source === selectedNode || edge.target === selectedNode)
        .map((edge) => `${edge.source} -> ${edge.target} (${edge.label})`),
    [selectedNode]
  );

  return (
    <main style={{ padding: 24 }}>
      <h1>Impact Analysis Platform</h1>
      <p>Interactive architecture graph and blast-radius simulation.</p>
      <label>
        Select node to simulate:
        <select value={selectedNode} onChange={(event) => setSelectedNode(event.target.value)} style={{ marginLeft: 8 }}>
          {seedNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.id}
            </option>
          ))}
        </select>
      </label>
      <div style={{ marginTop: 16 }}>
        <GraphExplorer nodes={seedNodes} edges={seedEdges} />
      </div>
      <section>
        <h2>Impact Report</h2>
        <ul>
          {impact.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
