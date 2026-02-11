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

/** Direção do veio (grain) para UV e textura. */
export type GrainDirection = "horizontal" | "vertical" | "none";

/**
 * Estrutura de material visual por face (Layout Engine / MaterialLibrary v2).
 * Alinhada com VisualMaterial; usada em CutListItem.faceMaterials.
 */
export interface LayoutVisualMaterial {
  color: string;
  textureUrl?: string;
  uvScale: { x: number; y: number };
  uvRotation: number;
  roughness: number;
  metallic: number;
  normalMapUrl?: string;
}

/** Materiais por face (preparação para texturas por face). */
export interface PieceFaceMaterials {
  top?: LayoutVisualMaterial;
  bottom?: LayoutVisualMaterial;
  left?: LayoutVisualMaterial;
  right?: LayoutVisualMaterial;
  front?: LayoutVisualMaterial;
  back?: LayoutVisualMaterial;
}

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
  /** ID do material no CRUD (Layout Engine / MaterialLibrary v2). */
  materialId?: string;
  /** Material visual completo para a peça (cor, UV, roughness, metallic). */
  visualMaterial?: LayoutVisualMaterial;
  /** Direção do veio: horizontal (tampos), vertical (laterais), none. */
  grainDirection?: GrainDirection;
  /** Override de escala UV por peça (opcional). */
  uvScaleOverride?: { x: number; y: number };
  /** Override de rotação UV por peça em graus (opcional). */
  uvRotationOverride?: number;
  /** Materiais por face (preparação para texturas por face). */
  faceMaterials?: PieceFaceMaterials;
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

/** IDs únicos e estáveis por peça da caixa (evita "duplicate key" no React). */
export interface BoxPanelIds {
  cima: string;
  fundo: string;
  lateral_esquerda: string;
  lateral_direita: string;
  costa: string;
  prateleiras: string[];
  portas: string[];
  gavetas: string[];
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
  /** IDs únicos por peça (cima, fundo, laterais, costa, prateleiras, portas, gavetas). */
  panelIds?: BoxPanelIds;
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
  /**
   * Direção da "costa" (parte traseira) da caixa em radianos: 0 | π/2 | π | -π/2.
   * Usado no auto-rotate ao encostar na parede: finalRotationY = wall.rotation.y + costaRotationY.
   */
  costaRotationY?: number;
  /** Se true, o viewer não reposiciona esta caixa no reflow (posição manual). */
  manualPosition?: boolean;
  /** ID do item do catálogo que originou esta caixa (opcional). */
  catalogItemId?: string;
  /** ID do modelo Base Cabinet que originou esta caixa (para expansão: guardar como modelo personalizado). */
  baseCabinetId?: string;
  /** Tipo de armário para altura automática: inferior (base) ou superior (parede). */
  cabinetType?: "lower" | "upper";
  /** Altura do pé (PE) em cm para caixas inferiores; base da caixa fica a PE cm do piso (default 10). */
  pe_cm?: number;
  /** Ativa/desativa os pés de 10 cm para caixas inferiores. */
  feetEnabled?: boolean;
  /** Se false, o viewer não altera rotation.y (modo manual; ativado pelo botão RODAR). Default true. */
  autoRotateEnabled?: boolean;
  /** IDs únicos e estáveis por peça (cima, fundo, laterais, costa, prateleiras, portas, gavetas). Evita duplicate key no React. */
  panelIds?: BoxPanelIds;
  /** Id do material (CRUD) ou label legado. Usado para resolver material no Viewer e em exports. */
  material?: string;
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