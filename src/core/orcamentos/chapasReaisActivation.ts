/**
 * Auditoria preços — Chapas Reais como fonte única de madeira.
 * Default global = `por_chapas_reais`; sem nesting oficial, monetização preliminar
 * (N × €/chapa ou Σ sheets fast) com badge Estimado; fallback Painéis por peça só se N=0.
 */

import type { OrcamentosMaterialCostMode } from "./orcamentosTypes";

/** Default de fábrica — madeira = chapas reais (fonte única). */
export const ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT: OrcamentosMaterialCostMode =
  "por_chapas_reais";

/**
 * Procedimento em produção (Admin).
 * €/chapa = derivado (€/m² × área chapa); sem campo de tarifa manual.
 */
export const CHAPAS_REAIS_ACTIVATION_STEPS = [
  "Confirmar €/m² do material dominante (catálogo / pricing) — o €/chapa deriva automaticamente (€/m² × área da chapa padrão).",
  "Admin → Sistema → Orçamentos: modo «Por chapas reais (exclusivo)» é o default — Guardar se alterar.",
  "Financeiro Unificado: com nesting Real, Painéis/portas/remates a 0 €; Chapas reais = N × €/chapa (ou Σ sheets).",
  "Se o badge for Estimado: Painéis preliminar = N × €/chapa (ou Σ sheets fast), sem desconto artificial; oficial vem do TCN/PRO.",
  "Gavetas (montagem N×15 €), ferragens, orla e operações não são zerados pelo modo chapas.",
] as const;

export const CHAPAS_REAIS_ACTIVATION_WARNING =
  "Modo exclusivo: substitui o custo material por peça (Painéis / portas / remates) quando há € de chapas. " +
  "Com nesting Estimado, Painéis usa N × €/chapa (ou Σ sheets fast) como preliminar. " +
  "Sem N de chapas, faz fallback para Painéis por peça (remates sem linha de madeira). " +
  "Pode voltar a «Por peça» em Admin → Orçamentos se necessário.";
