/**
 * FASE 4 — Etapa 8 (Parte 2): MaterialLibrary v2.
 * Converte MaterialRecord + MaterialPreset em objeto visual completo para o Viewer.
 * Suporta cor base, textura, UV scale/rotation, roughness, metallic, normal map.
 */

import * as THREE from "three";
import type { MaterialRecord } from "./types";
import type { MaterialPreset } from "./presets";
import { getMaterialForBox, getMaterialByIdOrLabel } from "./service";
import { getPresetById, getDefaultPreset } from "./presetService";
import type { BoxModule } from "../types";

/** Objeto visual final para renderização (cor, textura, UV, PBR). */
export interface VisualMaterial {
  color: string;
  textureUrl?: string;
  uvScale: { x: number; y: number };
  uvRotation: number;
  roughness: number;
  metallic: number;
  normalMapUrl?: string;
}

const DEFAULT_UV_SCALE = { x: 1, y: 1 };
const DEFAULT_ROUGHNESS = 0.6;
const DEFAULT_METALLIC = 0;

/**
 * Constrói um VisualMaterial a partir de MaterialRecord e MaterialPreset.
 * Fallbacks: preset sem textura → só cor base; campos em falta → valores padrão.
 */
export function buildVisualMaterial(
  materialRecord: MaterialRecord | null,
  preset: MaterialPreset
): VisualMaterial {
  const color =
    (materialRecord?.color && /^#[0-9A-Fa-f]{3,8}$/.test(materialRecord.color))
      ? materialRecord.color
      : preset.color;
  return {
    color: color ?? "#f5f5f5",
    textureUrl: preset.textureUrl ?? materialRecord?.textureUrl,
    uvScale: preset.uvScale
      ? { x: Number(preset.uvScale.x) || 1, y: Number(preset.uvScale.y) || 1 }
      : DEFAULT_UV_SCALE,
    uvRotation: Number(preset.uvRotation) || 0,
    roughness: Math.max(0, Math.min(1, Number(preset.roughness) ?? DEFAULT_ROUGHNESS)),
    metallic: Math.max(0, Math.min(1, Number(preset.metallic) ?? DEFAULT_METALLIC)),
    normalMapUrl: preset.normalMapUrl,
  };
}

/**
 * Resolve o material visual para uma caixa: CRUD → presetService → buildVisualMaterial.
 */
export function getVisualMaterialForBox(
  box: BoxModule,
  projectMaterialId?: string
): VisualMaterial {
  const materialId = getMaterialForBox(box, projectMaterialId);
  const record = materialId ? getMaterialByIdOrLabel(materialId) : null;
  const preset =
    (record?.visualPresetId && getPresetById(record.visualPresetId)) || getDefaultPreset();
  return buildVisualMaterial(record, preset);
}

/**
 * Cria um THREE.MeshStandardMaterial a partir de VisualMaterial (cor, roughness, metallic).
 * Textura é carregada de forma assíncrona; use applyVisualMaterialToMesh para aplicar também map/UV.
 */
export function getThreeJsMaterial(visualMaterial: VisualMaterial): THREE.MeshStandardMaterial {
  const color = new THREE.Color(visualMaterial.color ?? "#f5f5f5");
  const roughness = Math.max(0, Math.min(1, visualMaterial.roughness ?? DEFAULT_ROUGHNESS));
  const metalness = Math.max(0, Math.min(1, visualMaterial.metallic ?? DEFAULT_METALLIC));
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive: new THREE.Color(0x000000),
  });
}

/**
 * Fallback seguro quando não há record nem preset.
 */
export function getFallbackMaterial(): VisualMaterial {
  const preset = getDefaultPreset();
  return buildVisualMaterial(null, preset);
}

/** Peça com campos opcionais de material/UV (Layout Engine). */
export interface PieceWithMaterialFields {
  visualMaterial?: VisualMaterial;
  grainDirection?: "horizontal" | "vertical" | "none";
  uvScaleOverride?: { x: number; y: number };
  uvRotationOverride?: number;
}

/**
 * Calcula a escala UV efetiva para uma peça: overrides têm prioridade; senão, regra por grainDirection.
 * horizontal → uvScale.x > uvScale.y (ex.: 2, 1); vertical → uvScale.y > uvScale.x (ex.: 1, 2); none → preset.
 */
export function getEffectiveUvScaleForPiece(piece: PieceWithMaterialFields): { x: number; y: number } {
  if (piece.uvScaleOverride && Number.isFinite(piece.uvScaleOverride.x) && Number.isFinite(piece.uvScaleOverride.y)) {
    return { x: piece.uvScaleOverride.x, y: piece.uvScaleOverride.y };
  }
  const base = piece.visualMaterial?.uvScale ?? DEFAULT_UV_SCALE;
  const g = piece.grainDirection;
  if (g === "horizontal") return { x: 2, y: 1 };
  if (g === "vertical") return { x: 1, y: 2 };
  return { x: base.x, y: base.y };
}

/**
 * Calcula a rotação UV efetiva para uma peça: override ou valor do preset.
 */
export function getEffectiveUvRotationForPiece(piece: PieceWithMaterialFields): number {
  if (piece.uvRotationOverride !== undefined && Number.isFinite(piece.uvRotationOverride)) {
    return piece.uvRotationOverride;
  }
  return piece.visualMaterial?.uvRotation ?? 0;
}

/** TextureLoader partilhado para reutilização. */
let textureLoader: THREE.TextureLoader | null = null;
function getTextureLoader(): THREE.TextureLoader {
  if (!textureLoader) textureLoader = new THREE.TextureLoader();
  return textureLoader;
}

/**
 * Aplica o material visual a um mesh: cor base, roughness, metallic e, se existir textura, map + UV.
 * Não substitui o sistema atual do Viewer; uso opcional.
 * Se o mesh tiver material array (edge/face), aplica ao primeiro MeshStandardMaterial encontrado.
 */
export function applyVisualMaterialToMesh(
  mesh: THREE.Mesh,
  visualMaterial: VisualMaterial
): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const uvScale = visualMaterial.uvScale ?? DEFAULT_UV_SCALE;
  const uvRotationDeg = visualMaterial.uvRotation ?? 0;

  for (let i = 0; i < materials.length; i++) {
    const current = materials[i];
    let mat: THREE.MeshStandardMaterial;

    if (current instanceof THREE.MeshStandardMaterial) {
      mat = current;
    } else {
      mat = getThreeJsMaterial(visualMaterial);
      if (Array.isArray(mesh.material)) {
        const arr = [...(mesh.material as THREE.Material[])];
        arr[i] = mat;
        mesh.material = arr;
      } else {
        mesh.material = mat;
      }
    }

    mat.color.set(visualMaterial.color ?? "#f5f5f5");
    mat.roughness = Math.max(0, Math.min(1, visualMaterial.roughness ?? DEFAULT_ROUGHNESS));
    mat.metalness = Math.max(0, Math.min(1, visualMaterial.metallic ?? DEFAULT_METALLIC));
    mat.needsUpdate = true;

    if (visualMaterial.textureUrl && visualMaterial.textureUrl.trim()) {
      getTextureLoader().load(
        visualMaterial.textureUrl.trim(),
        (texture) => {
          mat.map = texture;
          texture.repeat.set(uvScale.x, uvScale.y);
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.rotation = (uvRotationDeg * Math.PI) / 180;
          mat.needsUpdate = true;
        },
        undefined,
        () => {
          // Em caso de erro de carregamento, mantém apenas cor base
        }
      );
    }
  }
}
