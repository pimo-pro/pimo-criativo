/**
 * Índice da Biblioteca de Modelos Prontos.
 * Categorias e modelos iniciais.
 */

import type { DesignTemplate, TemplateCategory } from "./types";

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Cozinha",
  "Roupeiro",
  "Quarto",
  "Banheiro",
];

/** Modelos de layout antigos removidos; o sistema usa apenas Base Cabinets (catálogo). */
export const TEMPLATES: DesignTemplate[] = [];

export function getTemplatesByCategory(categoria: TemplateCategory): DesignTemplate[] {
  return TEMPLATES.filter((t) => t.categoria === categoria);
}

export function getTemplateById(id: string): DesignTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
