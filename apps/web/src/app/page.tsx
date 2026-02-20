"use client";

import { useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import { GraphExplorer } from "../components/graph-explorer";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
}

interface SerializedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface AnalyzeResponse {
  repositoryId?: string;
  analysisRunId?: string;
  graph: SerializedGraph;
  semanticInsights: {
    businessRules: string[];
    domainEntities: string[];
    useCases: string[];
    architectureSmells: string[];
  };
}

interface SimulateResponse {
  riskLevel: "low" | "medium" | "high";
  directImpacts: GraphNode[];
  indirectImpacts: GraphNode[];
  suggestedRegressionAreas: string[];
  impactReportId?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const BUSINESS_NODE_TYPES = new Set([
  "BusinessRule",
  "DomainEntity",
  "UseCase",
  "ArchitectureSmell",
]);
const CODE_NODE_TYPES = new Set(["File", "Endpoint", "Class", "Function"]);
type ViewMode = "all" | "business" | "code";

function trimLabel(value: string, maxLength = 48): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}...`;
}

function shortenFileLabel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return trimLabel(normalized, 42);
  }
  return trimLabel(`${parts[parts.length - 2]}/${parts[parts.length - 1]}`, 42);
}

function toFlowNodes(graphNodes: GraphNode[]): Node[] {
  const viewportWidth =
    typeof window !== "undefined" ? Math.max(window.innerWidth, 1200) : 1600;
  const columns = Math.max(6, Math.floor((viewportWidth - 120) / 220));
  return graphNodes.map((node, index) => ({
    id: node.id,
    position: {
      x: 40 + (index % columns) * 220,
      y: 40 + Math.floor(index / columns) * 130,
    },
    data: {
      label: `${node.type}: ${node.type === "File" ? shortenFileLabel(node.label) : trimLabel(node.label)}`,
      fullLabel: node.label,
    },
  }));
}

function toFlowEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.type,
  }));
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px 32px 40px",
    background:
      "linear-gradient(180deg, #f5f7ff 0%, #f8fbff 48%, #eef4ff 100%)",
    color: "#112245",
  } as const,
  header: {
    background:
      "linear-gradient(135deg, #142f6a 0%, #2468d1 45%, #4d8cff 100%)",
    borderRadius: 18,
    color: "#ffffff",
    padding: "24px 28px",
    boxShadow: "0 14px 36px rgba(15, 43, 99, 0.2)",
    marginBottom: 20,
  } as const,
  grid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  } as const,
  panel: {
    background: "#ffffff",
    border: "1px solid #dbe6ff",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 8px 20px rgba(10, 32, 80, 0.08)",
  } as const,
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #bbcdf8",
    padding: "10px 12px",
    fontSize: 14,
    marginTop: 6,
    boxSizing: "border-box",
  } as const,
  button: {
    borderRadius: 10,
    border: "none",
    background: "#1f66ff",
    color: "white",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  } as const,
};

export default function HomePage() {
  const [projectPath, setProjectPath] = useState("apps/api");
  const [excludeDirs, setExcludeDirs] = useState(
    "node_modules, dist, build, .next, .git, coverage",
  );
  const [graphDetailLevel, setGraphDetailLevel] = useState<"project" | "full">(
    "project",
  );
  const [includeSemantic, setIncludeSemantic] = useState(true);
  const [persist, setPersist] = useState(true);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  const [analysisRunId, setAnalysisRunId] = useState<string | undefined>();
  const [graph, setGraph] = useState<SerializedGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState("");
  const [simulation, setSimulation] = useState<SimulateResponse | null>(null);
  const [semantic, setSemantic] = useState<AnalyzeResponse["semanticInsights"]>(
    {
      businessRules: [],
      domainEntities: [],
      useCases: [],
      architectureSmells: [],
    },
  );

  const visibleGraph = useMemo(() => {
    if (!graph) {
      return null;
    }

    if (viewMode === "all") {
      return graph;
    }

    const allowedTypes = viewMode === "business" ? BUSINESS_NODE_TYPES : CODE_NODE_TYPES;
    const visibleNodes = graph.nodes.filter((node) => allowedTypes.has(node.type));
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = graph.edges.filter(
      (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
    );

    return {
      nodes: visibleNodes,
      edges: visibleEdges,
    };
  }, [graph, viewMode]);

  const nodes = useMemo(
    () => (visibleGraph ? toFlowNodes(visibleGraph.nodes) : []),
    [visibleGraph],
  );
  const edges = useMemo(
    () => (visibleGraph ? toFlowEdges(visibleGraph.edges) : []),
    [visibleGraph],
  );

  const runAnalyze = async () => {
    setAnalyzeLoading(true);
    setError(null);
    setSimulation(null);

    try {
      const parsedExcludeDirs = excludeDirs
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          excludeDirs: parsedExcludeDirs,
          graphDetailLevel,
          includeSemantic,
          persist,
        }),
      });
      console.log(response);

      if (!response.ok) {
        throw new Error(`Analyze failed (${response.status})`);
      }

      const payload = (await response.json()) as AnalyzeResponse;
      setGraph(payload.graph);
      setSemantic(payload.semanticInsights);
      setAnalysisRunId(payload.analysisRunId);
      setSelectedNode(payload.graph.nodes[0]?.id ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Analyze request failed.",
      );
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const runSimulation = async () => {
    if (!graph || !selectedNode) {
      return;
    }

    setSimulateLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graph,
          changedNodeId: selectedNode,
          analysisRunId,
          persist,
        }),
      });

      if (!response.ok) {
        throw new Error(`Simulation failed (${response.status})`);
      }

      setSimulation((await response.json()) as SimulateResponse);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Simulation request failed.",
      );
    } finally {
      setSimulateLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 34 }}>Impact Analysis Platform</h1>
        <p style={{ marginBottom: 0, fontSize: 16, maxWidth: 820 }}>
          Pipeline real conectado ao backend: análise estática, extração de
          regras, insights semânticos e simulação de impacto.
        </p>
      </section>

      <section style={styles.grid}>
        <article style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>Pipeline</h2>
          <label>
            Caminho do projeto para análise
            <input
              style={styles.input}
              value={projectPath}
              onChange={(event) => setProjectPath(event.target.value)}
            />
          </label>

          <label style={{ display: "block", marginTop: 10 }}>
            Pastas ignoradas (separadas por vírgula)
            <input
              style={styles.input}
              value={excludeDirs}
              onChange={(event) => setExcludeDirs(event.target.value)}
            />
          </label>

          <label style={{ display: "block", marginTop: 10 }}>
            Nível de detalhe do grafo
            <select
              style={styles.input}
              value={graphDetailLevel}
              onChange={(event) =>
                setGraphDetailLevel(event.target.value as "project" | "full")
              }
            >
              <option value="project">Somente projeto (rápido)</option>
              <option value="full">Completo (mais lento)</option>
            </select>
          </label>

          <label style={{ display: "block", marginTop: 10 }}>
            <input
              type="checkbox"
              checked={includeSemantic}
              onChange={(event) => setIncludeSemantic(event.target.checked)}
              style={{ marginRight: 8 }}
            />
            Habilitar insights de IA
          </label>

          <label style={{ display: "block", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={persist}
              onChange={(event) => setPersist(event.target.checked)}
              style={{ marginRight: 8 }}
            />
            Persistir em Postgres/Neo4j (quando configurado)
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              style={styles.button}
              onClick={runAnalyze}
              disabled={analyzeLoading}
            >
              {analyzeLoading ? "Analisando..." : "Executar análise"}
            </button>
            <button
              style={{ ...styles.button, background: "#375ea7" }}
              onClick={runSimulation}
              disabled={simulateLoading || !graph || !selectedNode}
            >
              {simulateLoading ? "Simulando..." : "Simular impacto"}
            </button>
          </div>

          {error ? (
            <p style={{ color: "#9b1c1c", marginTop: 12 }}>{error}</p>
          ) : null}
          {analysisRunId ? (
            <p style={{ marginTop: 12 }}>
              <strong>Analysis Run:</strong> {analysisRunId}
            </p>
          ) : null}
        </article>

        <article style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>Insights Semânticos</h2>
          <h3>Regras de negócio</h3>
          <ul>
            {semantic.businessRules.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Entidades de domínio</h3>
          <ul>
            {semantic.domainEntities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Casos de uso</h3>
          <ul>
            {semantic.useCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Smells arquiteturais</h3>
          <ul>
            {semantic.architectureSmells.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section style={{ ...styles.panel, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Mapa de Impacto</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          Visualização
          <select
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as ViewMode)}
            style={styles.input}
          >
            <option value="all">Completa (negócio + código)</option>
            <option value="business">Teórica de negócio</option>
            <option value="code">Código</option>
          </select>
        </label>
        <label>
          Nó alterado:
          <select
            value={selectedNode}
            onChange={(event) => setSelectedNode(event.target.value)}
            style={{ ...styles.input, marginLeft: 10, width: "auto" }}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.id}
              </option>
            ))}
          </select>
        </label>

        <div style={{ marginTop: 14 }}>
          {graph ? (
            <GraphExplorer nodes={nodes} edges={edges} />
          ) : (
            <p>Execute a análise para gerar o grafo.</p>
          )}
        </div>

        {simulation ? (
          <div style={{ marginTop: 16 }}>
            <p>
              <strong>Risco:</strong> {simulation.riskLevel}
            </p>
            <h3>Impactos diretos</h3>
            <ul>
              {simulation.directImpacts.map((node) => (
                <li key={node.id}>
                  {node.type}: {node.label}
                </li>
              ))}
            </ul>
            <h3>Impactos indiretos</h3>
            <ul>
              {simulation.indirectImpacts.map((node) => (
                <li key={node.id}>
                  {node.type}: {node.label}
                </li>
              ))}
            </ul>
            <h3>Áreas sugeridas para regressão</h3>
            <ul>
              {simulation.suggestedRegressionAreas.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {simulation.impactReportId ? (
              <p>
                <strong>Impact Report:</strong> {simulation.impactReportId}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
