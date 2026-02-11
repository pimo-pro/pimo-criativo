/**
 * FASE 3 — Materials System
 * FASE 4 Etapa 8: Material Presets Engine (presets.ts, presetService.ts).
 * Nota: MaterialPreset e getPresetById existem em types/utils (CRUD) e em presets/presetService (visual).
 * Re-exportar tudo geraria conflito; para presets visuais use import de "./presetService" ou "./presets".
 */

export * from "./types";
export * from "./service";
export * from "./hooks";
export * from "./utils";
export type { MaterialPreset as VisualMaterialPreset, MaterialPresetRecord } from "./presets";
export { INITIAL_MATERIAL_PRESETS } from "./presets";
export {
  getAllPresets,
  getPresetById as getVisualPresetById,
  getPresetByName,
  registerPreset,
  updatePreset,
  deletePreset,
  getDefaultPreset,
} from "./presetService";
export * from "./materialLibraryV2";
