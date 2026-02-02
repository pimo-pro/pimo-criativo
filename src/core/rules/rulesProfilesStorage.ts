/**
 * Armazenamento de perfis de regras (LocalStorage).
 * loadProfiles, saveProfiles, setActiveProfile, resetProfiles.
 */

import { defaultProfilesConfig, DEFAULT_PROFILE_ID, type RulesProfilesConfig } from "./rulesProfiles";

const PROFILES_STORAGE_KEY = "pimo-rules-profiles-v1";

/**
 * Carrega perfis do LocalStorage; se não existirem, retorna defaults.
 */
export function loadProfiles(): RulesProfilesConfig {
  try {
    const stored = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!stored) return defaultProfilesConfig;
    const parsed = JSON.parse(stored) as RulesProfilesConfig;
    // Garantir que existe pelo menos um perfil e que perfilAtivoId é válido
    const perfis = Array.isArray(parsed.perfis) && parsed.perfis.length > 0 ? parsed.perfis : defaultProfilesConfig.perfis;
    const perfilAtivoId =
      perfis.some((p) => p.id === parsed.perfilAtivoId) ? parsed.perfilAtivoId : perfis[0].id;
    return { perfis, perfilAtivoId };
  } catch {
    return defaultProfilesConfig;
  }
}

/**
 * Guarda perfis no LocalStorage.
 */
export function saveProfiles(config: RulesProfilesConfig): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Erro ao guardar perfis:", error);
  }
}

/**
 * Define o perfil ativo; retorna a configuração atualizada (não persiste).
 */
export function setActiveProfileId(config: RulesProfilesConfig, id: string): RulesProfilesConfig {
  const exists = config.perfis.some((p) => p.id === id);
  if (!exists) return config;
  return { ...config, perfilAtivoId: id };
}

/**
 * Repõe perfis para os valores padrão.
 */
export function resetProfiles(): RulesProfilesConfig {
  const defaults = defaultProfilesConfig;
  saveProfiles(defaults);
  return defaults;
}

/** ID do perfil padrão (não removível). */
export { DEFAULT_PROFILE_ID };
