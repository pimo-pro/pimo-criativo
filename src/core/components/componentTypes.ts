/**
 * Tipos de componentes usados na fabricação de móveis.
 * Base para regras de ferragens, furos e montagem.
 */

export interface ComponentType {
  id: string;
  nome: string;
  categoria: "estrutura" | "porta" | "gaveta" | "acabamento";

  possui_lados: boolean;
  lados: string[];

  ferragens_default?: Array<{
    ferragem_id: string;
    quantidade_por_lado?: number;
    quantidade_fixa?: number;
    aplicar_em: string[];
  }>;

  recebe_furos: boolean;
  regras_de_furo?: Array<{
    tipo: "cavilha" | "parafuso" | "dobradica" | "corredica" | "suporte_prateleira" | "prego";
    diametro?: number;
    profundidade?: number;
    quantidade_por_lado?: number;
    aplicar_em: string[];
  }>;

  regras_de_montagem?: Array<{
    conecta_com: string;
    tipo_conexao: "parafuso" | "cavilha" | "dobradiça" | "cola";
  }>;

  aparece_no_cutlist: boolean;
  aparece_no_pdf: boolean;
}

const LADOS_PADRAO = ["direita", "esquerda", "topo", "fundo"];

function base(
  id: string,
  nome: string,
  categoria: ComponentType["categoria"],
  possui_lados: boolean,
  lados: string[] = []
): ComponentType {
  return {
    id,
    nome,
    categoria,
    possui_lados,
    lados,
    recebe_furos: false,
    aparece_no_cutlist: true,
    aparece_no_pdf: true,
  };
}

export const COMPONENT_TYPES_DEFAULT: ComponentType[] = [
  {
    ...base("cima", "Cima", "estrutura", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "parafuso_4x50", quantidade_fixa: 4, aplicar_em: [] },
      { ferragem_id: "cavilha_8mm", quantidade_fixa: 4, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "cavilha", diametro: 8, aplicar_em: ["direita", "esquerda"] },
      { tipo: "parafuso", diametro: 3, aplicar_em: ["direita", "esquerda"] },
    ],
  },
  {
    ...base("fundo", "Fundo", "estrutura", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "parafuso_4x50", quantidade_fixa: 4, aplicar_em: [] },
      { ferragem_id: "cavilha_8mm", quantidade_fixa: 4, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "cavilha", diametro: 8, aplicar_em: ["direita", "esquerda"] },
      { tipo: "parafuso", diametro: 3, aplicar_em: ["direita", "esquerda"] },
    ],
  },
  {
    ...base("lateral_esquerda", "Lateral esquerda", "estrutura", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "parafuso_4x50", quantidade_fixa: 4, aplicar_em: [] },
      { ferragem_id: "cavilha_8mm", quantidade_fixa: 4, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "cavilha", diametro: 8, aplicar_em: ["topo", "fundo"] },
      { tipo: "parafuso", diametro: 3, aplicar_em: ["topo", "fundo"] },
    ],
  },
  {
    ...base("lateral_direita", "Lateral direita", "estrutura", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "parafuso_4x50", quantidade_fixa: 4, aplicar_em: [] },
      { ferragem_id: "cavilha_8mm", quantidade_fixa: 4, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "cavilha", diametro: 8, aplicar_em: ["topo", "fundo"] },
      { tipo: "parafuso", diametro: 3, aplicar_em: ["topo", "fundo"] },
    ],
  },
  {
    ...base("costa", "Costa", "estrutura", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "prego_costa", quantidade_fixa: 12, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "prego", diametro: 1, aplicar_em: [] },
    ],
  },
  base("separador", "Separador", "estrutura", true, LADOS_PADRAO),
  base("divisorio", "Divisório", "estrutura", true, LADOS_PADRAO),
  {
    ...base("prateleira", "Prateleira", "estrutura", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "suporte_prateleira", quantidade_fixa: 4, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "suporte_prateleira", diametro: 5, aplicar_em: ["direita", "esquerda"] },
    ],
  },
  {
    ...base("porta", "Porta", "porta", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "dobradica_35mm", quantidade_fixa: 2, aplicar_em: [] },
      { ferragem_id: "parafuso_puxador", quantidade_fixa: 2, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "dobradica", diametro: 35, quantidade_por_lado: 2, aplicar_em: ["direita"] },
      { tipo: "parafuso", diametro: 8, quantidade_por_lado: 2, aplicar_em: ["direita"] },
      { tipo: "parafuso", diametro: 5, aplicar_em: [] },
    ],
  },
  {
    ...base("gaveta_lat_esq", "Gaveta lateral esquerda", "gaveta", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "corredica_esq", quantidade_fixa: 2, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "corredica", diametro: 5, aplicar_em: ["direita", "esquerda"] },
    ],
  },
  {
    ...base("gaveta_lat_dir", "Gaveta lateral direita", "gaveta", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "corredica_dir", quantidade_fixa: 2, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "corredica", diametro: 5, aplicar_em: ["direita", "esquerda"] },
    ],
  },
  {
    ...base("gaveta_frente", "Gaveta frente", "gaveta", true, LADOS_PADRAO),
    recebe_furos: true,
    ferragens_default: [
      { ferragem_id: "parafuso_puxador", quantidade_fixa: 2, aplicar_em: [] },
    ],
    regras_de_furo: [
      { tipo: "parafuso", diametro: 5, aplicar_em: [] },
    ],
  },
  base("gaveta_fundo", "Gaveta fundo", "gaveta", true, LADOS_PADRAO),
  base("remate_cima", "Remate cima", "acabamento", false),
  base("remate_lado", "Remate lado", "acabamento", false),
  base("remate_completo", "Remate completo", "acabamento", false),
  base("roda_pe", "Roda pé", "acabamento", false),
  base("tampo", "Tampo", "estrutura", true, LADOS_PADRAO),
  base("puxador", "Puxador", "acabamento", false),
];
