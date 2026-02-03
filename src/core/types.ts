import type { Group } from "three";

export interface Material {
  tipo: string;
  espessura: number;
  precoPorM2: number;
}

export interface Dimensoes {
  largura: number;
  altura: number;
  profundidade: number;
}

/** Tipos de acabamento de borda (corte da chapa). */
export type TipoBorda = "reta" | "biselada" | "arredondada";

/** Tipos de fundo da caixa (montagem). */
export type TipoFundo = "integrado" | "recuado" | "sem_fundo";

/** Origem da peça na lista de corte (paramétrica da caixa ou importada de GLB). */
export type CutListSourceType = "parametric" | "glb_importado";

export interface CutListItem {
  id: string;
  nome: string;
  quantidade: number;
  dimensoes: {
    largura: number;
    altura: number;
    profundidade: number;
  };
  espessura: number;
  material: string;
  tipo: string;
  /** Permite distinguir peças paramétricas de peças importadas na UI. */
  sourceType?: CutListSourceType;
  /** ID da instância do modelo na caixa (quando sourceType === "glb_importado"). */
  modelInstanceId?: string;
  /** ID da caixa (para agrupamento). */
  boxId?: string;
}

/** Instância de um modelo CAD (GLB) associada a uma caixa. */
export interface BoxModelInstance {
  /** ID único da instância (ex.: box-1-model-abc). */
  id: string;
  /** Referência ao CadModel (catálogo). */
  modelId: string;
  /** Nome de exibição (override do catálogo). */
  nome?: string;
  /** Material aplicado a esta instância. */
  material?: string;
  /** Categoria (override do catálogo). */
  categoria?: string;
}

export interface CutListItemComPreco extends CutListItem {
  precoUnitario: number;
  precoTotal: number;
  espessura: number;
}

export interface Peca {
  id: string;
  nome: string;
  tipo: string;
  dimensoes: {
    largura: number;
    altura: number;
    profundidade: number;
  };
  posicao: {
    x: number;
    y: number;
    z: number;
  };
  rotacao?: {
    x: number;
    y: number;
    z: number;
  };
  cor?: string;
}

export interface Estrutura3D {
  pecas: Peca[];
  dimensoesTotais: {
    largura: number;
    altura: number;
    profundidade: number;
  };
  centro: {
    x: number;
    y: number;
    z: number;
  };
}

export interface Acessorio {
  id: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  tipo?: string;
  descricao?: string;
}

export interface AcessorioComPreco extends Acessorio {
  precoTotal: number;
}

export interface Design {
  cutList: CutListItem[];
  estrutura3D: Estrutura3D | null;
  acessorios: Acessorio[];
  timestamp: Date;
}

export interface BoxConfig {
  id: string;
  nome: string;
  dimensoes: Dimensoes;
}

export interface BoxDesign {
  boxId: string;
  cutList: CutListItem[];
  cutListComPreco: CutListItemComPreco[];
  estrutura3D: Estrutura3D;
  precoTotalPecas: number;
}

export interface BoxModule {
  id: string;
  nome: string;
  dimensoes: Dimensoes;
  espessura: number;
  material?: string;
  tipoBorda: TipoBorda;
  tipoFundo: TipoFundo;
  /** Instâncias de modelos GLB associadas a esta caixa. */
  models: BoxModelInstance[];
  prateleiras: number;
  portaTipo: "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr";
  gavetas: number;
  alturaGaveta: number;
  ferragens: Acessorio[];
  cutList: CutListItem[];
  cutListComPreco: CutListItemComPreco[];
  estrutura3D: Estrutura3D | null;
  precoTotalPecas: number;
}

export interface WorkspaceBox {
  id: string;
  nome: string;
  dimensoes: Dimensoes;
  espessura: number;
  tipoBorda: TipoBorda;
  tipoFundo: TipoFundo;
  /** Instâncias de modelos GLB associadas a esta caixa (multi-model por box). */
  models: BoxModelInstance[];
  /** Modelo GLB carregado diretamente (uso interno no Viewer). */
  glbModel?: Group;
  prateleiras: number;
  portaTipo: "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr";
  gavetas: number;
  alturaGaveta: number;
  posicaoX_mm: number;
  posicaoY_mm: number;
  /** Posição Z em mm (para manipulação 3D no viewer). */
  posicaoZ_mm?: number;
  rotacaoY_90: boolean;
  /** Rotação Y em radianos (manipulação visual no viewer; não altera cut list). */
  rotacaoY?: number;
  /** Se true, o viewer não reposiciona esta caixa no reflow (posição manual). */
  manualPosition?: boolean;
  /** ID do item do catálogo que originou esta caixa (opcional). */
  catalogItemId?: string;
}

export interface ProjetoConfig {
  tipo: string;
  material: Material;
  dimensoes: Dimensoes;
  quantidade: number;
}

export interface ResultadosCalculo {
  numeroPecas: number;
  numeroPaineis: number;
  areaTotal: number;
  desperdicio: number;
  desperdicioPercentual: number;
  precoMaterial: number;
  precoFinal: number;
}

export interface ChangelogEntry {
  id: string;
  timestamp: Date;
  type: "box" | "calc" | "doc";
  message: string;
}