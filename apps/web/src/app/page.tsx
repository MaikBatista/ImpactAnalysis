"use client";

import { useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import { GraphExplorer } from "../components/graph-explorer";

interface FlowDefinition {
  id: string;
  name: string;
  objective: string;
  owner: string;
  status: "draft" | "validated" | "production";
}

interface AnalysisResult {
  links: string[];
  rules: string[];
  impacts: string[];
}

const baseNodes: Node[] = [
  { id: "file:user-service.ts", position: { x: 50, y: 50 }, data: { label: "User Service" } },
  { id: "endpoint:users_get", position: { x: 350, y: 40 }, data: { label: "GET /users" } },
  { id: "table:users", position: { x: 350, y: 180 }, data: { label: "users table" } },
  { id: "rule:premium-check", position: { x: 650, y: 120 }, data: { label: "Premium Eligibility Rule" } }
];

const baseEdges: Edge[] = [
  { id: "a", source: "file:user-service.ts", target: "endpoint:users_get", label: "exposes_endpoint" },
  { id: "b", source: "file:user-service.ts", target: "table:users", label: "reads_from" },
  { id: "c", source: "endpoint:users_get", target: "rule:premium-check", label: "implements_rule" }
];

const defaultFlows: FlowDefinition[] = [
  {
    id: "flow-onboarding",
    name: "Onboarding do Cliente",
    objective: "Criar conta, validar elegibilidade e liberar trial.",
    owner: "Time de Growth",
    status: "production"
  },
  {
    id: "flow-billing",
    name: "Cobrança Recorrente",
    objective: "Fechar ciclo de faturamento e notificar falhas de pagamento.",
    owner: "Time Financeiro",
    status: "validated"
  }
];

const statusLabel: Record<FlowDefinition["status"], string> = {
  draft: "Rascunho",
  validated: "Validado",
  production: "Produção"
};

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px 32px 40px",
    background: "linear-gradient(180deg, #f5f7ff 0%, #f8fbff 48%, #eef4ff 100%)",
    color: "#112245"
  } as const,
  header: {
    background: "linear-gradient(135deg, #142f6a 0%, #2468d1 45%, #4d8cff 100%)",
    borderRadius: 18,
    color: "#ffffff",
    padding: "24px 28px",
    boxShadow: "0 14px 36px rgba(15, 43, 99, 0.2)",
    marginBottom: 20
  } as const,
  grid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
  } as const,
  panel: {
    background: "#ffffff",
    border: "1px solid #dbe6ff",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 8px 20px rgba(10, 32, 80, 0.08)"
  } as const,
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #bbcdf8",
    padding: "10px 12px",
    fontSize: 14,
    marginTop: 6,
    boxSizing: "border-box"
  } as const,
  button: {
    borderRadius: 10,
    border: "none",
    background: "#1f66ff",
    color: "white",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer"
  } as const
};

function buildAnalysis(repoUrl: string, snippet: string, flows: FlowDefinition[]): AnalysisResult {
  const normalizedSnippet = snippet.toLowerCase();

  const links = [
    repoUrl ? `Repositório monitorado: ${repoUrl}` : "Análise local sem URL de repositório externo.",
    "Ligação detectada: endpoint users_get depende da regra premium-check.",
    flows.length ? `Fluxos mapeados na tela: ${flows.map((flow) => flow.name).join(", ")}.` : "Nenhum fluxo mapeado ainda."
  ];

  const rules = [
    normalizedSnippet.includes("premium")
      ? "Regra inferida: cliente premium recebe fallback prioritário em falhas críticas."
      : "Regra inferida: validação de cadastro acontece antes da gravação no banco.",
    normalizedSnippet.includes("invoice")
      ? "Regra inferida: emissão de cobrança exige status de assinatura ativo."
      : "Regra inferida: alterações em usuários afetam trilha de auditoria.",
    "Regra inferida: mudanças em endpoints públicos exigem revisão de contrato e testes de regressão."
  ];

  const impacts = [
    "Impacto alto em API pública e integrações downstream quando regras de elegibilidade mudam.",
    "Impacto médio em jornadas de onboarding por dependência entre serviço de usuários e faturamento.",
    "Impacto potencial em dashboards operacionais que consomem dados da tabela users."
  ];

  return { links, rules, impacts };
}

