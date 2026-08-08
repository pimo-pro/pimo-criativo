/**
 * Tabelas estáticas DRILL/orla dos modos industriais (A/D).
 * Sem imports de adapters — evita ciclos com xmlMachineRouting / cutlist.
 */

import type { OrlaSideId } from "../orla/orlaTypes";

/** Peças industriais → DRILL (cx_gav + a_1). */
export const INDUSTRIAL_DRILL_TIPOS: readonly string[] = [
  "cx_gav_lat_dir",
  "cx_gav_lat_esq",
  "cx_gav_cima",
  "cx_gav_fun",
  "cx_gav_lat_direita",
  "cx_gav_lat_esquerda",
  "a1_cx_lat_dir",
  "a1_cx_lat_esq",
  "a1_cx_cima",
  "a1_cx_fundo",
  "a1_cx_comp_40",
];

/** Lados de orla por tipo industrial (só A/D com tipos próprios). */
export const INDUSTRIAL_ORLA_SIDES: Record<string, readonly OrlaSideId[]> = {
  cx_gav_fun: [],
  cx_gav_cima: ["front", "back", "left", "right"],
  cx_gav_lat_dir: ["front"],
  cx_gav_lat_esq: ["front"],
  cx_gav_lat_direita: ["front"],
  cx_gav_lat_esquerda: ["front"],
  a1_cx_fundo: [],
  a1_cx_comp_40: ["front", "back"],
  a1_cx_cima: ["front", "back", "left", "right"],
  a1_cx_lat_dir: ["front"],
  a1_cx_lat_esq: ["front"],
};

export function isIndustrialDrillTipo(tipo: string): boolean {
  return (INDUSTRIAL_DRILL_TIPOS as readonly string[]).includes(tipo);
}

/** Heurística de nome/token para DRILL (cx_gav / a1). */
export function industrialDrillTokenMatch(token: string): boolean {
  return (
    token.includes("cx_gav") ||
    token.includes("cx-gav") ||
    token.includes("a1_cx") ||
    token.includes("a_1_cx")
  );
}

/** Excluir tipos industriais da heurística CNC de cima/fundo. */
export function industrialExcludeFromCncHeuristic(token: string): boolean {
  return token.includes("cx_gav") || token.includes("a1_cx") || token.includes("a_1");
}
