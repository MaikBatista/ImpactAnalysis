# 📜 ImpactAnalysis – Product Constitution

## 1. Identidade do Produto

Nome: ImpactAnalysis
Categoria: Motor de Análise Semântica de Código
Natureza: Plataforma de inferência de domínio e análise de impacto baseada em AST

## 2. Missão

ImpactAnalysis existe para:

Inferir regras de negócio e modelo de domínio diretamente do código-fonte, correlacionando regras com seus executores e simulando o impacto de alterações.

O sistema deve ser capaz de analisar desde ideias arquiteturais até código consolidado, mantendo coerência semântica.

3. Problema que Resolve

Equipes não sabem:

Onde estão as regras de negócio reais

Qual código executa cada regra

O impacto real de alterar determinada regra

Se o sistema está violando sua própria arquitetura

Onde o domínio está misturado com infraestrutura

ImpactAnalysis resolve isso através de análise estrutural + inferência semântica.

4. O Que o Sistema É

ImpactAnalysis é:

Um motor baseado em AST

Um inferidor de modelo de domínio

Um extrator formal de regras de negócio

Um simulador de impacto arquitetural

Um gerador de relatórios técnicos e executivos

5. O Que o Sistema NÃO É

ImpactAnalysis NÃO é:

Um simples dependency graph

Um lint tool

Um wrapper de LLM

Um analisador baseado apenas em regex

Um gerador de documentação superficial

Toda implementação que se aproxime dessas características viola a constituição.

6. Definição Formal de Regra de Negócio

Regra de Negócio é classificada como uma das categorias abaixo:

6.1 Invariante de Domínio

Condição que deve sempre ser verdadeira para uma entidade.

Exemplo:

Pedido não pode ser cancelado após envio.

6.2 Política de Decisão

Fluxo condicional que altera comportamento com base em conceito de negócio.

Exemplo:

Cliente premium recebe desconto.

6.3 Regra de Cálculo

Expressão matemática que representa lógica econômica ou operacional.

Exemplo:

comissão = valor \* 0.12

6.4 Transição de Estado

Alteração de estado controlada por condição.

Exemplo:

this.status = OrderStatus.SHIPPED

6.5 Restrição Temporal ou Contextual

Regra baseada em tempo, status ou contexto.

7. Não São Regras de Negócio

Checagem null

Validação de tipo

Logs

Tratamento de erro técnico

Autenticação técnica

Configuração de infraestrutura

8. Arquitetura Canônica do Motor

Toda evolução deve respeitar esta arquitetura:

CodeParser
↓
SemanticEnricher
↓
DomainModelBuilder
↓
BusinessRuleEngine
↓
ImpactSimulationEngine
↓
ArchitecturalAnalyzer
↓
ReportGenerator

Nenhuma camada deve pular outra.

9. Modelo Interno Oficial
   9.1 DomainEntity
   type DomainEntity = {
   name: string
   properties: string[]
   methods: string[]
   stateFields: string[]
   filePath: string
   }
   9.2 BusinessRule
   type BusinessRule = {
   id: string
   type:
   | "INVARIANT"
   | "POLICY"
   | "CALCULATION"
   | "STATE_TRANSITION"
   | "CONTEXT_RESTRICTION"

entity?: string
method?: string
filePath: string

condition: string
consequence: string

astLocation: {
start: number
end: number
}

confidence: number
}
9.3 DomainRelation
type DomainRelation = {
from: string
to: string
type: "CALLS" | "DEPENDS_ON" | "MODIFIES" | "USES"
}
9.4 ImpactNode
type ImpactNode = {
id: string
type: "ENTITY" | "RULE" | "FILE" | "METHOD"
riskScore: number
} 10. Princípios Arquiteturais

AST é a fonte primária de verdade técnica.

Inferência semântica deve ser determinística antes de usar IA.

IA é amplificadora, não substituta de análise estrutural.

Regras devem possuir confiança quantificável.

Toda regra deve ser rastreável até um nó AST.

Todo impacto deve ser explicável.

Se não é explicável, não é comercializável.

11. Camadas de Produto

ImpactAnalysis opera em três níveis:

Nível Técnico

Extração e modelagem estrutural.

Nível Arquitetural

Inferência de domínio e detecção de violações.

Nível Executivo

Relatório de risco e impacto.

12. Público-Alvo Estratégico

Primário:

Arquitetos de software

Times de modernização de legado

Empresas com sistemas críticos

Secundário:

Startups em fase de crescimento

Consultorias técnicas

13. Diferencial Competitivo

ImpactAnalysis combina:

AST + Inferência de Domínio + Correlação Regra ↔ Executor + Simulação de Impacto

Nenhuma ferramenta tradicional faz isso de forma integrada.

14. Critério de Evolução

Uma nova feature só é válida se:

Aumenta precisão semântica

Melhora inferência de domínio

Melhora rastreabilidade

Ou melhora explicabilidade executiva

Se não atende nenhum desses critérios, não deve ser implementada.

🔒 Regra de Ouro

Se uma decisão técnica conflita com esta constituição,
a constituição prevalece.
