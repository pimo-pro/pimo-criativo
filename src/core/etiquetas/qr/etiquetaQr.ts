import type { BoxModule, CutListItemComPreco } from "../../types";
import type { RulesConfig } from "../../rules/rulesConfig";
import { resolveIndustrialPieceRef } from "../../cutlayout/cutLayoutProPieceNaming";
import { resolveNomeIndustrialForEtiqueta } from "../industrialDisplayName";
import { resolveAuthoritativeLabelNumber } from "../../qrcode/panelLabelNumber";
import { buildLocalQrPayload } from "../../qrcode/qrcodeService";
import {
  buildEtiquetaCodeV5,
  buildEtiquetaQrPayloadV5,
  buildPiecesPerSheetMap,
  labelItemSheetKey,
  type LabelSheetPlacement,
} from "./etiquetaCodeV5";

export type EtiquetaPieceLike = CutListItemComPreco & {
  boxId?: string;
  nome?: string;
  shortCode?: string;
};

export type EtiquetaQrContext = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
};

/**
 * QR canónico do UEE — nome industrial completo + número da etiqueta.
 * Ex.: ANTONIO_NOVO_5_CC4_REMATE_L_B_01-6
 */
export function resolveUnifiedEtiquetaQrCode(
  item: EtiquetaPieceLike,
  ctx: EtiquetaQrContext,
  _piecesPerSheet: Map<string, number>,
  index0: number
): string {
  const boxNome = ctx.boxes.find((b) => b.id === item.boxId)?.nome;
  const pieceSeq = resolveAuthoritativeLabelNumber(item) ?? index0 + 1;
  const industrialRef = resolveIndustrialPieceRef(item, boxNome, ctx.projectName);
  return buildEtiquetaQrPayloadV5({ industrialPieceRef: industrialRef, pieceSeq });
}

/**
 * Código display v5 na faixa inferior — nome industrial completo + sufixo AN04-6.
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

/**
 * Compatibilidade S1 — short code para cutlist, técnico, drill (inalterado).
 */
export function resolveLegacyShortQrCode(
  item: EtiquetaPieceLike,
  ctx: EtiquetaQrContext
): string {
  const authoritative = resolveAuthoritativeLabelNumber(item);
  if (authoritative != null) {
    return buildLocalQrPayload(item, ctx, authoritative);
  }
  const rawSc = String(item.shortCode ?? "").trim();
  if (rawSc && rawSc !== "ERR") return rawSc;
  return buildLocalQrPayload(item, ctx, 1);
}

export { buildEtiquetaCodeV5, buildEtiquetaQrPayloadV5, buildPiecesPerSheetMap, labelItemSheetKey, type LabelSheetPlacement };

export {
  generateEtiquetaCode,
  buildLocalQrPayload,
  attachQrCodesToCutlist,
} from "../../qrcode/qrcodeService";
