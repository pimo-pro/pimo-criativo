/**
 * MaterialEngine — Núcleo do sistema de materiais realistas.
 * Presets por modo (performance, showcase, realistic); cache de texturas; ligação com ViewerCore.
 */

import * as THREE from "three";
import type {
  MaterialMode,
  MaterialPresetDefinition,
  LoadedMaterialResult,
  BuildMaterialOptions,
} from "./types";
import { getPreset, getDefaultPreset } from "./presetRegistry";
import { getSceneMaterialConfig as getSceneConfig } from "./sceneMaterialConfig";
import { createWoodMaterial } from "../../materials/WoodMaterial";
import {
  clearMapsFromMaterial,
  applyMapsToMaterialAsync,
  assignMaterialToMesh,
} from "./applyMaterialToMesh";
import { loadTextureAsync } from "./textureCache";
import { getDefaultOfficialMaterial } from "../../../core/materials/materials.api";

/** Modo global (default: performance para manter comportamento atual). */
let currentMode: MaterialMode = "performance";
let materialEngineEnsured = false;

/** Z-01.2.9 — marca o motor de materiais como activo na primeira chamada de API. */
export function ensureMaterialEngine(): void {
  materialEngineEnsured = true;
}

export function isMaterialEngineEnsured(): boolean {
  return materialEngineEnsured;
}

/**
 * Lacado (MeshPhysical + clearcoat): sincronizado pelo ViewerCore com `materialQuality === "lacquered"`.
 * Usado por loadMaterial quando não há opção explícita (ex.: BoxMaterialApplier na construção).
 */
let lacqueredClearcoatPipeline = false;

export function setLacqueredClearcoatPipeline(enabled: boolean): void {
  lacqueredClearcoatPipeline = enabled;
}

export function getLacqueredClearcoatPipeline(): boolean {
  return lacqueredClearcoatPipeline;
}

export function getMaterialMode(): MaterialMode {
  return currentMode;
}

export function setMaterialMode(mode: MaterialMode): void {
  ensureMaterialEngine();
  currentMode = mode;
  invalidateOfficialMaterialCache();
}

/** Carrega textura por URL (cache global); usado pelo pipeline unificado. */
export function loadTextureIfNeeded(url: string): Promise<THREE.Texture | null> {
  return loadTextureAsync(url);
}

const sharedOfficialMaterialCache = new Map<
  string,
  THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
>();

export function invalidateOfficialMaterialCache(): void {
  sharedOfficialMaterialCache.clear();
}

/**
 * Material partilhável por id oficial (portas/gavetas na construção da caixa).
 * Texturas carregadas de forma assíncrona via textureUrl do preset.
 */
export function getMaterialForOfficialId(
  materialId: string
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const key = (materialId ?? "").trim() || getDefaultOfficialMaterial().canonicalId;
  const cached = sharedOfficialMaterialCache.get(key);
  if (cached) return cached;

  const result = loadMaterial(key, currentMode, {
    useLacqueredClearcoat: lacqueredClearcoatPipeline,
  });
  if (result?.material) {
    sharedOfficialMaterialCache.set(key, result.material);
    return result.material;
  }

  const fallback = loadMaterial(getDefaultOfficialMaterial().canonicalId, currentMode, {
    useLacqueredClearcoat: lacqueredClearcoatPipeline,
  });
  if (fallback?.material) {
    sharedOfficialMaterialCache.set(key, fallback.material);
    return fallback.material;
  }

  const { material } = createWoodMaterial({}, { color: "#f2f0eb", roughness: 0.55, metalness: 0 });
  sharedOfficialMaterialCache.set(key, material);
  return material;
}

/**
 * Material exclusivo por mesh (remate/rodapé — dispose seguro, sem partilhar instância).
 */
export function createMaterialForOfficialId(
  materialId: string
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const key = (materialId ?? "").trim() || getDefaultOfficialMaterial().canonicalId;
  const result = loadMaterial(key, currentMode, {
    useLacqueredClearcoat: lacqueredClearcoatPipeline,
  });
  if (result?.material) return result.material;
  const fallback = loadMaterial(getDefaultOfficialMaterial().canonicalId, currentMode, {
    useLacqueredClearcoat: lacqueredClearcoatPipeline,
  });
  if (fallback?.material) return fallback.material;
  return createWoodMaterial({}, { color: "#f2f0eb", roughness: 0.55, metalness: 0 }).material;
}

