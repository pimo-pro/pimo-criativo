import type { BoxModule, CutListItemComPreco } from "../../types";
import type { RulesConfig } from "../../rules/rulesConfig";
import { resolveIndustrialPieceRef } from "../../cutlayout/cutLayoutProPieceNaming";
import { resolveNomeIndustrialForEtiqueta } from "../industrialDisplayName";
import { resolveAuthoritativeLabelNumber } from "../../qrcode/panelLabelNumber";
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
};

export type EtiquetaQrContext = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
};

/**
 * Payload QR das listas (ainda legado até Passo 3.3) — nome industrial + seq.
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
 * Código display / N QR da etiqueta = `buildIndustrialId`.
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

export { buildEtiquetaCodeV5, buildEtiquetaQrPayloadV5, buildPiecesPerSheetMap, labelItemSheetKey, type LabelSheetPlacement };

export {
  attachLabelNumbersToCutlist,
  resolvePieceIndustrialId,
} from "../../qrcode/qrcodeService";
