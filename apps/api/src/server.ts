import Fastify from "fastify";
import cors from "@fastify/cors";
import { RepositoryImporter } from "@impact/repo-importer";
import { CodeAnalyzer } from "@impact/code-analyzer";
import { GraphBuilder } from "@impact/dependency-graph-builder";
import { ImpactSimulationEngine } from "@impact/impact-simulation-engine";
import fs from "node:fs/promises";

const app = Fastify({ logger: true });
const importer = new RepositoryImporter();
const analyzer = new CodeAnalyzer();
const graphBuilder = new GraphBuilder();

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

app.post<{ Body: { repositoryUrl: string; branch?: string } }>("/api/repos/import/github", async (request) => {
  const imported = await importer.fromGitHub(request.body.repositoryUrl, request.body.branch);
  return imported;
});

app.post<{ Body: { projectPath: string } }>("/api/analyze", async (request) => {
  const analysis = analyzer.analyze(request.body.projectPath);

  for (const file of analysis.files) {
    graphBuilder.upsertNode({
      id: `file:${file.filePath}`,
      type: "File",
      label: file.filePath,
      metadata: { imports: file.imports }
    });

    for (const importedPath of file.imports) {
      graphBuilder.upsertNode({
        id: `file:${importedPath}`,
        type: "File",
        label: importedPath,
        metadata: {}
      });
      graphBuilder.addEdge({
        from: `file:${file.filePath}`,
        to: `file:${importedPath}`,
        type: "depends_on"
      });
    }

    for (const endpoint of file.endpoints) {
      const endpointId = `endpoint:${file.filePath}:${endpoint}`;
      graphBuilder.upsertNode({
        id: endpointId,
        type: "Endpoint",
        label: endpoint,
        metadata: { filePath: file.filePath }
      });
      graphBuilder.addEdge({
        from: `file:${file.filePath}`,
        to: endpointId,
        type: "exposes_endpoint"
      });
    }
  }

  const graph = graphBuilder.serialize();
  return { analysis, graph };
});

app.post<{ Body: { graphPath: string; changedNodeId: string } }>("/api/simulate", async (request) => {
  const raw = await fs.readFile(request.body.graphPath, "utf8");
  const parsed = JSON.parse(raw) as { nodes: Array<any>; edges: Array<any> };
  const nodes = new Map(parsed.nodes.map((node) => [node.id, node]));

  const engine = new ImpactSimulationEngine(nodes, parsed.edges);
  return engine.simulate({ changedNodeId: request.body.changedNodeId });
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ host: "0.0.0.0", port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
