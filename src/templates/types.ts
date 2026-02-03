/**
 * Tipos para a Biblioteca de Modelos Prontos (Design Templates).
 */

import type { Dimensoes, Material } from "../core/types";

export type TemplateBoxDef = {
  id: string;
  nome: string;
  tipo?: string;
  dimensoes: Dimensoes;
  /** Posição em mm (X, Y, Z). Y=0 no chão. */
  posicaoX_mm: number;
  posicaoY_mm?: number;
  posicaoZ_mm?: number;
  espessura?: number;
  prateleiras?: number;
  gavetas?: number;
  portaTipo?: "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr";
};

export type DesignTemplate = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  /** URL ou data URL do thumbnail. */
  thumbnail?: string;
  boxes: TemplateBoxDef[];
  materialPadrao?: Partial<Material>;
};

export type TemplateCategory = "Cozinha" | "Roupeiro" | "Quarto" | "Banheiro";
