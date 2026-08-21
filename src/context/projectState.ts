import { calcularProjeto } from "../core/calculator/woodCalculator";
import { buildFerragens } from "../core/ferragens/ferragens";
import {
  loadPesPlasticoConfig,
  PE_PLASTICO_ID,
  PE_PLASTICO_NOME,
  quantidadePesParaCaixa,
} from "../core/ferragens/pesPlasticoConfig";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import {
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
import { ensureBoxPanelIds } from "../core/box/panelIds";
import { isCornerFixedFrontModel, migrateCornerDireitaInferiorBoxes } from "../core/cornerCabinet";
import type { ProjectState, ViewerSettings } from "./projectTypes";
import { validateBoxModels } from "../core/rules/validation";
import {
  computeLayoutWarnings,
  type LayoutWarnings,
} from "../core/layout/layoutWarnings";
import { mmToM } from "../utils/units";
import { loadProfiles } from "../core/rules/rulesProfilesStorage";
import { defaultRulesConfig, normalizeRulesConfig } from "../core/rules/rulesConfig";
import type { RulesProfilesConfig } from "../core/rules/rulesProfiles";
import { regenerateLayersForBox } from "../services/boxLayersService";
import { getDefaultOfficialMaterial } from "../core/materials/materials.api";
import { createEmptyProjectMeasurements } from "../3d/viewer-engine/measurement/internalRulerTypes";
import { createEmptyObjectGroups } from "../core/viewer/groupTypes";
import { computeOrlaFerragem, syncOrlaPiecesForProject } from "../core/orla/orlaCalculator";
import { migrateProjectPieceObservacoes } from "../core/observacoes/ObservacoesService";
import { normalizeOrlaPresets } from "../core/orla/orlaPresets";
import { normalizeDrawerPresets } from "../core/drawers/drawerPresets";
import { buildRemateCutlistItems } from "../core/remate/remateCutlist";
import { buildRodapeCutlistItems } from "../core/rodape/rodapeCutlist";
import { loadGlobalFinanceiroAdminSettings } from "../core/financeiro/financeiroAdminRules";

/** Extrai rules do perfil ativo; fallback para default se não existir. */
function getRulesFromProfiles(config: RulesProfilesConfig) {
  const perfil = config.perfis.find((p) => p.id === config.perfilAtivoId);
  return normalizeRulesConfig(perfil?.rules ?? defaultRulesConfig);
}

const defaultOfficialMaterial = getDefaultOfficialMaterial();
const defaultMaterial: Material = {
  tipo: defaultOfficialMaterial.canonicalId,
  espessura: defaultOfficialMaterial.industrialDefaults?.espessuraPadrao ?? 19,
  precoPorM2: defaultOfficialMaterial.industrialDefaults?.custo_m2 ?? 25.0,
};

const defaultDimensoes: Dimensoes = {
  largura: 1800,
  altura: 2000,
  profundidade: 400,
};

const defaultTipoBorda: TipoBorda = "reta";
const defaultTipoFundo: TipoFundo = "recuado";

const defaultViewerSettings: ViewerSettings = {
  showPanelEdges: true,
  hiddenPanels: [],
  explodedViewEnabled: false,
  explodedViewIntensity: 0.35,
  hideAllPanels: false,
  showCeiling: true,
  wallEditMode: false,
  mousePreset: "cad",
  backgroundMode: "studio",
  materialQuality: "standard",
  enableReflections: false,
  photoModeEnabled: false,
  highlightEnabled: false,
  rulerEnabled: false,
  internalRulerEnabled: false,
  ultraPerformanceModeOptions: {
    enabled: false,
    mode: "balanced",
  },
  globalLightIntensity: 1,
  shadowIntensity: 1,
  glossIntensity: 1,
  matteMode: false,
  panelRenderingEnabled: false,
  showDrawerDrilling: false,
  defaultScalingMode: "additive",
};

const AUTO_PROJECT_NAME_SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Nome automático: NP + ano (2 dígitos) + dia + mês + hora (dia/mês/hora sem zero à esquerda).
 * Ex.: 2026-04-01 10:15 -> NP261410
 */
export function formatAutoProjectName(date: Date): string {
  const yy = date.getFullYear() % 100;
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const hour = date.getHours();
  return `NP${String(yy).padStart(2, "0")}${day}${month}${hour}`;
}

/**
 * Se `base` já existir em `existing`, acrescenta 2 caracteres até encontrar candidato livre (varredura determinística).
 */
export function ensureUniqueAutoProjectName(
  base: string,
  existing: ReadonlySet<string>
): string {
  if (!existing.has(base)) return base;
  const chars = AUTO_PROJECT_NAME_SUFFIX_CHARS;
  for (let i = 0; i < chars.length; i++) {
    for (let j = 0; j < chars.length; j++) {
      const candidate = `${base}${chars[i]!}${chars[j]!}`;
      if (!existing.has(candidate)) return candidate;
    }
  }
  return `${base}zz`;
}

const defaultAutoProjectName = ensureUniqueAutoProjectName(
  formatAutoProjectName(new Date()),
  new Set()
);

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
  gavetas: 0,
  alturaGaveta: 200,
  ferragens: [],
  cutList: [],
  cutListComPreco: [],
  doorsLayer: [],
  drawersLayer: [],
  divisores: [],
  separadores: [],
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

export type CreateWorkspaceBoxOverrides = {
  prateleiras?: number;
  portaTipo?: WorkspaceBox["portaTipo"];
  gavetas?: number;
  drawerHeightMode?: WorkspaceBox["drawerHeightMode"];
  drawerType?: WorkspaceBox["drawerType"];
  panelIds?: WorkspaceBox["panelIds"];
  cabinetType?: "lower" | "upper";
  pe_cm?: number;
  feetHeight?: number;
  feetOffsetFront?: number;
  feetEnabled?: boolean;
  piHideDrawerHoles?: boolean;
  cornerFixedFront?: boolean;
  /** Deve ser definido antes de regenerateLayersForBox (módulos corner-ff-*). */
  baseCabinetId?: string;
  divisores?: WorkspaceBox["divisores"];
  separadores?: WorkspaceBox["separadores"];
};

export const createWorkspaceBox = (
  id: string,
  nome: string,
  dimensoes: Dimensoes,
  espessura: number,
  posicaoX_mm: number,
  models: BoxModelInstance[] = [],
  tipoBorda: TipoBorda = defaultTipoBorda,
  tipoFundo: TipoFundo = defaultTipoFundo,
  catalogItemId?: string,
  overrides?: CreateWorkspaceBoxOverrides
): WorkspaceBox => {
  const prateleiras = overrides?.prateleiras ?? 0;
  const portaTipo = overrides?.portaTipo ?? "sem_porta";
  const gavetas = overrides?.gavetas ?? 0;
  const drawerHeightMode = overrides?.drawerHeightMode ?? "equal";
  const drawerType = overrides?.drawerType ?? "normal";
  const panelIds = ensureBoxPanelIds(overrides?.panelIds, {
    prateleiras,
    portaTipo,
    gavetas,
    cornerFixedFront: overrides?.cornerFixedFront,
    divisoresCount: overrides?.divisores?.length ?? 0,
    separadoresCount: overrides?.separadores?.length ?? 0,
  });
  const cabinetType = overrides?.cabinetType;
  const feetHeight = Math.max(40, overrides?.feetHeight ?? ((overrides?.pe_cm ?? 10) * 10));
  const pe_cm = feetHeight / 10;
  const feetOffsetFront = Math.max(0, overrides?.feetOffsetFront ?? 100);
  const feetEnabled = overrides?.feetEnabled ?? (cabinetType === "lower");
  const baseCabinetId = overrides?.baseCabinetId ?? catalogItemId;
  const alturaMm = dimensoes?.altura ?? 0;
  const posicaoY_mm =
    cabinetType === "lower" && feetEnabled !== false
      ? (feetHeight ?? 100) + alturaMm / 2
      : cabinetType === "upper"
        ? 1500 + alturaMm / 2
        : 0;
  
  const tempBox: WorkspaceBox = {
    id,
    nome,
    dimensoes,
    espessura,
    tipoBorda,
    tipoFundo,
    models: models ?? [],
    prateleiras,
    portaTipo,
    gavetas,
    alturaGaveta: 200,
    drawerHeightMode,
    drawerType,
    posicaoX_mm,
    posicaoY_mm,
    posicaoZ_mm: 0,
    rotacaoY_90: false,
    rotacaoY: 0,
    manualPosition: false,
    catalogItemId,
    baseCabinetId,
    cabinetType,
    pe_cm,
    feetHeight,
    feetOffsetFront,
    feetEnabled,
    autoRotateEnabled: true,
    panelIds,
    doorsLayer: [],
    drawersLayer: [],
    divisores: overrides?.divisores ?? [],
    separadores: overrides?.separadores ?? [],
    locked: false,
    piHideDrawerHoles: overrides?.piHideDrawerHoles === true,
    costaAtiva: true,
    noBackPanel: false,
    profundidadeExterna: dimensoes.profundidade,
    remateIds: [],
  };
  
  // Regenerate layers based on portaTipo and gavetas
  const layers = regenerateLayersForBox(tempBox);
  return {
    ...tempBox,
    ...layers,
  };
};

/** Projeto inicia sem caixas; o utilizador adiciona pelo catálogo ou "Adicionar caixote". */
const defaultWorkspaceBoxes: WorkspaceBox[] = [];

export const defaultState: ProjectState = {
  projectName: defaultAutoProjectName,
  designer: "",
  empresaExecutora: "Carpintaria",
  materiaisProjeto: "",
  tipoProjeto: "Estante de Parede – 3 Portas",
  material: defaultMaterial,
  materialId: "",
  dimensoes: defaultDimensoes,
  quantidade: 1,
  boxes: [],
  selectedBoxId: "",
  workspaceBoxes: defaultWorkspaceBoxes,
  selectedWorkspaceBoxId: "",

  selectedCaixaId: "",
  selectedCaixaModelUrl: null,
  selectedModelInstanceId: null,
  resultados: null,
  ultimaAtualizacao: null,
  lastAutosaveTime: null,
  currentProjectId: null,
  readyForProduction: false,
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
  financeiroOverrides: {},
  financeiroAdminSettings: loadGlobalFinanceiroAdminSettings(),
  activeViewerTool: "select",
  viewerSettings: defaultViewerSettings,
  measurements: createEmptyProjectMeasurements(),
  objectGroups: createEmptyObjectGroups(),
  room: null,
  orlaPresets: normalizeOrlaPresets(undefined),
  drawerPresets: normalizeDrawerPresets(undefined),
  orlaPieces: {},
  pieceObservacoes: {},
  industrialPieceEdits: {},
  industrialOperacoes: {},
  industrialDocumentOverrides: {},
  industrialDocumentHistory: [],
  orlaJuntoPairs: [],
  ferragemOrla: { linhas: [], metrosTotal: 0, custoTotal: 0, porBox: {} },
  remates: [],
  hematis: [],
  rodapes: [],
  autoFill: null,
  ...((): { rulesProfiles: RulesProfilesConfig; rules: ReturnType<typeof normalizeRulesConfig> } => {
    const profiles = loadProfiles();
    return { rulesProfiles: profiles, rules: getRulesFromProfiles(profiles) };
  })(),
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
    const orlaPresets = normalizeOrlaPresets(state.orlaPresets);
    const defaultOrlaId = orlaPresets[0]?.id ?? null;

    // Auto-aplica 1.º preset Admin a caixas sem escolha (undefined). null = "Sem orla".
    const workspaceBoxes = migrateCornerDireitaInferiorBoxes(state.workspaceBoxes).map((b) =>
      b.orlaPresetId === undefined && defaultOrlaId
        ? { ...b, orlaPresetId: defaultOrlaId }
        : b
    );
    const stateSynced = { ...state, workspaceBoxes, orlaPresets };
    // Sincroniza boxes com workspaceBoxes (single source of truth para o viewer e cálculo).
    const boxes = buildBoxesFromWorkspace(stateSynced);
    const stateWithBoxes = { ...stateSynced, boxes };
    const boxesWithCutList = boxes.map((box) => buildBoxDesign(stateWithBoxes, box));
    const resultados =
      boxes.length > 0
        ? calcularResultadosBoxes(stateWithBoxes)
        : calcularProjeto(buildConfig(stateWithBoxes));

    const remateItems = buildRemateCutlistItems(state.remates ?? [], boxesWithCutList);
    const rodapeItems = buildRodapeCutlistItems(state.rodapes ?? [], boxesWithCutList);
    const extraCutListItems = [...remateItems, ...rodapeItems];
    const extrasByBoxId: Record<string, typeof remateItems> = {};
    for (const item of extraCutListItems) {
      const bid = item.boxId ?? "";
      if (!bid) continue;
      (extrasByBoxId[bid] ??= []).push(item);
    }

    const orlaPieces = syncOrlaPiecesForProject(
      boxesWithCutList,
      state.orlaPieces ?? {},
      defaultOrlaId,
      extrasByBoxId,
      orlaPresets
    );
    const ferragemOrla = computeOrlaFerragem({
      boxes: boxesWithCutList,
      orlaPresets,
      orlaPieces,
      orlaJuntoPairs: state.orlaJuntoPairs ?? [],
      extraCutListItems,
    });
    const pieceObservacoes = migrateProjectPieceObservacoes(
      state.pieceObservacoes ?? {},
      boxesWithCutList
    );
    return {
      ...stateWithBoxes,
      orlaPresets,
      orlaPieces,
      resultados,
      ferragemOrla,
      pieceObservacoes,
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

  // Pipeline moderno: cutlistFromBoxes e a unica fonte de pecas parametricas,
  // incluindo gavetas geradas a partir de drawersLayer.
  const cutListComPreco = cutlistComPrecoFromBox(box, prev.rules, prev.materialId);
  const combinedCutList = cutListComPreco;
  const precoTotalPecas = calcularPrecoTotalPecas(cutListComPreco);
  const ferragensBase = buildFerragens(box.prateleiras, box.portaTipo, box.gavetas);
  const peCfg = loadPesPlasticoConfig();
  const peQty = quantidadePesParaCaixa(box, prev.rules);
  const ferragens =
    peCfg.ativo && peQty > 0
      ? [
          ...ferragensBase,
          {
            id: PE_PLASTICO_ID,
            nome: PE_PLASTICO_NOME,
            tipo: "pe_plastico",
            quantidade: peQty,
            precoUnitario: peCfg.precoUnitario,
          },
        ]
      : ferragensBase;

  return {
    ...box,
    ferragens,
    cutList: combinedCutList,
    cutListComPreco,
    estrutura3D: null,
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

export const convertWorkspaceToBox = (box: WorkspaceBox): BoxModule => {
  const panelIds = ensureBoxPanelIds(box.panelIds, {
    prateleiras: box.prateleiras,
    portaTipo: box.portaTipo,
    gavetas: box.gavetas,
    cornerFixedFront: isCornerFixedFrontModel(box.baseCabinetId),
    divisoresCount: box.divisores?.length ?? 0,
    separadoresCount: box.separadores?.length ?? 0,
  });
  return {
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
    cabinetType: box.cabinetType,
    pe_cm: box.pe_cm,
    feetHeight: box.feetHeight,
    feetOffsetFront: box.feetOffsetFront,
    feetEnabled: box.feetEnabled,
    panelIds,
    material: box.material,
    doorsLayer: box.doorsLayer ?? [],
    drawersLayer: box.drawersLayer ?? [],
    drawerHeightMode: box.drawerHeightMode,
    europeanDrawerConfig: box.europeanDrawerConfig,
    divisores: box.divisores ?? [],
    separadores: box.separadores ?? [],
    shelfOptions: box.shelfOptions,
    catalogItemId: box.catalogItemId,
    baseCabinetId: box.baseCabinetId,
    piHideDrawerHoles: box.piHideDrawerHoles === true,
    costaAtiva: box.costaAtiva,
    noBackPanel: box.noBackPanel ?? box.costaAtiva === false,
    costaMaterialId: box.costaMaterialId,
    costaThicknessMm: box.costaThicknessMm,
    separadorMaterialId: box.separadorMaterialId,
    frenteFixaMaterialId: box.frenteFixaMaterialId,
    profundidadeExterna: box.profundidadeExterna,
    orlaPresetId: box.orlaPresetId,
    remateIds: box.remateIds ?? [],
    observacoes: box.observacoes,
    customIndustrialModelId: box.customIndustrialModelId,
    allowPieceRotation: box.allowPieceRotation,
    lockWoodGrain: box.lockWoodGrain,
  };
};

export const buildBoxesFromWorkspace = (state: ProjectState): BoxModule[] => {
  return state.workspaceBoxes.map((box) => convertWorkspaceToBox(box));
};

/** Caixas com cutlist paramétrica calculada (para orla, exports, etc.). */
export const buildBoxesWithCutList = (state: ProjectState): BoxModule[] => {
  const boxes = buildBoxesFromWorkspace(state);
  return boxes.map((box) => buildBoxDesign(state, box));
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
      let largura = 0;
      let altura = 0;
      let profundidade = 0;
      for (const p of parts) {
        const d = p.dimensoes;
        if (d.largura > largura) largura = d.largura;
        if (d.altura > altura) altura = d.altura;
        if (d.profundidade > profundidade) profundidade = d.profundidade;
      }
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
  const allRemates = buildRemateCutlistItems(prev.remates ?? [], boxes);
  const allRodapes = buildRodapeCutlistItems(prev.rodapes ?? [], boxes);
  const cutListComPreco = [...allParametric, ...allExtracted, ...allRemates, ...allRodapes];
  const precoTotalPecas = calcularPrecoTotalPecas(cutListComPreco);
  const precoProjetoBase = precoTotalPecas + precoTotalAcessorios;
  const precoTotalProjeto = calcularPrecoTotalProjeto(precoProjetoBase);

  const ruleViolations = computeRuleViolations(prev);
  const layoutWarnings = computeLayoutWarningsFromState(prev);
  const now = new Date();

  return {
    boxes,
    design: {
      cutList: cutListComPreco,
      estrutura3D: selectedDesign.estrutura3D,
      acessorios: selectedDesign.ferragens,
      timestamp: now,
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
    ultimaAtualizacao: now,
    estaCarregando: false,
    erro: null,
  };
};
