import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { attachLabelNumbersToCutlist } from "../qrcode/qrcodeService";
import { buildRemateCutlistItems } from "../remate/remateCutlist";
import { buildRodapeCutlistItems } from "../rodape/rodapeCutlist";
import type { RematePiece } from "../remate/rematePieceTypes";
import type { ProjectRodape } from "../rodape/rodapeTypes";
import type { IndustrialPieceEditsStore } from "../industrial/industrialPieceEditsTypes";
import { applyIndustrialPieceEdits } from "../industrial/IndustrialPieceEditsService";

/**
 * Snapshot mínimo para gerar a mesma lista de itens que o fluxo CNC/PDF (cutlist + peças CAD extraídas + remates + rodapés).
 * Usado em projeto único, multi‑projeto e no Worker — uma única função, com cache em `cutlistComPrecoFromBoxes`.
 */
export type IndustrialExportProjectSnapshot = {
  rules: RulesConfig;
  materialId?: string;
  projectName?: string;
  boxes: BoxModule[];
  remates?: readonly RematePiece[];
  rodapes?: readonly ProjectRodape[];
  extractedPartsByBoxId?: Record<string, Record<string, unknown[]>>;
  industrialPieceEdits?: IndustrialPieceEditsStore;
};

export function buildCutlistItemsForIndustrialExport(
  snap: IndustrialExportProjectSnapshot
): CutListItemComPreco[] {
  const {
    boxes,
    rules,
    materialId,
    projectName = "Projeto",
    remates = [],
    rodapes = [],
    extractedPartsByBoxId = {},
    industrialPieceEdits,
  } = snap;

  const rawParam = boxes.flatMap((box) => cutlistComPrecoFromBox(box, rules, materialId));
  const extracted = boxes.flatMap((box) => {
    const byModel = extractedPartsByBoxId?.[box.id];
    if (!byModel) return [] as CutListItemComPreco[];
    return Object.values(byModel).flat() as CutListItemComPreco[];
  });
  const remateItems = buildRemateCutlistItems(remates, boxes);
  const rodapeItems = buildRodapeCutlistItems(rodapes, boxes);

  const merged = [...rawParam, ...extracted, ...remateItems, ...rodapeItems].map((p) => ({
    ...p,
    boxId: p.boxId ?? "",
  }));

  return applyIndustrialPieceEdits(
    attachLabelNumbersToCutlist(merged, {
      projectName,
      boxes,
      rules,
    }),
    industrialPieceEdits
  );
}
