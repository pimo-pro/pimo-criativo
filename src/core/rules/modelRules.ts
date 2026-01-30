/**
 * Armazenamento e leitura de regras por modelo (modelId).
 * Regras são opcionais por modelo; sem regras = sem validação extra.
 */

import { safeGetItem, safeParseJson, safeSetItem } from "../../utils/storage";
import type { ModelRules, SingleRule } from "./types";

const RULES_STORAGE_KEY = "pimo_model_rules";

function getStoredRules(): ModelRules[] {
  const raw = safeGetItem(RULES_STORAGE_KEY);
  const parsed = safeParseJson<ModelRules[]>(raw);
  return Array.isArray(parsed) ? parsed : [];
}

/** Obtém regras do modelo por modelId (catálogo). */
export function getModelRules(modelId: string): ModelRules | undefined {
  const all = getStoredRules();
  return all.find((r) => r.modelId === modelId);
}

/** Obtém lista de regras ativas para um modelo. */
export function getRulesForModel(modelId: string): SingleRule[] {
  const modelRules = getModelRules(modelId);
  if (!modelRules) return [];
  return modelRules.rules.filter((r) => r.enabled);
}

/** Define regras completas para um modelo (substitui). */
export function setModelRules(modelId: string, rules: SingleRule[]): ModelRules {
  const all = getStoredRules();
  const filtered = all.filter((r) => r.modelId !== modelId);
  const next: ModelRules = { modelId, rules };
  safeSetItem(RULES_STORAGE_KEY, JSON.stringify([...filtered, next]));
  return next;
}

/** Atualiza uma regra específica (por id) no conjunto do modelo. */
export function updateModelRule(
  modelId: string,
  ruleId: string,
  updates: Partial<SingleRule>
): ModelRules | undefined {
  const current = getModelRules(modelId);
  if (!current) return undefined;
  const rules = current.rules.map((r) =>
    r.id === ruleId ? { ...r, ...updates } : r
  ) as SingleRule[];
  return setModelRules(modelId, rules);
}

/** Ativa ou desativa uma regra por id. */
export function setRuleEnabled(modelId: string, ruleId: string, enabled: boolean): ModelRules | undefined {
  return updateModelRule(modelId, ruleId, { enabled });
}

/** Lista todos os modelIds que têm regras definidas. */
export function getModelIdsWithRules(): string[] {
  return getStoredRules().map((r) => r.modelId);
}

/** Adiciona uma regra a um modelo (append). */
export function addModelRule(modelId: string, rule: SingleRule): ModelRules {
  const current = getModelRules(modelId);
  const rules = current ? [...current.rules, rule] : [rule];
  return setModelRules(modelId, rules);
}

/** Remove uma regra por id. */
export function removeModelRule(modelId: string, ruleId: string): ModelRules | undefined {
  const current = getModelRules(modelId);
  if (!current) return undefined;
  const rules = current.rules.filter((r) => r.id !== ruleId);
  return setModelRules(modelId, rules) as ModelRules;
}
