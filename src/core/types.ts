import type { Group } from "three";
import type { DoorLayerItem, DrawerLayerItem } from "../models/BoxLayers";
import type { DrawerHeightMode } from "./drawers/drawerHeightModeTypes";
export type {
  DivisorItem,
  SeparadorItem,
  DivisorReferenceEdge,
  SeparadorReferenceEdge,
  DivisorPrateleiraLado,
  DivisorPosicaoRelativaAoSep,
  SeparadorAncoraHorizontal,
} from "./divSep/types";

export type OperationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

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

/** Direção do veio (grain) legacy — orientação interna de painéis paramétricos (UV). */
export type GrainDirection = "horizontal" | "vertical" | "none";

/** Código industrial de veio na cutlist / nesting / TCN. YY = fixo; XX = livre. */
export type IndustrialGrainCode = "YY" | "XX";

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

export type DrillType = "cavilha" | "parafuso" | "minifix" | "dobradica" | "dobradica_fixacao" | "dobradica_parafuso_uniao" | "corredica" | "prateleira" | "fixacao_estrutural" | "puxador" | "fixacao_metalica";
export type DrillFace = "cima" | "fundo" | "esquerda" | "direita" | "frente" | "tras";
export type DrillPanelKey = "cima" | "fundo" | "lateral_esquerda" | "lateral_direita" | "porta";
export interface TechnicalDrillHole {
  x: number;
  y: number;
  diametro: number;
  profundidade: number;
  tipo: DrillType;
  face: DrillFace;
  /** Força TypeNo=1 (Vertical Hole) no export KDT DRILL. */
  topDrillable?: boolean;
  /** "groove" para rasgos de encaixe (fundo da gaveta); omitido = furo circular. */
  holeSubtype?: "groove";
  /** Largura do rasgo em mm (apenas quando holeSubtype="groove"). */
  grooveWidth?: number;
  /** Comprimento do rasgo em mm (apenas quando holeSubtype="groove"). */
  grooveLength?: number;
  /**
   * Rasgo de painel completo com sangria industrial (BeginX=L+overcut, EndX=−overcut).
   * Usado nos laterais da gaveta — Y/Width/Depth não dependem de L.
   */
  grooveFullPanelOvercut?: boolean;
  /** Correction KDT do rasgo (laterais = 2). */
  grooveCorrection?: number;
  /** ToolName KDT do rasgo (ex.: FRESA_DESBASTE_10MM). */
  grooveToolName?: string;
  /** Chave do par de cavilha 10×30↔10×13. */
  pairedHoleKey?: string;
  /** ID catálogo (cavilha_10x30 / cavilha_10x13). */
  holeCatalogId?: string;
  /** Ferragem CAVILHA_10x40. */
  ferragemId?: string;
}

export interface ViewerDrillMarkersByPanel extends Record<DrillPanelKey, TechnicalDrillHole[]> {
  /** Furos por porta (índice = ordem da porta). Quando definido, cada porta usa apenas os seus furos. */
  portaPerDoor?: TechnicalDrillHole[][];
  /** Frente fixa (caixas de canto — calço alinhado à porta). */
  frente_fixa?: TechnicalDrillHole[];
  /** Furos por separador horizontal (chave = panelId / item id do SEP). */
  separadoresById?: Record<string, TechnicalDrillHole[]>;
  /** Furos por divisório vertical (chave = panelId / item id do DIV). */
  divisoresById?: Record<string, TechnicalDrillHole[]>;
}

export interface DrillHole {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  /** Tipo de furo para cores no Layout. */
  holeType?: DrillType;
  /** Se true, furo perfurável pelo topo (emissão TCN). */
  topDrillable?: boolean;
}

/** Furo real do painel: geometria de fabricação (fonte única para Layout PRO e TCN). */
export type PanelFace = "A" | "B";

