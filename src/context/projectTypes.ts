import type {
  AcessorioComPreco,
  BoxModule,
  ChangelogEntry,
  CutListItem,
  CutListItemComPreco,
  Design,
  Dimensoes,
  Estrutura3D,
  Material,
  ResultadosCalculo,
  TipoBorda,
  TipoFundo,
  WorkspaceBox,
} from "../core/types";
import type {
  CreateRemateInput,
  CreateRematePieceInput,
  RematePiece,
  UpdateRematePieceInput,
} from "../core/remate/remateTypes";
import type {
  CreateHematiInput,
  ProjectHemati,
  UpdateHematiInput,
} from "../core/hemati/hematiTypes";
import type {
  CreateRodapeInput,
  ProjectRodape,
  UpdateRodapeInput,
} from "../core/rodape/rodapeTypes";
import type { RuleViolation } from "../core/rules/types";
import type { LayoutWarnings } from "../core/layout/layoutWarnings";
import type { RulesConfig } from "../core/rules/rulesConfig";
import type { RulesProfilesConfig } from "../core/rules/rulesProfiles";
import type { DoorLayerItem, DrawerLayerItem, LayerOpenDirection } from "../models/BoxLayers";
import type {
  InternalMeasurementEntry,
  InternalMeasurementPoint,
  ProjectMeasurementsState,
} from "../3d/viewer-engine/measurement/internalRulerTypes";
import type {
  UnifiedMeasurement,
  UnifiedMeasurementPoint,
} from "../3d/viewer-engine/measurement/unifiedMeasurementTypes";

export type {
  InternalMeasurementEntry,
  InternalMeasurementPoint,
  ProjectMeasurementsState,
  UnifiedMeasurement,
  UnifiedMeasurementPoint,
};

export type ViewerMousePreset = "cad" | "classic" | "orbitFriendly" | "mouseCentric";
export type ViewerBackgroundMode = "studio" | "white" | "dark" | "woodFloor";
export type ViewerMaterialQuality = "standard" | "premium" | "lacquered";
export type UltraPerformanceInternalMode = "balanced" | "flat2" | "aggressive";
export type ScalingMode = "additive" | "ratio";

export type UltraPerformanceModeOptions = {
  enabled: boolean;
  mode: UltraPerformanceInternalMode;
};

export type ViewerSettings = {
  showPanelEdges: boolean;
  hiddenPanels: string[];
  explodedViewEnabled: boolean;
  explodedViewIntensity: number;
  hideAllPanels: boolean;
  showCeiling: boolean;
  wallEditMode: boolean;
  mousePreset: ViewerMousePreset;
  backgroundMode: ViewerBackgroundMode;
  materialQuality: ViewerMaterialQuality;
  enableReflections: boolean;
  photoModeEnabled: boolean;
  /** Highlight 3D: hover/click em elementos selecionáveis (portas, gavetas, painéis, furos). */
  highlightEnabled: boolean;
  /** Régua: modo de medição (UI apenas; medição a implementar). */
  rulerEnabled: boolean;
  /** Régua interna (cavidade): seleção interna + overlay de dimensões L×A×P. */
  internalRulerEnabled: boolean;
  ultraPerformanceModeOptions: UltraPerformanceModeOptions;
  /** Multiplicador global da iluminação (0.6 - 1.4). */
  globalLightIntensity: number;
  /** Intensidade das sombras projetadas pela luz principal (0 = desligado, 1 = 100%). */
  shadowIntensity: number;
  /** Intensidade do brilho para exibição (1 = comportamento atual, 0 = fosco). Não altera presets. */
  glossIntensity: number;
  /** Modo fosco: remove brilho, env e clearcoat independentemente do slider. */
  matteMode: boolean;
  /** Panel Rendering 2.0: evidencia peças individuais já renderizadas como meshes separados. */
  panelRenderingEnabled: boolean;
  /** Debug FASE 5: marcadores de furação nas gavetas no Viewer 3D. */
  showDrawerDrilling: boolean;
  /** Modo padrão ao alterar medidas via menu de contexto (sem submenu). */
  defaultScalingMode: ScalingMode;
};

/**
 * Estado global do projeto: caixas, workspace, material, regras, design e cutlist.
 * Fonte única para o Provider; não modificar estrutura sem atualizar ProjectContext.
 */
export interface ProjectState {
  projectName: string;
  /**
   * Designer do projeto (editavel na Home).
   * Vazio = resolver com utilizador atual / "Visitante" na UI e no seed.
   */
  designer?: string;
  /** Empresa executora (editavel na Home). Default tipico: "Carpintaria". */
  empresaExecutora?: string;
  /** Descricao livre de materiais do projeto (editavel na Home). */
  materiaisProjeto?: string;
  tipoProjeto: string;
  /** Material legado (compatibilidade); não usar como fonte principal. */
  material: Material;
  /** Id do material no CRUD; fonte principal. Vazio = usar material.tipo para resolução. */
  materialId?: string;
  dimensoes: Dimensoes;
  quantidade: number;
  boxes: BoxModule[];
  selectedBoxId: string;
  workspaceBoxes: WorkspaceBox[];
  selectedWorkspaceBoxId: string;
  selectedCaixaId: string;
  /** URL do modelo CAD selecionado (para preview). */
  selectedCaixaModelUrl: string | null;
  /** ID da instância do modelo selecionada na caixa (para edição). */
  selectedModelInstanceId: string | null;

  resultados: ResultadosCalculo | null;
  ultimaAtualizacao: Date | null;
  /** Último instante de auto-save (ISO string). */
  lastAutosaveTime: string | null;
  /** Id do projeto atualmente aberto/guardado; usado para UPDATE em saves subsequentes. */
  currentProjectId?: string | null;
  /** Metadado: projeto marcado para fabricação/orçamento (painel de exportação). */
  readyForProduction: boolean;

