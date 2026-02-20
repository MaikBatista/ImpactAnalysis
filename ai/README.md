# AI Layer (Optional / Isolated)

Este diretório existe para capacidades opcionais de IA (refino textual, agrupamento e priorização), sem participar da inferência estrutural do core.

Restrições:
- IA não cria regra sem AST.
- IA não substitui inferência estrutural.
- IA não altera o parser semântico/canônico do `core`.
