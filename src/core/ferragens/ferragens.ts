/**
 * Base de ferragens usadas em fabricação de móveis.
 * Catálogo completo para marcenaria, cozinhas e roupeiros.
 */

export interface Ferragem {
  id: string;
  nome: string;
  categoria: "parafuso" | "cavilha" | "dobradica" | "corredica" | "suporte" | "prego" | "acessorio";
  medidas?: string;
  descricao?: string;
}

export const FERRAGENS_DEFAULT: Ferragem[] = [
  {
    id: "parafuso_4x50",
    nome: "Parafuso 4×50",
    categoria: "parafuso",
    medidas: "4mm × 50mm",
    descricao: "Parafuso para fixação estrutural",
  },
  {
    id: "cavilha_8mm",
    nome: "Cavilha 8mm",
    categoria: "cavilha",
    medidas: "Ø8mm",
    descricao: "Cavilha para montagem de painéis",
  },
  {
    id: "dobradica_35mm",
    nome: "Dobradiça 35mm",
    categoria: "dobradica",
    medidas: "35mm",
    descricao: "Dobradiça para portas",
  },
  {
    id: "suporte_prateleira",
    nome: "Suporte de Prateleira",
    categoria: "suporte",
    descricao: "Suporte regulável para prateleira",
  },
  {
    id: "corredica_esq",
    nome: "Corrediça Lateral Esquerda",
    categoria: "corredica",
    descricao: "Corrediça para gaveta (lado esquerdo)",
  },
  {
    id: "corredica_dir",
    nome: "Corrediça Lateral Direita",
    categoria: "corredica",
    descricao: "Corrediça para gaveta (lado direito)",
  },
  {
    id: "prego_costa",
    nome: "Prego para Costa",
    categoria: "prego",
    medidas: "2mm × 20mm",
    descricao: "Prego fino para fixar costa",
  },
  {
    id: "parafuso_puxador",
    nome: "Parafuso para Puxador",
    categoria: "parafuso",
    medidas: "M4 × 25mm",
    descricao: "Parafuso para fixar puxadores",
  },
];
