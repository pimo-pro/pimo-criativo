import {
  buildFullIndustrialName,
  buildIndustrialId,
  mergePieceTypeTokens,
  sanitizeIndustrialToken,
  type IndustrialPieceTokenMap,
} from "../naming/industrialNaming";

/** @deprecated Preferir `sanitizeIndustrialToken` — reexport de compatibilidade. */
export function sanitizeIndustrialSegment(value: string): string {
  return sanitizeIndustrialToken(value);
}

function isKnownPieceTipoOrToken(
  raw: string,
  tokenMap?: IndustrialPieceTokenMap | null
): boolean {
  const map = mergePieceTypeTokens(tokenMap);
  if (map[raw] || map[raw.toLowerCase()]) return true;
  const san = sanitizeIndustrialToken(raw);
  return Object.values(map).includes(san);
}

/**
 * Nome industrial completo na faixa inferior: `{projeto}_{caixa}_{token}`.
 * Peças novas → `buildFullIndustrialName`. Labels legados (`metadata.industrialLabel`) não são retokenizados.
 */
export function buildV5BottomStripIndustrialName(
  projectName: string,
  boxName: string,
  nomeIndustrial: string,
  tokenMap?: IndustrialPieceTokenMap | null
): string {
  const projeto = sanitizeIndustrialToken(projectName) || "projeto";
  const raw = String(nomeIndustrial ?? "").trim();
  if (!raw) {
    return buildFullIndustrialName(projectName, boxName, "peca", undefined, tokenMap);
  }

  const industrialSan = sanitizeIndustrialToken(raw) || "peca";
  const projectPrefix = `${projeto}_`;

  if (industrialSan.startsWith(projectPrefix)) {
    return industrialSan;
  }

  if (isKnownPieceTipoOrToken(raw, tokenMap)) {
    return buildFullIndustrialName(projectName, boxName, raw, undefined, tokenMap);
  }

  if (raw.includes("_") || industrialSan.includes("_")) {
    return `${projeto}_${industrialSan}`;
  }

  return buildFullIndustrialName(projectName, boxName, raw, undefined, tokenMap);
}

type NomeIndustrialItemLike = {
  nome?: string;
  tipo?: string;
  metadata?: Record<string, unknown>;
};

const DOOR_POSITION_TO_TOKEN: Record<string, string> = {
  dir: "port_dir",
  esq: "port_esq",
  cima: "port_cima",
  baixa: "port_baix",
};

/**
 * Chave de peça para `buildFullIndustrialName` quando não há `metadata.industrialLabel` legado.
 * Usa metadados dos adaptadores (DIV/SEP, portas, remates) + `tipo` SSOT.
 */
export function resolvePieceKeyForUnifiedNaming(
  item: NomeIndustrialItemLike
): { key: string; seq?: number } {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  let key = String(item.tipo ?? item.nome ?? "peca").trim() || "peca";
  let seq: number | undefined;

  const divSep = meta.divSepKind;
  if (divSep === "DIV" || divSep === "SEP") {
    key = String(divSep);
    const idx = Number(meta.divSepIndex);
    if (Number.isFinite(idx) && idx > 0) seq = Math.floor(idx);
  }

  const doorKind = meta.doorPositionKind;
  if (typeof doorKind === "string" && DOOR_POSITION_TO_TOKEN[doorKind]) {
    key = DOOR_POSITION_TO_TOKEN[doorKind]!;
  }

  const remateSuffix = meta.remateKind ?? meta.remateIndustrialLabel;
  if (
    (key === "remate" || meta.remateId != null || meta.remateType != null) &&
    typeof remateSuffix === "string" &&
    remateSuffix.trim()
  ) {
    key = `remate_${sanitizeIndustrialToken(remateSuffix)}`;
    const occ = Number(meta.remateOccurrenceIndex);
    if (Number.isFinite(occ) && occ > 0) seq = Math.floor(occ);
  }

  if (key === "rodape") {
    const occ = Number(meta.rodapeOccurrenceIndex ?? meta.partIndex);
    if (Number.isFinite(occ) && occ > 0) seq = Math.floor(occ);
  }

  const drawerIndex = Number(meta.drawerIndex);
  if (Number.isFinite(drawerIndex) && drawerIndex > 0 && String(key).startsWith("gaveta_")) {
    seq = Math.floor(drawerIndex);
  }

  return { key, seq };
}

/**
 * Nome industrial da peça para etiqueta de fabrico.
 * - `metadata.industrialLabel` existente → preservado (não recalcula peças antigas).
 * - Peças novas → `buildFullIndustrialName` sem inversão L/R.
 */
export function resolveNomeIndustrialForEtiqueta(
  item: NomeIndustrialItemLike,
  projectName: string,
  boxNome?: string,
  tokenMap?: IndustrialPieceTokenMap | null
): string {
  const fromMeta = item.metadata?.industrialLabel;
  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return fromMeta.trim();
  }
  const { key, seq } = resolvePieceKeyForUnifiedNaming(item);
  return buildFullIndustrialName(projectName, boxNome ?? "", key, seq, tokenMap);
}

/**
 * Nome completo documental (PDF técnico, cutlist, ferragens, etc.) —
 * mesma regra da faixa da etiqueta; preserva `metadata.industrialLabel`.
 */
export function resolveFullIndustrialNameForDocument(
  item: NomeIndustrialItemLike,
  projectName: string,
  boxNome?: string,
  tokenMap?: IndustrialPieceTokenMap | null
): string {
  const resolved = resolveNomeIndustrialForEtiqueta(item, projectName, boxNome, tokenMap);
  return buildV5BottomStripIndustrialName(projectName, boxNome ?? "", resolved, tokenMap);
}

/** N QR / ID industrial documental — idêntico ao impresso na etiqueta. */
export function resolveIndustrialIdForDocument(
  item: NomeIndustrialItemLike,
  projectName: string,
  boxNome?: string,
  tokenMap?: IndustrialPieceTokenMap | null
): string {
  return buildIndustrialId(
    resolveFullIndustrialNameForDocument(item, projectName, boxNome, tokenMap)
  );
}
