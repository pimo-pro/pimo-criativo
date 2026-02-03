import type { WoodMaterialMaps, WoodMaterialOptions } from "./WoodMaterial";

export type MaterialPreset = {
  name: string;
  maps: WoodMaterialMaps;
  options?: WoodMaterialOptions;
};

export type MaterialSet = Record<string, MaterialPreset>;

/** IDs dos materiais PBR reais (sem cores artificiais). */
export const MATERIAIS_PBR_IDS = [
  "carvalho_natural",
  "carvalho_escuro",
  "nogueira",
  "mdf_branco",
  "mdf_cinza",
  "mdf_preto",
] as const;

export type MaterialPbrId = (typeof MATERIAIS_PBR_IDS)[number];

/** Nomes de exibição para os materiais PBR. */
export const MATERIAIS_PBR_LABELS: Record<MaterialPbrId, string> = {
  carvalho_natural: "Carvalho Natural",
  carvalho_escuro: "Carvalho Escuro",
  nogueira: "Nogueira",
  mdf_branco: "MDF Branco",
  mdf_cinza: "MDF Cinza",
  mdf_preto: "MDF Preto",
};

/** Mapeia nome legado ou display para ID do MaterialLibrary. */
export function resolveMaterialId(nome: string): MaterialPbrId {
  const lower = nome.toLowerCase().trim();
  const map: Record<string, MaterialPbrId> = {
    "carvalho natural": "carvalho_natural",
    "carvalho_natural": "carvalho_natural",
    carvalho: "carvalho_natural",
    "carvalho escuro": "carvalho_escuro",
    "carvalho_escuro": "carvalho_escuro",
    nogueira: "nogueira",
    "mdf branco": "mdf_branco",
    "mdf_branco": "mdf_branco",
    mdf: "mdf_branco",
    "mdf cinza": "mdf_cinza",
    "mdf_cinza": "mdf_cinza",
    "mdf preto": "mdf_preto",
    "mdf_preto": "mdf_preto",
    preto: "mdf_preto",
  };
  return (map[lower] as MaterialPbrId) ?? "mdf_branco";
}

/**
 * Materiais PBR reais — sem fallback de cor sólida.
 * Cada material usa texturas (colorMap, normalMap, roughnessMap, aoMap, metalnessMap).
 */
export const defaultMaterialSet: MaterialSet = {
  carvalho_natural: {
    name: "carvalho_natural",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
      metalnessMap: "/textures/wood/metalness.svg",
      aoMap: "/textures/wood/ao.svg",
    },
    options: {
      color: "#c9a27a",
      repeat: { x: 2, y: 2 },
      metalness: 0,
      roughness: 0.55,
      envMapIntensity: 0.4,
    },
  },
  carvalho_escuro: {
    name: "carvalho_escuro",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
      metalnessMap: "/textures/wood/metalness.svg",
      aoMap: "/textures/wood/ao.svg",
    },
    options: {
      color: "#5c3d2e",
      repeat: { x: 2, y: 2 },
      metalness: 0,
      roughness: 0.55,
      envMapIntensity: 0.4,
    },
  },
  nogueira: {
    name: "nogueira",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
      metalnessMap: "/textures/wood/metalness.svg",
      aoMap: "/textures/wood/ao.svg",
    },
    options: {
      color: "#8a5a2b",
      repeat: { x: 2, y: 2 },
      metalness: 0,
      roughness: 0.55,
      envMapIntensity: 0.4,
    },
  },
  mdf_branco: {
    name: "mdf_branco",
    maps: {
      colorMap: "/textures/mdf/branco/base.svg",
      normalMap: "/textures/mdf/branco/normal.svg",
      roughnessMap: "/textures/mdf/branco/roughness.svg",
      aoMap: "/textures/mdf/branco/ao.svg",
    },
    options: {
      color: "#f8fafc",
      repeat: { x: 1, y: 1 },
      metalness: 0,
      roughness: 0.55,
      envMapIntensity: 0.4,
    },
  },
  mdf_cinza: {
    name: "mdf_cinza",
    maps: {
      colorMap: "/textures/mdf/branco/base.svg",
      normalMap: "/textures/mdf/branco/normal.svg",
      roughnessMap: "/textures/mdf/branco/roughness.svg",
      aoMap: "/textures/mdf/branco/ao.svg",
    },
    options: {
      color: "#9ca3af",
      repeat: { x: 1, y: 1 },
      metalness: 0,
      roughness: 0.55,
      envMapIntensity: 0.4,
    },
  },
  mdf_preto: {
    name: "mdf_preto",
    maps: {
      colorMap: "/textures/mdf/branco/base.svg",
      normalMap: "/textures/mdf/branco/normal.svg",
      roughnessMap: "/textures/mdf/branco/roughness.svg",
      aoMap: "/textures/mdf/branco/ao.svg",
    },
    options: {
      color: "#1f2937",
      repeat: { x: 1, y: 1 },
      metalness: 0,
      roughness: 0.55,
      envMapIntensity: 0.4,
    },
  },

};

/** Resolve preset: usa ID resolvido ou fallback para mdf_branco. */
export function getMaterialPreset(materialSet: MaterialSet, idOrName: string): MaterialPreset | null {
  const resolved = resolveMaterialId(idOrName);
  return materialSet[resolved] ?? materialSet.mdf_branco ?? null;
}

export const mergeMaterialSet = (base: MaterialSet, incoming?: MaterialSet) => {
  if (!incoming) return base;
  return { ...base, ...incoming };
};