  design: Design | null;
  cutList: CutListItem[] | null;
  cutListComPreco: CutListItemComPreco[] | null;
  /** Peças extraídas por caixa e por modelo: boxId → modelInstanceId → itens com preço. */
  extractedPartsByBoxId: Record<string, Record<string, CutListItemComPreco[]>>;
  /** Violações de regras dinâmicas por modelo (dimensão, material, compatibilidade). */
  ruleViolations: RuleViolation[];
  /** Posições dos modelos em espaço local da caixa (m): boxId → modelInstanceId → { x, y, z }. */
  modelPositionsByBoxId: Record<string, Record<string, { x: number; y: number; z: number }>>;
  /** Colisões e modelos fora dos limites da caixa. */
  layoutWarnings: LayoutWarnings;
  estrutura3D: Estrutura3D | null;
  acessorios: AcessorioComPreco[] | null;

  precoTotalPecas: number | null;
  precoTotalAcessorios: number | null;
  precoTotalProjeto: number | null;

  /**
   * P3.5 — Overrides do Financeiro Unificado (IVA %, custos manuais, distância).
   * Não altera cutlist/CNC; só exibição, PDF e total.
   */
  financeiroOverrides: import("../core/financeiro/financeiroUnificadoTypes").FinanceiroOverrides;

  /**
   * P3.6 — Regras ADMIN (ADM / montagem / portes) do projeto.
   * Se vazio, usa defaults globais (Admin / localStorage).
   */
  financeiroAdminSettings: import("../core/financeiro/financeiroAdminRules").FinanceiroAdminSettings;

  /** Ferramenta 3D ativa no Viewer: select, move, rotate. Opcional para compatibilidade com snapshots antigos. */
  activeViewerTool?: "select" | "move" | "rotate" | "scale";

  /** Configurações visuais/controle do viewer (fase 3). */
  viewerSettings: ViewerSettings;

  /** Medições do viewer (régua interna, etc.). */
  measurements: ProjectMeasurementsState;

  /** Sala Room 2.0 — geometria visual (sem impacto industrial). */
  room: import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomConfig | null;

  /** Orla V1 — catálogo de presets de orla do projeto. */
  orlaPresets: import("../core/orla/orlaTypes").OrlaPreset[];
  /** Gavetas — catálogo de presets de configuração de gavetas do projeto. */
  drawerPresets: import("../core/drawers/drawerPresetTypes").DrawerPreset[];
  /** Orla V1 — configuração por peça (chave = panelId estável). */
  orlaPieces: Record<string, import("../core/orla/orlaTypes").PieceOrlaConfig>;
  /** Observações por peça (chave = panelId estável ou id industrial). */
  pieceObservacoes: Record<string, string[]>;
  /** Edições industriais manuais (medidas, mover, apagar) — painel mestre. */
  industrialPieceEdits: import("../core/industrial/industrialPieceEditsTypes").IndustrialPieceEditsStore;
  /** Estado das operações industriais (Nesting, CNC, …). */
  industrialOperacoes: import("../core/industrial/industrialPieceEditsTypes").IndustrialOperacoesStore;
  /**
   * Overrides documentais das páginas /analise (Fases 2–5).
   * Não altera design 3D, regras, CNC/TCN/drill.
   * Etiquetas UEE: só whitelist documental de overrides.cutlist (Fase 5).
   */
  industrialDocumentOverrides: import("../core/industrial/onlineAnalysis/industrialDocumentOverridesTypes").IndustrialDocumentOverridesStore;
  /** Histórico documental append-only das edições /analise (Fase 3). */
  industrialDocumentHistory: import("../core/industrial/onlineAnalysis/industrialDocumentHistoryTypes").IndustrialDocumentHistoryStore;
  /** Orla V1 — pares de bordas partilhadas (Orla Junto). */
  orlaJuntoPairs: import("../core/orla/orlaTypes").OrlaJuntoPair[];
  /** Orla V1 — ferragem calculada (metros, custo). */
  ferragemOrla: import("../core/orla/orlaTypes").ProjectFerragemOrla;

  /** Remate 2.0 — peças independentes manipuláveis. */
  remates: RematePiece[];
  /** Grupos de objetos do viewer (multi-seleção persistente). */
  objectGroups: import("../core/viewer/groupTypes").ObjectGroupsState;
  /** Remate visual (legado hematis[]) — acabamento superior/lateral; apenas visual. */
  hematis: ProjectHemati[];
  /** Roda pé inteligente — acabamento inferior (cozinhas; apenas visual). */
  rodapes: ProjectRodape[];

  /** Auto-Room-Fill — última execução e IDs criados (apenas visual). */
  autoFill?: import("../core/autoRoomFill/autoRoomFillTypes").ProjectAutoFillState | null;

  /** Perfis de regras: lista de perfis + perfil ativo. */
  rulesProfiles: RulesProfilesConfig;
  /** Regras dinâmicas ativas (= perfil ativo); usadas em todo o projeto. */
  rules: RulesConfig;
  /** ID do perfil de regras associado ao projeto (opcional; futuro project-level profile). */
  rulesProfileId?: string;

  estaCarregando: boolean;
  erro: string | null;
  changelog: ChangelogEntry[];
}

export type SavedProjectInfo = {
  id: string;
  name: string;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerName: string;
  thumbnailDataUrl: string | null;
  /** Verdadeiro quando o snapshot do projeto estava inválido/nulo no storage. */
  corrupted?: boolean;
};

export type ViewerSnapshot = {
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    zoom: number;
    type: "perspective" | "orthographic" | "unknown";
  };
  objects: {
    id: string;
    name?: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  }[];
  materials: {
    id: string;
    name?: string;
    preset: string;
    color?: string;
    roughness?: number;
    metalness?: number;
    envMapIntensity?: number;
    opacity?: number;
    transparent?: boolean;
  }[];
  scene: {
    hasFloor: boolean;
    hasGrid: boolean;
    environment: boolean;
    lights: {
      id: string;
      type: string;
      position: [number, number, number];
      intensity: number;
      color?: string;
    }[];
  };
};

