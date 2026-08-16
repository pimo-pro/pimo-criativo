/**
 * Wood Pack — 10 materiais (fonte única para MaterialEngine e Materiais & Fabricação).
 * viewerMaterialId único; texturas em public/textures/wood/<id>-base.jpg e <id>-normal.jpg.
 * Estrutura preparada para WebP no futuro (sem implementar).
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

const D = { x: 1, y: 1 };
const M = 0;
/** Base remota opcional; senão usa ficheiros em `public/textures/`. */
const TEXTURES_BASE_URL: string = import.meta.env.VITE_TEXTURES_URL
  ? String(import.meta.env.VITE_TEXTURES_URL).replace(/\/+$/, "")
  : "/textures";
const TEXTURE_URLS = {
  mdfBranco: `${TEXTURES_BASE_URL}/mdf/mdf-branco.jpg`,
  mdfCinza: `${TEXTURES_BASE_URL}/mdf/mdf-cinza.jpg`,
  mdfPreto: `${TEXTURES_BASE_URL}/mdf/mdf-preto.jpg`,
  carvalho: `${TEXTURES_BASE_URL}/wood/carvalho.jpg`,
  nogueira: `${TEXTURES_BASE_URL}/wood/nogueira.jpg`,
} as const;

/** 10 presets Wood Pack — único centro de definição de materiais visuais. */
export const INITIAL_MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: "mdf_branco",
    name: "MDF Branco",
    color: "#f2f0eb",
    textureUrl: TEXTURE_URLS.mdfBranco,
    uvScale: D,
    uvRotation: 0,
    roughness: 0.52,
    metallic: M,
  },
  {
    id: "mdb_laminado",
    name: "MDB Laminado",
    color: "#f2f0eb",
    textureUrl: TEXTURE_URLS.mdfBranco,
    uvScale: D,
    uvRotation: 0,
    roughness: 0.5,
    metallic: M,
  },
  {
    id: "laminado_linho_cancun",
    name: "Cinza",
    color: "#9ca3af",
    textureUrl: TEXTURE_URLS.mdfCinza,
    uvScale: D,
    uvRotation: 0,
    roughness: 0.55,
    metallic: M,
  },
  {
    id: "mdf_preto",
    name: "Preto",
    color: "#1f2937",
    textureUrl: TEXTURE_URLS.mdfPreto,
    uvScale: D,
    uvRotation: 0,
    roughness: 0.58,
    metallic: M,
  },
  {
    id: "hdf_lacado",
    name: "HDF Lacado",
    color: "#f5f5f0",
    uvScale: D,
    uvRotation: 0,
    roughness: 0.35,
    metallic: 0.08,
    textureUrl: TEXTURE_URLS.mdfBranco,
  },
  {
    id: "hdf_cru",
    name: "HDF Cru",
    color: "#e8e4dc",
    uvScale: D,
    uvRotation: 0,
    roughness: 0.6,
    metallic: M,
    textureUrl: TEXTURE_URLS.mdfBranco,
  },
  {
    id: "carvalho_natural",
    name: "Carvalho Natural",
    color: "#c9a27a",
    uvScale: { x: 2, y: 2 },
    uvRotation: 0,
    roughness: 0.55,
    metallic: M,
    textureUrl: TEXTURE_URLS.carvalho,
  },
  {
    id: "agl_carvalho",
    name: "AGL_Carvalho",
    color: "#c9a27a",
    uvScale: { x: 2, y: 2 },
    uvRotation: 0,
    roughness: 0.55,
    metallic: M,
    textureUrl: TEXTURE_URLS.carvalho,
  },
  {
    id: "madeira_carvalho",
    name: "Madeira Carvalho",
    color: "#b8956a",
    uvScale: { x: 2, y: 2 },
    uvRotation: 0,
    roughness: 0.55,
    metallic: M,
    textureUrl: TEXTURE_URLS.carvalho,
  },
  {
    id: "pinho_natural",
    name: "Pinho Natural",
    color: "#e0c38d",
    uvScale: { x: 3, y: 3 },
    uvRotation: 0,
    roughness: 0.5,
    metallic: M,
    textureUrl: TEXTURE_URLS.nogueira,
  },
  {
    id: "madeira_pinho",
    name: "Madeira Pinho",
    color: "#d4b896",
    uvScale: { x: 3, y: 3 },
    uvRotation: 0,
    roughness: 0.52,
    metallic: M,
    textureUrl: TEXTURE_URLS.nogueira,
  },
];
