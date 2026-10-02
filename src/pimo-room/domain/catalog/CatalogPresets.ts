/**
 * Presets internos do catálogo (placeholders + paths opcionais).
 * Assets GLB: public/room-catalog/ — se ausentes, usa mesh procedural.
 */
import type { CatalogItem } from "./CatalogItem";

export const CATALOG_PRESETS: CatalogItem[] = [
  {
    id: "chair-basic",
    name: "Cadeira",
    type: "chair",
    src: "/room-catalog/chair.glb",
    sizeMm: { width: 450, depth: 500, height: 900 },
    color: "#8b7355",
    thumbnailLabel: "Cadeira",
  },
  {
    id: "table-dining",
    name: "Mesa",
    type: "table",
    src: "/room-catalog/table.glb",
    sizeMm: { width: 1400, depth: 800, height: 750 },
    color: "#a0826d",
    thumbnailLabel: "Mesa",
  },
  {
    id: "sofa-2s",
    name: "Sofá",
    type: "sofa",
    src: "/room-catalog/sofa.glb",
    sizeMm: { width: 1800, depth: 850, height: 800 },
    color: "#5c6b7a",
    thumbnailLabel: "Sofá",
  },
  {
    id: "lamp-floor",
    name: "Candeeiro",
    type: "lamp",
    src: "/room-catalog/lamp.glb",
    sizeMm: { width: 350, depth: 350, height: 1600 },
    color: "#d4c4a8",
    thumbnailLabel: "Candeeiro",
  },
  {
    id: "custom-box",
    name: "Bloco custom",
    type: "custom",
    sizeMm: { width: 600, depth: 600, height: 600 },
    color: "#6b8e9f",
    thumbnailLabel: "Custom",
  },
];

export function getCatalogPreset(id: string): CatalogItem | undefined {
  return CATALOG_PRESETS.find((p) => p.id === id);
}