export type ViewerRenderSize = "small" | "medium" | "large" | "4k" | "viewport";

export type ViewerRenderBackground = "white" | "transparent" | "hdri" | "project-transparent";

export type ViewerRenderMode = "pbr" | "lines";

export type ViewerCameraPreset = "current" | "front" | "top" | "iso1" | "iso2";

export type ViewerRenderFormat = "png" | "jpg";

export type ViewerRenderOptions = {
  size: ViewerRenderSize;
  background: ViewerRenderBackground;
  mode: ViewerRenderMode;
  preset?: ViewerCameraPreset;
  watermark?: boolean;
  shadowIntensity?: number;
  format?: ViewerRenderFormat;
  quality?: number;
  advancedRealism?: boolean;
  /** Exportação em wireframe (desenho de linhas); ignora `mode` e usa `lineDrawingBackground`. */
  lineDrawingExport?: boolean;
  lineDrawingBackground?: "white" | "transparent";
};

export type ViewerRenderResult = {
  dataUrl: string;
  width: number;
  height: number;
};

export type ViewerToolMode = "select" | "move" | "rotate" | "scale";

export type RoomConfig = {
  numWalls: 3 | 4;
  walls: Array<{
    id: string;
    position: { x: number; y?: number; z: number };
    rotation: number;
    widthMm?: number;
    lengthMm: number;
    heightMm: number;
    thicknessMm: number;
    color?: string;
    openings: Array<{
      id: string;
      type: "door" | "window";
      kind?: "normal" | "correr";
      widthMm: number;
      heightMm: number;
      thicknessMm?: number;
      floorOffsetMm: number;
      horizontalOffsetMm: number;
      modelId?: string;
    }>;
  }>;
  selectedWallId?: string | null;
};

export type DoorWindowConfig = {
  widthMm: number;
  heightMm: number;
  floorOffsetMm: number;
  horizontalOffsetMm: number;
};

export type ViewerApi = {
  saveSnapshot: () => ViewerSnapshot | null;
  restoreSnapshot: (_snapshot: ViewerSnapshot | null) => void;
  renderScene: (_options: ViewerRenderOptions) => Promise<ViewerRenderResult | null>;
  /** Define a ferramenta ativa no Viewer (select = sem gizmo, move = translate, rotate = rotate). */
  setTool: (_mode: ViewerToolMode) => void;
  setUltraPerformanceMode: (_active: boolean) => void;
  setGlobalLightIntensity?: (_value: number) => void;
  getUltraPerformanceMode: () => boolean;
  createRoom: (_config: RoomConfig) => void;
  removeRoom: () => void;
  selectWallByIndex: (_index: number | null) => void;
  selectRoomElementById: (_elementId: string | null) => void;
  setPlacementMode: (_mode: "door" | "window" | null) => void;
  addDoorToRoom: (_wallId: number, _config: DoorWindowConfig, _elementId?: string) => string;
  addWindowToRoom: (_wallId: number, _config: DoorWindowConfig, _elementId?: string) => string;
  setOnRoomElementPlaced: (
    _cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ) => void;
  setOnRoomElementSelected: (
    _cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ) => void;
  updateRoomElementConfig: (_elementId: string, _config: DoorWindowConfig) => boolean;
  setLockEnabled: (_enabled: boolean) => void;
  getLockEnabled: () => boolean;
  getCombinedBoundingBox: () => { width: number; height: number; depth: number } | null;
  getSelectedBoxDimensions: () => { width: number; height: number; depth: number } | null;
  /** Subscreve alterações da caixa selecionada (seleção ou updateBox na caixa selecionada). Retorna função para cancelar. */
  subscribeSelectedBoxChange?: (_callback: (_id: string | null) => void) => () => void;
  setDimensionsOverlayVisible: (_visible: boolean) => void;
  getDimensionsOverlayVisible: () => boolean;
  toggleDimensionsOverlay: () => boolean;
  getDimensionsOverlayData?: () => import("../3d/viewer-engine/overlays/boxDimensionsOverlay").DimensionOverlayDataEntry[];
  getPrintReadyDimensions?: () => import("../3d/viewer-engine/overlays/boxDimensionsLayout").PrintReadyDimensions;
  getSelectedObjects: (
    _multiBoxIds?: string[]
  ) => Array<{ kind: "box" | "remate" | "rodape"; id: string }>;
  align: (
    _type: "right" | "left" | "front" | "back" | "top" | "bottom",
    _multiBoxIds?: string[]
  ) => boolean;
  /** Posição em pixels (relativa ao container) do topo da caixa selecionada, para overlay de texto. */
  getSelectedBoxScreenPosition: () => { x: number; y: number } | null;
  /** Maior X (borda direita) das caixas no viewer, em metros. Usado para posicionar nova caixa ao lado. */
  getRightmostX: () => number;
  /** Ativa/desativa highlight por mesh (hover + seleção). */
  setHighlightEnabled?: (_enabled: boolean) => void;
  /** Ativa/desativa vista explodida. */
  setExplodedViewEnabled?: (_enabled: boolean) => void;
  /** Intensidade da vista explodida (0–1). */
  setExplodedViewIntensity?: (_value: number) => void;
};

/** Snapshot da sala (paredes + seleção) para persistir com o projeto. */
export type RoomSnapshot = {
  walls: Array<{
    id: string;
    lengthCm: number;
    heightCm: number;
    thicknessCm: number;
    color: string;
    position?: { x: number; y?: number; z: number };
    rotation?: number;
    openings: Array<{
      id: string;
      type: "door" | "window";
      kind?: "normal" | "correr";
      widthMm: number;
      heightMm: number;
      thicknessMm?: number;
      floorOffsetMm: number;
      horizontalOffsetMm: number;
      modelId?: string;
    }>;
  }>;
  selectedWallId: string | null;
  /** Índice da parede principal (0..3). */
  mainWallIndex?: number;
};

