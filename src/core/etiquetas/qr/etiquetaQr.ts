import type { BoxModule, CutListItemComPreco } from "../../types";
import type { RulesConfig } from "../../rules/rulesConfig";
import { resolveNomeIndustrialForEtiqueta } from "../industrialDisplayName";
import { resolveAuthoritativeLabelNumber } from "../../qrcode/panelLabelNumber";
import {
  buildEtiquetaCodeV5,
  buildPiecesPerSheetMap,
  labelItemSheetKey,
  type LabelSheetPlacement,
} from "./etiquetaCodeV5";

export type EtiquetaPieceLike = CutListItemComPreco & {
  boxId?: string;
  nome?: string;
};

export type EtiquetaQrContext = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
};

/**
 * Código display / N QR / payload QR = `buildIndustrialId` (SSOT da etiqueta).
 */
export function resolveEtiquetaDisplayCodeV5(
  item: EtiquetaPieceLike,
  ctx: EtiquetaQrContext,
  piecesPerSheet: Map<string, number>,
  index0: number
): string {
  const key = labelItemSheetKey(item.boxId, item.nome);
  const totalPiecesInSheet = piecesPerSheet.get(key) ?? 0;
  const pieceSeq = resolveAuthoritativeLabelNumber(item) ?? index0 + 1;
  const effectiveProjectName = String(
    (item as { sourceProjectName?: string }).sourceProjectName ?? ctx.projectName ?? "PROJETO"
  );
  const boxNome = ctx.boxes.find((b) => b.id === item.boxId)?.nome;
  const tokenMap = ctx.rules.labelSystemV5?.naming?.pieceTypeTokens ?? null;
  const nomeIndustrial = resolveNomeIndustrialForEtiqueta(
    item,
    effectiveProjectName,
    boxNome,
    tokenMap
  );
  return buildEtiquetaCodeV5({
    projectName: effectiveProjectName,
    pieceSeq,
    totalPiecesInSheet,
    boxName: boxNome ?? item.boxId ?? "",
    nomeIndustrial,
  });
}

/** @deprecated Alias — usa o mesmo ID industrial da etiqueta. */
export function resolveUnifiedEtiquetaQrCode(
  item: EtiquetaPieceLike,
  ctx: EtiquetaQrContext,
  piecesPerSheet: Map<string, number>,
  index0: number
): string {
  return resolveEtiquetaDisplayCodeV5(item, ctx, piecesPerSheet, index0);
}

export { buildEtiquetaCodeV5, buildPiecesPerSheetMap, labelItemSheetKey, type LabelSheetPlacement };

export {
  attachLabelNumbersToCutlist,
  resolvePieceIndustrialId,
} from "../../qrcode/qrcodeService";
