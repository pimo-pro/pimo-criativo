// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { invariantNotificationStore } from "../../../stores/invariantNotificationStore";
import { invariantRulesStore } from "../config/invariantRulesStore";
import { InvariantViolationError } from "../errors/InvariantViolationError";
import {
  formatInvariantIssuesForDisplay,
  hasBlockingInvariantErrors,
  runInvariantSuite,
} from "../pipeline/runInvariantSuite";
import type { InvariantIssue, InvariantValidationInput } from "../types";

export type { InvariantIssue, InvariantPhase, InvariantSeverity, InvariantSuiteResult } from "../types";
export { runInvariantSuite, runInvariantSuites } from "../pipeline/runInvariantSuite";
export { invariantRulesStore } from "../config/invariantRulesStore";
export { listInvariantValidators, getInvariantValidator } from "../registry";
export { InvariantViolationError } from "../errors/InvariantViolationError";

/**
 * Regista issues nas notificações persistentes (import lazy para evitar ciclo).
 */
export function recordInvariantNotifications(issues: InvariantIssue[]): void {
  if (!issues.length) return;
  invariantNotificationStore.getState().addIssues(issues);
}

/**
 * Executa invariantes, regista notificações e opcionalmente bloqueia exportação.
 */
export function validateAndRecordInvariants(input: InvariantValidationInput): InvariantIssue[] {
  const result = runInvariantSuite(input);
  if (result.issues.length) {
    recordInvariantNotifications(result.issues);
  }
  return result.issues;
}

/**
 * Verifica se a exportação pode prosseguir.
 * Lança InvariantViolationError quando blockGenerationOnErrors está activo e há erros.
 */
export function assertExportInvariantsAllowed(input: InvariantValidationInput): void {
  const issues = validateAndRecordInvariants(input);
  const block = invariantRulesStore.isGenerationBlockedOnErrors();
  if (block && hasBlockingInvariantErrors(issues)) {
    throw new InvariantViolationError(issues);
  }
}

export function formatInvariantIssuesForToast(issues: InvariantIssue[]): string {
  return formatInvariantIssuesForDisplay(issues);
}
