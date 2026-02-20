import Fastify from "fastify";
import cors from "@fastify/cors";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { RepositoryImporter } from "@impact/repo-importer";
import { CodeAnalyzer } from "@impact/code-analyzer";
import {
  GraphBuilder,
  type GraphEdge,
  type GraphNode,
} from "@impact/dependency-graph-builder";
import { ImpactSimulationEngine } from "@impact/impact-simulation-engine";
import { BusinessRuleExtractor } from "@impact/business-rule-extractor";
import { AISemanticLayer } from "@impact/ai-semantic-layer";
import { Pool } from "pg";
import neo4j, { type Driver } from "neo4j-driver";

function loadEnvFiles(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "apps/api/.env"),
    path.resolve(process.cwd(), "apps/api/.env.local"),
  ];

  for (const filePath of candidates) {
    if (!fsSync.existsSync(filePath)) {
      continue;
    }

    const content = fsSync.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separator = line.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

loadEnvFiles();
interface SerializedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface AnalyzeRequest {
  projectPath: string;
  excludeDirs?: string[];
  graphDetailLevel?: "project" | "full";
  repositoryId?: string;
  repositoryUrl?: string;
  includeSemantic?: boolean;
  persist?: boolean;
}

function isGitHubHttpUrl(value: string): boolean {
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(
    value.trim().replace(/\.git$/i, ""),
  );
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function extractTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

function pickRelatedFiles(
  files: { filePath: string }[],
  text: string,
  max = 4,
): string[] {
  const tokens = extractTokens(text);
  if (tokens.length === 0) {
    return files.slice(0, Math.min(2, files.length)).map((file) => file.filePath);
  }

  const scored = files
    .map((file) => {
      const lowerPath = file.filePath.toLowerCase();
      const score = tokens.filter((token) => lowerPath.includes(token)).length;
      return { filePath: file.filePath, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((item) => item.filePath);

  if (scored.length > 0) {
    return scored;
  }

  return files.slice(0, Math.min(2, files.length)).map((file) => file.filePath);
}

interface SimulateRequest {
  changedNodeId: string;
  graphPath?: string;
  graph?: SerializedGraph;
  analysisRunId?: string;
  persist?: boolean;
}

class PostgresPersistence {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS repositories (
        id UUID PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_url TEXT,
        default_branch TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS analysis_runs (
        id UUID PRIMARY KEY,
        repository_id UUID NOT NULL REFERENCES repositories(id),
        status TEXT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS impact_reports (
        id UUID PRIMARY KEY,
        analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id),
        changed_node_id TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        report_json JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  }

  async createRepository(
    sourceType: string,
    sourceUrl?: string,
    defaultBranch?: string,
  ): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO repositories (id, source_type, source_url, default_branch)
       VALUES ($1, $2, $3, $4)`,
      [id, sourceType, sourceUrl ?? null, defaultBranch ?? null],
    );
    return id;
  }

  async createAnalysisRun(repositoryId: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO analysis_runs (id, repository_id, status) VALUES ($1, $2, 'running')`,
      [id, repositoryId],
    );
    return id;
  }

  async finishAnalysisRun(
    analysisRunId: string,
    status: "completed" | "failed",
  ): Promise<void> {
    await this.pool.query(
      `UPDATE analysis_runs SET status = $1, finished_at = NOW() WHERE id = $2`,
      [status, analysisRunId],
    );
  }

  async saveImpactReport(
    analysisRunId: string,
    changedNodeId: string,
    riskLevel: string,
    report: unknown,
  ): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO impact_reports (id, analysis_run_id, changed_node_id, risk_level, report_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [id, analysisRunId, changedNodeId, riskLevel, JSON.stringify(report)],
    );
    return id;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class Neo4jPersistence {
  private readonly driver: Driver;

  constructor(uri: string, user: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  async init(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE`,
      );
    } finally {
      await session.close();
    }
  }

  async persistGraph(graph: SerializedGraph): Promise<void> {
    const session = this.driver.session();
    try {
      for (const node of graph.nodes) {
        const label = node.type.replace(/[^A-Za-z]/g, "") || "Entity";
        const query = `
          MERGE (n:Entity {id: $id})
          SET n:${label}
          SET n.type = $type, n.label = $label, n.metadata = $metadata
        `;

        await session.run(query, {
          id: node.id,
          type: node.type,
          label: node.label,
          metadata: JSON.stringify(node.metadata ?? {}),
        });
      }

      for (const edge of graph.edges) {
        const relation = edge.type.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        const query = `
          MATCH (a:Entity {id: $from}), (b:Entity {id: $to})
          MERGE (a)-[r:${relation}]->(b)
          SET r.metadata = $metadata
        `;

        await session.run(query, {
          from: edge.from,
          to: edge.to,
          metadata: JSON.stringify(edge.metadata ?? {}),
        });
      }
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}

const app = Fastify({ logger: true });
const importer = new RepositoryImporter();
const analyzer = new CodeAnalyzer();
const ruleExtractor = new BusinessRuleExtractor();
const aiSemanticLayer = new AISemanticLayer(process.env.OPENAI_API_KEY, {
  provider:
    (process.env.SEMANTIC_PROVIDER as
      | "openai"
      | "openai-compatible"
      | "heuristic"
      | undefined) ?? "openai",
  model: process.env.SEMANTIC_MODEL ?? "gpt-4.1-mini",
  baseUrl: process.env.OPENAI_BASE_URL,
});

let postgres: PostgresPersistence | undefined;
if (process.env.DATABASE_URL) {
  try {
    postgres = new PostgresPersistence(process.env.DATABASE_URL);
    await postgres.init();
    app.log.info("Postgres persistence enabled.");
  } catch (error) {
    app.log.warn(
      { error },
      "Postgres unavailable. Continuing without relational persistence.",
    );
    postgres = undefined;
  }
}

let neo4jStore: Neo4jPersistence | undefined;
if (
  process.env.NEO4J_URI &&
  process.env.NEO4J_USER &&
  process.env.NEO4J_PASSWORD
) {
  try {
    neo4jStore = new Neo4jPersistence(
      process.env.NEO4J_URI,
      process.env.NEO4J_USER,
      process.env.NEO4J_PASSWORD,
    );
    await neo4jStore.init();
    app.log.info("Neo4j persistence enabled.");
  } catch (error) {
    app.log.warn(
      { error },
      "Neo4j unavailable. Continuing without graph persistence.",
    );
    neo4jStore = undefined;
  }
}

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

app.post<{
  Body: { repositoryUrl: string; branch?: string; persist?: boolean };
}>("/api/repos/import/github", async (request) => {
  const imported = await importer.fromGitHub(
    request.body.repositoryUrl,
    request.body.branch,
  );

  let repositoryId: string | undefined;
  if ((request.body.persist ?? true) && postgres) {
    repositoryId = await postgres.createRepository(
      "github",
      request.body.repositoryUrl,
      request.body.branch ?? "main",
    );
  }

  return { ...imported, repositoryId };
});

app.post<{ Body: AnalyzeRequest }>("/api/analyze", async (request, reply) => {
  const persist = request.body.persist ?? true;
  const includeSemantic = request.body.includeSemantic ?? true;
  const graphDetailLevel = request.body.graphDetailLevel ?? "project";

  if (!request.body.projectPath) {
    return reply.status(400).send({ message: "projectPath is required." });
  }

  let analysisRunId: string | undefined;
  let repositoryId = request.body.repositoryId;
  let resolvedProjectPath = request.body.projectPath;
  const normalizedPathInput = request.body.projectPath.trim();
  const githubUrl = isGitHubHttpUrl(normalizedPathInput)
    ? normalizedPathInput.replace(/\.git$/i, "")
    : undefined;

  try {
    if (githubUrl) {
      const imported = await importer.fromGitHub(githubUrl);
      resolvedProjectPath = imported.localPath;
    }

    if (persist && postgres) {
      if (!repositoryId) {
        repositoryId = await postgres.createRepository(
          githubUrl ? "github" : "local",
          request.body.repositoryUrl ?? githubUrl ?? request.body.projectPath,
          "main",
        );
      }
      analysisRunId = await postgres.createAnalysisRun(repositoryId);
    }

    const analysis = analyzer.analyze(resolvedProjectPath, {
      excludeDirs: request.body.excludeDirs,
      onlyInternalImports: true,
    });
    const graphBuilder = new GraphBuilder();
    const analyzedFilePaths = new Set(analysis.files.map((file) => file.filePath));

    for (const file of analysis.files) {
      const fileId = `file:${file.filePath}`;
      graphBuilder.upsertNode({
        id: fileId,
        type: "File",
        label: file.filePath,
        metadata: {
          importsCount: file.imports.length,
          exportedFunctionsCount: file.exportedFunctions.length,
          databaseInteractionsCount: file.databaseInteractions.length,
        },
      });

      for (const importedPath of file.imports) {
        if (!analyzedFilePaths.has(importedPath)) {
          continue;
        }

        const importedId = `file:${importedPath}`;
        graphBuilder.upsertNode({
          id: importedId,
          type: "File",
          label: importedPath,
          metadata: {},
        });
        graphBuilder.addEdge({
          from: fileId,
          to: importedId,
          type: "depends_on",
        });
      }

      if (graphDetailLevel === "full") {
        for (const endpoint of file.endpoints) {
          const endpointId = `endpoint:${file.filePath}:${endpoint}`;
          graphBuilder.upsertNode({
            id: endpointId,
            type: "Endpoint",
            label: endpoint,
            metadata: { filePath: file.filePath },
          });
          graphBuilder.addEdge({
            from: fileId,
            to: endpointId,
            type: "exposes_endpoint",
          });
        }
      }

      if (graphDetailLevel !== "full") {
        continue;
      }

      const sourceCode = await fs
        .readFile(file.filePath, "utf8")
        .catch(() => "");
      if (!sourceCode) {
        continue;
      }

      const rules = ruleExtractor.extract({
        filePath: file.filePath,
        sourceCode,
      });
      for (const rule of rules) {
        const ruleId = `rule:${rule.id}`;
        graphBuilder.upsertNode({
          id: ruleId,
          type: "BusinessRule",
          label: rule.expression,
          metadata: {
            confidence: rule.confidence,
            sourceFile: rule.sourceFile,
          },
        });
        graphBuilder.addEdge({
          from: fileId,
          to: ruleId,
          type: "implements_rule",
        });
      }
    }

    let semanticInsights = {
      businessRules: [] as string[],
      domainEntities: [] as string[],
      useCases: [] as string[],
      architectureSmells: [] as string[],
    };

    if (includeSemantic) {
      const repositorySummary = `Project path: ${request.body.projectPath}. Resolved path: ${resolvedProjectPath}. Files analyzed: ${analysis.files.length}.`;
      const codeSnippet = analysis.files
        .slice(0, 30)
        .map(
          (file) =>
            `${file.filePath}\nimports: ${file.imports.join(", ")}\nendpoints: ${file.endpoints.join(" | ")}`,
        )
        .join("\n\n")
        .slice(0, 12000);

      semanticInsights = await aiSemanticLayer.analyze({
        repositorySummary,
        codeSnippet,
      });

      const semanticBusinessRuleIds: string[] = [];
      const semanticEntityIds: string[] = [];
      const semanticUseCaseIds: string[] = [];
      const semanticSmellIds: string[] = [];

      for (const [index, rule] of semanticInsights.businessRules.entries()) {
        const id = `semantic-rule:${slugify(rule)}:${index}`;
        semanticBusinessRuleIds.push(id);
        graphBuilder.upsertNode({
          id,
          type: "BusinessRule",
          label: rule,
          metadata: { source: "ai-semantic-layer", confidence: 0.5 },
        });

        for (const filePath of pickRelatedFiles(analysis.files, rule, 4)) {
          graphBuilder.addEdge({
            from: id,
            to: `file:${filePath}`,
            type: "relates_to",
          });
        }
      }

      for (const entity of semanticInsights.domainEntities) {
        const id = `entity:${slugify(entity)}`;
        semanticEntityIds.push(id);
        graphBuilder.upsertNode({
          id,
          type: "DomainEntity",
          label: entity,
          metadata: { source: "ai-semantic-layer" },
        });

        for (const filePath of pickRelatedFiles(analysis.files, entity, 3)) {
          graphBuilder.addEdge({
            from: id,
            to: `file:${filePath}`,
            type: "relates_to",
          });
        }
      }

      for (const useCase of semanticInsights.useCases) {
        const id = `usecase:${slugify(useCase)}`;
        semanticUseCaseIds.push(id);
        graphBuilder.upsertNode({
          id,
          type: "UseCase",
          label: useCase,
          metadata: { source: "ai-semantic-layer" },
        });

        for (const filePath of pickRelatedFiles(analysis.files, useCase, 3)) {
          graphBuilder.addEdge({
            from: id,
            to: `file:${filePath}`,
            type: "relates_to",
          });
        }
      }

      for (const [index, smell] of semanticInsights.architectureSmells.entries()) {
        const id = `smell:${slugify(smell)}:${index}`;
        semanticSmellIds.push(id);
        graphBuilder.upsertNode({
          id,
          type: "ArchitectureSmell",
          label: smell,
          metadata: { source: "ai-semantic-layer" },
        });

        for (const filePath of pickRelatedFiles(analysis.files, smell, 3)) {
          graphBuilder.addEdge({
            from: id,
            to: `file:${filePath}`,
            type: "relates_to",
          });
        }
      }

      for (const useCaseId of semanticUseCaseIds) {
        for (const entityId of semanticEntityIds.slice(0, 6)) {
          graphBuilder.addEdge({
            from: useCaseId,
            to: entityId,
            type: "relates_to",
          });
        }
        for (const ruleId of semanticBusinessRuleIds.slice(0, 6)) {
          graphBuilder.addEdge({
            from: useCaseId,
            to: ruleId,
            type: "relates_to",
          });
        }
      }

      for (const smellId of semanticSmellIds) {
        for (const useCaseId of semanticUseCaseIds.slice(0, 6)) {
          graphBuilder.addEdge({
            from: smellId,
            to: useCaseId,
            type: "relates_to",
          });
        }
      }
    }

    const graph = graphBuilder.serialize();

    if (persist && neo4jStore) {
      await neo4jStore.persistGraph(graph);
    }

    if (analysisRunId && postgres) {
      await postgres.finishAnalysisRun(analysisRunId, "completed");
    }

    return {
      repositoryId,
      analysisRunId,
      analysis,
      semanticInsights,
      graph,
    };
  } catch (error) {
    console.log(error);

    if (analysisRunId && postgres) {
      await postgres
        .finishAnalysisRun(analysisRunId, "failed")
        .catch(() => undefined);
    }

    app.log.error({ error }, "Analysis pipeline failed.");
    return reply
      .status(500)
      .send({ message: "Analysis pipeline failed.", details: String(error) });
  }
});

app.post<{ Body: SimulateRequest }>("/api/simulate", async (request, reply) => {
  const persist = request.body.persist ?? true;

  let graph: SerializedGraph | undefined = request.body.graph;
  if (!graph && request.body.graphPath) {
    const raw = await fs.readFile(request.body.graphPath, "utf8");
    graph = JSON.parse(raw) as SerializedGraph;
  }

  if (!graph) {
    return reply.status(400).send({ message: "Provide graph or graphPath." });
  }

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const engine = new ImpactSimulationEngine(nodes, graph.edges);
  const result = engine.simulate({ changedNodeId: request.body.changedNodeId });

  let impactReportId: string | undefined;
  if (persist && postgres && request.body.analysisRunId) {
    impactReportId = await postgres.saveImpactReport(
      request.body.analysisRunId,
      request.body.changedNodeId,
      result.riskLevel,
      result,
    );
  }

  return { ...result, impactReportId };
});

app.addHook("onClose", async () => {
  await Promise.allSettled([postgres?.close(), neo4jStore?.close()]);
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ host: "0.0.0.0", port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});


