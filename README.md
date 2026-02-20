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

## Pipeline End-to-End (atual)

1. API recebe `projectPath` no endpoint `POST /api/analyze`.
2. `code-analyzer` executa leitura AST para imports/endpoints/dependências.
3. `business-rule-extractor` identifica regras candidatas no source.
4. `ai-semantic-layer` (opcional) extrai regras, entidades, casos de uso e smells.
5. `dependency-graph-builder` consolida nós/arestas em um grafo serializado.
6. Persistência opcional:
   - Postgres: `repositories`, `analysis_runs`, `impact_reports`
   - Neo4j: nós e relacionamentos do grafo
7. Web consome API real para análise + simulação (`POST /api/simulate`).

## Environment Variables

### API

- `PORT` (default: `4000`)
- `DATABASE_URL` (opcional, habilita persistência relacional)
- `NEO4J_URI` (opcional, habilita persistência de grafo)
- `NEO4J_USER` (opcional)
- `NEO4J_PASSWORD` (opcional)
- `OPENAI_API_KEY` (opcional, habilita insights semânticos com LLM)

### Web

- `NEXT_PUBLIC_API_URL` (default recomendado: `http://localhost:4000`)

## Run Locally

```bash
npm install
npm run dev:api
npm run dev:web
```

## API Endpoints

- `GET /health`
- `POST /api/repos/import/github`
- `POST /api/analyze`
- `POST /api/simulate`

### `POST /api/analyze` body

```json
{
  "projectPath": "apps/api",
  "includeSemantic": true,
  "persist": true
}
```

### `POST /api/simulate` body

```json
{
  "changedNodeId": "file:...",
  "graph": { "nodes": [], "edges": [] },
  "analysisRunId": "uuid-opcional",
  "persist": true
}
```

## Example Pipeline

```bash
npm run pipeline:example
```

Outputs:
- `docs/example-graph.json`
- `docs/example-impact-report.json`

## Docker

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

Services:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Neo4j Browser: `http://localhost:7474`
- Postgres: `localhost:5432`

## Notes

- Persistência é resiliente: se Postgres/Neo4j não estiverem disponíveis, API continua com processamento em memória.
- IA é opcional: sem `OPENAI_API_KEY`, a camada semântica retorna fallback determinístico.
