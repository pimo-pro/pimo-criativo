import type { WoodMaterialMaps, WoodMaterialOptions } from "./WoodMaterial";

export type MaterialPreset = {
  name: string;
  maps: WoodMaterialMaps;
  options?: WoodMaterialOptions;
};

export type MaterialSet = Record<string, MaterialPreset>;

export const defaultMaterialSet: MaterialSet = {
  carvalho: {
    name: "carvalho",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
    },
    options: { color: "#c9a27a", repeat: { x: 2, y: 2 } },
  },
  nogueira: {
    name: "nogueira",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
    },
    options: { color: "#8a5a2b", repeat: { x: 2, y: 2 } },
  },
  branco: {
    name: "branco",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
    },
    options: { color: "#f8fafc", repeat: { x: 2, y: 2 } },
  },
  preto: {
    name: "preto",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
    },
    options: { color: "#0f172a", repeat: { x: 2, y: 2 } },
  },
  mdf: {
    name: "mdf",
    maps: {
      colorMap: "/textures/wood/base.svg",
      normalMap: "/textures/wood/normal.svg",
      roughnessMap: "/textures/wood/roughness.svg",
    },
    options: { color: "#d9b68c", repeat: { x: 2, y: 2 } },
  },
};

export const mergeMaterialSet = (base: MaterialSet, incoming?: MaterialSet) => {
  if (!incoming) return base;
  return { ...base, ...incoming };
};
