/**
 * Base de ferragens usadas em fabricação de móveis.
 * Catálogo completo para marcenaria, cozinhas e roupeiros.
 */

import type { Acessorio } from "../types";

export interface Ferragem {
  id: string;
  categoria: "parafuso" | "cavilha" | "dobradica" | "corredica" | "suporte" | "prego" | "acessorio" | "puxa";
  nome: string;
  medidas?: string;
  descricao?: string;
  /** Cor comercial (ex.: bege para CAVILHA_10x40). */
  cor?: string;
  /** Espessura / diâmetro nominal (mm). */
  espessuraMm?: number;
  /** Comprimento nominal (mm). */
  comprimentoMm?: number;
  precoUnitario?: number;
}

export const FERRAGENS_DEFAULT: Ferragem[] = [
  {
    id: "parafuso_4x50",
    nome: "Parafuso 4×50",
    categoria: "parafuso",
    medidas: "4mm × 50mm",
    descricao: "Parafuso para fixação estrutural",
    precoUnitario: 0.15,
  },
  {
    id: "parafuso_3x30",
    nome: "Parafuso 3\u00d730",
    categoria: "parafuso",
    medidas: "3mm \u00d7 30mm",
    descricao:
      "Parafuso para fixa\u00e7\u00e3o de p\u00e9s de pl\u00e1stico ajust\u00e1veis (4 por p\u00e9) \u2014 freeagem (sem furos/CNC)",
    precoUnitario: 0.1,
  },
  {
    id: "parafuso_4x35",
    nome: "Parafuso 4\u00d735",
    categoria: "parafuso",
    medidas: "4mm \u00d7 35mm",
    descricao:
      "Freeagem: uni\u00e3o de caixas, alturas e remates (sem furos/CNC)",
    precoUnitario: 0.14,
  },
  {
    id: "parafuso_5x50",
    nome: "Parafuso 5\u00d750",
    categoria: "parafuso",
    medidas: "5mm \u00d7 50mm",
    descricao: "Freeagem: fixa\u00e7\u00e3o de caixas superiores (sem furos/CNC)",
    precoUnitario: 0.24,
  },
  {
    id: "puxa_8mm",
    nome: "puxa 8mm",
    categoria: "puxa",
    medidas: "8mm \u00d7 30mm",
    descricao: "Freeagem: 1 por cada Parafuso 5\u00d750 (sem furos/CNC)",
    precoUnitario: 0.7,
  },
  {
    id: "cavilha_10x40",
    nome: "Cavilha 10mm",
    categoria: "cavilha",
    medidas: "Ø10mm × 40mm",
    descricao:
      "Cavilha industrial 10×40 — par obrigatório Ø10×30 (espessura) + Ø10×13 (face). Nome comercial: Cavilha 10mm.",
    cor: "bege",
    espessuraMm: 10,
    comprimentoMm: 40,
    precoUnitario: 0.08,
  },
  {
    id: "dobradica_35mm",
    nome: "Dobradi\u00e7a I-Sensys 8645i",
    categoria: "dobradica",
    medidas: "35mm",
    descricao: "Dobradi\u00e7a Hettich I-Sensys 8645i",
    precoUnitario: 2.5,
  },
  {
    id: "calco_00",
    nome: "Cal\u00e7o",
    categoria: "acessorio",
    medidas: "37mm",
    descricao: "Cal\u00e7o Ref 00 (I-Sensys 8645i)",
    precoUnitario: 0,
  },
  {
    id: "calco_03",
    nome: "Cal\u00e7o",
    categoria: "acessorio",
    medidas: "37mm",
    descricao: "Cal\u00e7o Ref 03 (Frente Fixa)",
    precoUnitario: 0,
  },
  {
    id: "suporte_prateleira",
    nome: "Suporte de Prateleira",
    categoria: "suporte",
    descricao: "Suporte regul\u00e1vel para prateleira",
    precoUnitario: 0.9,
  },
  {
    id: "corredica_esq",
    nome: "Corrediça Lateral Esquerda",
    categoria: "corredica",
    descricao: "Corrediça para gaveta (lado esquerdo)",
    precoUnitario: 9.5,
  },
  {
    id: "corredica_dir",
    nome: "Corrediça Lateral Direita",
    categoria: "corredica",
    descricao: "Corrediça para gaveta (lado direito)",
    precoUnitario: 9.5,
  },
  {
    id: "prego_costa",
    nome: "Prego para Costa",
    categoria: "prego",
    medidas: "2mm × 20mm",
    descricao: "Prego fino para fixar costa",
    precoUnitario: 0.02,
  },
  {
    id: "parafuso_puxador",
    nome: "Parafuso para Puxador",
    categoria: "parafuso",
    medidas: "M4 × 25mm",
    descricao: "Parafuso para fixar puxadores",
    precoUnitario: 0.12,
  },
  {
    id: "pe_plastico",
    nome: "Pé",
    categoria: "acessorio",
    medidas: "100mm",
    descricao: "Pé de plástico ajustável",
    precoUnitario: 2.8,
  },
];

const PRECO_FERRAGENS: Record<string, number> = {
  parafuso: 0.15,
  dobradica: 1.8,
  corrediça: 8.5,
  suporte: 0,
  trilho: 12.0,
};

const FERRAGENS_BASE: Acessorio[] = [
  { id: "parafuso-4x50", nome: "Parafuso 4×50", tipo: "parafuso", quantidade: 0, precoUnitario: PRECO_FERRAGENS.parafuso },
  { id: "dobradica-35mm", nome: "Dobradiça 35mm", tipo: "dobradica", quantidade: 0, precoUnitario: PRECO_FERRAGENS.dobradica },
  { id: "corredica-350mm", nome: "Corrediça 350mm", tipo: "corrediça", quantidade: 0, precoUnitario: PRECO_FERRAGENS.corrediça },
  { id: "suporte-prateleira", nome: "Suporte Prateleira", tipo: "suporte", quantidade: 0, precoUnitario: PRECO_FERRAGENS.suporte },
  { id: "trilho-superior", nome: "Trilho Superior", tipo: "trilho", quantidade: 0, precoUnitario: PRECO_FERRAGENS.trilho },
  { id: "trilho-inferior", nome: "Trilho Inferior", tipo: "trilho", quantidade: 0, precoUnitario: PRECO_FERRAGENS.trilho },
];

export function buildFerragens(
  prateleiras: number,
  portaTipo: "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr",
  gavetas: number
): Acessorio[] {
  return FERRAGENS_BASE.map((item) => {
    if (item.tipo === "suporte") {
      return { ...item, quantidade: prateleiras * 4 };
    }
    if (item.tipo === "dobradica") {
      const qtd = portaTipo === "porta_simples" ? 2 : portaTipo === "porta_dupla" ? 4 : 0;
      return { ...item, quantidade: qtd };
    }
    if (item.tipo === "corrediça") {
      return { ...item, quantidade: gavetas * 2 };
    }
    if (item.tipo === "trilho") {
      const qtd = portaTipo === "porta_correr" ? 1 : 0;
      return { ...item, quantidade: qtd };
    }
    return item;
  });
}
