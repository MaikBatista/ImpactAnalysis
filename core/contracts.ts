import { Node } from "ts-morph";

export type ParsedFile = {
  filePath: string;
  ast: Node;
  language: "ts";
};

export type SemanticNode = {
  kind: string;
  symbol?: string;
  type?: string;
  filePath: string;
  astNode: Node;
};

export type CallGraphEdge = {
  from: string;
  to: string;
  filePath: string;
};

export type SemanticAnalysis = {
  parsedFiles: ParsedFile[];
  nodes: SemanticNode[];
  callGraph: CallGraphEdge[];
};

export type DomainModel = {
  semanticNodes: SemanticNode[];
  entities: DomainEntity[];
  relations: DomainRelation[];
};

export type RuleAnalysis = {
  domainModel: DomainModel;
  rules: BusinessRule[];
};

export type BusinessRuleExtractionInput = {
  semanticNodes: SemanticNode[];
  domainEntities: DomainEntity[];
};

export type RuleContext = {
  inDomainEntity: boolean;
  mutatesStateField: boolean;
  hasExplicitThrow: boolean;
  inPublicMethod: boolean;
  usesStateEnum: boolean;
  outsideControllerInfra: boolean;
  strongStructuralPattern: boolean;
  inController: boolean;
  isolatedCalculation: boolean;
};

export type DomainEntity = {
  name: string;
  properties: string[];
  methods: string[];
  stateFields: string[];
  filePath: string;
};

export type DomainRelation = {
  from: string;
  to: string;
  type: "CALLS" | "DEPENDS_ON" | "MODIFIES" | "USES";
};

export type BusinessRuleType =
  | "INVARIANT"
  | "POLICY"
  | "CALCULATION"
  | "STATE_TRANSITION"
  | "CONTEXT_RESTRICTION";

export type BusinessRule = {
  id: string;
  type: BusinessRuleType;
  entity?: string;
  method?: string;
  filePath: string;
  condition: string;
  consequence: string;
  astLocation: {
    start: number;
    end: number;
  };
  confidence: number;
};

export type ImpactNode = {
  id: string;
  type: "ENTITY" | "RULE" | "FILE" | "METHOD";
  riskScore: number;
};

export type ImpactSimulationInput = {
  domainEntities: DomainEntity[];
  businessRules: BusinessRule[];
  domainRelations: DomainRelation[];
};

export type ImpactExplanation = {
  fanOut: number;
  callDepth: number;
  affectedFiles: number;
  affectedEntities: number;
  crossLayerViolations: number;
};

export type ArchitecturalViolationType =
  | "DOMAIN_CALLING_INFRA"
  | "RULE_IN_CONTROLLER"
  | "ANEMIC_ENTITY"
  | "FAT_SERVICE"
  | "SCATTERED_RULE"
  | "LAYER_VIOLATION";

export type ArchitecturalViolation = {
  id: string;
  type: ArchitecturalViolationType;
  message: string;
  filePath?: string;
  relatedIds: string[];
};

export type ImpactSimulationResult = {
  rootRule: BusinessRule;
  impactedNodes: ImpactNode[];
  globalRiskScore: number;
  explanation: ImpactExplanation;
};

export type TechnicalReport = {
  entities: DomainEntity[];
  relations: DomainRelation[];
  rules: BusinessRule[];
  impact: ImpactSimulationResult | null;
  architecturalViolations: ArchitecturalViolation[];
};
