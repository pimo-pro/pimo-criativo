/**
 * Código display v5 = `buildIndustrialId(nomeCompleto)` — ex.: kcnc1ld.
 * Sem NUM_CAIXA nem sufixo -SEQ (o nº da etiqueta fica só no badge visual do PDF).
 * AAA é acrescentado na faixa inferior por pdfEtiquetas.
 */

import { buildIndustrialId } from "../../naming/industrialNaming";
import { buildV5BottomStripIndustrialName } from "../industrialDisplayName";

export interface EtiquetaCodeV5Input {
  projectName: string;
  /** @deprecated Não entra no código; mantido por compatibilidade de call sites. */
  pieceSeq: number;
  /** @deprecated Não entra no código; mantido por compatibilidade de call sites. */
  totalPiecesInSheet: number;
  /** Nome de exibição da caixa. */
  boxName?: string;
  /** Tipo/token/nome industrial ou label legado. */
  nomeIndustrial?: string;
}

/** Chave de lookup alinhada a orderByCutLayoutPro em pdfEtiquetas. */
export function labelItemSheetKey(boxId: string | undefined, pieceName: string | undefined): string {
  return `${boxId ?? ""}::${pieceName ?? ""}`;
}

/**
 * Primeira letra de cada palavra (espaço ou _), maiúscula, até 11 caracteres alfanuméricos.
 */
export function extractProjectSigla(projectName: string): string {
  const raw = String(projectName ?? "").trim();
  if (!raw) return "X";

  const parts = raw.split(/[\s_]+/).filter(Boolean);
  let sigla = "";
  for (const part of parts) {
    const cleaned = part.replace(/[^a-zA-Z0-9]/g, "");
    if (!cleaned) continue;
    sigla += cleaned.charAt(0).toUpperCase();
    if (sigla.length >= 11) break;
  }

  const alnum = sigla.replace(/[^A-Z0-9]/g, "");
  return alnum.length > 0 ? alnum.slice(0, 11) : "X";
}

export function formatNumCaixa(totalPiecesInSheet: number): string {
  const n = Math.floor(Number(totalPiecesInSheet));
  if (!Number.isFinite(n) || n <= 0) return "00";
  const clamped = Math.min(99, n);
  return String(clamped).padStart(2, "0");
}

/** NUM_CAIXA no displayCode curto — 3 dígitos (ex.: 3 → 003). */
export function formatNumCaixa3Digits(totalPiecesInSheet: number): string {
  const n = Math.floor(Number(totalPiecesInSheet));
  if (!Number.isFinite(n) || n <= 0) return "000";
  const clamped = Math.min(999, n);
  return String(clamped).padStart(3, "0");
}

/**
 * Prefixo de letras a partir do nome industrial completo.
 * Ex.: NP2624622_Caixa_Forno_SEP_03 → NCFS
 */
export function buildIndustrialShortCodeFromFullName(industrialFullName: string): string {
  const tokens = String(industrialFullName ?? "")
    .trim()
    .split("_")
    .filter(Boolean);

  if (tokens.length === 0) return "X";

  const [projectToken, ...rest] = tokens;
  const letters: string[] = [];

  const projectLetter = projectToken.match(/[a-zA-Z]/)?.[0];
  if (projectLetter) letters.push(projectLetter.toUpperCase());

  const semanticTokens = rest.filter((t, idx) => {
    const isLast = idx === rest.length - 1;
    const isNumeric = /^\d+$/.test(t);
    return !isLast || !isNumeric;
  });

  for (const t of semanticTokens) {
    const letter = t.match(/[a-zA-Z]/)?.[0];
    if (letter) letters.push(letter.toUpperCase());
  }

  return letters.join("") || "X";
}

/** @deprecated Alias — usar buildIndustrialShortCodeFromFullName com nome completo. */
export function buildIndustrialShortCode(
  projectName: string,
  boxName: string,
  pieceName: string
): string {
  const fullName = buildV5BottomStripIndustrialName(projectName, boxName, pieceName);
  return buildIndustrialShortCodeFromFullName(fullName);
}

export function buildEtiquetaCodeV5(input: EtiquetaCodeV5Input): string {
  const nomeIndustrial = String(input.nomeIndustrial ?? "").trim() || "peca";
  const boxName = String(input.boxName ?? "").trim();
  const industrialFullName = buildV5BottomStripIndustrialName(
    input.projectName,
    boxName,
    nomeIndustrial
  );
  return buildIndustrialId(industrialFullName);
}

export type LabelSheetPlacement = {
  partName: string;
  boxId: string;
  sheetIndex: number;
  x_mm: number;
  y_mm: number;
  /** Posição dentro do painel (ordem do array do nesting). */
  placementIndex?: number;
  /** Posição global no flatten de placements (fallback). */
  globalPlacementIndex?: number;
};

export type LabelItemLike = {
  boxId?: string;
  nome?: string;
};

function hasBoxId(boxId: string | undefined): boolean {
  return String(boxId ?? "").trim().length > 0;
}

function normalizedBoxKey(boxId: string | undefined): string {
  return String(boxId ?? "").trim();
}

function normalizedNomeKey(nome: string | undefined): string {
  const n = String(nome ?? "").trim();
  return n.length > 0 ? n : "__unnamed__";
}

function countItemsByBox(items: LabelItemLike[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!hasBoxId(item.boxId)) continue;
    const boxKey = normalizedBoxKey(item.boxId);
    counts.set(boxKey, (counts.get(boxKey) ?? 0) + 1);
  }
  return counts;
}

function countItemsByNome(items: LabelItemLike[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (hasBoxId(item.boxId)) continue;
    const nomeKey = normalizedNomeKey(item.nome);
    counts.set(nomeKey, (counts.get(nomeKey) ?? 0) + 1);
  }
  return counts;
}

export function buildPiecesPerSheetMap(
  items: LabelItemLike[],
  placements?: LabelSheetPlacement[]
): Map<string, number> {
  const result = new Map<string, number>();

  if (placements && placements.length > 0) {
    const itemToSheet = new Map<string, number>();
    for (const p of placements) {
      const key = labelItemSheetKey(p.boxId, p.partName);
      if (!itemToSheet.has(key)) itemToSheet.set(key, p.sheetIndex);
    }

    const sheetCounts = new Map<number, number>();
    for (const item of items) {
      const key = labelItemSheetKey(item.boxId, item.nome);
      const sheetIdx = itemToSheet.get(key);
      if (sheetIdx === undefined) continue;
      sheetCounts.set(sheetIdx, (sheetCounts.get(sheetIdx) ?? 0) + 1);
    }

    const byBox = countItemsByBox(items);

    for (const item of items) {
      const key = labelItemSheetKey(item.boxId, item.nome);
      const sheetIdx = itemToSheet.get(key);
      if (sheetIdx !== undefined) {
        result.set(key, sheetCounts.get(sheetIdx) ?? 0);
      } else if (hasBoxId(item.boxId)) {
        result.set(key, byBox.get(normalizedBoxKey(item.boxId)) ?? 0);
      } else {
        result.set(key, 0);
      }
    }
    return result;
  }

  const byBox = countItemsByBox(items);
  const byNome = countItemsByNome(items);

  for (const item of items) {
    const key = labelItemSheetKey(item.boxId, item.nome);
    if (hasBoxId(item.boxId)) {
      result.set(key, byBox.get(normalizedBoxKey(item.boxId)) ?? 0);
    } else {
      result.set(key, byNome.get(normalizedNomeKey(item.nome)) ?? 0);
    }
  }
  return result;
}
