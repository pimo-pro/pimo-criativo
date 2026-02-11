/**
 * FASE 4 — Etapa 8 (Parte 1): Material Presets Engine.
 * Estrutura centralizada para presets visuais (base do futuro MaterialLibrary v2, Textures, UV Mapping).
 */

export interface MaterialPreset {
  id: string;
  name: string;
  color: string;
  textureUrl?: string;
  uvScale?: { x: number; y: number };
  uvRotation?: number;
  roughness?: number;
  metallic?: number;
  normalMapUrl?: string;
}

export type MaterialPresetRecord = Record<string, MaterialPreset>;

const DEFAULT_UV_SCALE = { x: 1, y: 1 };
const DEFAULT_ROUGHNESS = 0.6;
const DEFAULT_METALLIC = 0;

/** Presets iniciais (carregados estaticamente). */
export const INITIAL_MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: "madeira_clara",
    name: "Madeira Clara",
    color: "#e8dcc8",
    uvScale: DEFAULT_UV_SCALE,
    uvRotation: 0,
    roughness: DEFAULT_ROUGHNESS,
    metallic: DEFAULT_METALLIC,
  },
  {
    id: "madeira_escura",
    name: "Madeira Escura",
    color: "#5c4033",
    uvScale: DEFAULT_UV_SCALE,
    uvRotation: 0,
    roughness: 0.65,
    metallic: DEFAULT_METALLIC,
  },
  {
    id: "branco_liso",
    name: "Branco Liso",
    color: "#f5f5f5",
    uvScale: DEFAULT_UV_SCALE,
    uvRotation: 0,
    roughness: 0.4,
    metallic: DEFAULT_METALLIC,
  },
  {
    id: "preto_fosco",
    name: "Preto Fosco",
    color: "#2a2a2a",
    uvScale: DEFAULT_UV_SCALE,
    uvRotation: 0,
    roughness: 0.85,
    metallic: DEFAULT_METALLIC,
  },
  {
    id: "cinza_industrial",
    name: "Cinza Industrial",
    color: "#6b7280",
    uvScale: DEFAULT_UV_SCALE,
    uvRotation: 0,
    roughness: 0.7,
    metallic: 0.1,
  },
  {
    id: "carvalho_natural",
    name: "Carvalho Natural",
    color: "#c9a227",
    uvScale: DEFAULT_UV_SCALE,
    uvRotation: 0,
    roughness: 0.55,
    metallic: DEFAULT_METALLIC,
  },
];
