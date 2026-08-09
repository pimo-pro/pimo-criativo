/**
 * Partição de custos ADMIN/Totais: Painéis (carcaça + portas de módulo + madeira de gavetas).
 * Bucket financeiro «Gavetas» = montagem unitária (fora desta partição de madeira).
 * Alinhado a classifyFinanceiroCustoKey.
 */

import { isIndustrialDoorPanelTipo } from "../doors/industrialDoorPanels";
import { classifyFinanceiroCustoKey } from "./financeiroUnificado";

export {
  isBundledSheetWoodTipo,
  isFallbackCarcassWoodTipo,
  isRemateOrRodapeTipo,
} from "./industrialWoodFinanceRules";

/** Peça cujo material deve ir para Painéis (exclui remates/divisão; inclui gaveta_* e porta_* módulo). */
export function isCarcassPanelForAdminCost(tipo: string): boolean {
  return classifyFinanceiroCustoKey(tipo) === "paineis";
}

/**
 * Identidade de peça de porta de módulo (listagens de fabrico / CNC).
 * Não implica bucket financeiro «Portas» — o material dessas folhas vai para Painéis.
 */
export function isDoorPieceForAdminCost(tipo: string): boolean {
  return isIndustrialDoorPanelTipo(tipo) || classifyFinanceiroCustoKey(tipo) === "portas";
}