export default function HomePage() {
  const [flows, setFlows] = useState<FlowDefinition[]>(defaultFlows);
  const [selectedNode, setSelectedNode] = useState("table:users");
  const [repoUrl, setRepoUrl] = useState("https://github.com/exemplo/meu-repo");
  const [codeSnippet, setCodeSnippet] = useState(
    "function canActivatePremium(user) {\n  return user.plan === 'premium' && user.score > 70;\n}"
  );
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowObjective, setNewFlowObjective] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult>(() => buildAnalysis(repoUrl, codeSnippet, defaultFlows));

  const nodes = useMemo<Node[]>(() => {
    const flowNodes = flows.map((flow, index) => ({
      id: `flow:${flow.id}`,
      position: { x: 920, y: 60 + index * 140 },
      data: { label: `Fluxo: ${flow.name}` }
    }));

    return [...baseNodes, ...flowNodes];
  }, [flows]);

  const edges = useMemo<Edge[]>(() => {
    const flowEdges = flows.map((flow, index) => ({
      id: `flow-edge-${flow.id}`,
      source: "endpoint:users_get",
      target: `flow:${flow.id}`,
      label: index % 2 === 0 ? "supports_flow" : "feeds_journey"
    }));

    return [...baseEdges, ...flowEdges];
  }, [flows]);

  const impact = useMemo(
    () =>
      edges
        .filter((edge) => edge.source === selectedNode || edge.target === selectedNode)
        .map((edge) => `${edge.source} -> ${edge.target} (${edge.label})`),
    [edges, selectedNode]
  );

  const createFlow = () => {
    if (!newFlowName.trim() || !newFlowObjective.trim()) {
      return;
    }

    const created: FlowDefinition = {
      id: `${newFlowName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: newFlowName.trim(),
      objective: newFlowObjective.trim(),
      owner: "Time de Produto",
      status: "draft"
    };

    setFlows((previous) => [...previous, created]);
    setNewFlowName("");
    setNewFlowObjective("");
  };

  const cycleFlowStatus = (flowId: string) => {
    setFlows((previous) =>
      previous.map((flow) => {
        if (flow.id !== flowId) {
          return flow;
        }

        const nextStatus: FlowDefinition["status"] =
          flow.status === "draft" ? "validated" : flow.status === "validated" ? "production" : "draft";

        return { ...flow, status: nextStatus };
      })
    );
  };

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 34 }}>Impact Analysis Platform</h1>
        <p style={{ marginBottom: 0, fontSize: 16, maxWidth: 820 }}>
          Edite e crie fluxos direto nas telas, conecte um repositório GitHub ou trechos de código e use IA para mapear
          vínculos, regras de negócio e prever impactos de mudanças antes de colocar em produção.
        </p>
      </section>

      <section style={styles.grid}>
        <article style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>Workspace IA</h2>
          <label>
            URL do repositório GitHub
            <input style={styles.input} value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
          </label>
          <label style={{ display: "block", marginTop: 12 }}>
            Cole um trecho do código para análise semântica
            <textarea
              style={{ ...styles.input, minHeight: 130, resize: "vertical" }}
              value={codeSnippet}
              onChange={(event) => setCodeSnippet(event.target.value)}
            />
          </label>
          <button style={{ ...styles.button, marginTop: 12 }} onClick={() => setAnalysis(buildAnalysis(repoUrl, codeSnippet, flows))}>
            Executar leitura com IA
          </button>

          <div style={{ marginTop: 14 }}>
            <h3 style={{ marginBottom: 4 }}>Vínculos identificados</h3>
            <ul>
              {analysis.links.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 style={{ marginBottom: 4 }}>Regras de negócio detectadas</h3>
            <ul>
              {analysis.rules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>

        <article style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>Editor de Fluxos</h2>
          <p style={{ marginTop: 0 }}>Crie, ajuste e promova fluxos entre rascunho, validado e produção.</p>

          <label>
            Nome do fluxo
            <input style={styles.input} value={newFlowName} onChange={(event) => setNewFlowName(event.target.value)} />
          </label>
          <label style={{ display: "block", marginTop: 10 }}>
            Objetivo de negócio
            <textarea
              style={{ ...styles.input, minHeight: 82 }}
              value={newFlowObjective}
              onChange={(event) => setNewFlowObjective(event.target.value)}
            />
          </label>
          <button style={{ ...styles.button, marginTop: 10 }} onClick={createFlow}>
            Criar novo fluxo
          </button>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {flows.map((flow) => (
              <div
                key={flow.id}
                style={{ border: "1px solid #d6e2ff", borderRadius: 12, padding: 10, background: "#f8fbff" }}
              >
                <strong>{flow.name}</strong>
                <p style={{ margin: "6px 0" }}>{flow.objective}</p>
                <small>
                  Dono: {flow.owner} • Status: {statusLabel[flow.status]}
                </small>
                <div>
                  <button
                    style={{ ...styles.button, marginTop: 8, background: "#375ea7", padding: "8px 12px", fontSize: 13 }}
                    onClick={() => cycleFlowStatus(flow.id)}
                  >
                    Mudar status
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ ...styles.panel, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Mapa de Impacto e Simulação</h2>
        <p style={{ marginTop: 0 }}>
          Visualize dependências técnicas e funcionais em tempo real. Selecione um nó para ver o blast radius da mudança.
        </p>

        <label>
          Nó para simular impacto:
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
          <GraphExplorer nodes={nodes} edges={edges} />
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <h3 style={{ marginBottom: 0 }}>Impactos prováveis</h3>
          <ul style={{ marginTop: 4 }}>
            {impact.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3 style={{ marginBottom: 0 }}>Insights da IA para regressão</h3>
          <ul style={{ marginTop: 4 }}>
            {analysis.impacts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
