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
  WorkspaceBox,
} from "../core/types";

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
  selectedCaixaModelUrl: string | null;

  resultados: ResultadosCalculo | null;
  ultimaAtualizacao: Date | null;

  design: Design | null;
  cutList: CutListItem[] | null;
  cutListComPreco: CutListItemComPreco[] | null;
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
  selectBox: (boxId: string) => void;
  updateCaixaModelId: (caixaId: string, modelId: string | null) => void;
  renameBox: (nome: string) => void;
  setPrateleiras: (quantidade: number) => void;
  setPortaTipo: (portaTipo: BoxModule["portaTipo"]) => void;
  updateWorkspacePosition: (boxId: string, posicaoX_mm: number) => void;
  updateWorkspaceBoxPosition: (boxId: string, posicaoX_mm: number) => void;
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
