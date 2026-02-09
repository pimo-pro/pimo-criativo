import type { CatalogItem } from "./catalogTypes";
import { BASE_CABINET_MODELS } from "../core/baseCabinets";

/**
 * Catálogo de módulos: Base Cabinets (sistema único e padronizado).
 * Cada item corresponde a um modelo base; regras de espessura, costa e pés são aplicadas pelo sistema.
 */

export const CATALOG_ITEMS: CatalogItem[] = BASE_CABINET_MODELS.map((m) => ({
  id: m.id,
  nome: m.nome,
  categoria: "base",
  dimensoesDefault: {
    largura_mm: m.widthMm,
    altura_mm: m.heightMm,
    profundidade_mm: m.depthMm,
  },
  descricao: m.nome,
}));

/**
 * Retorna todos os itens de uma categoria específica
 */
export function getCatalogItemsByCategory(categoria: string): CatalogItem[] {
  return CATALOG_ITEMS.filter((item) => item.categoria === categoria);
}

/**
 * Retorna um item do catálogo por ID
 */
export function getCatalogItemById(id: string): CatalogItem | undefined {
  return CATALOG_ITEMS.find((item) => item.id === id);
}

/**
 * Retorna todas as categorias únicas do catálogo
 */
export function getCatalogCategories(): string[] {
  const categorias = new Set<string>();
  CATALOG_ITEMS.forEach((item) => {
    categorias.add(item.categoria);
  });
  return Array.from(categorias).sort();
}

/**
 * Retorna o nome amigável de uma categoria
 */
export function getCategoryDisplayName(categoria: string): string {
  const parts = categoria.split("/");
  const categoryMap: Record<string, string> = {
    cozinha: "Cozinha",
    roupeiro: "Roupeiro",
    quarto: "Quarto",
    banheiro: "Banheiro",
    base: "Base",
    lower: "Inferior",
    upper: "Superior",
  };

  if (parts.length === 2) {
    const [parent, child] = parts;
    return `${categoryMap[parent] || parent} - ${categoryMap[child] || child}`;
  }
  return categoryMap[categoria] || categoria;
}