/**
 * Clone exclusivo para face de peça (gaveta / frente-fixa).
 * Re-dispara applyMapsToMaterialAsync no clone — mapas async da instância loadMaterial
 * não propagam via .clone() se feito antes do Promise resolver.
 */
export function createClonedMaterialWithDetailMaps(
  materialId: string,
  options?: { onMapsApplied?: () => void }
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | null {
  const key = (materialId ?? "").trim() || getDefaultOfficialMaterial().canonicalId;
  const result = loadMaterial(key, currentMode, {
    useLacqueredClearcoat: lacqueredClearcoatPipeline,
  });
  if (!result?.material) return null;
  const preset = getPreset(key) ?? getDefaultPreset();
  const mat = result.material.clone();
  if (preset.textureUrl || preset.normalMapUrl || preset.roughnessMapUrl) {
    applyMapsToMaterialAsync(mat, preset, options?.onMapsApplied);
  } else {
    options?.onMapsApplied?.();
  }
  mat.needsUpdate = true;
  return mat;
}

/**
 * Devolve o preset normalizado por materialId (resolve aliases via materials.api).
 */
export function loadPreset(materialId: string): MaterialPresetDefinition | null {
  return getPreset(materialId);
}

/**
 * Constrói MeshStandardMaterial ou MeshPhysicalMaterial (lacado + clearcoat) a partir do preset e modo.
 * Cor + PBR sempre; map/normalMap/roughnessMap quando existirem no preset (textureUrl).
 * Modo performance mantém PBR leve; texturas reais da chapa são sempre aplicadas se definidas.
 */
export function buildThreeMaterial(
  preset: MaterialPresetDefinition,
  _mode: MaterialMode,
  buildOptions?: BuildMaterialOptions
): LoadedMaterialResult {
  const useLacquered = Boolean(buildOptions?.useLacqueredClearcoat);
  const options = {
    color: preset.baseColor,
    roughness: preset.roughness,
    metalness: preset.metalness,
    envMapIntensity: preset.envMapIntensity ?? 0.4,
  };

  let material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  let textures: THREE.Texture[];

  if (useLacquered) {
    material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(preset.baseColor),
      roughness: preset.roughness,
      metalness: preset.metalness,
      envMapIntensity: preset.envMapIntensity ?? 0.4,
      emissive: new THREE.Color(0x000000),
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    textures = [];
  } else {
    const created = createWoodMaterial({}, options);
    material = created.material;
    textures = created.textures;
  }

  const hasDetailMaps = Boolean(
    preset.textureUrl || preset.normalMapUrl || preset.roughnessMapUrl
  );

  if (hasDetailMaps) {
    applyMapsToMaterialAsync(material, preset);
  } else {
    clearMapsFromMaterial(material);
  }

  return {
    material,
    textures,
    loadDetailMaps: () => Promise.resolve(),
    areDetailMapsLoaded: () => true,
  };
}

/**
 * Carrega material para uma caixa (compatível com LoadedWoodMaterial do ViewerCore).
 * Usa materialId e modo atual; fallback para mdf_branco.
 */
export function loadMaterial(
  materialId: string,
  mode: MaterialMode = currentMode,
  buildOptions?: BuildMaterialOptions
): LoadedMaterialResult | null {
  ensureMaterialEngine();
  const preset = getPreset(materialId) ?? getDefaultPreset();
  const useClearcoat =
    buildOptions?.useLacqueredClearcoat !== undefined
      ? buildOptions.useLacqueredClearcoat
      : lacqueredClearcoatPipeline;
  return buildThreeMaterial(preset, mode, { useLacqueredClearcoat: useClearcoat });
}

/**
 * Aplica material a um mesh: resolve preset, constrói material, atribui ao mesh.
 */
export function applyMaterialToMesh(
  mesh: THREE.Mesh,
  materialId: string,
  mode: MaterialMode = currentMode
): void {
  const result = loadMaterial(materialId, mode, {
    useLacqueredClearcoat: lacqueredClearcoatPipeline,
  });
  if (!result) return;
  assignMaterialToMesh(mesh, result.material);
}

/**
 * Configuração unificada de materiais de cena (paredes, chão, room box, ground).
 */
export function getSceneMaterialConfig() {
  return getSceneConfig();
}
