/**
 * Fingerprint estável do cutlist industrial + params de chapa.
 * Usado para invalidar o snapshot PRO oficial quando o projecto muda.
 * buildCutlistFingerprint é puro; buildChapasOficiaisFingerprint lê settings
 * com as MESMAS funções do pipeline PRO (só leitura — não altera valores).
 */

import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import { inferCutlistItemThicknessMm } from "../cnc/industrialNestingGroup";
import { getSheetDefinitionFromSettings } from "../cnc/cncPipeline";
import { getLayoutKerfMmForCncNesting } from "../cnc/tcnLayoutKerf";
import { getSettings } from "../settings/settingsService";

export type CutlistFingerprintSheetParams = {
  largura_mm?: number;
  altura_mm?: number;
  espessura_mm?: number;
  /** Kerf efectivo do nesting CNC (quando conhecido). */
  kerf_mm?: number;
};

export type BuildCutlistFingerprintInput = {
  items: ReadonlyArray<CutlistItemForPieces>;
  sheet?: CutlistFingerprintSheetParams | null;
};

/** FNV-1a 32-bit → base36 (mesmo algoritmo que onlineAnalysis.stableHash). */
function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function itemLine(item: CutlistItemForPieces): string {
  const L = round2(Number(item.dimensoes?.largura) || 0);
  const A = round2(Number(item.dimensoes?.altura) || 0);
  const esp = round2(inferCutlistItemThicknessMm(item));
  const qty = Math.max(0, Math.floor(Number(item.quantidade) || 0));
  const boxId = String(item.boxId ?? "").trim();
  const tipo = String(item.tipo ?? item.nome ?? "").trim().toLowerCase();
  const mat = String(item.materialId ?? item.material ?? "").trim().toLowerCase();
  const sheetW = round2(Number(item.sheetWidthMm) || 0);
  const sheetH = round2(Number(item.sheetHeightMm) || 0);
  const grain = String(item.grainDirection ?? "").trim();
  return [boxId, tipo, L, A, esp, qty, mat, sheetW, sheetH, grain].join("\t");
}

/**
 * Devolve fingerprint curto e estável.
 * Prefixo `v1:` permite evoluir o algoritmo sem colisões silenciosas.
 */
export function buildCutlistFingerprint(input: BuildCutlistFingerprintInput): string {
  const items = input.items ?? [];
  const lines = items.map(itemLine).sort();

  const sheet = input.sheet ?? {};
  const sheetLine = [
    "sheet",
    round2(Number(sheet.largura_mm) || 0),
    round2(Number(sheet.altura_mm) || 0),
    round2(Number(sheet.espessura_mm) || 0),
    round2(Number(sheet.kerf_mm) || 0),
  ].join("\t");

  const payload = `v1\n${sheetLine}\n${lines.join("\n")}`;
  return `v1:${stableHash(payload)}`;
}

/**
 * Fingerprint oficial (SSOT) para publish/getValid.
 * Usa getSheetDefinitionFromSettings + getLayoutKerfMmForCncNesting(getSettings())
 * — as mesmas fontes que getDefaultCncLayoutOptions / withSheetDefaults no PRO.
 * Não altera settings; só lê. Passo 5 e passo 6 devem chamar ESTA função.
 */
export function buildChapasOficiaisFingerprint(
  items: ReadonlyArray<CutlistItemForPieces>
): string {
  const sheetDef = getSheetDefinitionFromSettings();
  const kerf_mm = getLayoutKerfMmForCncNesting(getSettings());
  return buildCutlistFingerprint({
    items,
    sheet: {
      largura_mm: sheetDef.largura_mm,
      altura_mm: sheetDef.altura_mm,
      espessura_mm: sheetDef.espessura_mm,
      kerf_mm,
    },
  });
}
