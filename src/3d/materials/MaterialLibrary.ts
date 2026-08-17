import type { WoodMaterialOptions } from "./WoodMaterial";
import { getAllPresets } from "../../core/materials/presetService";
import { resolveMaterial } from "../../core/materials/materials.api";

export type MaterialPreset = {
  name: string;
  options?: WoodMaterialOptions;
};

export type MaterialSet = Record<string, MaterialPreset>;

/** IDs dos materiais (Wood Pack 10 + fallback). Fonte única: presets.ts via presetService. */
export const MATERIAIS_PBR_IDS = [
  "mdf_branco",
  "laminado_linho_cancun",
  "mdf_preto",
  "hdf_lacado",
  "hdf_cru",
  "carvalho_natural",
  "agl_carvalho",
  "agl_branco",
  "madeira_carvalho",
  "pinho_natural",
  "madeira_pinho",
] as const;

export type MaterialPbrId = (typeof MATERIAIS_PBR_IDS)[number];

function buildPbrLabels(): Record<MaterialPbrId, string> {
  const presets = getAllPresets();
  const map = new Map(presets.map((p) => [p.id, p.name]));
  return {
    mdf_branco: map.get("mdf_branco") ?? "MDF Branco",
    laminado_linho_cancun: map.get("laminado_linho_cancun") ?? "Cinza",
    mdf_preto: map.get("mdf_preto") ?? "Preto",
    hdf_lacado: map.get("hdf_lacado") ?? "HDF Lacado",
    hdf_cru: map.get("hdf_cru") ?? "HDF Cru",
    carvalho_natural: map.get("carvalho_natural") ?? "Carvalho Natural",
    agl_carvalho: map.get("agl_carvalho") ?? "AGL_Carvalho",
    agl_branco: map.get("agl_branco") ?? "AGL LAM BRANCO",
    madeira_carvalho: map.get("madeira_carvalho") ?? "Madeira Carvalho",
    pinho_natural: map.get("pinho_natural") ?? "Pinho Natural",
    madeira_pinho: map.get("madeira_pinho") ?? "Madeira Pinho",
  };
}
export const MATERIAIS_PBR_LABELS: Record<MaterialPbrId, string> = buildPbrLabels();

export function resolveMaterialId(nome: string): MaterialPbrId {
  const resolved = resolveMaterial(nome);
  const viewer = resolved?.viewerMaterialId?.trim();
  if (viewer && MATERIAIS_PBR_IDS.includes(viewer as MaterialPbrId)) return viewer as MaterialPbrId;
  return "mdf_branco";
}

/** Materiais a partir do presetService (fonte única). Cor + PBR; sem texturas no fallback. */
function buildDefaultMaterialSet(): MaterialSet {
  const presets = getAllPresets();
  const set: MaterialSet = {};
  for (const p of presets) {
    if (!p?.id) continue;
    set[p.id] = {
      name: p.name,
      options: {
        color: p.color ?? "#f2f0eb",
        metalness: p.metallic ?? 0,
        roughness: p.roughness ?? 0.55,
        envMapIntensity: 0.4,
      },
    };
  }
  if (!set.mdf_branco) {
    set.mdf_branco = {
      name: "MDF Branco",
      options: { color: "#f2f0eb", metalness: 0, roughness: 0.52, envMapIntensity: 0.4 },
    };
  }
  return set;
}

export const defaultMaterialSet: MaterialSet = buildDefaultMaterialSet();

export function getMaterialPreset(materialSet: MaterialSet, idOrName: string): MaterialPreset | null {
  const resolved = resolveMaterialId(idOrName);
  return materialSet[resolved] ?? materialSet.mdf_branco ?? null;
}

export const mergeMaterialSet = (base: MaterialSet, incoming?: MaterialSet) => {
  if (!incoming) return base;
  return { ...base, ...incoming };
};
