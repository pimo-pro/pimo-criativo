// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import type { InvariantIssue, InvariantValidationInput } from "../types";
import { validateDrillHolesOutOfBounds, validateInvalidPieceDimensions } from "./viewerInvariants";
import { runCutlayoutInvariants } from "./cutlayoutInvariants";

/** Pré-condições de exportação industrial. */
export function runExportInvariants(input: InvariantValidationInput): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  const cutList = input.cutList ?? input.project.cutListComPreco ?? input.project.cutList ?? [];

  if (!cutList.length && (input.project.boxes?.length ?? 0) > 0) {
    issues.push({
      ruleId: "empty-cutlist-export",
      ruleName: "Cutlist vazia",
      severity: "warning",
      message: "Exportação solicitada mas a lista de corte está vazia.",
      context: { operation: "export", phase: "export" },
      phase: "export",
    });
  }

  const exportInput: InvariantValidationInput = { ...input, phase: "export" };
  issues.push(
    ...validateDrillHolesOutOfBounds(exportInput),
    ...validateInvalidPieceDimensions(exportInput),
    ...runCutlayoutInvariants(exportInput)
  );

  return issues;
}
