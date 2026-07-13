// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import type { InvariantRuleConfig, InvariantSystemConfig } from "../types";

export const INVARIANT_STORAGE_KEY = "pimo_invariants_v1";

export const BUILTIN_RULE_SEEDS: InvariantRuleConfig[] = [
  {
    id: "inv-drill-out-of-bounds",
    validatorId: "drill-holes-out-of-bounds",
    name: "Furos fora da peça",
    description: "Detecta furos de furação com coordenadas fora dos limites do painel.",
    severity: "error",
    enabled: true,
  },
  {
    id: "inv-invalid-dimensions",
    validatorId: "invalid-piece-dimensions",
    name: "Dimensões inválidas",
    description: "Peças com largura, altura ou espessura zero ou negativa.",
    severity: "error",
    enabled: true,
  },
  {
    id: "inv-rotation-nan",
    validatorId: "box-rotation-inconsistent",
    name: "Rotação inconsistente",
    description: "Caixas com valores de rotação inválidos (NaN ou infinito).",
    severity: "warning",
    enabled: true,
  },
  {
    id: "inv-layout-overlap",
    validatorId: "layout-placement-overlap",
    name: "Sobreposição no layout",
    description: "Peças sobrepostas no layout de corte industrial.",
    severity: "error",
    enabled: true,
  },
  {
    id: "inv-layout-outside",
    validatorId: "layout-placement-outside-sheet",
    name: "Peça fora da chapa",
    description: "Colocações do layout fora dos limites da chapa.",
    severity: "error",
    enabled: true,
  },
  {
    id: "inv-empty-cutlist",
    validatorId: "empty-cutlist-export",
    name: "Cutlist vazia",
    description: "Tentativa de exportação sem peças na lista de corte.",
    severity: "warning",
    enabled: true,
  },
  {
    id: "inv-rule-violations",
    validatorId: "project-rule-violations",
    name: "Violações de regras do projeto",
    description: "Regras de negócio do configurador com violações activas.",
    severity: "warning",
    enabled: true,
  },
  {
    id: "inv-layout-warnings",
    validatorId: "project-layout-warnings",
    name: "Avisos de layout de modelos",
    description: "Modelos CAD com colisões ou fora dos limites da caixa.",
    severity: "info",
    enabled: true,
  },
];

export const INVARIANT_SYSTEM_DEFAULTS: InvariantSystemConfig = {
  blockGenerationOnErrors: false,
  rules: BUILTIN_RULE_SEEDS,
};
