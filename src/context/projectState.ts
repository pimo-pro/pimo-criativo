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
  BoxModelInstance,
  BoxModule,
  ChangelogEntry,
  Dimensoes,
  Material,
  ProjetoConfig,
  ResultadosCalculo,
  TipoBorda,
  TipoFundo,
  WorkspaceBox,
} from "../core/types";
import type { ProjectState } from "./projectTypes";
import { safeGetItem, safeParseJson } from "../utils/storage";
import { validateBoxModels } from "../core/rules/validation";
import {
  computeLayoutWarnings,
  type LayoutWarnings,
} from "../core/layout/layoutWarnings";
import { mmToM } from "../utils/units";
import { loadProfiles } from "../core/rules/rulesProfilesStorage";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import type { RulesProfilesConfig } from "../core/rules/rulesProfiles";
import { getCatalogGlbPath } from "../core/glb/glbRegistry";

/** Extrai rules do perfil ativo; fallback para default se não existir. */
function getRulesFromProfiles(config: RulesProfilesConfig) {
  const perfil = config.perfis.find((p) => p.id === config.perfilAtivoId);
  return perfil?.rules ?? defaultRulesConfig;
}

const defaultMaterial: Material = {
  tipo: "MDF Branco",
  espessura: 19,
  precoPorM2: 25.0,
};

const defaultDimensoes: Dimensoes = {
  largura: 1800,
  altura: 2000,
  profundidade: 400,
};

const defaultTipoBorda: TipoBorda = "reta";
const defaultTipoFundo: TipoFundo = "recuado";

