/**
 * Sanitização de catálogo e component types persistidos (localStorage).
 * Garante defaults alinhados ao SSOT industrial actual.
 */

import type { ComponentType } from "../components/componentTypes";
import { COMPONENT_TYPES_DEFAULT } from "../components/componentTypes";
import type { Ferragem } from "./ferragens";
import { FERRAGENS_DEFAULT } from "./ferragens";
import { CAVILHA_10x40_FERRAGEM_ID } from "../drill/cavilha10x40Rule";

const LEGACY_CAVILHA_10MM_ID = "cavilha_10mm";

function defaultComponentById(): Map<string, ComponentType> {
  return new Map(COMPONENT_TYPES_DEFAULT.map((ct) => [ct.id, ct]));
}

/** Remove duplicado legado cavilha_10mm; funde preço no canónico se existir. */
export function sanitizeFerragensCatalog(catalog: Ferragem[]): Ferragem[] {
  const defaultsById = new Map(FERRAGENS_DEFAULT.map((f) => [f.id, f]));
  const out: Ferragem[] = [];
  let sawCanonicalCavilha = false;

  for (const entry of catalog) {
    if (entry.id === LEGACY_CAVILHA_10MM_ID) {
      continue;
    }
    if (entry.id === CAVILHA_10x40_FERRAGEM_ID) {
      sawCanonicalCavilha = true;
    }
    out.push(entry);
  }

  if (!sawCanonicalCavilha) {
    const fromDefault = defaultsById.get(CAVILHA_10x40_FERRAGEM_ID);
    if (fromDefault) out.push(fromDefault);
  }

  return out.length > 0 ? out : [...FERRAGENS_DEFAULT];
}

/** Alinha component types persistidos aos defaults SSOT (prego, puxador, corrediças, frente_fixa). */
export function sanitizeComponentTypes(types: ComponentType[]): ComponentType[] {
  const defaults = defaultComponentById();
  const merged = types.map((ct) => {
    const base = defaults.get(ct.id);
    if (!base) return ct;
    return {
      ...ct,
      ferragens_default: base.ferragens_default ?? ct.ferragens_default,
      regras_de_furo: mergeRegrasDeFuro(base, ct),
    };
  });

  const ids = new Set(merged.map((c) => c.id));
  for (const [id, base] of defaults) {
    if (!ids.has(id) && id === "frente_fixa") {
      merged.push(base);
    }
  }

  return merged.length > 0 ? merged : [...COMPONENT_TYPES_DEFAULT];
}

function mergeRegrasDeFuro(base: ComponentType, stored: ComponentType): ComponentType["regras_de_furo"] {
  const storedRules = stored.regras_de_furo ?? [];
  const baseRules = base.regras_de_furo ?? [];
  if (stored.id === "costa") {
    return baseRules;
  }
  const normalized = storedRules.map((rule) => {
    if (rule.tipo === "cavilha" && rule.diametro === 8) {
      return { ...rule, diametro: 10 };
    }
    return rule;
  });
  return normalized.length > 0 ? normalized : baseRules;
}
