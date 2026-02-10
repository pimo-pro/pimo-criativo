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
import type { RuleViolation } from "../core/rules/types";
import type { LayoutWarnings } from "../core/layout/layoutWarnings";
import type { RulesConfig } from "../core/rules/rulesConfig";
import type { RulesProfilesConfig } from "../core/rules/rulesProfiles";

export interface ProjectState {
  projectName: string;
  tipoProjeto: string;
  material: Material;
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

  /** Ferramenta 3D ativa no Viewer: select, move, rotate. Opcional para compatibilidade com snapshots antigos. */
  activeViewerTool?: "select" | "move" | "rotate";

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
  createdAt: string;
  updatedAt: string;
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

export type Viewer2DAngle = "top" | "front" | "left" | "right";

export type ViewerRenderSize = "small" | "medium" | "large" | "4k";

export type ViewerRenderBackground = "white" | "transparent";

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
};

export type ViewerRenderResult = {
  dataUrl: string;
  width: number;
  height: number;
};

export type ViewerToolMode = "select" | "move" | "rotate";

export type RoomConfig = {
  numWalls: 3 | 4;
  walls: Array<{
    id: string;
    position: { x: number; z: number };
    rotation: number;
    lengthMm: number;
    heightMm: number;
    thicknessMm: number;
    color?: string;
    openings: Array<{
      id: string;
      type: "door" | "window";
      widthMm: number;
      heightMm: number;
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
  enable2DView: (_angle: Viewer2DAngle) => void;
  disable2DView: () => void;
  renderScene: (_options: ViewerRenderOptions) => Promise<ViewerRenderResult | null>;
  /** Define a ferramenta ativa no Viewer (select = sem gizmo, move = translate, rotate = rotate). */
  setTool: (_mode: ViewerToolMode) => void;
  setUltraPerformanceMode: (_active: boolean) => void;
  getUltraPerformanceMode: () => boolean;
  createRoom: (_config: RoomConfig) => void;
  removeRoom: () => void;
  selectWallByIndex: (_index: number | null) => void;
  selectRoomElementById: (_elementId: string | null) => void;
  setPlacementMode: (_mode: "door" | "window" | null) => void;
  addDoorToRoom: (_wallId: number, _config: DoorWindowConfig) => string;
  addWindowToRoom: (_wallId: number, _config: DoorWindowConfig) => string;
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
  setDimensionsOverlayVisible: (_visible: boolean) => void;
  getDimensionsOverlayVisible: () => boolean;
  /** Maior X (borda direita) das caixas no viewer, em metros. Usado para posicionar nova caixa ao lado. */
  getRightmostX: () => number;
};

/** Snapshot da sala (paredes + seleção) para persistir com o projeto. */
export type RoomSnapshot = {
  walls: Array<{
    id: string;
    lengthCm: number;
    heightCm: number;
    thicknessCm: number;
    color: string;
    position?: { x: number; z: number };
    rotation?: number;
    openings: Array<{
      id: string;
      type: "door" | "window";
      widthMm: number;
      heightMm: number;
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
  applyStateToViewer: () => void;
  extractStateFromViewer: () => void;
  saveViewerSnapshot: () => ViewerSnapshot | null;
  restoreViewerSnapshot: (_snapshot: ViewerSnapshot | null) => void;
  registerViewerApi: (_api: ViewerApi | null) => void;
  enable2DView: (_angle: Viewer2DAngle) => void;
  disable2DView: () => void;
  renderScene: (_options: ViewerRenderOptions) => Promise<ViewerRenderResult | null>;
  /** Define a ferramenta 3D ativa (select, move, rotate); aplica à caixa selecionada. */
  setActiveTool: (_mode: ViewerToolMode) => void;
  setUltraPerformanceMode: (_active: boolean) => void;
  getUltraPerformanceMode: () => boolean;
  createRoom: (_config: RoomConfig) => void;
  removeRoom: () => void;
  setPlacementMode: (_mode: "door" | "window" | null) => void;
  addDoorToRoom: (_wallId: number, _config: DoorWindowConfig) => string;
  addWindowToRoom: (_wallId: number, _config: DoorWindowConfig) => string;
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
  setDimensionsOverlayVisible: (_visible: boolean) => void;
  getDimensionsOverlayVisible: () => boolean;
  getRightmostX: () => number;
};

export interface ProjectActions {
  setProjectName: (_name: string) => void;
  setTipoProjeto: (_tipo: string) => void;
  setMaterial: (_material: Material) => void;
  setEspessura: (_espessura: number) => void;
  setDimensoes: (_dimensoes: Partial<Dimensoes>) => void;
  setQuantidade: (_quantidade: number) => void;
  addBox: () => void;
  addWorkspaceBox: () => void;
  addWorkspaceBoxFromCatalog: (_catalogItemId: string) => void;
  duplicateBox: () => void;
  duplicateWorkspaceBox: () => void;
  removeBox: () => void;
  removeWorkspaceBox: () => void;
  removeWorkspaceBoxById: (_boxId: string) => void;
  selectBox: (_boxId: string) => void;
  clearSelection: () => void;
  /** Adiciona um modelo CAD (por id do catálogo) à caixa. */
  addModelToBox: (_caixaId: string, _cadModelId: string) => void;
  /** Cria uma nova caixa no workspace com o modelo CAD (modelo = Box completo). */
  addCadModelAsNewBox: (_cadModelId: string) => void;
  /** Remove uma instância de modelo da caixa. */
  removeModelFromBox: (_caixaId: string, _modelInstanceId: string) => void;
  /** Atualiza nome, material ou categoria de uma instância de modelo na caixa. */
  updateModelInBox: (_caixaId: string, _modelInstanceId: string, _updates: { nome?: string; material?: string; categoria?: string }) => void;
  /** (Legado) Atualiza o único modelo da caixa; migra para models[]. */
  updateCaixaModelId: (_caixaId: string, _modelId: string | null) => void;
  selectModelInstance: (_boxId: string, _modelInstanceId: string | null) => void;
  renameBox: (_nome: string) => void;
  setPrateleiras: (_quantidade: number) => void;
  setGavetas: (_quantidade: number) => void;
  setPortaTipo: (_portaTipo: BoxModule["portaTipo"]) => void;
  setTipoBorda: (_tipoBorda: TipoBorda) => void;
  setTipoFundo: (_tipoFundo: TipoFundo) => void;
  setExtractedPartsForBox: (_boxId: string, _modelInstanceId: string, _parts: CutListItemComPreco[]) => void;
  clearExtractedPartsForBox: (_boxId: string, _modelInstanceId?: string) => void;
  setModelPositionInBox: (_boxId: string, _modelInstanceId: string, _position: { x: number; y: number; z: number }) => void;
  setLayoutWarnings: (_warnings: LayoutWarnings) => void;
  updateWorkspacePosition: (_boxId: string, _posicaoX_mm: number) => void;
  updateWorkspaceBoxPosition: (_boxId: string, _posicaoX_mm: number) => void;
  /** Atualiza posição/rotação/manual da caixa no viewer (manipulação visual; não altera cut list). */
  updateWorkspaceBoxTransform: (
    _boxId: string,
    _partial: {
      x_mm?: number;
      y_mm?: number;
      z_mm?: number;
      rotacaoY_rad?: number;
      manualPosition?: boolean;
      autoRotateEnabled?: boolean;
      feetEnabled?: boolean;
    }
  ) => void;
  /** Atualiza dimensões da caixa a partir do bbox do GLB (caixas CAD-only). */
  setWorkspaceBoxDimensoes: (_boxId: string, _dimensoes: { largura: number; altura: number; profundidade: number }) => void;
  /** Atualiza o nome da caixa (ex.: nome do modelo CAD). */
  setWorkspaceBoxNome: (_boxId: string, _nome: string) => void;
  toggleWorkspaceRotation: (_boxId: string) => void;
  rotateWorkspaceBox: (_boxId: string) => void;
  gerarDesign: () => void;
  exportarPDF: () => void;
  exportarPdfTecnico: () => void;
  /** Gera PDF unificado (Técnico + Cutlist em um único ficheiro). */
  exportarPdfUnificado: () => void;
  logChangelog: (_message: string) => void;
  /** Define a ferramenta 3D ativa (select, move, rotate) e aplica ao viewerApiAdapter. */
  setActiveTool: (_mode: "select" | "move" | "rotate") => void;
  /** Atualiza regras dinâmicas; guarda no LocalStorage e força recalcular caixas. */
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
  /** Define o perfil de regras do projeto (futuro; não ativado na UI ainda). */
  setProjectRulesProfile: (_id: string) => void;
  /** Recalcula todas as caixas com as regras atuais (após updateRules). */
  recalculateAllBoxes: () => void;
  undo: () => void;
  redo: () => void;
  saveProjectSnapshot: () => void;
  loadProjectSnapshot: (_id: string) => void;
  /** Carrega projeto a partir de um template (limpa sala, caixas e substitui pelo layout do modelo). */
  loadProjectFromTemplate: (_templateId: string) => void;
  /** Adiciona um template como novas caixas no workspace (não substitui o projeto). */
  addTemplateAsNewBox: (_templateId: string) => void;
  listSavedProjects: () => SavedProjectInfo[];
  createNewProject: () => void;
  renameProject: (_id: string, _name: string) => void;
  deleteProject: (_id: string) => void;
}

export interface ProjectContextProps {
  project: ProjectState;
  actions: ProjectActions;
  viewerSync: ViewerSync;
}
