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
  const key = String(item.tipo ?? item.nome ?? "peca").trim() || "peca";
  return buildFullIndustrialName(projectName, boxNome ?? "", key, undefined, tokenMap);
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
