/**
 * Idempotência na geração de WO.
 *
 * `skipExistingStationOrders` activo (Fase 3C): não cria nova WO se já existir
 * ordem para (projectId, station); reutiliza a existente.
 * `warnOnDuplicate` continua a registar aviso em consola.
 *
 * Histórico: introduzido 2026-06-23 com skip=false para preservar o comportamento
 * então vigente (só warn). Nunca esteve true em produção até Fase 3C.
 * Docs referenciados (RELATORIO_FASE_4 / feature-flags) não estão no repo.
 */
export const woIdempotencyConfig = {
  /**
   * Quando `true`, não cria nova WO se já existir ordem para (projectId, station).
   * Reutiliza a existente no resultado.
   */
  skipExistingStationOrders: true,

  /**
   * Quando `true`, regista aviso em consola se duplicata seria criada.
   * Seguro em produção — não altera persistência.
   */
  warnOnDuplicate: true,
} as const;
