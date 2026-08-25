import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import {
  buildPiecesPerSheetMap,
  resolveEtiquetaDisplayCodeV5,
  type EtiquetaQrContext,
} from "../etiquetas/qr/etiquetaQr";

export type IndustrialListQrContext = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
};

/** N.º QR unificado — mesmo `buildIndustrialId` da etiqueta. */
export function resolveIndustrialListNqr(
  item: CutListItemComPreco,
  ctx: IndustrialListQrContext,
  piecesPerSheet: Map<string, number>,
  index0: number
): string {
  const qrCtx: EtiquetaQrContext = {
    projectName: ctx.projectName,
    boxes: ctx.boxes,
    rules: ctx.rules,
  };
  return resolveEtiquetaDisplayCodeV5(item, qrCtx, piecesPerSheet, index0);
}

export function buildIndustrialListPiecesPerSheet(
  items: CutListItemComPreco[]
): Map<string, number> {
  return buildPiecesPerSheetMap(items);
}
