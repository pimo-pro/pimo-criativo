/**
 * Definição de um item no catálogo (preset).
 */
export type CatalogItemType = "chair" | "table" | "sofa" | "lamp" | "custom";

export type CatalogItem = {
  id: string;
  name: string;
  type: CatalogItemType;
  /** Caminho opcional GLB/OBJ em /public (fallback: placeholder procedural). */
  src?: string;
  /** Dimensões default do placeholder (mm). */
  sizeMm: { width: number; depth: number; height: number };
  /** Cor do placeholder. */
  color: string;
  thumbnailLabel?: string;
};

export type CatalogItemScale = { x: number; y: number; z: number };
