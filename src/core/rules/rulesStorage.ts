/**
 * Armazenamento de regras dinâmicas (LocalStorage).
 * loadRules, saveRules, resetRules.
 */

import { defaultRulesConfig, type RulesConfig } from "./rulesConfig";

const RULES_STORAGE_KEY = "pimo-rules-config-v1";

/**
 * Carrega regras do LocalStorage; se não existirem, retorna defaults.
 */
export function loadRules(): RulesConfig {
  try {
    const stored = localStorage.getItem(RULES_STORAGE_KEY);
    if (!stored) return defaultRulesConfig;
    const parsed = JSON.parse(stored) as RulesConfig;
    return parsed;
  } catch {
    return defaultRulesConfig;
  }
}

/**
 * Guarda regras no LocalStorage.
 */
export function saveRules(rules: RulesConfig): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules, null, 2));
  } catch (error) {
    console.error("Erro ao guardar regras:", error);
  }
}

/**
 * Repõe regras para os valores padrão.
 */
export function resetRules(): RulesConfig {
  const defaults = defaultRulesConfig;
  saveRules(defaults);
  return defaults;
}
