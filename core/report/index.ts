import type {
  ArchitecturalViolation,
  BusinessRule,
  DomainEntity,
  DomainRelation,
  ImpactSimulationResult,
  TechnicalReport,
} from "../contracts.js";

export class ReportGenerator {
  generate(input: {
    entities: DomainEntity[];
    relations: DomainRelation[];
    rules: BusinessRule[];
    impact: ImpactSimulationResult | null;
    architecturalViolations: ArchitecturalViolation[];
  }): TechnicalReport {
    return {
      entities: input.entities,
      relations: input.relations,
      rules: input.rules,
      impact: input.impact,
      architecturalViolations: input.architecturalViolations,
    };
  }
}