export type ProjectSnapshot = {
  projectState: unknown;
  viewerSnapshot: ViewerSnapshot | null;
  /** Estado da sala (paredes e aberturas) para carregar com o projeto. */
  roomSnapshot?: RoomSnapshot | null;
};

export type ViewerSync = {
  notifyChangeSignal: unknown;
  saveViewerSnapshot: () => ViewerSnapshot | null;
  restoreViewerSnapshot: (_snapshot: ViewerSnapshot | null) => void;
  registerViewerApi: (_api: ViewerApi | null) => void;
  renderScene: (_options: ViewerRenderOptions) => Promise<ViewerRenderResult | null>;
  /** Define a ferramenta 3D ativa (select, move, rotate); aplica à caixa selecionada. */
  setActiveTool: (_mode: ViewerToolMode) => void;
  setUltraPerformanceMode: (_active: boolean) => void;
  getUltraPerformanceMode: () => boolean;
  createRoom: (_config: RoomConfig) => void;
  removeRoom: () => void;
  setPlacementMode: (_mode: "door" | "window" | null) => void;
  addDoorToRoom: (_wallId: number, _config: DoorWindowConfig, _elementId?: string) => string;
  addWindowToRoom: (_wallId: number, _config: DoorWindowConfig, _elementId?: string) => string;
  setOnRoomElementPlaced: (
    _cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ) => void;
  setOnRoomElementSelected: (
    _cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ) => void;
  updateRoomElementConfig: (_elementId: string, _config: DoorWindowConfig) => boolean;
  setLockEnabled: (_enabled: boolean) => void;
  getLockEnabled: () => boolean;
  getCombinedBoundingBox: () => { width: number; height: number; depth: number } | null;
  getSelectedBoxDimensions: () => { width: number; height: number; depth: number } | null;
  subscribeSelectedBoxChange?: (_callback: (_id: string | null) => void) => () => void;
  setDimensionsOverlayVisible: (_visible: boolean) => void;
  getDimensionsOverlayVisible: () => boolean;
  toggleDimensionsOverlay: () => boolean;
  getPrintReadyDimensions?: () => import("../3d/viewer-engine/overlays/boxDimensionsLayout").PrintReadyDimensions;
  getSelectedObjects: (
    _multiBoxIds?: string[]
  ) => Array<{ kind: "box" | "remate" | "rodape"; id: string }>;
  align: (
    _type: "right" | "left" | "front" | "back" | "top" | "bottom",
    _multiBoxIds?: string[]
  ) => boolean;
  getSelectedBoxScreenPosition: () => { x: number; y: number } | null;
  getRightmostX: () => number;
};

