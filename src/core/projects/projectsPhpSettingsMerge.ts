/**
 * Espelho do merge defensivo de settings no POST de projectos PHP.
 * Fonte: public_html/api/projects/index.php (~513-528), hostinger/api/projects/index.php (igual).
 *
 * Uso: diagnóstico Fase 3E (H2) — não substituir nem alterar a API em produção.
 */

import { asObject } from "./projectsMappers";

/** Chaves preservadas do ficheiro existente quando o POST não as envia. */
export const PHP_DEFENSIVE_SETTINGS_KEYS = ["projectReport", "productionRelease"] as const;

/**
 * Replica o ramo «Merge defensivo» do POST quando já existe ficheiro no disco.
 * Devolve uma cópia de `incoming` com settings fundidos quando aplicável.
 */
export function applyPhpDefensiveSettingsMerge(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...incoming };
  const old = asObject(existing);
  if (!old) return result;

  const oldSettings = asObject(old.settings) ?? {};
  const inSettings = asObject(result.settings) ?? {};
  let settingsMerged = false;
  const mergedSettings: Record<string, unknown> = { ...inSettings };

  for (const key of PHP_DEFENSIVE_SETTINGS_KEYS) {
    const incomingHasKey = Object.prototype.hasOwnProperty.call(inSettings, key);
    const oldValue = oldSettings[key];
    const oldHasValue = oldValue !== undefined && oldValue !== null;
    if (!incomingHasKey && oldHasValue) {
      mergedSettings[key] = oldValue;
      settingsMerged = true;
    }
  }

  if (settingsMerged) {
    result.settings = mergedSettings;
  }
  return result;
}
