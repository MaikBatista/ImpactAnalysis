// Node labels
(:File {id, path, language, checksum})
(:Class {id, name, fileId})
(:Function {id, name, signature, fileId})
(:Endpoint {id, method, path, functionId})
(:Table {id, schema, name})
(:Column {id, tableId, name, type})
(:BusinessRule {id, name, expression, confidence})
(:DomainEntity {id, name})
(:UseCase {id, name})

// Edge relationships
(:Function)-[:CALLS]->(:Function)
(:File)-[:DEPENDS_ON]->(:File)
(:Function)-[:WRITES_TO]->(:Table)
(:Function)-[:READS_FROM]->(:Table)
(:Function)-[:IMPLEMENTS_RULE]->(:BusinessRule)
(:Function)-[:EXPOSES_ENDPOINT]->(:Endpoint)
(:Function)-[:TRIGGERS_EVENT]->(:UseCase)
