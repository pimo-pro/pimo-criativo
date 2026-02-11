/**
 * FASE 4 — Etapa 8 (Parte 1): Serviço de Material Presets.
 * Carrega presets de um objeto estático; suporta leitura e alterações em memória.
 */

import type { MaterialPreset } from "./presets";
import { INITIAL_MATERIAL_PRESETS } from "./presets";

const DEFAULT_PRESET_ID = "branco_liso";

/** Store em memória (cópia dos iniciais para permitir register/update/delete). */
let store: Map<string, MaterialPreset> = new Map(
  INITIAL_MATERIAL_PRESETS.map((p) => [p.id, { ...p }])
);

function clonePreset(p: MaterialPreset): MaterialPreset {
  return {
    ...p,
    uvScale: p.uvScale ? { ...p.uvScale } : undefined,
  };
}

/**
 * Devolve todos os presets.
 */
export function getAllPresets(): MaterialPreset[] {
  return Array.from(store.values()).map(clonePreset);
}

/**
 * Devolve um preset por id, ou null.
 */
export function getPresetById(id: string): MaterialPreset | null {
  const p = store.get(id);
  return p ? clonePreset(p) : null;
}

/**
 * Devolve um preset por nome (case-insensitive), ou null.
 */
export function getPresetByName(name: string): MaterialPreset | null {
  if (!name || typeof name !== "string") return null;
  const lower = name.trim().toLowerCase();
  for (const p of store.values()) {
    if (p.name.trim().toLowerCase() === lower) return clonePreset(p);
  }
  return null;
}

/**
 * Regista um novo preset. Se o id já existir, não sobrescreve (retorna false).
 */
export function registerPreset(preset: MaterialPreset): boolean {
  if (!preset?.id || !preset?.name || typeof preset.color !== "string") return false;
  if (store.has(preset.id)) return false;
  store.set(preset.id, clonePreset(preset));
  return true;
}

/**
 * Atualiza um preset existente. Apenas campos fornecidos são alterados.
 */
export function updatePreset(
  id: string,
  data: Partial<Omit<MaterialPreset, "id">>
): boolean {
  const existing = store.get(id);
  if (!existing) return false;
  const updated: MaterialPreset = {
    ...existing,
    ...data,
    id: existing.id,
  };
  store.set(id, updated);
  return true;
}

/**
 * Remove um preset por id.
 */
export function deletePreset(id: string): boolean {
  return store.delete(id);
}

/**
 * Fallback seguro: devolve o preset "Branco Liso" ou o primeiro disponível.
 */
export function getDefaultPreset(): MaterialPreset {
  const p = store.get(DEFAULT_PRESET_ID) ?? store.values().next().value;
  if (p) return clonePreset(p);
  return {
    id: "fallback",
    name: "Fallback",
    color: "#ffffff",
    uvScale: { x: 1, y: 1 },
    roughness: 0.6,
    metallic: 0,
  };
}
