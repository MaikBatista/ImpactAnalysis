import fs from "node:fs/promises";
import path from "node:path";
import { CodeAnalyzer } from "@impact/code-analyzer";
import { GraphBuilder } from "@impact/dependency-graph-builder";
import { ImpactSimulationEngine } from "@impact/impact-simulation-engine";

async function main() {
  const projectPath = path.resolve("apps/api");
  const analyzer = new CodeAnalyzer();
  const analysis = analyzer.analyze(projectPath);
  const graph = new GraphBuilder();

  for (const file of analysis.files) {
    graph.upsertNode({
      id: `file:${file.filePath}`,
      type: "File",
      label: path.basename(file.filePath),
      metadata: file
    });

    for (const dependency of file.imports) {
      const dependencyId = `file:${dependency}`;
      graph.upsertNode({
        id: dependencyId,
        type: "File",
        label: dependency,
        metadata: {}
      });
      graph.addEdge({ from: `file:${file.filePath}`, to: dependencyId, type: "depends_on" });
    }
  }

  const serialized = graph.serialize();
  await fs.writeFile("docs/example-graph.json", JSON.stringify(serialized, null, 2));

  const simulator = new ImpactSimulationEngine(new Map(serialized.nodes.map((node) => [node.id, node])), serialized.edges);
  const firstNode = serialized.nodes[0]?.id;
  if (firstNode) {
    const result = simulator.simulate({ changedNodeId: firstNode });
    await fs.writeFile("docs/example-impact-report.json", JSON.stringify(result, null, 2));
  }

  console.log(`Analyzed ${analysis.files.length} files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
