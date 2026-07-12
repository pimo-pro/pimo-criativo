/**
 * FASE 4 — Etapa 8 (Parte 2): MaterialLibrary v2.
 *
 * LEGACY / caminho paralelo: orientado a MaterialRecord + presets de domínio (CRUD / caixas).
 * Para materiais de caixas no viewer 3D, a fonte preferida é {@link loadMaterial} em
 * `viewer-engine/materials/MaterialEngine` + `updateBoxMaterial` no ViewerCore.
 * Este módulo mantém-se para integração dados→VisualMaterial e aplicação pontual em meshes
 * (`applyVisualMaterialToMesh`), sem remover a API até uma fase futura de consolidação.
 */

import * as THREE from "three";
import type { MaterialRecord } from "./types";
import type { MaterialPreset } from "./presets";
import { getMaterialForBox, getMaterialByIdOrLabel } from "./service";
import { getPresetById, getDefaultPreset } from "./presetService";
import type { BoxModule } from "../types";
import { loadTextureAsync } from "../../3d/viewer-engine/materials/textureCache";
import { isMaterialMadeira, isViewerGrainFlipped, resolveViewerGrainDirectionForPiece, resolveViewerGrainUvScale } from "./nestingGrainLock";

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
    roughness: Math.max(0, Math.min(1, Number(preset.roughness ?? DEFAULT_ROUGHNESS))),
    metallic: Math.max(0, Math.min(1, Number(preset.metallic ?? DEFAULT_METALLIC))),
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
 * Texturas (map) não são carregadas aqui — usam o mesmo `textureCache` do MaterialEngine em
 * {@link applyVisualMaterialToMesh} (`loadTextureAsync`), evitando duplicar texturas em memória.
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

/** Peça com campos opcionais de material/UV (Layout Engine / Viewer). */
export interface PieceWithMaterialFields {
  visualMaterial?: VisualMaterial;
  grainDirection?: "horizontal" | "vertical" | "none";
  uvScaleOverride?: { x: number; y: number };
  uvRotationOverride?: number;
  materialId?: string;
  pieceTipo?: string;
  allowPieceRotation?: boolean;
  industrialGrainCode?: import("../types").IndustrialGrainCode;
  /** Índice de rotação 0–3 (remates virados no viewer). */
  rotationSnapIndex?: number;
}

/**
 * Calcula a escala UV efetiva para uma peça: overrides têm prioridade; senão, regra por grainDirection.
 * horizontal → uvScale.x > uvScale.y (ex.: 2, 1); vertical → uvScale.y > uvScale.x (ex.: 1, 2); none → preset.
 */
export function getEffectiveUvScaleForPiece(piece: PieceWithMaterialFields): { x: number; y: number } {
  if (piece.uvScaleOverride && Number.isFinite(piece.uvScaleOverride.x) && Number.isFinite(piece.uvScaleOverride.y)) {
    return piece.uvScaleOverride;
  }
  const base = piece.visualMaterial?.uvScale ?? DEFAULT_UV_SCALE;
  const madeira = isMaterialMadeira(piece.materialId);
  const grainFlipped = isViewerGrainFlipped(piece.rotationSnapIndex);
  const grainDirection =
    piece.grainDirection ??
    resolveViewerGrainDirectionForPiece({
      pieceTipo: piece.pieceTipo,
      materialId: piece.materialId,
      allowPieceRotation: piece.allowPieceRotation,
      industrialGrainCode: piece.industrialGrainCode,
    });
  return resolveViewerGrainUvScale(base, {
    materialMadeira: madeira,
    grainFlipped,
    grainDirection,
  });
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

type WoodGrainMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

/** Aplica escala/rotação UV do veio a um material clonado (portas, gavetas, remates). */
export function applyWoodGrainUvToMaterial(
  material: WoodGrainMaterial,
  piece: PieceWithMaterialFields
): void {
  const scale = getEffectiveUvScaleForPiece(piece);
  const rotationDeg = getEffectiveUvRotationForPiece(piece);
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const applyToTexture = (tex: THREE.Texture | null | undefined) => {
    if (!tex) return;
    tex.repeat.set(scale.x, scale.y);
    tex.rotation = rotationRad;
    tex.needsUpdate = true;
  };
  applyToTexture(material.map);
  applyToTexture(material.normalMap);
  applyToTexture(material.roughnessMap);
  material.needsUpdate = true;
}

/**
 * LEGACY: aplicação pontual por `VisualMaterial` (domínio CRUD / layout).
 * Não substitui `ViewerCore.updateBoxMaterial` nem `MaterialEngine.loadMaterial` — são o fluxo
 * principal de materiais das caixas no viewer.
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
      void loadTextureAsync(visualMaterial.textureUrl.trim()).then((texture) => {
        if (!texture) return;
        mat.map = texture;
        texture.repeat.set(uvScale.x, uvScale.y);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.rotation = (uvRotationDeg * Math.PI) / 180;
        mat.needsUpdate = true;
      });
    }
  }
}
