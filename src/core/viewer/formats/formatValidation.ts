import type { NormalizedProject, FormatValidationResult } from "./normalizedProject";

export function validateNormalizedMm(normalized: NormalizedProject): FormatValidationResult {
  const errors: string[] = [];
  const warnings = [...normalized.source.warnings];
  if (normalized.units !== "mm") {
    errors.push("NormalizedProject.units tem de ser mm.");
  }
  for (const box of normalized.workspaceBoxes) {
    if (!Number.isFinite(box.posicaoX_mm) || !Number.isFinite(box.posicaoY_mm) || !Number.isFinite(box.posicaoZ_mm)) {
      errors.push(`Caixa ${box.id}: posições inválidas (exige mm).`);
    }
    const d = box.dimensoes;
    if (!d || !Number.isFinite(d.largura) || !Number.isFinite(d.altura) || !Number.isFinite(d.profundidade)) {
      errors.push(`Caixa ${box.id}: dimensões inválidas (exige mm).`);
    }
  }
  if (normalized.source.format !== "pimo-project" && normalized.industrialReady) {
    errors.push("Import CAD não pode ficar industrialReady.");
  }
  return { ok: errors.length === 0, errors, warnings };
}
