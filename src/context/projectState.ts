import { calcularProjeto } from "../core/calculator/woodCalculator";
import { generateDesign } from "../core/design/generateDesign";
import { buildFerragens } from "../core/design/ferragens";
import {
  calcularPrecoCutList,
  calcularPrecoTotalPecas,
  calcularPrecoTotalProjeto,
} from "../core/pricing/pricing";
import { calcularPrecosAcessorios } from "../core/acessorios/acessorios";
import type {
  BoxModule,
  ChangelogEntry,
  Dimensoes,
  Material,
  ProjetoConfig,
  ResultadosCalculo,
  WorkspaceBox,
} from "../core/types";
import type { ProjectState } from "./projectTypes";
import { safeGetItem, safeParseJson } from "../utils/storage";

const defaultMaterial: Material = {
  tipo: "MDF",
  espessura: 19,
  precoPorM2: 25.0,
};

const defaultDimensoes: Dimensoes = {
  largura: 1800,
  altura: 2000,
  profundidade: 400,
};

const createBox = (
  id: string,
  nome: string,
  dimensoes: Dimensoes,
  espessura: number,
  modelId: string | null
): BoxModule => ({
  id,
  nome,
  dimensoes,
  espessura,
  modelId,
  prateleiras: 0,
  portaTipo: "porta_simples",
  gavetas: 1,
  alturaGaveta: 200,
  ferragens: [],
  cutList: [],
  cutListComPreco: [],
  estrutura3D: {
    pecas: [],
    dimensoesTotais: {
      largura: dimensoes.largura,
      altura: dimensoes.altura,
      profundidade: dimensoes.profundidade,
    },
    centro: {
      x: 0,
      y: dimensoes.altura / 2,
      z: 0,
    },
  },
  precoTotalPecas: 0,
});

export const createWorkspaceBox = (
  id: string,
  nome: string,
  dimensoes: Dimensoes,
  espessura: number,
  posicaoX_mm: number,
  modelId: string | null
): WorkspaceBox => ({
  id,
  nome,
  dimensoes,
  espessura,
  modelId,
  prateleiras: 0,
  portaTipo: "sem_porta",
  gavetas: 0,
  alturaGaveta: 200,
  posicaoX_mm,
  posicaoY_mm: 0,
  rotacaoY_90: false,
});

const defaultWorkspaceBoxes: WorkspaceBox[] = [
  createWorkspaceBox(
    "box-1",
    "Caixa 1",
    defaultDimensoes,
    defaultMaterial.espessura,
    0,
    null
  ),
];

export const defaultState: ProjectState = {
  projectName: "Novo Projeto",
  tipoProjeto: "Estante de Parede – 3 Portas",
  material: defaultMaterial,
  dimensoes: defaultDimensoes,
  quantidade: 1,
  boxes: [],
  selectedBoxId: "",
  workspaceBoxes: defaultWorkspaceBoxes,
  selectedWorkspaceBoxId: defaultWorkspaceBoxes[0].id,
  selectedCaixaId: defaultWorkspaceBoxes[0].id,
  selectedCaixaModelUrl: null,
  resultados: null,
  ultimaAtualizacao: null,
  design: null,
  cutList: null,
  cutListComPreco: null,
  estrutura3D: null,
  acessorios: null,
  precoTotalPecas: null,
  precoTotalAcessorios: null,
  precoTotalProjeto: null,
  estaCarregando: false,
  erro: null,
  changelog: [],
};

const buildConfig = (state: ProjectState): ProjetoConfig => {
  const selectedWorkspace = getSelectedWorkspaceBox(state);
  const selectedBox = getSelectedBox(state);
  return {
    tipo: state.tipoProjeto,
    material: state.material,
    dimensoes: selectedWorkspace?.dimensoes ?? selectedBox?.dimensoes ?? state.dimensoes,
    quantidade: state.quantidade,
  };
};

const calcularResultadosBoxes = (state: ProjectState): ResultadosCalculo | null => {
  if (!state.boxes || state.boxes.length === 0) {
    return null;
  }
  const totals = state.boxes.reduce(
    (acc, box) => {
      const resultados = calcularProjeto({
        tipo: state.tipoProjeto,
        material: state.material,
        dimensoes: box.dimensoes,
        quantidade: state.quantidade,
      });
      return {
        numeroPecas: acc.numeroPecas + resultados.numeroPecas,
        numeroPaineis: acc.numeroPaineis + resultados.numeroPaineis,
        areaTotal: acc.areaTotal + resultados.areaTotal,
        desperdicio: acc.desperdicio + resultados.desperdicio,
        precoMaterial: acc.precoMaterial + resultados.precoMaterial,
        precoFinal: acc.precoFinal + resultados.precoFinal,
      };
    },
    {
      numeroPecas: 0,
      numeroPaineis: 0,
      areaTotal: 0,
      desperdicio: 0,
      precoMaterial: 0,
      precoFinal: 0,
    }
  );
  const desperdicioPercentual =
    totals.areaTotal > 0 ? (totals.desperdicio / totals.areaTotal) * 100 : 0;
  return { ...totals, desperdicioPercentual };
};

