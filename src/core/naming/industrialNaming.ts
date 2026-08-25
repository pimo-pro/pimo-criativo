/**
 * SSOT de naming industrial — nomes completos e IDs curtos.
 * Tokens editáveis via `LabelSystemV5.naming.pieceTypeTokens` (perfil de regras).
 * Sem inversão L/R.
 */

export type IndustrialPieceTokenMap = Record<string, string>;

export interface IndustrialNamingRules {
  /** Mapa tipo SSOT / nome PT → token industrial (sobrescreve defaults). */
  pieceTypeTokens: IndustrialPieceTokenMap;
}

/**
 * Tokens canónicos fundidos.
 *
 * Alternativas descartadas:
 * - `gaveta_frente`: A1 usava `fren` → mantém-se `gav_frent` (Layout PRO / drawer).
 * - `porta_*`: doorLabels `port_*` coexistiam com Layout PRO `por_sim|por_dup|por_cor`
 *   → `por_*` para tipos SSOT; `port_*` para posição de porta (hinge).
 * - A1 carcass: tokens `cx_*` mantidos como tipos próprios.
 */
export const DEFAULT_PIECE_TYPE_TOKENS: IndustrialPieceTokenMap = {
  lateral_esquerda: "lat_esq",
  lateral_direita: "lat_dir",
  "lateral esquerda": "lat_esq",
  "lateral direita": "lat_dir",

  cima: "top",
  topo: "top",
  fundo: "fun",
  base: "bas",
  COSTA: "cos",
  costa: "cos",
  prateleira: "pra",

  gaveta_frente: "gav_frent",
  gaveta_frente_int: "gav_frent_int",
  gaveta_frente_ext: "gav_frent_ext",
  gaveta_fundo: "gav_fun",
  gaveta_lat_esq: "gav_lat_esq",
  gaveta_lat_dir: "gav_lat_dir",
  gaveta_traseira: "gav_cost",
  "gaveta frente": "gav_frent",
  "gaveta frente interna": "gav_frent_int",
  "gaveta frente externa": "gav_frent_ext",
  "gaveta fundo": "gav_fun",
  "gaveta lateral esquerda": "gav_lat_esq",
  "gaveta lateral direita": "gav_lat_dir",
  "gaveta traseira": "gav_cost",
  "gaveta costas": "gav_cost",

  porta_simples: "por_sim",
  porta_dupla: "por_dup",
  porta_correr: "por_cor",
  port_dir: "port_dir",
  port_esq: "port_esq",
  port_cima: "port_cima",
  port_baix: "port_baix",

  remate: "rem",
  rodape: "roda_pe",
  DIV: "div",
  SEP: "sep",
  div: "div",
  sep: "sep",
  /** Aliases do `tipo` SSOT na cutlist (adaptadores DIV/SEP / A1). */
  divisorio: "div",
  separador: "sep",
  a1_cx_lat_dir: "cx_lat_dir",
  a1_cx_lat_esq: "cx_lat_esq",
  a1_cx_cima: "cx_cima",
  a1_cx_fundo: "cx_fundo",
  a1_cx_comp_40: "cx_comp_40",

  cx_lat_dir: "cx_lat_dir",
  cx_lat_esq: "cx_lat_esq",
  cx_cima: "cx_cima",
  cx_fundo: "cx_fundo",
  cx_comp_40: "cx_comp_40",
  cx_gav_lat_dir: "cx_gav_lat_dir",
  cx_gav_lat_esq: "cx_gav_lat_esq",
  cx_gav_fun: "cx_gav_fun",
  cx_gav_cima: "cx_gav_cima",

  remate_dir: "remate_dir",
  remate_esq: "remate_esq",
  remate_cima: "remate_cima",
  remate_baixo: "remate_baixo",
  remate_frente: "remate_frente",
  remate_l_ext: "remate_l_ext",
  remate_l_int: "remate_l_int",
  remate_tampo: "remate_tampo",
  remate_avista: "remate_avista",
  remate_rodape: "remate_rodape",
  remate_rodape_l_a: "remate_rodape_l_a",
  remate_rodape_l_b: "remate_rodape_l_b",
};

export function buildDefaultIndustrialNamingRules(): IndustrialNamingRules {
  return { pieceTypeTokens: { ...DEFAULT_PIECE_TYPE_TOKENS } };
}

/** Sanitização única: NFD, espaços→`_`, só alfanumérico+`_`, colapsa `_`, lowercase. */
export function sanitizeIndustrialToken(input: string): string {
  return String(input ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

export function mergePieceTypeTokens(
  overrides?: IndustrialPieceTokenMap | null
): IndustrialPieceTokenMap {
  if (!overrides || Object.keys(overrides).length === 0) {
    return { ...DEFAULT_PIECE_TYPE_TOKENS };
  }
  return { ...DEFAULT_PIECE_TYPE_TOKENS, ...overrides };
}

export function resolvePieceToken(
  tipoOuNomePeca: string,
  tokenMap?: IndustrialPieceTokenMap | null
): string {
  const map = mergePieceTypeTokens(tokenMap);
  const raw = String(tipoOuNomePeca ?? "").trim();
  if (!raw) return "peca";

  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase();
  if (map[lower]) return map[lower];

  const values = new Set(Object.values(map));
  const asToken = sanitizeIndustrialToken(raw);
  if (values.has(asToken) || values.has(raw)) return asToken || "peca";

  return asToken || "peca";
}

/**
 * Nome completo: `{projeto}_{caixa}_{token}` + `_{seq}` opcional (sem zero à esquerda).
 */
export function buildFullIndustrialName(
  projeto: string,
  caixa: string,
  tipoOuNomePeca: string,
  seqDuplicata?: number,
  tokenMap?: IndustrialPieceTokenMap | null
): string {
  const p = sanitizeIndustrialToken(projeto) || "projeto";
  const c = sanitizeIndustrialToken(caixa) || "caixa";
  const token = resolvePieceToken(tipoOuNomePeca, tokenMap);
  let name = `${p}_${c}_${token}`;
  if (seqDuplicata != null && Number.isFinite(seqDuplicata) && seqDuplicata > 0) {
    name += `_${Math.floor(seqDuplicata)}`;
  }
  return name;
}

/**
 * ID curto a partir do nome completo.
 * Token alfabético → 1.ª letra; token numérico → completo. Sem separador.
 * Ex.: `khaled_cozinha_nova_c_1_lat_dir` → `kcnc1ld`
 */
export function buildIndustrialId(fullName: string): string {
  const tokens = sanitizeIndustrialToken(fullName).split("_").filter(Boolean);
  if (tokens.length === 0) return "x";
  let out = "";
  for (const t of tokens) {
    if (/^\d+$/.test(t)) {
      out += t;
      continue;
    }
    const letter = t.match(/[a-z]/)?.[0];
    if (letter) out += letter;
  }
  return out || "x";
}
