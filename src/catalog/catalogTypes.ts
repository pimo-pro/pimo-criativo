/**
 * Tipos para o sistema de Catálogo 3D
 */

export interface CatalogItemDimensoes {
  largura_mm: number;
  altura_mm: number;
  profundidade_mm: number;
}

export interface CatalogItem {
  id: string;
  nome: string;
  categoria: "cozinha" | "roupeiro" | "banheiro" | "quarto-infantil";
  dimensoesDefault: CatalogItemDimensoes;
  descricao?: string;
  /** URL opcional para thumbnail (futuro) */
  thumbnailUrl?: string;
  /** Placeholder para ligar mais tarde aos modelos 3D externos (GLB) */
  modelKey?: string;
}

export type CatalogCategory = {
  id: string;
  nome: string;
  parent?: string; // categoria pai (ex: "cozinha" para "cozinha/base")
};
