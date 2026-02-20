import Fastify from "fastify";
import cors from "@fastify/cors";
import path from "node:path";
import { CoreEngine } from "@impact/core";

interface AnalyzeRequest {
  projectPath: string;
}

interface SimulateRequest {
  projectPath: string;
  ruleId: string;
}

const app = Fastify({ logger: true });
const core = new CoreEngine();

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

app.post<{ Body: AnalyzeRequest }>("/api/analyze", async (request, reply) => {
  if (!request.body?.projectPath) {
    return reply.status(400).send({ message: "projectPath is required." });
  }

  try {
    const resolvedProjectPath = path.resolve(request.body.projectPath);
    const result = core.analyze(resolvedProjectPath);

    return {
      projectPath: resolvedProjectPath,
      parsedFilesCount: result.parsedFiles.length,
      semanticNodesCount: result.semantic.nodes.length,
      callGraphEdgesCount: result.semantic.callGraph.length,
      report: result.report,
    };
  } catch (error) {
    request.log.error({ error }, "Core analysis failed.");
    return reply
      .status(500)
      .send({ message: "Core analysis failed.", details: String(error) });
  }
});

app.post<{ Body: SimulateRequest }>("/api/simulate", async (request, reply) => {
  if (!request.body?.projectPath || !request.body?.ruleId) {
    return reply
      .status(400)
      .send({ message: "projectPath and ruleId are required." });
  }

  try {
    const resolvedProjectPath = path.resolve(request.body.projectPath);
    const impact = core.simulateRuleImpact(
      resolvedProjectPath,
      request.body.ruleId,
    );
    return {
      projectPath: resolvedProjectPath,
      ruleId: request.body.ruleId,
      impact,
    };
  } catch (error) {
    request.log.error({ error }, "Impact simulation failed.");
    return reply
      .status(500)
      .send({ message: "Impact simulation failed.", details: String(error) });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ host: "0.0.0.0", port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
