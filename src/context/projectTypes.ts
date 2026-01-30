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

export type ViewerRenderQuality = "low" | "medium" | "high";

export type ViewerRenderBackground = "white" | "transparent";

export type ViewerRenderOptions = {
  quality: ViewerRenderQuality;
  background: ViewerRenderBackground;
};

export type ViewerRenderResult = {
  dataUrl: string;
  width: number;
  height: number;
};

export type ViewerApi = {
  saveSnapshot: () => ViewerSnapshot | null;
  restoreSnapshot: (snapshot: ViewerSnapshot | null) => void;
  enable2DView: (angle: Viewer2DAngle) => void;
  disable2DView: () => void;
  renderScene: (options: ViewerRenderOptions) => ViewerRenderResult | null;
};

export type ProjectSnapshot = {
  projectState: unknown;
  viewerSnapshot: ViewerSnapshot | null;
};

export type ViewerSync = {
  notifyChangeSignal: unknown;
  applyStateToViewer: () => void;
  extractStateFromViewer: () => void;
  saveViewerSnapshot: () => ViewerSnapshot | null;
  restoreViewerSnapshot: (snapshot: ViewerSnapshot | null) => void;
  registerViewerApi: (api: ViewerApi | null) => void;
  enable2DView: (angle: Viewer2DAngle) => void;
  disable2DView: () => void;
  renderScene: (options: ViewerRenderOptions) => ViewerRenderResult | null;
};

export interface ProjectActions {
  setProjectName: (name: string) => void;
  setTipoProjeto: (tipo: string) => void;
  setMaterial: (material: Material) => void;
  setEspessura: (espessura: number) => void;
  setDimensoes: (dimensoes: Partial<Dimensoes>) => void;
  setQuantidade: (quantidade: number) => void;
  addBox: () => void;
  addWorkspaceBox: () => void;
  duplicateBox: () => void;
  duplicateWorkspaceBox: () => void;
  removeBox: () => void;
  removeWorkspaceBox: () => void;
  removeWorkspaceBoxById: (boxId: string) => void;
  selectBox: (boxId: string) => void;
  /** Adiciona um modelo CAD (por id do catálogo) à caixa. */
  addModelToBox: (caixaId: string, cadModelId: string) => void;
  /** Cria uma nova caixa no workspace com o modelo CAD (modelo = Box completo). */
  addCadModelAsNewBox: (cadModelId: string) => void;
  /** Remove uma instância de modelo da caixa. */
  removeModelFromBox: (caixaId: string, modelInstanceId: string) => void;
  /** Atualiza nome, material ou categoria de uma instância de modelo na caixa. */
  updateModelInBox: (caixaId: string, modelInstanceId: string, updates: { nome?: string; material?: string; categoria?: string }) => void;
  /** (Legado) Atualiza o único modelo da caixa; migra para models[]. */
  updateCaixaModelId: (caixaId: string, modelId: string | null) => void;
  selectModelInstance: (boxId: string, modelInstanceId: string | null) => void;
  renameBox: (nome: string) => void;
  setPrateleiras: (quantidade: number) => void;
  setPortaTipo: (portaTipo: BoxModule["portaTipo"]) => void;
  setTipoBorda: (tipoBorda: TipoBorda) => void;
  setTipoFundo: (tipoFundo: TipoFundo) => void;
  setExtractedPartsForBox: (boxId: string, modelInstanceId: string, parts: CutListItemComPreco[]) => void;
  clearExtractedPartsForBox: (boxId: string, modelInstanceId?: string) => void;
  setModelPositionInBox: (boxId: string, modelInstanceId: string, position: { x: number; y: number; z: number }) => void;
  setLayoutWarnings: (warnings: LayoutWarnings) => void;
  updateWorkspacePosition: (boxId: string, posicaoX_mm: number) => void;
  updateWorkspaceBoxPosition: (boxId: string, posicaoX_mm: number) => void;
  /** Atualiza posição/rotação/manual da caixa no viewer (manipulação visual; não altera cut list). */
  updateWorkspaceBoxTransform: (
    boxId: string,
    partial: { x_mm?: number; y_mm?: number; z_mm?: number; rotacaoY_rad?: number; manualPosition?: boolean }
  ) => void;
  /** Atualiza dimensões da caixa a partir do bbox do GLB (caixas CAD-only). */
  setWorkspaceBoxDimensoes: (boxId: string, dimensoes: { largura: number; altura: number; profundidade: number }) => void;
  /** Atualiza o nome da caixa (ex.: nome do modelo CAD). */
  setWorkspaceBoxNome: (boxId: string, nome: string) => void;
  toggleWorkspaceRotation: (boxId: string) => void;
  rotateWorkspaceBox: (boxId: string) => void;
  gerarDesign: () => void;
  exportarPDF: () => void;
  logChangelog: (message: string) => void;
  undo: () => void;
  redo: () => void;
  saveProjectSnapshot: () => void;
  loadProjectSnapshot: (id: string) => void;
  listSavedProjects: () => SavedProjectInfo[];
  createNewProject: () => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
}

export interface ProjectContextProps {
  project: ProjectState;
  actions: ProjectActions;
  viewerSync: ViewerSync;
}
