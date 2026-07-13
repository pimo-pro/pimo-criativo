// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import type { InvariantPhase, InvariantValidatorDefinition, InvariantValidatorFn } from "./types";
import {
  validateBoxRotationInconsistent,
  validateDrillHolesOutOfBounds,
  validateInvalidPieceDimensions,
  validateProjectLayoutWarnings,
  validateProjectRuleViolations,
} from "./phases/viewerInvariants";
import { runDrillingInvariants } from "./phases/drillingInvariants";
import { runCutlayoutInvariants } from "./phases/cutlayoutInvariants";
import { runExportInvariants } from "./phases/exportInvariants";

const VALIDATOR_ENTRIES: InvariantValidatorDefinition[] = [
  {
    id: "drill-holes-out-of-bounds",
    defaultName: "Furos fora da peça",
    defaultDescription: "Detecta furos fora dos limites do painel.",
    defaultSeverity: "error",
    phases: ["drilling", "export"],
    validate: validateDrillHolesOutOfBounds,
  },
  {
    id: "invalid-piece-dimensions",
    defaultName: "Dimensões inválidas",
    defaultDescription: "Peças com dimensões zero ou negativas.",
    defaultSeverity: "error",
    phases: ["viewer", "drilling", "cutlayout", "export"],
    validate: validateInvalidPieceDimensions,
  },
  {
    id: "box-rotation-inconsistent",
    defaultName: "Rotação inconsistente",
    defaultDescription: "Transformações de rotação inválidas nas caixas.",
    defaultSeverity: "warning",
    phases: ["viewer"],
    validate: validateBoxRotationInconsistent,
  },
  {
    id: "layout-placement-overlap",
    defaultName: "Sobreposição no layout",
    defaultDescription: "Peças sobrepostas no nesting/layout.",
    defaultSeverity: "error",
    phases: ["cutlayout", "export"],
    validate: runCutlayoutInvariants,
  },
  {
    id: "layout-placement-outside-sheet",
    defaultName: "Peça fora da chapa",
    defaultDescription: "Colocações fora dos limites da chapa.",
    defaultSeverity: "error",
    phases: ["cutlayout", "export"],
    validate: runCutlayoutInvariants,
  },
  {
    id: "empty-cutlist-export",
    defaultName: "Cutlist vazia",
    defaultDescription: "Exportação sem peças na cutlist.",
    defaultSeverity: "warning",
    phases: ["export"],
    validate: runExportInvariants,
  },
  {
    id: "project-rule-violations",
    defaultName: "Violações de regras do projeto",
    defaultDescription: "Regras de negócio com violações activas.",
    defaultSeverity: "warning",
    phases: ["viewer", "export"],
    validate: validateProjectRuleViolations,
  },
  {
    id: "project-layout-warnings",
    defaultName: "Avisos de layout de modelos",
    defaultDescription: "Modelos CAD com colisões ou fora de limites.",
    defaultSeverity: "info",
    phases: ["viewer"],
    validate: validateProjectLayoutWarnings,
  },
];

const validatorById = new Map<string, InvariantValidatorDefinition>(
  VALIDATOR_ENTRIES.map((v) => [v.id, v])
);

export function getInvariantValidator(id: string): InvariantValidatorDefinition | undefined {
  return validatorById.get(id);
}

export function listInvariantValidators(): InvariantValidatorDefinition[] {
  return [...VALIDATOR_ENTRIES];
}

export function listValidatorsForPhase(phase: InvariantPhase): InvariantValidatorDefinition[] {
  return VALIDATOR_ENTRIES.filter((v) => v.phases.includes(phase));
}

/** Mapa validatorId → função (para extensão futura). */
export function resolveValidatorFn(validatorId: string): InvariantValidatorFn | undefined {
  return validatorById.get(validatorId)?.validate;
}

/** Fase agregada — executa todos os validadores da fase. */
export function runPhaseValidators(phase: InvariantPhase, input: Parameters<InvariantValidatorFn>[0]) {
  switch (phase) {
    case "viewer":
      return [
        ...validateInvalidPieceDimensions(input),
        ...validateBoxRotationInconsistent(input),
        ...validateProjectRuleViolations(input),
        ...validateProjectLayoutWarnings(input),
      ];
    case "drilling":
      return runDrillingInvariants(input);
    case "cutlayout":
      return runCutlayoutInvariants(input);
    case "export":
      return runExportInvariants(input);
    default:
      return [];
  }
}
