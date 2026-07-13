// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { invariantRulesStore } from "../config/invariantRulesStore";
import { runPhaseValidators } from "../registry";
import type {
  InvariantIssue,
  InvariantPhase,
  InvariantSuiteResult,
  InvariantValidationInput,
} from "../types";

function applyRuleConfig(issues: InvariantIssue[]): InvariantIssue[] {
  const config = invariantRulesStore.get();
  const ruleByValidator = new Map(config.rules.map((r) => [r.validatorId, r]));

  return issues
    .filter((issue) => {
      const rule = ruleByValidator.get(issue.ruleId);
      return rule?.enabled !== false;
    })
    .map((issue) => {
      const rule = ruleByValidator.get(issue.ruleId);
      if (!rule) return issue;
      return {
        ...issue,
        ruleName: rule.name || issue.ruleName,
        severity: rule.severity ?? issue.severity,
      };
    });
}

/**
 * Executa a suite de invariantes para uma fase.
 * Não bloqueia — apenas recolhe issues.
 */
export function runInvariantSuite(input: InvariantValidationInput): InvariantSuiteResult {
  const rawIssues = runPhaseValidators(input.phase, input);
  const issues = applyRuleConfig(rawIssues);

  return {
    phase: input.phase,
    issues,
    ranAt: Date.now(),
  };
}

export function runInvariantSuites(
  phases: InvariantPhase[],
  baseInput: Omit<InvariantValidationInput, "phase">
): InvariantSuiteResult[] {
  return phases.map((phase) => runInvariantSuite({ ...baseInput, phase }));
}

export function hasBlockingInvariantErrors(issues: InvariantIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

export function formatInvariantIssuesForDisplay(issues: InvariantIssue[]): string {
  if (!issues.length) return "";
  return issues.map((i) => `[${i.severity}] ${i.ruleName}: ${i.message}`).join("\n");
}
