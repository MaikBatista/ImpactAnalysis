# Impact Analysis Platform

Production-oriented monorepo for repository intelligence, business-rule mining, architecture graphing, and change-impact simulation.

## Monorepo Structure

```txt
apps/
  web/                        # Next.js + ReactFlow graph explorer and simulation UI
  api/                        # Fastify API gateway
services/
  repo-importer/              # GitHub and ZIP ingestion
  code-analyzer/              # AST/static analysis and dependency extraction
  business-rule-extractor/    # Heuristic business rule extraction
  dependency-graph-builder/   # Canonical graph model and builder
  impact-simulation-engine/   # Blast-radius / risk scoring
  ai-semantic-layer/          # LLM-backed semantic intelligence
infra/
  docker/                     # Dockerfiles + Compose stack
  terraform/                  # Cloud baseline (ECS)
  ci/                         # GitHub Actions CI pipeline
docs/
  api-routes.md
  database-schema.sql
  graph-schema.cypher
scripts/
  run-example-pipeline.ts
```

## Architecture

### Backend
- **API (Fastify)** orchestrates import, analysis, graph generation, and simulation.
- **Ingestion service** supports Git clone and ZIP extraction workflows.
- **Analyzer service** parses TypeScript AST via `ts-morph` for imports, function dependencies, endpoint heuristics, and DB operation detection.
- **Graph service** stores normalized nodes/edges that map to Neo4j labels/relationships.
- **Simulation service** traverses graph (direct + indirect impacts), assigns risk levels, and proposes regression focus areas.
- **AI semantic service** optionally invokes OpenAI for rule/entity/use-case/smell extraction.

### Graph Schema
See `docs/graph-schema.cypher`.

### Relational Schema
See `docs/database-schema.sql`.

## API Endpoints
See `docs/api-routes.md`.

## Impact Simulation Algorithm

1. Start from changed node.
2. BFS graph traversal up to depth 3.
3. Depth 1 nodes => direct impact.
4. Depth 2+ nodes => indirect impact.
5. Risk score = `2*direct + indirect`.
6. Derive risk level thresholds: low/medium/high.
7. Suggest regression areas for impacted endpoint/function/business-rule nodes.

## Example Pipeline

```bash
npm install
npm run pipeline:example
```

The pipeline:
- Analyzes `apps/api`
- Builds knowledge graph snapshot
- Stores graph in `docs/example-graph.json`
- Stores simulated impact report in `docs/example-impact-report.json`

## Run Locally

```bash
npm install
npm run dev:api
npm run dev:web
```

## Docker

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

Services:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Neo4j Browser: `http://localhost:7474`

## Scalability Notes

- Service boundaries align with independent horizontal scaling.
- Graph schema supports multi-language extension with language-specific analyzers.
- Async job orchestration (future: Kafka/Temporal) can process very large repositories.
- Incremental analysis can be added by hashing files and only reprocessing diffs.
- Read models can be cached for interactive graph exploration under high concurrency.
