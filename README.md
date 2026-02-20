# ImpactAnalysis

Motor determinístico de análise de impacto arquitetural baseado em AST.

## Arquitetura canônica

```txt
core/
  parser/
  semantic/
  domain/
  rules/
  impact/
  architecture/
  report/
ai/              # opcional e isolado
platform/        # api, worker, storage
web/             # frontend futuro
```

## Fluxo obrigatório do Core

1. `CodeParser`
2. `SemanticEnricher`
3. `DomainModelBuilder`
4. `BusinessRuleEngine`
5. `ImpactSimulationEngine`
6. `ArchitecturalAnalyzer`
7. `ReportGenerator`

## Princípios implementados

- Sem IA no fluxo principal.
- Sem parsing repetido dentro das camadas.
- Regras de negócio rastreáveis por localização AST (`start`/`end`).
- Extração estrutural (sem regex/NLP) para entidades e regras.
- Simulação de risco determinística e explicável.

## Execução de exemplo

```bash
npm run pipeline:example
```

Saídas:

- `docs/example-impact-report.json`
- `docs/example-graph.json`

## Nota

`platform/api`, `platform/worker` e `platform/storage` estão como placeholders para integração após estabilização do core.
