/**
 * Regras industriais de madeira no Financeiro:
 * portas / gavetas / remates vêm das chapas — sem preço de madeira próprio.
 */

import { isIndustrialDoorPanelTipo } from "../doors/industrialDoorPanels";
import { isDrawerPieceTipo } from "../../services/drawerCutlistAdapter";

/** Remate / rodapé — madeira nas chapas (sem linha própria no modo industrial). */
export function isRemateOrRodapeTipo(tipo: string): boolean {
  const t = String(tipo ?? "").toLowerCase();
  return (
    t.includes("remate") ||
    t.includes("rodape") ||
    t.includes("roda_pe") ||
    t.includes("roda-pe") ||
    t.includes("rodapé")
  );
}

/**
 * Madeira coberta pelas chapas reais (ou excluída do fallback Painéis):
 * folhas de porta, peças de gaveta, remates/rodapés.
 */
export function isBundledSheetWoodTipo(tipo: string): boolean {
  const t = String(tipo ?? "").toLowerCase();
  if (isIndustrialDoorPanelTipo(tipo) || t.includes("porta")) return true;
  if (isDrawerPieceTipo(tipo) || t.includes("gaveta")) return true;
  if (isRemateOrRodapeTipo(tipo)) return true;
  return false;
}

/**
 * Fallback Painéis (sem nesting Real): só carcaça estrutural.
 * Exclui porta / gaveta / remate.
 */
export function isFallbackCarcassWoodTipo(tipo: string): boolean {
  return !isBundledSheetWoodTipo(tipo);
}
