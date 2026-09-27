/**
 * Integração Aedifex → pimo-alfa (boundary público).
 *
 * Fase 1: apenas documentação e scaffold.
 * Runtime de fusão começa na Fase 2 (bridge).
 *
 * Regra: ViewerCore NÃO importa este módulo.
 * @see ./PLAN_FASE1.md
 * @see ../industrial/viewerIntegration.ts (padrão de boundary)
 */

export const AEDIFEX_INTEGRATION_PHASE = 3 as const;

export const AEDIFEX_INTEGRATION_STATUS = {
  phase: AEDIFEX_INTEGRATION_PHASE,
  label: "fase-b-multi-level-walkthrough",
  runtimeEnabled: true,
  note: "RoomEngine Fase B: multi-level, slabs, walkthrough",
} as const;