export interface ProjectActions {
  setProjectName: (_name: string) => void;
  setProjectDesigner: (_designer: string) => void;
  setEmpresaExecutora: (_empresa: string) => void;
  setMateriaisProjeto: (_materiais: string) => void;
  setTipoProjeto: (_tipo: string) => void;
  setMaterial: (_material: Material) => void;
  /** @deprecated LEGADO — Sem implementação em runtime. Usar setMaterial para Material completo. */
  setProjectMaterial: (_materialId: string) => void;
  setEspessura: (_espessura: number) => void;
  setDimensoes: (_dimensoes: Partial<Dimensoes>) => void;
  /** @deprecated LEGADO — Sem implementação em runtime. Candidato a remoção futura. */
  setQuantidade: (_quantidade: number) => void;
  /** Atualiza apenas o flag de pronto para fabricação/orçamento. */
  setReadyForProduction: (_ready: boolean) => void;
  addBox: () => void;
  addWorkspaceBox: () => void;
  addWorkspaceBoxFromCatalog: (_catalogItemId: string) => void;
  addWorkspaceBoxFromMoveis: (_moveisId: string) => void;
  duplicateBox: () => void;
  duplicateWorkspaceBox: () => void;
  /** Duplica a peça selecionada e coloca com offset em X (mm). Usado pelo menu de contexto. */
  duplicateWorkspaceBoxAtOffset: (_offsetXMm?: number) => void;
  /** Aplica plano batch do Auto-Layout (clones, movimentos, prateleiras). */
  applyAutoLayoutPlan: (
    _plan: import("../3d/viewer-engine/autoLayout/autoLayoutTypes").AutoLayoutPlan
  ) => void;
  removeBox: () => void;
  removeWorkspaceBox: () => void;
  removeWorkspaceBoxById: (_boxId: string) => void;
  selectBox: (_boxId: string) => void;
  clearSelection: () => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  addModelToBox: (_caixaId: string, _cadModelId: string) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  addCadModelAsNewBox: (_cadModelId: string) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  removeModelFromBox: (_caixaId: string, _modelInstanceId: string) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  updateModelInBox: (_caixaId: string, _modelInstanceId: string, _updates: { nome?: string; material?: string; categoria?: string }) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  updateCaixaModelId: (_caixaId: string, _modelId: string | null) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  selectModelInstance: (_boxId: string, _modelInstanceId: string | null) => void;
  renameBox: (_nome: string) => void;
  setPrateleiras: (_quantidade: number) => void;
  setGavetas: (_quantidade: number) => void;
  /** Legacy stub — ignora config europeia; aplica só contagem clássica. */
  setEuropeanDrawerConfig?: (
    _config: Record<string, unknown>,
    _count: number
  ) => void;
  setDrawerHeightMode: (_mode: import("../core/drawers/drawerHeightModeTypes").DrawerHeightMode) => void;
  setPortaTipo: (_portaTipo: BoxModule["portaTipo"]) => void;
  setTipoBorda: (_tipoBorda: TipoBorda) => void;
  setTipoFundo: (_tipoFundo: TipoFundo) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  setExtractedPartsForBox: (_boxId: string, _modelInstanceId: string, _parts: CutListItemComPreco[]) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  clearExtractedPartsForBox: (_boxId: string, _modelInstanceId?: string) => void;
  /** @deprecated LEGADO — Sistema CAD removido. Sem implementação em runtime. Candidato a remoção futura. */
  setModelPositionInBox: (_boxId: string, _modelInstanceId: string, _position: { x: number; y: number; z: number }) => void;
  setLayoutWarnings: (_warnings: LayoutWarnings) => void;
  /** Altera o material simples da porta (Material Picker: Madeira, Branco, etc.). */
  setDoorMaterial: (_boxId: string, _doorLayerId: string, _material: string) => void;
  setDoorAllowPieceRotation: (_boxId: string, _doorLayerId: string, _allow: boolean) => void;
  setDoorLockWoodGrain: (_boxId: string, _doorLayerId: string, _lock: boolean) => void;
  /** Altera o material simples da gaveta (Material Picker: Madeira, Branco, etc.). */
  setDrawerMaterial: (_boxId: string, _drawerLayerId: string, _material: string) => void;
  setDrawerAllowPieceRotation: (_boxId: string, _drawerLayerId: string, _allow: boolean) => void;
  setDrawerLockWoodGrain: (_boxId: string, _drawerLayerId: string, _lock: boolean) => void;
  /** Atualiza posição X da caixa no workspace (mm). Fonte única para atualização de posição. */
  updateWorkspacePosition: (_boxId: string, _posicaoX_mm: number) => void;
  /** Atualiza posição/rotação/manual da caixa no viewer (manipulação visual; não altera cut list). */
  updateWorkspaceBoxTransform: (
    _boxId: string,
    _partial: {
      x_mm?: number;
      y_mm?: number;
      z_mm?: number;
      rotacaoX_rad?: number;
      rotacaoY_rad?: number;
      rotacaoZ_rad?: number;
      manualPosition?: boolean;
      autoRotateEnabled?: boolean;
      feetEnabled?: boolean;
      feetHeight?: number;
      feetOffsetFront?: number;
    }
  ) => void;
  /** Move caixas que estão fora da sala persistida para dentro (empilhamento a partir do canto). */
  repositionWorkspaceBoxesInsideRoom: () => void;
  /** Atualiza dimensões da caixa a partir do bbox do GLB (caixas CAD-only). */
  setWorkspaceBoxDimensoes: (_boxId: string, _dimensoes: { largura: number; altura: number; profundidade: number }) => void;
  /** Atualiza o nome da caixa (ex.: nome do modelo CAD). */
  setWorkspaceBoxNome: (_boxId: string, _nome: string) => void;
  /** Define o material da caixa (id do CRUD ou label legado). */
  setWorkspaceBoxMaterial: (_boxId: string, _materialId: string) => void;
  /** Override nesting: true = permite rodar peça com material de madeira. */
  setWorkspaceBoxAllowPieceRotation: (_boxId: string, _allow: boolean) => void;
  setWorkspaceBoxLockWoodGrain: (_boxId: string, _lock: boolean) => void;
  /** Bloqueia ou desbloqueia a peça (impede movimento e transformações quando locked). */
  setWorkspaceBoxLocked: (_boxId: string, _locked: boolean) => void;
  /** PI: ocultar só furos de corrediça nas laterais (cutlist + viewer). */
  setWorkspaceBoxPiHideDrawerHoles: (_boxId: string, _hide: boolean) => void;
  /** Material e espessura explícitos da COSTA; omitir valores restaura o padrão (família + 10 mm). */
  setWorkspaceBoxCostaMaterial: (
    _boxId: string,
    _costaMaterialId?: string,
    _costaThicknessMm?: number
  ) => void;
  /** Material explícito dos separadores horizontais; omitir restaura o material do corpo. */
  setWorkspaceBoxSeparadorMaterial: (_boxId: string, _separadorMaterialId?: string) => void;
  setWorkspaceBoxFrenteFixaMaterial: (_boxId: string, _frenteFixaMaterialId?: string) => void;
  /** Activa/desactiva costa traseira (visual + industrial). */
  setWorkspaceBoxNoBackPanel: (_boxId: string, _enabled: boolean) => void;
  /** Canto v2: orientação dinâmica (direita/esquerda) — FF, porta, furos e viewer. */
  setCornerOrientation: (
    _boxId: string,
    _orientation: import("../core/cornerCabinet/cornerCabinetRules").CornerOrientation
  ) => void;
  /** Alinha a frente do box (eixo Z) com a frente do box vizinho mais próximo no eixo X. */
  alignFrontWithNeighbor: (_boxId: string) => void;
  /** Alinha a base da caixa selecionada à base da vizinha mais próxima no plano XZ (só Y); sem outras caixas, chão em Y=0. */
  alignBottomSelectedBoxes: (_boxIds: string[]) => void;
  addInternalMeasurement: (_entry: InternalMeasurementEntry) => void;
  removeInternalMeasurement: (_id: string) => void;
  toggleInternalMeasurementVisibility: (_id: string) => void;
  showAllInternalMeasurements: (_boxId?: string) => void;
  hideAllInternalMeasurements: (_boxId?: string) => void;
  clearInternalMeasurements: (_boxId?: string) => void;
  addUnifiedMeasurement: (_entry: UnifiedMeasurement) => void;
  removeUnifiedMeasurement: (_id: string) => void;
  toggleUnifiedMeasurementVisibility: (_id: string) => void;
  showAllUnifiedMeasurements: () => void;
  hideAllUnifiedMeasurements: () => void;
  clearUnifiedMeasurements: () => void;
  addDoorLayerItem: () => void;
  addDrawerLayerItem: () => void;
  removeDoorLayerItem: (_id: string) => void;
  removeDrawerLayerItem: (_id: string) => void;
  updateDoorLayerItem: (
    _id: string,
    _partial: Partial<DoorLayerItem> & { applyVerticalAdjustMm?: number }
  ) => void;
  updateDrawerLayerItem: (_id: string, _partial: Partial<DrawerLayerItem>) => void;
  /**
   * Aplica ferragens a todas as gavetas do box seleccionado (origem `global`).
   * Sobrescreve prioridade individual — o utilizador re-aplica o global de propósito.
   */
  applyDrawerHardwareGlobal: (
    _boxId: string,
    _draft: import("../core/drawers/drawerHardware").DrawerHardwareDraft
  ) => void;
  setDoorLayerItemOpen: (_id: string, _isOpen: boolean) => void;
  setDrawerLayerItemOpen: (
    _id: string,
    _isOpen: boolean,
    _options?: { allowMultipleOpen?: boolean }
  ) => void;
  setDoorLayerItemMaterial: (_id: string, _materialId: string) => void;
  setDrawerLayerItemMaterial: (_id: string, _materialId: string) => void;
  setDoorLayerItemDirection: (_id: string, _direction: Exclude<LayerOpenDirection, "pull">) => void;
  regenerateBoxLayersForSelectedBox: () => void;
  /** Divisórios verticais (DIV) e separadores horizontais (SEP). */
  addSeparador: () => void;
  addDivisor: () => void;
  removeSeparador: (_id: string) => void;
  removeDivisor: (_id: string) => void;
  updateSeparador: (_id: string, _partial: Partial<import("../core/divSep/types").SeparadorItem>) => void;
  updateDivisor: (_id: string, _partial: Partial<import("../core/divSep/types").DivisorItem>) => void;
  toggleWorkspaceRotation: (_boxId: string) => void;
  rotateWorkspaceBox: (_boxId: string) => void;
  /** @internal Implementada em useDesignActions. Não chamada diretamente pela UI via actions.*. */
  gerarDesign: () => void;
  gerarESalvarDesign: () => Promise<void>;
  /**
   * @stable
   * Gera o PDF simples do projeto.
   *
   * Características:
   * - Não inclui PDF técnico
   * - Não inclui cutlist
   * - Não inclui detalhes de furação ou medidas técnicas
   * - Mantém o layout atual do PDF simples
   *
   * Uso:
   * - Botão principal de exportação na UI
   * - Entrega rápida para cliente
   * - Visualização geral do projeto sem detalhes de fabricação
   *
   * Importante:
   * - Não alterar comportamento sem decisão explícita de produto
   * - Não unificar automaticamente com PDF técnico
   */
  exportarPDF: () => void;
  /**
   * @stable
   * Gera o PDF técnico do projeto.
   *
   * Características:
   * - Inclui medidas técnicas
   * - Inclui detalhes de furação
   * - Inclui informações de fabricação
   * - Pode incluir vistas técnicas específicas
   *
   * Uso:
   * - Produção e fabricação
   * - Documentação técnica detalhada
   * - Profissionais que precisam de medidas exatas
   *
   * Importante:
   * - Não alterar comportamento sem decisão explícita de produto
   * - Não misturar com PDF simples automaticamente
   */
  exportarPdfTecnico: () => void;
  /**
   * @stable
   * Gera um PDF unificado contendo:
   * - PDF técnico
   * - Cutlist completa
   * - Informações combinadas num único ficheiro
   *
   * Características:
   * - Documento completo para produção
   * - Evita múltiplos ficheiros separados
   * - Mantém a ordem e estrutura atual
   *
   * Uso:
   * - Produção final
   * - Entrega completa para fábrica
   * - Clientes que desejam documentação técnica + lista de corte
   *
   * Importante:
   * - Não alterar comportamento sem decisão explícita de produto
   * - Não dividir novamente em múltiplos PDFs
   */
  exportarPdfUnificado: () => void;
  logChangelog: (_message: string) => void;
  /** Substitui a configuração Room 2.0 (null = sem sala). */
  setProjectRoom: (_room: import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomConfig | null) => void;
  /** Atualiza parcialmente project.room e sincroniza wallStore/viewer. */
  updateProjectRoom: (_patch: Partial<import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomConfig>) => void;
  /** Cria sala padrão Room 2.0 (4000×2500×2600 mm). */
  createDefaultProjectRoom: () => void;
  /** Remove sala do projeto. */
  removeProjectRoom: () => void;
  /** Orla V1 — aplica preset de orla a todas as peças do caixote. */
  setBoxOrlaPreset: (_boxId: string, _presetId: string | null) => void;
  /** Orla V1 — configura um lado da orla numa peça. */
  setPieceOrlaSide: (
    _pieceId: string,
    _side: import("../core/orla/orlaTypes").OrlaSideId,
    _patch: Partial<{ presetId: string | null; enabled: boolean }>
  ) => void;
  /** Orla V1 — define peças adjacentes com Orla Junto. */
  setPieceOrlaJunto: (_pieceId: string, _partnerIds: string[]) => void;
  /** Orla V1 — cria ou atualiza preset de orla. */
  upsertOrlaPreset: (_preset: import("../core/orla/orlaTypes").OrlaPreset) => void;
  /** Orla V1 — remove preset de orla (se não estiver em uso). */
  removeOrlaPreset: (_presetId: string) => void;
  /** Observações — adiciona/remove observação da caixa. */
  addBoxObservacao: (_boxId: string, _text: string) => void;
  removeBoxObservacao: (_boxId: string, _index: number) => void;
  /** Observações — adiciona/remove observação de peça (panelId / id industrial). */
  addPieceObservacao: (_pieceId: string, _text: string) => void;
  removePieceObservacao: (_pieceId: string, _index: number) => void;
  /** Industrial — atualizar medidas de peça (COMP/LARG/ESP). */
  updateIndustrialPieceDimensions: (
    _pieceId: string,
    _dims: { largura?: number; altura?: number; espessura?: number }
  ) => void;
  /** Industrial — mover peça para outra caixa. */
  moveIndustrialPiece: (_pieceId: string, _targetBoxId: string) => void;
  /** Industrial — apagar peça do fluxo industrial. */
  deleteIndustrialPiece: (_pieceId: string) => void;
  /** Industrial — marcar operação como concluída. */
  completeIndustrialOperacao: (
    _operationId: import("../core/industrial/industrialPieceEditsTypes").IndustrialOperationId,
    _notas?: string
  ) => void;
  /** P3.5 — grava overrides do painel financeiro unificado. */
  setFinanceiroOverrides: (
    _overrides: import("../core/financeiro/financeiroUnificadoTypes").FinanceiroOverrides
  ) => void;
  /** P3.6 — grava regras ADMIN (ADM / montagem / portes) do projeto. */
  setFinanceiroAdminSettings: (
    _settings: import("../core/financeiro/financeiroAdminRules").FinanceiroAdminSettings
  ) => void;
  /** Análise online — substituir overrides de um documento. */
  setDocumentOverrides: (
    _docId: import("../core/industrial/onlineAnalysis/industrialOnlineAnalysisDocs").IndustrialOnlineAnalysisDocId,
    _override: import("../core/industrial/onlineAnalysis/industrialDocumentOverridesTypes").IndustrialDocumentOverride
  ) => void;
  /** Análise online — patch de campos de uma linha. */
  patchDocumentRow: (
    _docId: import("../core/industrial/onlineAnalysis/industrialOnlineAnalysisDocs").IndustrialOnlineAnalysisDocId,
    _rowId: string,
    _fields: Record<string, string>
  ) => void;
  /** Análise online — adicionar linha. */
  addDocumentRow: (
    _docId: import("../core/industrial/onlineAnalysis/industrialOnlineAnalysisDocs").IndustrialOnlineAnalysisDocId,
    _sectionId: string,
    _fields: Record<string, string>
  ) => void;
  /** Análise online — remover linha. */
  deleteDocumentRow: (
    _docId: import("../core/industrial/onlineAnalysis/industrialOnlineAnalysisDocs").IndustrialOnlineAnalysisDocId,
    _rowId: string
  ) => void;
  /** Gavetas — cria ou atualiza preset de gavetas no projecto. */
  upsertDrawerPreset: (_preset: import("../core/drawers/drawerPresetTypes").DrawerPreset) => void;
  /** Gavetas — remove preset de gavetas do catálogo. */
  removeDrawerPreset: (_presetId: string) => void;
  /** Gavetas — guarda configuração actual do caixote como preset. */
  saveDrawerPresetFromBox: (_boxId: string, _nome: string) => void;
  /** Gavetas — aplica preset ao caixote (regenera camadas por índice). */
  applyDrawerPresetToBox: (_boxId: string, _presetId: string) => void;
  /** Remate 2.0 — cria peça independente (box ou standalone). */
  createRematePiece: (_input: CreateRematePieceInput) => void;
  /** Remate 2.0 — cria peça standalone a partir do catálogo MÓVEIS. */
  createStandaloneRematePiece: (_input: CreateRematePieceInput) => void;
  /** @deprecated alias — auto-room-fill e legado */
  createBoxRemate: (_input: CreateRemateInput) => void;
  /** Remate 2.0 — atualiza dimensões/material/posição de um remate. */
  updateRemate: (_remateId: string, _patch: UpdateRematePieceInput) => void;
  /** Remate 2.0 — remove remate do projeto. */
  removeRemate: (_remateId: string) => void;
  /** Remate 2.0 — reencosta remate (ou grupo) à face do módulo. */
  resnapRemateToFace: (_remateId: string) => void;
  /** Remate 2.0 — força SNAPPED em todos os remates do mesmo parentBoxId e mountSlot. */
  resetRemateSnap: (_remateId: string, _slot: import("../core/remate/rematePieceTypes").RemateMountSlot) => void;
  /** Remate 2.0 — duplica peça com offset lateral (mm). Devolve id da nova peça. */
  duplicateRemate: (_remateId: string) => string | null;
  /** Remate 2.0 — cria peça no slot oposto (ESQ↔DIR, CIMA↔FUNDO, FRENTE↔TRAS). */
  createOppositeRemate: (_remateId: string) => string | null;
  /** Remate 2.0 — seleção UI (noop no estado persistido). */
  selectRematePiece: (_remateId: string | null) => void;
  /** Remate visual (legado) — cria peça(s) no módulo. */
  createBoxHemati: (_input: CreateHematiInput) => void;
  updateHemati: (_hematiId: string, _patch: UpdateHematiInput) => void;
  removeHemati: (_hematiId: string) => void;
  setHematiVisible: (_hematiId: string, _visible: boolean) => void;
  /** Roda pé — cria peça(s) no módulo. */
  createBoxRodape: (_input: CreateRodapeInput) => void;
  updateRodape: (_rodapeId: string, _patch: UpdateRodapeInput) => void;
  /** Roda pé — actualiza comprimento/altura sincronizando heightMm e dimensions. */
  updateRodapeDimensions: (
    _rodapeId: string,
    _dims: { widthMm?: number; heightMm?: number }
  ) => void;
  removeRodape: (_rodapeId: string) => void;
  setRodapeVisible: (_rodapeId: string, _visible: boolean) => void;
  /** Auto-Room-Fill — preenche cozinha na sala atual (apenas visual). */
  runAutoRoomFill: () => void;
  /** Auto-Room-Fill — preferências de paredes / superiores / layout 3.0. */
  setAutoFillWallSettings: (_patch: {
    wallSelection?: Partial<
      import("../core/autoRoomFill/autoRoomFillTypes").AutoFillWallSelection
    >;
    allowUpperModules?: Partial<
      import("../core/autoRoomFill/autoRoomFillTypes").AutoFillAllowUpperByWall
    >;
    layoutTypeOverride?: import("../core/autoRoomFill/autoRoomFillTypes").KitchenLayoutTypeOverride;
  }) => void;
  /** Layout Generator 3.0 — I / L / U / Ilha (Auto-Room-Fill integrado). */
  runKitchenLayout30: () => void;
  /** Escala objetos selecionados (IDs codificados) segundo modo additive/ratio. */
  scaleSelectedObjects: (
    _selectedObjectIds: string[],
    _newMaxLength: number,
    _mode: ScalingMode
  ) => void;
  /** Duplica objetos selecionados preservando materiais. */
  duplicateSelectedObjects: (_selectedObjectIds: string[]) => void;
  /** Remove objetos selecionados. */
  deleteSelectedObjects: (_selectedObjectIds: string[]) => void;
  /** Roda caixas selecionadas 90°. */
  rotateSelectedObjects: (_selectedObjectIds: string[]) => void;
  /** Aplica material a todos os objetos selecionados (preserva geometria). */
  setSelectedObjectsMaterial: (_selectedObjectIds: string[], _materialId: string) => void;
  /** Cria grupo a partir de IDs codificados selecionados. */
  createObjectGroup: (_memberIds: string[], _name?: string) => string | null;
  /** Remove grupo (mantém membros). */
  ungroupObject: (_groupId: string) => void;
  /** Adiciona âncora de medição no espaço 3D (metros). */
  addMeasurementAnchor: (_position: { x: number; y: number; z: number }, _label?: string) => void;
  /** Remove âncora de medição. */
  removeMeasurementAnchor: (_anchorId: string) => void;
  /** Define a ferramenta 3D ativa (select, move, rotate, scale) e aplica ao viewerApiAdapter. */
  setActiveTool: (_mode: ViewerToolMode) => void;
  /** Atualiza parcialmente as configurações do viewer (teto, arestas, painéis, mouse, edição de parede). */
  setViewerSettings: (_partial: Partial<ViewerSettings>) => void;
  /** Alterna highlight 3D (hover/click em elementos). */
  toggleHighlight: () => void;
  /** Alterna modo régua (medição). */
  toggleRuler: () => void;
  toggleInternalRuler: () => void;
  /** @internal Implementada em useRulesActions. UI usa updateRulesInProfile — não actions.updateRules. */
  updateRules: (_rules: RulesConfig) => void;
  /** Define o perfil de regras ativo; recalcula todas as caixas. */
  setActiveRulesProfile: (_id: string) => void;
  /** Atualiza as regras de um perfil; se for o ativo, recalcula caixas. */
  updateRulesInProfile: (_profileId: string, _rules: RulesConfig) => void;
  /** Adiciona um novo perfil de regras. */
  addRulesProfile: (_profile: { nome: string; descricao?: string; rules?: RulesConfig }) => void;
  /** Remove um perfil de regras (exceto o padrão). */
  removeRulesProfile: (_id: string) => void;
  /** Substitui toda a configuração de perfis (ex.: após reset). */
  setRulesProfilesConfig: (_config: RulesProfilesConfig) => void;
  /** @internal Implementada em useRulesActions. Perfil por projeto; não ativado na UI ainda. */
  setProjectRulesProfile: (_id: string) => void;
  /** @internal Implementada em useDesignActions. Não chamada diretamente pela UI via actions.*. */
  recalculateAllBoxes: () => void;
  undo: () => void;
  redo: () => void;
  /** Navega para um estado específico da timeline de histórico. */
  goToHistory: (_index: number) => void;
  /** @internal Implementada em useProjectIoActions. Chamada via mecanismo interno (não via actions.* na UI). */
  saveProjectSnapshot: () => void;
  /** @internal Implementada em useProjectIoActions. Backup manual; não exposto na UI atual. */
  saveManualBackupSnapshot: () => void;
  loadProjectSnapshot: (_id: string) => Promise<void>;
  /** Carrega ProjectState importado de ficheiro (sem migrações REMATE/RODA PÉ nem buildDesignState). */
  loadImportedPimoProject: (_snapshot: ProjectSnapshot, _projectNameSlug: string) => Promise<void>;
  /** Combina vários snapshots guardados num único estado de workspace (opcional; não altera os projetos guardados). */
  mergeSnapshots: (_ids: string[]) => Promise<void>;
  /** @deprecated LEGADO — Templates não implementados. Sem implementação em runtime. Candidato a remoção futura. */
  loadProjectFromTemplate: (_templateId: string) => void;
  /** Adiciona um template como novas caixas no workspace (não substitui o projeto). */
  addTemplateAsNewBox: (_templateId: string) => void;
  listSavedProjects: (_scope?: "mine" | "all") => Promise<SavedProjectInfo[]>;
  createNewProject: () => Promise<SavedProjectInfo | null>;
  renameProject: (_id: string, _name: string) => Promise<void>;
  deleteProject: (_id: string) => Promise<void>;
  /**
   * Workspace Pipro v2 — substitui o ProjectState em memória (sem gravar projecto remoto).
   * Usado só pelo shell de design de modelos.
   */
  applyDesignWorkspaceState: (_state: ProjectState, _opts?: { pushUndo?: boolean }) => void;
}

export type ProjectHistoryEntry = {
  id: string;
  actionName: string;
  timestamp: string | null;
  actionType: "move" | "resize" | "add" | "remove" | "height" | "other";
};

export type ProjectHistoryController = {
  entries: ProjectHistoryEntry[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  goTo: (_index: number) => void;
};

export interface ProjectContextProps {
  project: ProjectState;
  actions: ProjectActions;
  viewerSync: ViewerSync;
  history: ProjectHistoryController;
}
