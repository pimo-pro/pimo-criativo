export type MaterialCategory =
  | "wood"
  | "metal"
  | "glass"
  | "plastic"
  | "marble"
  | "stone";

export type MaterialPreset = {
  id: string;
  label: string;
  category: MaterialCategory;
  maps: {
    map: string;
    normalMap: string;
    roughnessMap: string;
    metalnessMap: string;
    aoMap: string;
  };
  defaults: {
    roughness: number;
    metalness: number;
    envMapIntensity: number;
    color: string;
  };
};

const buildMaps = (category: MaterialCategory) => ({
  map: `/textures/${category}/base.svg`,
  normalMap: `/textures/${category}/normal.svg`,
  roughnessMap: `/textures/${category}/roughness.svg`,
  metalnessMap: `/textures/${category}/metalness.svg`,
  aoMap: `/textures/${category}/ao.svg`,
});

export const materialPresets: MaterialPreset[] = [
  {
    id: "wood_oak",
    label: "Madeira — Carvalho",
    category: "wood",
    maps: buildMaps("wood"),
    defaults: { roughness: 0.55, metalness: 0.05, envMapIntensity: 0.9, color: "#c9a27a" },
  },
  {
    id: "wood_walnut",
    label: "Madeira — Nogueira",
    category: "wood",
    maps: buildMaps("wood"),
    defaults: { roughness: 0.6, metalness: 0.05, envMapIntensity: 0.9, color: "#8b5a2b" },
  },
  {
    id: "wood_pine",
    label: "Madeira — Pinho",
    category: "wood",
    maps: buildMaps("wood"),
    defaults: { roughness: 0.5, metalness: 0.03, envMapIntensity: 0.8, color: "#e0c38d" },
  },
  {
    id: "metal_steel",
    label: "Metal — Aço",
    category: "metal",
    maps: buildMaps("metal"),
    defaults: { roughness: 0.2, metalness: 0.9, envMapIntensity: 1.2, color: "#cbd5f5" },
  },
  {
    id: "metal_brass",
    label: "Metal — Latão",
    category: "metal",
    maps: buildMaps("metal"),
    defaults: { roughness: 0.25, metalness: 0.85, envMapIntensity: 1.1, color: "#d4af37" },
  },
  {
    id: "metal_aluminum",
    label: "Metal — Alumínio",
    category: "metal",
    maps: buildMaps("metal"),
    defaults: { roughness: 0.3, metalness: 0.8, envMapIntensity: 1.0, color: "#aeb6bf" },
  },
  {
    id: "glass_clear",
    label: "Vidro — Transparente",
    category: "glass",
    maps: buildMaps("glass"),
    defaults: { roughness: 0.05, metalness: 0.0, envMapIntensity: 1.2, color: "#e2e8f0" },
  },
  {
    id: "glass_frosted",
    label: "Vidro — Fosco",
    category: "glass",
    maps: buildMaps("glass"),
    defaults: { roughness: 0.35, metalness: 0.0, envMapIntensity: 1.0, color: "#cbd5e1" },
  },
  {
    id: "plastic_matte",
    label: "Plástico — Fosco",
    category: "plastic",
    maps: buildMaps("plastic"),
    defaults: { roughness: 0.7, metalness: 0.0, envMapIntensity: 0.4, color: "#e5e7eb" },
  },
  {
    id: "plastic_glossy",
    label: "Plástico — Brilhante",
    category: "plastic",
    maps: buildMaps("plastic"),
    defaults: { roughness: 0.25, metalness: 0.0, envMapIntensity: 0.8, color: "#f3f4f6" },
  },
  {
    id: "marble_white",
    label: "Mármore — Branco",
    category: "marble",
    maps: buildMaps("marble"),
    defaults: { roughness: 0.3, metalness: 0.0, envMapIntensity: 0.9, color: "#f8fafc" },
  },
  {
    id: "marble_black",
    label: "Mármore — Escuro",
    category: "marble",
    maps: buildMaps("marble"),
    defaults: { roughness: 0.35, metalness: 0.0, envMapIntensity: 0.9, color: "#1f2937" },
  },
  {
    id: "stone_granite",
    label: "Pedra — Granito",
    category: "stone",
    maps: buildMaps("stone"),
    defaults: { roughness: 0.75, metalness: 0.0, envMapIntensity: 0.4, color: "#9ca3af" },
  },
  {
    id: "stone_slate",
    label: "Pedra — Ardósia",
    category: "stone",
    maps: buildMaps("stone"),
    defaults: { roughness: 0.8, metalness: 0.0, envMapIntensity: 0.35, color: "#475569" },
  },
];

export const getPresetsByCategory = (category: MaterialCategory) =>
  materialPresets.filter((preset) => preset.category === category);

export const getPresetById = (presetId: string) =>
  materialPresets.find((preset) => preset.id === presetId);
