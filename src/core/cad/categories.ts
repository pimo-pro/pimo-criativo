/**
 * Categorias de modelos CAD (GLB).
 * Usadas para filtrar e organizar modelos no catálogo e por caixa.
 */

export type CadModelCategoryId =
  | "portas"
  | "gavetas"
  | "acessorios"
  | "estrutura"
  | "decoracao";

export interface CadModelCategory {
  id: CadModelCategoryId;
  nome: string;
  descricao?: string;
}

export const CATEGORIAS_CAD: CadModelCategory[] = [
  { id: "portas", nome: "Portas", descricao: "Portas e frontais" },
  { id: "gavetas", nome: "Gavetas", descricao: "Gavetas e corpos de gaveta" },
  { id: "acessorios", nome: "Acessórios", descricao: "Puxadores, trilhos, ferragens" },
  { id: "estrutura", nome: "Estrutura", descricao: "Laterais, fundos, prateleiras" },
  { id: "decoracao", nome: "Decoração", descricao: "Elementos decorativos" },
];

export const CAD_CATEGORY_IDS = CATEGORIAS_CAD.map((c) => c.id);

export function getCategoriaById(id: string): CadModelCategory | undefined {
  return CATEGORIAS_CAD.find((c) => c.id === id);
}

export function getCategoriaNome(id: string): string {
  return getCategoriaById(id)?.nome ?? id;
}