export interface PanelDrillHole {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  /** Tipo: cavilha, parafuso, minifix, dobradiça, prateleira, etc. */
  holeType?: DrillType;
  /** Face do painel (A ou B). */
  face?: PanelFace;
  /** Se true, furo perfurável pelo topo (emissão TCN). */
  topDrillable?: boolean;
  /** "groove" para rasgos de encaixe; omitido = furo circular. */
  holeSubtype?: "groove";
  /** Largura do rasgo em mm (apenas quando holeSubtype="groove"). */
  grooveWidth?: number;
  /** Comprimento do rasgo em mm (apenas quando holeSubtype="groove"). */
  grooveLength?: number;
  /** Rasgo full-span com sangria L+overcut → −overcut (laterais gaveta). */
  grooveFullPanelOvercut?: boolean;
  /** Correction KDT do rasgo. */
  grooveCorrection?: number;
  /** ToolName KDT do rasgo. */
  grooveToolName?: string;
  /** Chave partilhada com o furo de encaixe na peça oposta (par 10×30↔10×13). */
  pairedHoleKey?: string;
  /** ID do catálogo industrial (ex.: cavilha_10x30). */
  holeCatalogId?: string;
  /** Ferragem física associada (ex.: cavilha_10x40). */
  ferragemId?: string;
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
  /** Direção do veio industrial: YY (fixo) ou XX (livre). */
  grainDirection?: IndustrialGrainCode;
  /** Override de escala UV por peça (opcional). */
  uvScaleOverride?: { x: number; y: number };
  /** Override de rotação UV por peça em graus (opcional). */
  uvRotationOverride?: number;
  /** Materiais por face (preparação para texturas por face). */
  faceMaterials?: PieceFaceMaterials;
  /** Furos reais do painel: geometria de fabricação (fonte única para Layout de Corte PRO, TCN e Viewer). */
  drillHoles?: PanelDrillHole[];
  /** Metadados por painel (ex.: labelNumber, QRNumber) — fonte preferencial para N/QR em PDFs e exportações. */
  metadata?: Record<string, unknown>;
  /** QR em SVG com o ID industrial da etiqueta (`buildIndustrialId`). */
  qrSvg?: string;
  /** Índice sequencial da peça no ciclo 1..99. */
  pieceNumber?: number;
  /** Profundidade exterior da caixa (mm), FASE 2/4 — não é a terceira dimensão da peça na lista. */
  boxProfundidadeExternaMm?: number;
  /** Profundidade útil interna da caixa (mm), FASE 3/4 — mesmo modelo que `getProfundidadeInternaUtilMm`. */
  boxProfundidadeInternaUtilMm?: number;
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
  /** Frente fixa (caixas de canto). */
  frente_fixa?: string;
  prateleiras: string[];
  portas: string[];
  gavetas: string[];
  /** Divisórios verticais (DIV). */
  divisores: string[];
  /** Separadores horizontais (SEP). */
  separadores: string[];
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
  drawerHeightMode?: DrawerHeightMode;
  drawerType?: "normal" | "pro";
  /** Erro bloqueante da última tentativa de configurar gavetas (FASE 4 UI). */
  drawerConfigError?: string;
  /** Avisos de validação de gavetas (FASE 4 UI). */
  drawerConfigWarnings?: string[];
  /** Tipo de armário para recursos visuais e acessórios (inferior/superior). */
  cabinetType?: "lower" | "upper";
  /** Altura do pé (PE) em cm para armários inferiores. */
  pe_cm?: number;
  /** Altura dos pés em mm (controle de UI/Viewer). */
  feetHeight?: number;
  /** Recuo frontal dos pés em mm (controle de UI/Viewer). */
  feetOffsetFront?: number;
  /** Ativa/desativa pés visuais e ferragens de pé para armários inferiores. */
  feetEnabled?: boolean;
  /** IDs únicos por peça (cima, fundo, laterais, costa, prateleiras, portas, gavetas). */
  panelIds?: BoxPanelIds;
  /** Camada de portas da caixa. */
  doorsLayer: DoorLayerItem[];
  /** Camada de gavetas da caixa. */
  drawersLayer: DrawerLayerItem[];
  /** Legacy opcional (projectos antigos Modelo B) — ignorado em runtime. */
  europeanDrawerConfig?: Record<string, unknown>;
  /** Divisórios verticais (DIV) internos. */
  divisores: import("./divSep/types").DivisorItem[];
  /** Separadores horizontais (SEP) internos. */
  separadores: import("./divSep/types").SeparadorItem[];
  /** Opções avançadas de prateleiras (grelha / direcção DIV-SEP). */
  shelfOptions?: import("./divSep/types").BoxShelfOptions;
  /** ID do item de catálogo que originou a caixa. */
  catalogItemId?: string;
  /** ID do modelo base que originou a caixa. */
  baseCabinetId?: string;
  /** Canto v2: orientação do módulo (frente fixa + porta). Default: direita. */
  orientation?: import("./cornerCabinet/cornerCabinetRules").CornerOrientation;
  /**
   * PI: oculta apenas furos de corrediça nas laterais (settings). Não afeta grelha 32 mm nem dobradiça.
   */
  piHideDrawerHoles?: boolean;
  ferragens: Acessorio[];
  cutList: CutListItem[];
  cutListComPreco: CutListItemComPreco[];
  estrutura3D: Estrutura3D | null;
  precoTotalPecas: number;
  /** FASE 2 — Ver `WorkspaceBox.costaAtiva`. */
  costaAtiva?: boolean;
  /** Sem costa traseira (visual + industrial). Sincronizado com `costaAtiva` (`noBackPanel === !costaAtiva`). */
  noBackPanel?: boolean;
  /** Material industrial explícito da COSTA (canonicalId, ex.: carvalho-10). Omitido = família do corpo. */
  costaMaterialId?: string;
  /** Espessura explícita da COSTA (mm). Omitido = 10 mm (ou espessura da variante escolhida). */
  costaThicknessMm?: number;
  /** Material industrial explícito dos separadores horizontais. Omitido = material do corpo. */
  separadorMaterialId?: string;
  /** Material industrial explícito da frente fixa (canto v2). Omitido = material do corpo. */
  frenteFixaMaterialId?: string;
  /** FASE 2 — Ver `WorkspaceBox.profundidadeExterna`. */
  profundidadeExterna?: number;
  /** Orla V1 — preset do caixote. `undefined` = auto (1.º Admin); `null` = sem orla. */
  orlaPresetId?: string | null;
  /** Remate V1 — IDs dos remates associados a esta caixa. */
  remateIds?: string[];
  /** Observações da caixa (nível box). */
  observacoes?: string[];
  /** ID do modelo industrial personalizado (custom-model-*). */
  customIndustrialModelId?: string;
  /** false = veio fixo no nesting; true = permite rodar mesmo com material de madeira. */
  allowPieceRotation?: boolean;
  /** true = manter veio da madeira (proibir rotação no nesting). */
  lockWoodGrain?: boolean;
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
  drawerHeightMode?: DrawerHeightMode;
  drawerType?: "normal" | "pro";
  /** Erro bloqueante da última tentativa de configurar gavetas (FASE 4 UI). */
  drawerConfigError?: string;
  /** Avisos de validação de gavetas (FASE 4 UI). */
  drawerConfigWarnings?: string[];
  /**
   * Legacy opcional (projectos antigos Modelo B) — ignorado em runtime.
   */
  europeanDrawerConfig?: Record<string, unknown>;
  posicaoX_mm: number;
  posicaoY_mm: number;
  /** Posição Z em mm (para manipulação 3D no viewer). */
  posicaoZ_mm?: number;
  rotacaoY_90: boolean;
  /** Rotação Y em radianos (manipulação visual no viewer; não altera cut list). */
  rotacaoY?: number;
  /** Rotação X e Z em radianos (manipulação visual; rotação completa 3D). */
  rotacaoX?: number;
  rotacaoZ?: number;
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
  /** Canto v2: orientação do módulo (frente fixa + porta). Default: direita. */
  orientation?: import("./cornerCabinet/cornerCabinetRules").CornerOrientation;
  /**
   * PI: oculta apenas furos de corrediça nas laterais. Grelha e dobradiça mantêm-se conforme modelo PI.
   */
  piHideDrawerHoles?: boolean;
  /** Tipo de armário para altura automática: inferior (base) ou superior (parede). */
  cabinetType?: "lower" | "upper";
  /** Altura do pé (PE) em cm para caixas inferiores; base da caixa fica a PE cm do piso (default 10). */
  pe_cm?: number;
  /** Altura dos pés em mm (default 100). */
  feetHeight?: number;
  /** Recuo frontal dos pés em mm (default 100). */
  feetOffsetFront?: number;
  /** Ativa/desativa os pés de 10 cm para caixas inferiores. */
  feetEnabled?: boolean;
  /** Se false, o viewer não altera rotation.y (modo manual; ativado pelo botão RODAR). Default true. */
  autoRotateEnabled?: boolean;
  /** IDs únicos e estáveis por peça (cima, fundo, laterais, costa, prateleiras, portas, gavetas). Evita duplicate key no React. */
  panelIds?: BoxPanelIds;
  /** Camada de portas da caixa. */
  doorsLayer: DoorLayerItem[];
  /** Camada de gavetas da caixa. */
  drawersLayer: DrawerLayerItem[];
  /** Divisórios verticais (DIV) internos. */
  divisores: import("./divSep/types").DivisorItem[];
  /** Separadores horizontais (SEP) internos. */
  separadores: import("./divSep/types").SeparadorItem[];
  /** Opções avançadas de prateleiras (grelha / direcção DIV-SEP). */
  shelfOptions?: import("./divSep/types").BoxShelfOptions;
  /** Id do material (CRUD) ou label legado. Usado para resolver material no Viewer e em exports. */
  material?: string;
  /** false = veio fixo no nesting; true = permite rodar mesmo com material de madeira. */
  allowPieceRotation?: boolean;
  /** true = manter veio da madeira (proibir rotação no nesting). Auto em material de madeira. */
  lockWoodGrain?: boolean;
  /** Se true, a peça não pode ser movida, redimensionada nem transformada (apenas selecionável para medição). */
  locked?: boolean;
  /**
   * FASE 2 — Costa estrutural ativa (default lógico: true quando omitido em projetos antigos).
   * Ver `resolveCostaAtiva` em `boxDepthModel.ts`.
   */
  costaAtiva?: boolean;
  /** Sem costa traseira (visual + industrial). Sincronizado com `costaAtiva` (`noBackPanel === !costaAtiva`). */
  noBackPanel?: boolean;
  /** Material industrial explícito da COSTA (canonicalId). */
  costaMaterialId?: string;
  /** Espessura explícita da COSTA (mm). */
  costaThicknessMm?: number;
  /** Material industrial explícito dos separadores horizontais. Omitido = material do corpo. */
  separadorMaterialId?: string;
  /** Material industrial explícito da frente fixa (canto v2). Omitido = material do corpo. */
  frenteFixaMaterialId?: string;
  /**
   * FASE 2 — Profundidade externa explícita (mm), alinhada a `dimensoes.profundidade`.
   * Mantida em sincrono nas ações de dimensão; facilita FASE 3–4.
   */
  profundidadeExterna?: number;
  /** Orla V1 — preset do caixote. `undefined` = auto (1.º Admin); `null` = sem orla. */
  orlaPresetId?: string | null;
  /** Remate V1 — IDs dos remates associados a esta caixa. */
  remateIds?: string[];
  /** Observações da caixa (nível box). */
  observacoes?: string[];
  /** ID do modelo industrial personalizado (custom-model-*). */
  customIndustrialModelId?: string;
  /** Snapshot do designBox para instâncias do modelo personalizado. */
  industrialDesignBox?: import("./industrialDesigner/types").IndustrialDesignBox;
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