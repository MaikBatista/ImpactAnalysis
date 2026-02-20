"use client";

import { useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import { GraphExplorer } from "../components/graph-explorer";

type DomainEntity = {
  name: string;
  properties: string[];
  methods: string[];
  stateFields: string[];
  filePath: string;
};

type DomainRelation = {
  from: string;
  to: string;
  type: "CALLS" | "DEPENDS_ON" | "MODIFIES" | "USES";
};

type BusinessRuleType =
  | "INVARIANT"
  | "POLICY"
  | "CALCULATION"
  | "STATE_TRANSITION"
  | "CONTEXT_RESTRICTION";

type BusinessRule = {
  id: string;
  type: BusinessRuleType;
  entity?: string;
  method?: string;
  filePath: string;
  condition: string;
  consequence: string;
  astLocation: {
    start: number;
    end: number;
  };
  confidence: number;
};

type ImpactNode = {
  id: string;
  type: "ENTITY" | "RULE" | "FILE" | "METHOD";
  riskScore: number;
};

type ImpactResult = {
  rootRule: BusinessRule;
  impactedNodes: ImpactNode[];
  globalRiskScore: number;
  explanation: {
    fanOut: number;
    callDepth: number;
    affectedFiles: number;
    affectedEntities: number;
    crossLayerViolations: number;
  };
};

type AnalyzeResponse = {
  projectPath: string;
  parsedFilesCount: number;
  semanticNodesCount: number;
  callGraphEdgesCount: number;
  report: {
    entities: DomainEntity[];
    relations: DomainRelation[];
    rules: BusinessRule[];
    impact: ImpactResult | null;
    architecturalViolations: Array<{
      id: string;
      type: string;
      message: string;
      filePath?: string;
      relatedIds: string[];
    }>;
  };
};

type SimulateResponse = {
  projectPath: string;
  ruleId: string;
  impact: ImpactResult;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function short(value: string, max = 58): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function safeId(text: string): string {
  return text.replace(/[^a-zA-Z0-9_:.#/-]/g, "_");
}

function buildGraph(report: AnalyzeResponse["report"]): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, Node>();
  const edgeMap = new Map<string, Edge>();

  for (const entity of report.entities) {
    const id = `entity:${entity.name}`;
    nodeMap.set(id, {
      id,
      position: { x: 0, y: 0 },
      data: { label: `${entity.name}\n${entity.filePath}`, kind: "ENTITY" },
    });
  }

  for (const rule of report.rules) {
    const id = `rule:${safeId(rule.id)}`;
    nodeMap.set(id, {
      id,
      position: { x: 0, y: 0 },
      data: {
        label: `${rule.type} (${rule.confidence})\n${rule.entity ?? "<no-entity>"}.${rule.method ?? "<no-method>"}`,
        kind: "RULE",
      },
    });

    if (rule.entity) {
      const entityId = `entity:${rule.entity}`;
      if (nodeMap.has(entityId)) {
        const edgeId = `rule-entity:${id}:${entityId}`;
        edgeMap.set(edgeId, {
          id: edgeId,
          source: id,
          target: entityId,
          label: "BELONGS_TO",
        });
      }
    }

    if (rule.method && rule.entity) {
      const methodId = `method:${rule.entity}.${rule.method}`;
      if (!nodeMap.has(methodId)) {
        nodeMap.set(methodId, {
          id: methodId,
          position: { x: 0, y: 0 },
          data: { label: `${rule.entity}.${rule.method}`, kind: "METHOD" },
        });
      }
      const edgeId = `rule-method:${id}:${methodId}`;
      edgeMap.set(edgeId, {
        id: edgeId,
        source: id,
        target: methodId,
        label: "EXECUTES_IN",
      });
    }
  }

  for (const relation of report.relations) {
    const fromKind = relation.from.includes(".") || relation.from.includes("#") ? "METHOD" : "FILE";
    const toKind = relation.to.includes(".") || relation.to.includes("#") ? "METHOD" : "FILE";

    const fromId = `${fromKind.toLowerCase()}:${safeId(relation.from)}`;
    const toId = `${toKind.toLowerCase()}:${safeId(relation.to)}`;

    if (!nodeMap.has(fromId)) {
      nodeMap.set(fromId, {
        id: fromId,
        position: { x: 0, y: 0 },
        data: { label: short(relation.from), kind: fromKind },
      });
    }

    if (!nodeMap.has(toId)) {
      nodeMap.set(toId, {
        id: toId,
        position: { x: 0, y: 0 },
        data: { label: short(relation.to), kind: toKind },
      });
    }

    const edgeId = `${relation.type}:${fromId}:${toId}`;
    edgeMap.set(edgeId, {
      id: edgeId,
      source: fromId,
      target: toId,
      label: relation.type,
    });
  }

  const nodes = [...nodeMap.values()].map((node, index) => ({
    ...node,
    position: {
      x: 40 + (index % 6) * 260,
      y: 40 + Math.floor(index / 6) * 150,
    },
  }));

  return { nodes, edges: [...edgeMap.values()] };
}

const styles = {
  page: {
    padding: "24px 28px 36px",
    minHeight: "100vh",
  } as const,
  hero: {
    border: "1px solid #ccbda6",
    borderRadius: 18,
    padding: "22px 24px",
    background:
      "linear-gradient(145deg, rgba(36,93,87,0.94) 0%, rgba(173,110,47,0.9) 100%)",
    color: "#f7f3e8",
    boxShadow: "0 16px 34px rgba(61,49,33,0.25)",
  } as const,
  grid: {
    marginTop: 16,
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  } as const,
  card: {
    border: "1px solid #d6c8b1",
    borderRadius: 14,
    padding: 14,
    background: "#fbf7ee",
    boxShadow: "0 8px 20px rgba(58,47,34,0.1)",
  } as const,
  input: {
    width: "100%",
    border: "1px solid #c9b79d",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#fffdf8",
    color: "#1e2a24",
    fontSize: 14,
    marginTop: 6,
  } as const,
  button: {
    border: "1px solid #1e4b45",
    borderRadius: 10,
    padding: "10px 14px",
    background: "#245d57",
    color: "#f7f3e8",
    fontWeight: 700,
    cursor: "pointer",
  } as const,
};

export default function HomePage() {
  const [projectPath, setProjectPath] = useState("apps/api");
  const [ruleId, setRuleId] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingSimulate, setLoadingSimulate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [simulation, setSimulation] = useState<SimulateResponse | null>(null);

  const flow = useMemo(
    () => (analysis ? buildGraph(analysis.report) : { nodes: [], edges: [] }),
    [analysis],
  );

  const impactedNodeIds = useMemo(() => {
    if (!simulation) {
      return new Set<string>();
    }

    const set = new Set<string>();
    for (const node of simulation.impact.impactedNodes) {
      if (node.type === "RULE") {
        set.add(`rule:${safeId(node.id)}`);
      } else if (node.type === "ENTITY") {
        set.add(`entity:${node.id}`);
      } else if (node.type === "METHOD") {
        set.add(`method:${safeId(node.id)}`);
      } else {
        set.add(`file:${safeId(node.id)}`);
      }
    }
    return set;
  }, [simulation]);

  const selectedRule = useMemo(
    () => analysis?.report.rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [analysis, selectedRuleId],
  );

  const highlightedNodeIds = useMemo(() => {
    const merged = new Set<string>(impactedNodeIds);
    if (!selectedRule) {
      return merged;
    }

    merged.add(`rule:${safeId(selectedRule.id)}`);
    if (selectedRule.entity) {
      merged.add(`entity:${selectedRule.entity}`);
    }
    if (selectedRule.entity && selectedRule.method) {
      merged.add(`method:${safeId(`${selectedRule.entity}.${selectedRule.method}`)}`);
    }
    return merged;
  }, [impactedNodeIds, selectedRule]);

  const runAnalyze = async () => {
    setLoadingAnalyze(true);
    setError(null);
    setSimulation(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      });

      if (!response.ok) {
        throw new Error(`Analyze failed (${response.status})`);
      }

      const payload = (await response.json()) as AnalyzeResponse;
      setAnalysis(payload);
      setRuleId(payload.report.rules[0]?.id ?? "");
      setSelectedRuleId(payload.report.rules[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analyze falhou.");
    } finally {
      setLoadingAnalyze(false);
    }
  };

  const runSimulation = async () => {
    if (!ruleId) {
      return;
    }

    setLoadingSimulate(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, ruleId }),
      });

      if (!response.ok) {
        throw new Error(`Simulate failed (${response.status})`);
      }

      setSimulation((await response.json()) as SimulateResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation falhou.");
    } finally {
      setLoadingSimulate(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <h1 style={{ margin: 0, fontSize: 34 }}>ImpactAnalysis Core Visualizer</h1>
        <p style={{ margin: "8px 0 0", fontSize: 16, maxWidth: 900 }}>
          Visualização do núcleo determinístico: entidades de domínio, regras formais,
          relações estruturais e simulação de impacto por <span className="mono">ruleId</span>.
        </p>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Pipeline</h2>
          <label>
            Projeto alvo
            <input
              style={styles.input}
              value={projectPath}
              onChange={(event) => setProjectPath(event.target.value)}
            />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={styles.button} onClick={runAnalyze} disabled={loadingAnalyze}>
              {loadingAnalyze ? "Analisando..." : "Executar análise"}
            </button>
          </div>

          {analysis ? (
            <div style={{ marginTop: 12, fontSize: 14 }}>
              <div>Arquivos parseados: <strong>{analysis.parsedFilesCount}</strong></div>
              <div>Nós semânticos: <strong>{analysis.semanticNodesCount}</strong></div>
              <div>Arestas call graph: <strong>{analysis.callGraphEdgesCount}</strong></div>
              <div>Entidades: <strong>{analysis.report.entities.length}</strong></div>
              <div>Regras: <strong>{analysis.report.rules.length}</strong></div>
              <div>Relações: <strong>{analysis.report.relations.length}</strong></div>
            </div>
          ) : null}
        </article>

        <article style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Simulação</h2>
          <label>
            Regra para simular
            <select
              style={styles.input}
              value={ruleId}
              onChange={(event) => {
                setRuleId(event.target.value);
                setSelectedRuleId(event.target.value);
              }}
              disabled={!analysis || analysis.report.rules.length === 0}
            >
              {analysis?.report.rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.type} | {rule.entity ?? "<no-entity>"} | {rule.id}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              style={{ ...styles.button, background: "#ad6e2f", borderColor: "#7b4f22" }}
              onClick={runSimulation}
              disabled={loadingSimulate || !ruleId}
            >
              {loadingSimulate ? "Simulando..." : "Simular impacto"}
            </button>
          </div>

          {simulation ? (
            <div style={{ marginTop: 12, fontSize: 14 }}>
              <div>
                Risco global: <strong>{simulation.impact.globalRiskScore}</strong>
              </div>
              <div>
                Fan-out: <strong>{simulation.impact.explanation.fanOut}</strong>
              </div>
              <div>
                Profundidade: <strong>{simulation.impact.explanation.callDepth}</strong>
              </div>
              <div>
                Arquivos afetados: <strong>{simulation.impact.explanation.affectedFiles}</strong>
              </div>
              <div>
                Entidades afetadas: <strong>{simulation.impact.explanation.affectedEntities}</strong>
              </div>
              <div>
                Violações cross-layer: <strong>{simulation.impact.explanation.crossLayerViolations}</strong>
              </div>
            </div>
          ) : null}
        </article>

        <article style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Regras (Formal)</h2>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th align="left">Tipo</th>
                  <th align="left">Entidade</th>
                  <th align="left">Método</th>
                  <th align="left">Conf</th>
                </tr>
              </thead>
              <tbody>
                {analysis?.report.rules.map((rule) => (
                  <tr
                    key={rule.id}
                    onClick={() => {
                      setSelectedRuleId(rule.id);
                      setRuleId(rule.id);
                    }}
                    style={{
                      cursor: "pointer",
                      background:
                        selectedRuleId === rule.id ? "rgba(173,110,47,0.16)" : "transparent",
                    }}
                  >
                    <td>{rule.type}</td>
                    <td>{rule.entity ?? "-"}</td>
                    <td>{rule.method ?? "-"}</td>
                    <td>{rule.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Rule Detail</h2>
        {selectedRule ? (
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <div><strong>ID:</strong> <span className="mono">{selectedRule.id}</span></div>
            <div><strong>Type:</strong> {selectedRule.type}</div>
            <div><strong>Entity:</strong> {selectedRule.entity ?? "-"}</div>
            <div><strong>Method:</strong> {selectedRule.method ?? "-"}</div>
            <div><strong>File:</strong> <span className="mono">{selectedRule.filePath}</span></div>
            <div><strong>AST Location:</strong> start {selectedRule.astLocation.start}, end {selectedRule.astLocation.end}</div>
            <div><strong>Confidence:</strong> {selectedRule.confidence}</div>
            <div>
              <strong>Condition:</strong>
              <pre
                style={{
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  background: "#f2ecdf",
                  border: "1px solid #d7c9af",
                  overflow: "auto",
                }}
              >
                {selectedRule.condition}
              </pre>
            </div>
            <div>
              <strong>Consequence:</strong>
              <pre
                style={{
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  background: "#f2ecdf",
                  border: "1px solid #d7c9af",
                  overflow: "auto",
                }}
              >
                {selectedRule.consequence}
              </pre>
            </div>
          </div>
        ) : (
          <p>Selecione uma regra na tabela para ver os detalhes.</p>
        )}
      </section>

      {error ? (
        <p style={{ color: "#9a2d26", marginTop: 12 }}>
          <strong>Erro:</strong> {error}
        </p>
      ) : null}

      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Grafo Estrutural</h2>
        {analysis ? (
          <GraphExplorer
            nodes={flow.nodes}
            edges={flow.edges}
            impactedNodeIds={highlightedNodeIds}
          />
        ) : (
          <p>Execute a análise para visualizar entidades, regras e relações.</p>
        )}
      </section>
    </main>
  );
}
