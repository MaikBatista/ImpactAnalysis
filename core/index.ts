import { ArchitecturalAnalyzer } from "./architecture/index.js";
import type {
  ImpactSimulationResult,
  ParsedFile,
  RuleAnalysis,
  SemanticAnalysis,
  TechnicalReport,
} from "./contracts.js";
import { DomainModelBuilder } from "./domain/index.js";
import { ImpactSimulationEngine } from "./impact/index.js";
import { CodeParser } from "./parser/index.js";
import { ReportGenerator } from "./report/index.js";
import { BusinessRuleEngine } from "./rules/index.js";
import { SemanticEnricher } from "./semantic/index.js";

export type CorePipelineResult = {
  parsedFiles: ParsedFile[];
  semantic: SemanticAnalysis;
  report: TechnicalReport;
};

export class CoreEngine {
  private readonly parser = new CodeParser();
  private readonly semantic = new SemanticEnricher();
  private readonly domain = new DomainModelBuilder();
  private readonly rules = new BusinessRuleEngine();
  private readonly impact = new ImpactSimulationEngine();
  private readonly architecture = new ArchitecturalAnalyzer();
  private readonly report = new ReportGenerator();

  analyze(projectPath: string): CorePipelineResult {
    const parsedFiles = this.parser.parseProject(projectPath);
    const semantic = this.semantic.enrich(parsedFiles);
    const domainModel = this.domain.build(semantic.nodes);
    const rules = this.rules.extract({
      semanticNodes: semantic.nodes,
      domainEntities: domainModel.entities,
    });
    const ruleAnalysis: RuleAnalysis = { domainModel, rules };
    const impact = this.buildInitialImpact(ruleAnalysis);
    const violations = this.architecture.analyze(ruleAnalysis);

    const report = this.report.generate({
      entities: domainModel.entities,
      relations: domainModel.relations,
      rules,
      impact,
      architecturalViolations: violations,
    });

    return { parsedFiles, semantic, report };
  }

  simulateRuleImpact(projectPath: string, ruleId: string): ImpactSimulationResult {
    const parsedFiles = this.parser.parseProject(projectPath);
    const semantic = this.semantic.enrich(parsedFiles);
    const domainModel = this.domain.build(semantic.nodes);
    const rules = this.rules.extract({
      semanticNodes: semantic.nodes,
      domainEntities: domainModel.entities,
    });
    const ruleAnalysis: RuleAnalysis = { domainModel, rules };
    return this.impact.simulate(ruleId, {
      domainEntities: domainModel.entities,
      businessRules: rules,
      domainRelations: domainModel.relations,
    });
  }

  private buildInitialImpact(ruleAnalysis: RuleAnalysis): ImpactSimulationResult | null {
    const firstRule = ruleAnalysis.rules[0];
    if (!firstRule) {
      return null;
    }
    return this.impact.simulate(firstRule.id, {
      domainEntities: ruleAnalysis.domainModel.entities,
      businessRules: ruleAnalysis.rules,
      domainRelations: ruleAnalysis.domainModel.relations,
    });
  }
}

export * from "./contracts.js";
export { CodeParser } from "./parser/index.js";
export { SemanticEnricher } from "./semantic/index.js";
export { DomainModelBuilder } from "./domain/index.js";
export { BusinessRuleEngine } from "./rules/index.js";
export { ImpactSimulationEngine } from "./impact/index.js";
export { ArchitecturalAnalyzer } from "./architecture/index.js";
export { ReportGenerator } from "./report/index.js";
