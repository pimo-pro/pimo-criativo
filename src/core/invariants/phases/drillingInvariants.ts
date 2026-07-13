// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import type { InvariantIssue, InvariantValidationInput } from "../types";
import { validateDrillHolesOutOfBounds, validateInvalidPieceDimensions } from "./viewerInvariants";

/** Fase de furação — reutiliza validadores de furos e dimensões. */
export function runDrillingInvariants(input: InvariantValidationInput): InvariantIssue[] {
  const drillingInput: InvariantValidationInput = { ...input, phase: "drilling" };
  return [...validateDrillHolesOutOfBounds(drillingInput), ...validateInvalidPieceDimensions(drillingInput)];
}
