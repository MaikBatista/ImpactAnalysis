import type { BusinessRule, RuleContext } from "../contracts.js";

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateConfidence(rule: BusinessRule, context: RuleContext): number {
  let confidence = 0;

  if (context.inDomainEntity) confidence += 0.25;
  if (context.mutatesStateField) confidence += 0.25;
  if (context.hasExplicitThrow) confidence += 0.15;
  if (context.inPublicMethod) confidence += 0.1;
  if (context.usesStateEnum) confidence += 0.1;
  if (context.outsideControllerInfra) confidence += 0.1;
  if (context.strongStructuralPattern) confidence += 0.05;

  if (!context.inDomainEntity) {
    confidence = Math.min(confidence, 0.6);
  }

  if (context.inController) {
    confidence -= 0.2;
  }

  if (rule.type === "CALCULATION" && context.isolatedCalculation) {
    confidence = Math.min(confidence, 0.7);
  }

  return round2(Math.max(0, Math.min(1, confidence)));
}
