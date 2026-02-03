import type { CatalogItem } from "./catalogTypes";

/**
 * Catálogo de módulos padrão do PIMO
 * 
 * Estrutura base para o sistema de catálogo 3D.
 * Inicialmente usa apenas WorkspaceBoxes, mas preparado para integração futura com modelos GLB.
 */

export const CATALOG_ITEMS: CatalogItem[] = [
  // Cozinha - Base
  {
    id: "cozinha-base-600",
    nome: "Base 600mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 600,
      altura_mm: 850,
      profundidade_mm: 600,
    },
    descricao: "Módulo base padrão 600mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-base-600.jpg",
  },
  {
    id: "cozinha-base-800",
    nome: "Base 800mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 800,
      altura_mm: 850,
      profundidade_mm: 600,
    },
    descricao: "Módulo base padrão 800mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-base-800.jpg",
  },
  {
    id: "cozinha-base-1000",
    nome: "Base 1000mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 1000,
      altura_mm: 850,
      profundidade_mm: 600,
    },
    descricao: "Módulo base padrão 1000mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-base-1000.jpg",
  },
  {
    id: "cozinha-base-1200",
    nome: "Base 1200mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 1200,
      altura_mm: 850,
      profundidade_mm: 600,
    },
    descricao: "Módulo base padrão 1200mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-base-1200.jpg",
  },

  // Cozinha - Superior
  {
    id: "cozinha-superior-300",
    nome: "Superior 300mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 300,
      altura_mm: 700,
      profundidade_mm: 350,
    },
    descricao: "Módulo superior padrão 300mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-superior-300.jpg",
  },
  {
    id: "cozinha-superior-400",
    nome: "Superior 400mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 400,
      altura_mm: 700,
      profundidade_mm: 350,
    },
    descricao: "Módulo superior padrão 400mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-superior-400.jpg",
  },
  {
    id: "cozinha-superior-600",
    nome: "Superior 600mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 600,
      altura_mm: 700,
      profundidade_mm: 350,
    },
    descricao: "Módulo superior padrão 600mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-superior-600.jpg",
  },
  {
    id: "cozinha-superior-800",
    nome: "Superior 800mm",
    categoria: "cozinha",
    dimensoesDefault: {
      largura_mm: 800,
      altura_mm: 700,
      profundidade_mm: 350,
    },
    descricao: "Módulo superior padrão 800mm",
    thumbnailUrl: "/catalog-thumbnails/cozinha-superior-800.jpg",
  },

  // Roupeiro - Inferior
  {
    id: "roupeiro-lower-600",
    nome: "Roupeiro Inferior 600mm",
    categoria: "roupeiro",
    dimensoesDefault: {
      largura_mm: 600,
      altura_mm: 1000,
      profundidade_mm: 600,
    },
    descricao: "Módulo roupeiro inferior 600mm",
    thumbnailUrl: "/catalog-thumbnails/roupeiro-lower-600.jpg",
  },
  {
    id: "roupeiro-lower-800",
    nome: "Roupeiro Inferior 800mm",
    categoria: "roupeiro",
    dimensoesDefault: {
      largura_mm: 800,
      altura_mm: 1000,
      profundidade_mm: 600,
    },
    descricao: "Módulo roupeiro inferior 800mm",
    thumbnailUrl: "/catalog-thumbnails/roupeiro-lower-800.jpg",
  },
  {
    id: "roupeiro-lower-1000",
    nome: "Roupeiro Inferior 1000mm",
    categoria: "roupeiro",
    dimensoesDefault: {
      largura_mm: 1000,
      altura_mm: 1000,
      profundidade_mm: 600,
    },
    descricao: "Módulo roupeiro inferior 1000mm",
    thumbnailUrl: "/catalog-thumbnails/roupeiro-lower-1000.jpg",
  },

  // Roupeiro - Superior
  {
    id: "roupeiro-upper-600",
    nome: "Roupeiro Superior 600mm",
    categoria: "roupeiro",
    dimensoesDefault: {
      largura_mm: 600,
      altura_mm: 800,
      profundidade_mm: 600,
    },
    descricao: "Módulo roupeiro superior 600mm",
    thumbnailUrl: "/catalog-thumbnails/roupeiro-upper-600.jpg",
  },
  {
    id: "roupeiro-upper-800",
    nome: "Roupeiro Superior 800mm",
    categoria: "roupeiro",
    dimensoesDefault: {
      largura_mm: 800,
      altura_mm: 800,
      profundidade_mm: 600,
    },
    descricao: "Módulo roupeiro superior 800mm",
    thumbnailUrl: "/catalog-thumbnails/roupeiro-upper-800.jpg",
  },
  {
    id: "roupeiro-upper-1000",
    nome: "Roupeiro Superior 1000mm",
    categoria: "roupeiro",
    dimensoesDefault: {
      largura_mm: 1000,
      altura_mm: 800,
      profundidade_mm: 600,
    },
    descricao: "Módulo roupeiro superior 1000mm",
    thumbnailUrl: "/catalog-thumbnails/roupeiro-upper-1000.jpg",
  },

  // Quarto
  {
    id: "quarto-crianca-600",
    nome: "Módulo Quarto 600mm",
    categoria: "quarto-infantil",
    dimensoesDefault: {
      largura_mm: 600,
      altura_mm: 2000,
      profundidade_mm: 600,
    },
    descricao: "Módulo para quarto infantil 600mm",
    thumbnailUrl: "/catalog-thumbnails/quarto-crianca-600.jpg",
  },
  {
    id: "quarto-crianca-800",
    nome: "Módulo Quarto 800mm",
    categoria: "quarto-infantil",
    dimensoesDefault: {
      largura_mm: 800,
      altura_mm: 2000,
      profundidade_mm: 600,
    },
    descricao: "Módulo para quarto infantil 800mm",
    thumbnailUrl: "/catalog-thumbnails/quarto-crianca-800.jpg",
  },

  // Banheiro
  {
    id: "banheiro-base-600",
    nome: "Módulo Banheiro 600mm",
    categoria: "banheiro",
    dimensoesDefault: {
      largura_mm: 600,
      altura_mm: 800,
      profundidade_mm: 350,
    },
    descricao: "Módulo para banheiro 600mm",
    thumbnailUrl: "/catalog-thumbnails/banheiro-base-600.jpg",
  },
  {
    id: "banheiro-base-800",
    nome: "Módulo Banheiro 800mm",
    categoria: "banheiro",
    dimensoesDefault: {
      largura_mm: 800,
      altura_mm: 800,
      profundidade_mm: 350,
    },
    descricao: "Módulo para banheiro 800mm",
    thumbnailUrl: "/catalog-thumbnails/banheiro-base-800.jpg",
  },
];

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
    superior: "Superior",
    lower: "Inferior",
    upper: "Superior",
  };
  
  if (parts.length === 2) {
    const [parent, child] = parts;
    return `${categoryMap[parent] || parent} - ${categoryMap[child] || child}`;
  }
  
  return categoryMap[categoria] || categoria;
}
