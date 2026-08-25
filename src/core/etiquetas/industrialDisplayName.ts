import {
  buildFullIndustrialName,
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

  // Já é nome completo (sistema novo ou legado com prefixo de projecto).
  if (industrialSan.startsWith(projectPrefix)) {
    return industrialSan;
  }

  // Tipo SSOT / token conhecido (ex.: lateral_direita, cima) → nome completo novo.
  if (isKnownPieceTipoOrToken(raw, tokenMap)) {
    return buildFullIndustrialName(projectName, boxName, raw, undefined, tokenMap);
  }

  // Label legado com `_` (ex.: BOX_DIV_01, C1_top) — só prefixar projecto, sem retokenizar.
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
