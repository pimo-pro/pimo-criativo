// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import type { CutLayoutResult } from "../cutlayout/cutLayoutTypes";
import type { CutListItem } from "../types";
import type { ProjectState } from "../../context/projectTypes";

export type InvariantSeverity = "info" | "warning" | "error";

export type InvariantPhase = "viewer" | "drilling" | "cutlayout" | "export";

export type InvariantContextInfo = {
  piece?: string;
  box?: string;
  boxId?: string;
  operation?: string;
  phase?: InvariantPhase;
  pieceId?: string;
};

export type InvariantIssue = {
  ruleId: string;
  ruleName: string;
  severity: InvariantSeverity;
  message: string;
  context: InvariantContextInfo;
  phase: InvariantPhase;
};

export type InvariantValidationInput = {
  project: ProjectState;
  cutList?: CutListItem[];
  layoutResult?: CutLayoutResult | null;
  phase: InvariantPhase;
};

export type InvariantValidatorFn = (input: InvariantValidationInput) => InvariantIssue[];

/** Definição built-in de um validador (código). */
export type InvariantValidatorDefinition = {
  id: string;
  defaultName: string;
  defaultDescription: string;
  defaultSeverity: InvariantSeverity;
  phases: InvariantPhase[];
  validate: InvariantValidatorFn;
};

/** Instância configurável de regra (admin / localStorage). */
export type InvariantRuleConfig = {
  id: string;
  validatorId: string;
  name: string;
  description: string;
  severity: InvariantSeverity;
  enabled: boolean;
  /** Regra criada pelo utilizador no admin (vs. built-in seed). */
  isCustom?: boolean;
  params?: Record<string, number | boolean | string>;
};

export type InvariantSystemConfig = {
  /** Quando true, exportações com violações de severidade error são bloqueadas. */
  blockGenerationOnErrors: boolean;
  rules: InvariantRuleConfig[];
};

export type InvariantSuiteResult = {
  phase: InvariantPhase;
  issues: InvariantIssue[];
  ranAt: number;
};
