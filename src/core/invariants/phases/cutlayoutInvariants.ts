// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { validateIndustrialLayout } from "../../cutlayout/integration/industrialLayoutContract";
import type { InvariantIssue, InvariantValidationInput } from "../types";

/** Valida layout industrial (sobreposição, fora da chapa). */
export function runCutlayoutInvariants(input: InvariantValidationInput): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  const layout = input.layoutResult;
  if (!layout?.sheets?.length) return issues;

  const kerfMm = 3;
  const marginMm = 10;
  const firstSheet = layout.sheets[0]?.sheet;
  if (!firstSheet) return issues;

  const result = validateIndustrialLayout(layout, {
    kerfMm,
    marginMm,
    physicalSheet: firstSheet,
    coordinateFrame: "physical",
  });

  for (const issue of result.issues) {
    const isOverlap = issue.code === "placement-overlap";
    const isOutside =
      issue.code === "placement-outside-sheet" || issue.code === "sheet-out-of-range";

    if (!isOverlap && !isOutside) continue;

    issues.push({
      ruleId: isOverlap ? "layout-placement-overlap" : "layout-placement-outside-sheet",
      ruleName: isOverlap ? "Sobreposição no layout" : "Peça fora da chapa",
      severity: "error",
      message: issue.message,
      context: {
        piece: issue.partName,
        boxId: issue.boxId,
        operation: "cutlayout",
        phase: "cutlayout",
      },
      phase: "cutlayout",
    });
  }

  return issues;
}
