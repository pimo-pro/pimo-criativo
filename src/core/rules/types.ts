/**
 * Regras dinâmicas por modelo GLB.
 * Cada modelo pode ter regras de dimensão, material, compatibilidade e comportamento.
 */

import type { Dimensoes } from "../types";

/** Identificador único de um tipo de regra. */
export type RuleKind =
  | "dimension"
  | "material"
  | "compatibility"
  | "position"
  | "behavior";

/** Severidade da violação (para UI e feedback). */
export type RuleSeverity = "error" | "warning" | "info";

/** Regra de dimensão: limites min/max em mm (relativos à caixa ou absolutos). */
export interface DimensionRule {
  kind: "dimension";
  id: string;
  enabled: boolean;
  /** Ex.: "altura", "largura", "profundidade". */
  dimension: keyof Dimensoes;
  minMm?: number;
  maxMm?: number;
  /** Se true, valores são relativos à caixa (ex.: altura máx = 80% da caixa). */
  relativeToBox?: boolean;
  /** Percentual 0–100 quando relativeToBox. */
  minPercent?: number;
  maxPercent?: number;
  message?: string;
}

/** Regra de material: materiais permitidos para este modelo. */
export interface MaterialRule {
  kind: "material";
  id: string;
  enabled: boolean;
  allowedMaterials: string[];
  message?: string;
}

/** Regra de compatibilidade: ex. máx instâncias por caixa, ou categorias permitidas na caixa. */
export interface CompatibilityRule {
  kind: "compatibility";
  id: string;
  enabled: boolean;
  maxInstancesPerBox?: number;
  allowedCategoriesInBox?: string[];
  message?: string;
}

/** Regra de posição: posições válidas (ex.: só frente, só interior). */
export interface PositionRule {
  kind: "position";
  id: string;
  enabled: boolean;
  /** "frente" | "interior" | "qualquer" */
  validSlots?: string[];
  message?: string;
}

/** Regra de comportamento: snapping, auto-posicionamento. */
export interface BehaviorRule {
  kind: "behavior";
  id: string;
  enabled: boolean;
  snapToGridMm?: number;
  autoPosition?: "none" | "stack" | "align_front" | "align_center";
  message?: string;
}

export type SingleRule =
  | DimensionRule
  | MaterialRule
  | CompatibilityRule
  | PositionRule
  | BehaviorRule;

/** Conjunto de regras associado a um modelo (por modelId no catálogo). */
export interface ModelRules {
  modelId: string;
  rules: SingleRule[];
  /** Override por instância (opcional) pode ser guardado em BoxModelInstance. */
}

/** Informação de violação de regra (para estado e UI). */
export interface RuleViolation {
  id: string;
  ruleKind: RuleKind;
  ruleId: string;
  severity: RuleSeverity;
  message: string;
  boxId: string;
  modelInstanceId: string;
  modelId: string;
  /** Dados extras para correção (ex.: valor atual vs limite). */
  details?: Record<string, unknown>;
}

/** Contexto para validação: caixa + instâncias + (opcional) dimensões do modelo carregado. */
export interface ValidationContext {
  boxId: string;
  boxDimensoes: Dimensoes;
  boxModels: Array<{ id: string; modelId: string; material?: string; categoria?: string }>;
  modelInstanceId: string;
  modelId: string;
  material?: string;
  categoria?: string;
  /** Dimensões do modelo (bbox) em mm, se disponível. */
  modelDimensoesMm?: Dimensoes;
  /** Posição atual do modelo em mm (se aplicável). */
  positionMm?: { x: number; y: number; z: number };
}

/** Resultado de posicionamento automático. */
export interface AutoPositionResult {
  positionMm: { x: number; y: number; z: number };
  rotationDeg?: { x: number; y: number; z: number };
  snapped: boolean;
  reason?: string;
}
