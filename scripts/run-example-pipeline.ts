import fs from "node:fs/promises";
import path from "node:path";
import { CoreEngine } from "../core/index.js";

async function main() {
  const projectPath = path.resolve("apps/api");
  const engine = new CoreEngine();

  const result = engine.analyze(projectPath);

  await fs.writeFile(
    "docs/example-impact-report.json",
    JSON.stringify(result.report, null, 2),
    "utf8",
  );

  const semanticSnapshot = {
    nodes: result.semantic.nodes.map((node) => ({
      kind: node.kind,
      symbol: node.symbol,
      type: node.type,
      filePath: node.filePath,
      astLocation: {
        start: node.astNode.getStart(),
        end: node.astNode.getEnd(),
      },
    })),
    callGraph: result.semantic.callGraph,
  };

  await fs.writeFile(
    "docs/example-graph.json",
    JSON.stringify(semanticSnapshot, null, 2),
    "utf8",
  );

  console.log(`Parsed files: ${result.parsedFiles.length}`);
  console.log(`Domain entities: ${result.report.entities.length}`);
  console.log(`Business rules: ${result.report.rules.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
