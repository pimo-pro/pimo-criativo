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

export const TEMPLATES: DesignTemplate[] = [
  {
    id: "cozinha-linear-3m",
    nome: "Cozinha Linear 3m",
    categoria: "Cozinha",
    descricao: "Linha de cozinha com base e coluna, 3 metros.",
    boxes: [
      { id: "box-1", nome: "Base 1", dimensoes: { largura: 600, altura: 860, profundidade: 600 }, posicaoX_mm: 0, posicaoY_mm: 0, posicaoZ_mm: 0, espessura: 19, prateleiras: 1, gavetas: 2, portaTipo: "porta_simples" },
      { id: "box-2", nome: "Base 2", dimensoes: { largura: 600, altura: 860, profundidade: 600 }, posicaoX_mm: 620, posicaoY_mm: 0, posicaoZ_mm: 0, espessura: 19, prateleiras: 1, gavetas: 2, portaTipo: "porta_simples" },
      { id: "box-3", nome: "Base 3", dimensoes: { largura: 600, altura: 860, profundidade: 600 }, posicaoX_mm: 1240, posicaoY_mm: 0, posicaoZ_mm: 0, espessura: 19, prateleiras: 1, gavetas: 2, portaTipo: "porta_simples" },
      { id: "box-4", nome: "Base 4", dimensoes: { largura: 580, altura: 860, profundidade: 600 }, posicaoX_mm: 1860, posicaoY_mm: 0, posicaoZ_mm: 0, espessura: 19, prateleiras: 1, gavetas: 2, portaTipo: "porta_simples" },
      { id: "box-5", nome: "Coluna", dimensoes: { largura: 400, altura: 2160, profundidade: 350 }, posicaoX_mm: 500, posicaoY_mm: 0, posicaoZ_mm: 650, espessura: 19, prateleiras: 5, gavetas: 0, portaTipo: "porta_simples" },
    ],
  },
  {
    id: "roupeiro-2-portas",
    nome: "Roupeiro 2 Portas",
    categoria: "Roupeiro",
    descricao: "Roupeiro de chão com 2 portas e prateleiras internas.",
    boxes: [
      { id: "box-1", nome: "Corpo principal", dimensoes: { largura: 1200, altura: 2200, profundidade: 600 }, posicaoX_mm: 0, posicaoY_mm: 0, posicaoZ_mm: 0, espessura: 19, prateleiras: 4, gavetas: 0, portaTipo: "porta_dupla" },
    ],
  },
  {
    id: "quarto-infantil",
    nome: "Quarto Infantil",
    categoria: "Quarto",
    descricao: "Layout simples: cama em L com cabeceira e roupeiro.",
    boxes: [
      { id: "box-1", nome: "Cabeceira", dimensoes: { largura: 1200, altura: 600, profundidade: 400 }, posicaoX_mm: 0, posicaoY_mm: 0, posicaoZ_mm: 0, espessura: 19, prateleiras: 0, gavetas: 0, portaTipo: "sem_porta" },
      { id: "box-2", nome: "Roupeiro infantil", dimensoes: { largura: 800, altura: 1800, profundidade: 500 }, posicaoX_mm: 1250, posicaoY_mm: 0, posicaoZ_mm: 0, espessura: 19, prateleiras: 3, gavetas: 1, portaTipo: "porta_simples" },
    ],
  },
];

export function getTemplatesByCategory(categoria: TemplateCategory): DesignTemplate[] {
  return TEMPLATES.filter((t) => t.categoria === categoria);
}

export function getTemplateById(id: string): DesignTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