const createBox = (
  id: string,
  nome: string,
  dimensoes: Dimensoes,
  espessura: number,
  models: BoxModelInstance[],
  tipoBorda: TipoBorda = defaultTipoBorda,
  tipoFundo: TipoFundo = defaultTipoFundo
): BoxModule => ({
  id,
  nome,
  dimensoes,
  espessura,
  tipoBorda,
  tipoFundo,
  models: models ?? [],
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
  models: BoxModelInstance[] = [],
  tipoBorda: TipoBorda = defaultTipoBorda,
  tipoFundo: TipoFundo = defaultTipoFundo,
  catalogItemId?: string
): WorkspaceBox => ({
  id,
  nome,
  dimensoes,
  espessura,
  tipoBorda,
  tipoFundo,
  models: models ?? [],
  prateleiras: 0,
  portaTipo: "sem_porta",
  gavetas: 0,
  alturaGaveta: 200,
  posicaoX_mm,
  posicaoY_mm: 0,
  posicaoZ_mm: 0,
  rotacaoY_90: false,
  rotacaoY: 0,
  manualPosition: false,
  catalogItemId,
});

const defaultWorkspaceBoxes: WorkspaceBox[] = [
  createWorkspaceBox("box-1", "Caixa 1", defaultDimensoes, defaultMaterial.espessura, 0, []),
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
  selectedWorkspaceBoxIds: [defaultWorkspaceBoxes[0].id],
  selectedCaixaId: defaultWorkspaceBoxes[0].id,
  selectedCaixaModelUrl: null,
  selectedModelInstanceId: null,
  resultados: null,
  ultimaAtualizacao: null,
  design: null,
  cutList: null,
  cutListComPreco: null,
  extractedPartsByBoxId: {},
  ruleViolations: [],
  modelPositionsByBoxId: {},
  layoutWarnings: { collisions: [], outOfBounds: [] },
  estrutura3D: null,
  acessorios: null,
  precoTotalPecas: null,
  precoTotalAcessorios: null,
  precoTotalProjeto: null,
  activeViewerTool: "select",
  rulesProfiles: loadProfiles(),
  rules: getRulesFromProfiles(loadProfiles()),
  rulesProfileId: undefined,
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
    // Sincroniza boxes com workspaceBoxes (single source of truth para o viewer e cálculo).
    const boxes = buildBoxesFromWorkspace(state);
    const stateWithBoxes = { ...state, boxes };
    const resultados =
      boxes.length > 0
        ? calcularResultadosBoxes(stateWithBoxes)
        : calcularProjeto(buildConfig(stateWithBoxes));
    return {
      ...stateWithBoxes,
      resultados,
      ultimaAtualizacao: new Date(),
      estaCarregando: false,
      erro: null,
    };
  } catch (error) {
    return {
      ...state,
      boxes: buildBoxesFromWorkspace(state),
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
  // Caixa só com modelo(s) CAD (módulo completo): não gerar peças paramétricas; só contam as peças extraídas do GLB
  const isCadOnlyBox =
    (box.models?.length ?? 0) > 0 && box.prateleiras === 0 && box.gavetas === 0;
  if (isCadOnlyBox) {
    const ferragens = buildFerragens(0, box.portaTipo, 0);
    return {
      ...box,
      ferragens,
      cutList: [],
      cutListComPreco: [],
      estrutura3D: null,
      precoTotalPecas: 0,
    };
  }

  const design = generateDesign(
    prev.tipoProjeto,
    prev.material,
    box.dimensoes,
    prev.quantidade,
    box.espessura,
    box.prateleiras,
    box.portaTipo,
    box.gavetas,
    box.alturaGaveta,
    prev.rules
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

/** Base URL para resolver caminhos relativos (ex.: /models/x.glb). */
function getBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    return base ? `${window.location.origin}${base}` : window.location.origin;
  }
  return window.location.origin;
}

export const getModelUrlFromStorage = (modelId?: string | null): string | null => {
  if (!modelId) return null;
  if (modelId.startsWith("catalog:")) {
    const catalogItemId = modelId.replace("catalog:", "");
    const catalogPath = getCatalogGlbPath(catalogItemId);
    if (!catalogPath) return null;
    if (
      catalogPath.startsWith("data:") ||
      catalogPath.startsWith("http://") ||
      catalogPath.startsWith("https://")
    ) {
      return catalogPath;
    }
    const base = getBaseUrl();
    const path = catalogPath.startsWith("/") ? catalogPath : `/${catalogPath}`;
    return `${base}${path}`;
  }
  const stored = safeGetItem("pimo_admin_cad_models");
  const parsed = safeParseJson<{ id?: string; arquivo?: string }[]>(stored);
  if (!Array.isArray(parsed)) return null;
  const found = parsed.find((item) => item.id === modelId);
  const arquivo = found?.arquivo ?? null;
  if (!arquivo) return null;
  // Data URLs (base64) e URLs absolutas ficam como estão
  if (arquivo.startsWith("data:") || arquivo.startsWith("http://") || arquivo.startsWith("https://")) {
    return arquivo;
  }
  // Caminho relativo: garantir URL absoluta
  const base = getBaseUrl();
  const path = arquivo.startsWith("/") ? arquivo : `/${arquivo}`;
  return `${base}${path}`;
};

const convertWorkspaceToBox = (box: WorkspaceBox): BoxModule => ({
  ...createBox(
    box.id,
    box.nome,
    box.dimensoes,
    box.espessura,
    box.models ?? [],
    box.tipoBorda,
    box.tipoFundo
  ),
  prateleiras: box.prateleiras,
  portaTipo: box.portaTipo,
  gavetas: box.gavetas,
  alturaGaveta: box.alturaGaveta,
});

export const buildBoxesFromWorkspace = (state: ProjectState): BoxModule[] => {
  return state.workspaceBoxes.map((box) => convertWorkspaceToBox(box));
};

/** Deriva dimensões aproximadas do modelo a partir das peças extraídas (bbox máximo). */
function getModelDimensoesFromExtracted(
  extractedByBoxId: ProjectState["extractedPartsByBoxId"]
): Record<string, Record<string, import("../core/types").Dimensoes>> {
  const out: Record<string, Record<string, import("../core/types").Dimensoes>> = {};
  for (const [boxId, byInstance] of Object.entries(extractedByBoxId ?? {})) {
    if (!byInstance || typeof byInstance !== "object") continue;
    out[boxId] = {};
    for (const [instanceId, parts] of Object.entries(byInstance)) {
      if (!Array.isArray(parts) || parts.length === 0) continue;
      const largura = Math.max(...parts.map((p) => p.dimensoes.largura));
      const altura = Math.max(...parts.map((p) => p.dimensoes.altura));
      const profundidade = Math.max(...parts.map((p) => p.dimensoes.profundidade));
      out[boxId][instanceId] = { largura, altura, profundidade };
    }
  }
  return out;
}

/** Agrega avisos de layout (colisões e fora dos limites) para todo o estado. */
function computeLayoutWarningsFromState(prev: ProjectState): LayoutWarnings {
  const collisions: LayoutWarnings["collisions"] = [];
  const outOfBounds: LayoutWarnings["outOfBounds"] = [];
  const dimsByBox = getModelDimensoesFromExtracted(prev.extractedPartsByBoxId);
  const positionsByBox = prev.modelPositionsByBoxId ?? {};

  for (const box of prev.workspaceBoxes ?? []) {
    const boxDims = prev.boxes?.find((b) => b.id === box.id)?.dimensoes ?? box.dimensoes;
    const boxDimsM = {
      width: mmToM(boxDims.largura),
      height: mmToM(boxDims.altura),
      depth: mmToM(boxDims.profundidade),
    };
    const modelDims = dimsByBox[box.id];
    const modelPositions = positionsByBox[box.id];
    const models = box.models ?? [];
    if (models.length === 0) continue;

    const positionsAndSizes = models
      .map((m) => {
        const pos = modelPositions?.[m.id] ?? { x: 0, y: boxDimsM.height / 2, z: 0 };
        const dims = modelDims?.[m.id];
        const sizeM = dims
          ? { width: mmToM(dims.largura), height: mmToM(dims.altura), depth: mmToM(dims.profundidade) }
          : { width: 0.1, height: 0.1, depth: 0.1 };
        return { modelInstanceId: m.id, position: pos, size: sizeM };
      })
      .filter((m) => m.size.width > 0 && m.size.height > 0 && m.size.depth > 0);

    const warnings = computeLayoutWarnings(box.id, boxDimsM, positionsAndSizes);
    collisions.push(...warnings.collisions);
    outOfBounds.push(...warnings.outOfBounds);
  }
  return { collisions, outOfBounds };
}

/** Calcula violações de regras dinâmicas para todas as caixas e modelos. */
export function computeRuleViolations(prev: ProjectState): import("../core/rules/types").RuleViolation[] {
  const dimsByBox = getModelDimensoesFromExtracted(prev.extractedPartsByBoxId);
  const all: import("../core/rules/types").RuleViolation[] = [];
  for (const box of prev.workspaceBoxes ?? []) {
    const modelDimensoes = dimsByBox[box.id];
    all.push(
      ...validateBoxModels(
        box.id,
        box.dimensoes,
        (box.models ?? []).map((m) => ({
          id: m.id,
          modelId: m.modelId,
          material: m.material,
          categoria: m.categoria,
        })),
        modelDimensoes
      )
    );
  }
  return all;
}

export const buildDesignState = (prev: ProjectState): Partial<ProjectState> => {
  const boxes = prev.boxes.map((box) => buildBoxDesign(prev, box));
  const selectedBox = getSelectedBox(prev);
  if (!selectedBox) {
    return {
      boxes: prev.boxes,
      design: null,
      cutList: null,
      cutListComPreco: null,
      ruleViolations: computeRuleViolations(prev),
      layoutWarnings: computeLayoutWarningsFromState(prev),
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

  // Incluir peças paramétricas de TODAS as caixas e peças extraídas (modelos CAD) de TODAS as caixas
  const allParametric = boxes.flatMap((b) => b.cutListComPreco ?? []);
  const allExtracted = (prev.boxes ?? []).flatMap((box) =>
    Object.values(prev.extractedPartsByBoxId?.[box.id] ?? {}).flat()
  );
  const cutListComPreco = [...allParametric, ...allExtracted];
  const precoTotalPecas = calcularPrecoTotalPecas(cutListComPreco);
  const precoProjetoBase = precoTotalPecas + precoTotalAcessorios;
  const precoTotalProjeto = calcularPrecoTotalProjeto(precoProjetoBase);

  const ruleViolations = computeRuleViolations(prev);
  const layoutWarnings = computeLayoutWarningsFromState(prev);

  return {
    boxes,
    design: {
      cutList: cutListComPreco,
      estrutura3D: selectedDesign.estrutura3D,
      acessorios: selectedDesign.ferragens,
      timestamp: new Date(),
    },
    cutList: cutListComPreco,
    cutListComPreco,
    ruleViolations,
    layoutWarnings,
    estrutura3D: selectedDesign.estrutura3D,
    acessorios: acessoriosComPreco,
    precoTotalPecas,
    precoTotalAcessorios,
    precoTotalProjeto,
    resultados,
    ultimaAtualizacao: new Date(),
    estaCarregando: false,
    erro: null,
  };
};