export const applyResultados = (state: ProjectState): ProjectState => {
  try {
    const resultados =
      state.boxes && state.boxes.length > 0
        ? calcularResultadosBoxes(state)
        : calcularProjeto(buildConfig(state));
    return {
      ...state,
      resultados,
      ultimaAtualizacao: new Date(),
      estaCarregando: false,
      erro: null,
    };
  } catch (error) {
    return {
      ...state,
      resultados: null,
      estaCarregando: false,
      erro: error instanceof Error ? error.message : "Erro ao calcular projeto",
    };
  }
};

export const appendChangelog = (
  prev: ChangelogEntry[],
  entry: Omit<ChangelogEntry, "id">
): ChangelogEntry[] => {
  return [
    {
      ...entry,
      id: `${entry.type}-${entry.timestamp.getTime()}-${prev.length + 1}`,
    },
    ...prev,
  ].slice(0, 100);
};

export const recomputeState = (
  prev: ProjectState,
  partial: Partial<ProjectState>,
  withLoading: boolean
): ProjectState => {
  const nextState: ProjectState = {
    ...prev,
    ...partial,
    ...(withLoading ? { estaCarregando: true } : null),
  };

  return applyResultados(nextState);
};

const buildBoxDesign = (prev: ProjectState, box: BoxModule): BoxModule => {
  const design = generateDesign(
    prev.tipoProjeto,
    prev.material,
    box.dimensoes,
    prev.quantidade,
    box.espessura,
    box.prateleiras,
    box.portaTipo,
    box.gavetas,
    box.alturaGaveta
  );

  const cutListComPreco = calcularPrecoCutList(design.cutList);
  const precoTotalPecas = calcularPrecoTotalPecas(cutListComPreco);
  const ferragens = buildFerragens(box.prateleiras, box.portaTipo, box.gavetas);

  return {
    ...box,
    ferragens,
    cutList: design.cutList,
    cutListComPreco,
    estrutura3D: design.estrutura3D,
    precoTotalPecas,
  };
};

export const getSelectedBox = (state: ProjectState): BoxModule | undefined => {
  return state.boxes.find((box) => box.id === state.selectedBoxId) ?? state.boxes[0];
};

export const getSelectedWorkspaceBox = (state: ProjectState): WorkspaceBox | undefined => {
  return (
    state.workspaceBoxes.find((box) => box.id === state.selectedWorkspaceBoxId) ??
    state.workspaceBoxes[0]
  );
};

export const getModelUrlFromStorage = (modelId?: string | null): string | null => {
  if (!modelId) return null;
  const stored = safeGetItem("pimo_admin_cad_models");
  const parsed = safeParseJson<{ id?: string; arquivo?: string }[]>(stored);
  if (!Array.isArray(parsed)) return null;
  const found = parsed.find((item) => item.id === modelId);
  return found?.arquivo ?? null;
};

const convertWorkspaceToBox = (box: WorkspaceBox): BoxModule => ({
  ...createBox(box.id, box.nome, box.dimensoes, box.espessura, box.modelId),
  prateleiras: box.prateleiras,
  portaTipo: box.portaTipo,
  gavetas: box.gavetas,
  alturaGaveta: box.alturaGaveta,
});

export const buildBoxesFromWorkspace = (state: ProjectState): BoxModule[] => {
  return state.workspaceBoxes.map((box) => convertWorkspaceToBox(box));
};

export const buildDesignState = (prev: ProjectState): Partial<ProjectState> => {
  const boxes = prev.boxes.map((box) => buildBoxDesign(prev, box));
  const selectedBox = getSelectedBox(prev);
  if (!selectedBox) {
    return {
      design: null,
      cutList: null,
      cutListComPreco: null,
      estrutura3D: null,
      acessorios: null,
      precoTotalPecas: null,
      precoTotalAcessorios: null,
      precoTotalProjeto: null,
      ultimaAtualizacao: new Date(),
      estaCarregando: false,
      erro: "Nenhum caixote disponível para cálculo",
    };
  }
  const selectedDesign =
    boxes.find((design) => design.id === selectedBox.id) ?? boxes[0];
  const resultados = calcularResultadosBoxes({ ...prev, boxes });

  const ferragensAtivas = selectedDesign.ferragens.filter((item) => item.quantidade > 0);
  const acessoriosComPreco = calcularPrecosAcessorios(ferragensAtivas);
  const precoTotalAcessorios = acessoriosComPreco.reduce(
    (total, acc) => total + acc.precoTotal,
    0
  );

  const precoProjetoBase = selectedDesign.precoTotalPecas + precoTotalAcessorios;
  const precoTotalProjeto = calcularPrecoTotalProjeto(precoProjetoBase);

  return {
    boxes,
    design: {
      cutList: selectedDesign.cutList,
      estrutura3D: selectedDesign.estrutura3D,
      acessorios: selectedDesign.ferragens,
      timestamp: new Date(),
    },
    cutList: selectedDesign.cutList,
    cutListComPreco: selectedDesign.cutListComPreco,
    estrutura3D: selectedDesign.estrutura3D,
    acessorios: acessoriosComPreco,
    precoTotalPecas: selectedDesign.precoTotalPecas,
    precoTotalAcessorios,
    precoTotalProjeto,
    resultados,
    ultimaAtualizacao: new Date(),
    estaCarregando: false,
    erro: null,
  };
};
