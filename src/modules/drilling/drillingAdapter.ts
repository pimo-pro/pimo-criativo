import type {
  CutListItem,
  DrillFace,
  DrillPanelKey,
  DrillType,
  OperationResult,
  PanelDrillHole,
  TechnicalDrillHole,
  ViewerDrillMarkersByPanel,
} from "../../core/types";
import type { RulesConfig } from "../../core/rules/rulesConfig";
import {
  getNumDobradicas,
  MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM,
  getHingeYPositions,
  normalizeRulesConfig,
} from "../../core/rules/rulesConfig";
import { getSettings } from "../../core/settings/settingsService";
import type { PieceType } from "../../core/drilling/drillingService";
import { calculateTechnicalDrillingsForPiece, drillFaceToPanelFace, isTopDrillable } from "../../core/drilling/drillingService";
import { devLogger } from "../../utils/devLogger";
import { isIndustrialDoorPanelTipo } from "../../core/doors/industrialDoorPanels";

export type PanelDrillingInput = {
  tipo: string;
  larguraMm: number;
  alturaMm: number;
  espessuraMm: number;
  /** Contexto do módulo: há prateleiras paramétricas. */
  hasShelves?: boolean;
  /** Modo explícito de prateleiras: standard = motor lateral; div = modo DIV/SEP. */
  shelfMode?: "standard" | "div";
  /** Contexto do módulo: há gavetas (qualquer tipo). */
  hasDrawers?: boolean;
  doorHeightMm?: number;
  /** Largura da porta (mm). Para hingeSide top/bottom: posições ao longo da largura; usado em cima/fundo para copiar da porta. */
  doorWidthMm?: number;
  /**
   * Altura do vão (abertura) do caixote em mm.
   * Este é o eixo global onde as dobradiças devem alinhar (porta e laterais).
   */
  openingHeightMm?: number;
  /** Folga inferior da porta dentro do vão (mm). */
  bottomGapMm?: number;
  /** Folga superior da porta dentro do vão (mm). */
  topGapMm?: number;
  hingeSide?: "left" | "right" | "top" | "bottom";
  /**
   * Posições das dobradiças (mm) já calculadas na porta (fonte primária).
   * - Laterais (left/right): lista de offsets a partir da base do móvel (mm)
   * - Cima/Fundo (top/bottom): lista de X (mm)
   *
   * Quando fornecido, o painel deve copiar SEM recalcular.
   */
  hingePositionsMm?: number[];
  /**
   * Contexto do módulo (ex.: cutlist): necessário para permitir furos de dobradiça em laterais.
   * Sem ambos definidos, laterais não geram hingePositions nem dobradica_fixacao / parafuso_uniao.
   */
  portaTipo?: "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr";
  /** Tamanho de doorsLayer no módulo (número de folhas/itens). */
  doorsLayerCount?: number;
  handleType?: string;
  handleProfileId?: string;
  handleCenterDistanceMm?: number;
  handlePosition?: "Centro" | "Topo" | "Inferior" | "Percentual";
  handlePositionPercent?: number;
  handleOffsetXMm?: number;
  handleOffsetYMm?: number;
  handleOffsetMm?: number;
  slideType?: string;
  metalBoxType?: string;
  metalBoxProfileId?: string;
  metalBoxHeightMm?: number;
  softClose?: boolean;
  /** Gaveta mais baixa do módulo — pino inferior a 41 mm da base da frente. */
  isLowestDrawer?: boolean;
  /** Gaveta mais alta do módulo (flush à CIMA). */
  isHighestDrawer?: boolean;
  /** Papel no stack (`lowest` | `highest` | `middle` | `single`). */
  drawerStackRole?: string;
  drawerSideHeightMm?: number;
  drawerBodyWidthMm?: number;
  drawerSideThicknessMm?: number;
  drawerBottomThicknessMm?: number;
  drawerBottomWidthMm?: number;
  drawerSideBaseElevationMm?: number;
};

export type PanelDrillingOutput = {
  drillHoles: PanelDrillHole[];
};

const EMPTY_VIEWER_DRILL_MARKERS: ViewerDrillMarkersByPanel = {
  cima: [],
  fundo: [],
  lateral_esquerda: [],
  lateral_direita: [],
  porta: [],
  portaPerDoor: [],
  frente_fixa: [],
  separadoresById: {},
  divisoresById: {},
};

const SEP_EDGE_EPS_MM = 0.5;

/** Converte furos do SEP para o viewer 3D (cavilhas na espessura = faces esquerda/direita; face inferior = fundo). */
export function panelSeparadorDrillHoleToTechnical(
  h: PanelDrillHole,
  larguraMm: number
): TechnicalDrillHole {
  const holeType = (h.holeType ?? "cavilha") as DrillType;
  let face: DrillFace = "fundo";
  if (holeType === "cavilha" && h.topDrillable === false) {
    if (h.x <= SEP_EDGE_EPS_MM) face = "esquerda";
    else if (h.x >= larguraMm - SEP_EDGE_EPS_MM) face = "direita";
  } else if (holeType === "cavilha" && h.topDrillable === true) {
    face = "fundo";
  }
  return {
    x: h.x,
    y: h.y,
    diametro: h.diameter,
    profundidade: h.depth,
    tipo: holeType,
    face,
  };
}

/** Converte furos do DIV para o viewer 3D (A = direita, B = esquerda do painel). */
export function panelDivisorDrillHoleToTechnical(h: PanelDrillHole): TechnicalDrillHole {
  return {
    x: h.x,
    y: h.y,
    diametro: h.diameter,
    profundidade: h.depth,
    tipo: (h.holeType ?? "parafuso") as DrillType,
    face: h.face === "A" ? "direita" : "esquerda",
  };
}

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function toFiniteNumber(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/** Laterais: só dobradiça quando há porta real no módulo e hingeSide definido (cutlist passa portaTipo + doorsLayerCount). */
function lateralModuleAllowsHingeDrilling(input: PanelDrillingInput): boolean {
  if (input.portaTipo === undefined || input.doorsLayerCount === undefined) return false;
  if (input.portaTipo === "sem_porta" || input.doorsLayerCount <= 0) return false;
  return input.hingeSide !== undefined;
}

/**
 * Limita offsets ao longo de um eixo (altura da porta ou largura em abertura top/bottom):
 * valores são mm a partir da borda "base" do eixo (base da porta = fundo; esquerda ao longo da largura).
 * drillingService converte para coordenadas do painel (Y topo→baixo) com y = dimensão - offset.
 */
function sanitizeHingeOffsetsFromEdge(
  positions: number[] | undefined,
  axisLenMm: number,
  distEntreFurosCalcoMm: number
): number[] {
  if (!Array.isArray(positions) || !Number.isFinite(axisLenMm) || axisLenMm <= 0) return [];
  const margin = MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM;
  const halfFixationDist = Math.max(0, distEntreFurosCalcoMm / 2);
  const minO = margin + halfFixationDist;
  const maxO = Math.max(minO, axisLenMm - margin - halfFixationDist);

  return positions
    .map((o) => Number(o))
    .filter((o) => Number.isFinite(o))
    .map((o) => clampNumber(o, minO, maxO));
}

/** Posições X (mm) para furação top/bottom: porta = master, painel cima/fundo copia. Lógica paralela à de altura da porta, ao longo da largura. */
function getHingePositionsFromDoorWidth(
  rules: RulesConfig,
  doorWidthMm: number,
  panelWidthMm: number
): number[] {
  if (!Number.isFinite(doorWidthMm) || doorWidthMm <= 0) return [];
  const numHinges = getNumDobradicas(doorWidthMm, rules);
  const doorPositions = getHingeYPositions(doorWidthMm, numHinges, rules);
  if (doorPositions.length === 0) return [];
  if (!Number.isFinite(panelWidthMm) || panelWidthMm <= 0) return doorPositions;

  const margem = MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM;
  const xMinPanel = margem;
  const xMaxPanel = Math.max(xMinPanel, panelWidthMm - margem);
  const distEntreCalco = rules.furos?.tecnicos?.dobradica_fixacao?.distanciaEntreFurosCalco ?? 32;
  const halfDistHoles = distEntreCalco / 2;
  const xMinSafe = xMinPanel + halfDistHoles;
  const xMaxSafe = Math.max(xMinSafe, xMaxPanel - halfDistHoles);

  const centerOffset = (panelWidthMm - doorWidthMm) / 2;
  return doorPositions.map((x) => Math.max(xMinSafe, Math.min(xMaxSafe, x + centerOffset)));
}

/** Converte furação técnica em furos reais do painel (face A/B via drillingService — docs/matriz-faces-A-B-FINAL.md). */
function toPanelDrillHoles(furacoesTecnicas: TechnicalDrillHole[], pieceType: PieceType): PanelDrillHole[] {
  return furacoesTecnicas.map((h) => {
    const holeType = h.tipo as DrillType;
    const topByFace = isTopDrillable(h.face);
    const topDrillable =
      topByFace ||
      h.topDrillable === true ||
      holeType === "dobradica" ||
      holeType === "dobradica_fixacao" ||
      holeType === "dobradica_parafuso_uniao" ||
      holeType === "prateleira" ||
      holeType === "puxador" ||
      holeType === "fixacao_metalica";
    const base: PanelDrillHole = {
      x: h.x,
      y: h.y,
      diameter: h.diametro,
      depth: h.profundidade,
      holeType,
      face: drillFaceToPanelFace(h.face, pieceType),
      topDrillable,
    };
    if (h.holeSubtype === "groove") {
      base.holeSubtype = "groove";
      if (h.grooveWidth != null) base.grooveWidth = h.grooveWidth;
      if (h.grooveLength != null) base.grooveLength = h.grooveLength;
      if (h.grooveFullPanelOvercut === true) base.grooveFullPanelOvercut = true;
      if (h.grooveCorrection != null) base.grooveCorrection = h.grooveCorrection;
      if (h.grooveToolName) base.grooveToolName = h.grooveToolName;
    }
    if (h.pairedHoleKey) base.pairedHoleKey = h.pairedHoleKey;
    if (h.holeCatalogId) base.holeCatalogId = h.holeCatalogId;
    if (h.ferragemId) base.ferragemId = h.ferragemId;
    return base;
  });
}

export function buildEffectiveDrillingRules(rules: RulesConfig): RulesConfig {
  const normalizedRules = normalizeRulesConfig(rules);
  const settings = getSettings();
  const fu = settings?.furação;
  if (!fu?.parafuso || !fu?.prateleira || !fu?.dobradica) return normalizedRules;

  const pr = fu.prateleira;
  const df = fu.dobradicaFixacao;
  const minFuros = clampNumber(toFiniteNumber(pr.minFuros, normalizedRules.furos.tecnicos.prateleira.minFurosPorColuna), 2, 100);
  const maxFurosRaw = clampNumber(toFiniteNumber(pr.maxFuros, normalizedRules.furos.tecnicos.prateleira.maxFurosPorColuna), 2, 100);
  const maxFuros = Math.max(minFuros, maxFurosRaw);
  const distanciaDaBordaPrateleira = clampNumber(
    toFiniteNumber(pr.distanciaDaBorda, normalizedRules.furos.tecnicos.prateleira.distanciaDaBorda),
    5,
    120
  );

  // Distâncias de parafuso/cavilha vêm das configurações globais. sideOffset só se definido manualmente; caso contrário o motor usa espessura/2.
  const parafusoFront = toFiniteNumber(fu.parafuso.frontDistance, 90);
  const parafusoBack = toFiniteNumber(fu.parafuso.backDistance, 90);
  const parafusoSideExplicit =
    fu.parafuso.sideOffset != null &&
    Number.isFinite(Number(fu.parafuso.sideOffset)) &&
    Number(fu.parafuso.sideOffset) > 0
      ? Number(fu.parafuso.sideOffset)
      : undefined;
  const cavilhaFront = toFiniteNumber(fu.cavilha?.frontDistance, 60);
  const cavilhaBack = toFiniteNumber(fu.cavilha?.backDistance, 60);
  const cavilhaSideExplicit =
    fu.cavilha?.sideOffset != null &&
    Number.isFinite(Number(fu.cavilha.sideOffset)) &&
    Number(fu.cavilha.sideOffset) > 0
      ? Number(fu.cavilha.sideOffset)
      : undefined;

  const { sideOffset: _dropParafusoSo, ...parafusoNorm } = normalizedRules.furos.tecnicos.parafuso;
  const { sideOffset: _dropCavilhaSo, ...cavilhaNorm } = normalizedRules.furos.tecnicos.cavilha;

  return {
    ...normalizedRules,
    furos: {
      ...normalizedRules.furos,
      tecnicos: {
        ...normalizedRules.furos.tecnicos,
        parafuso: {
          ...parafusoNorm,
          distanciaFrente: parafusoFront,
          distanciaFundo: parafusoBack,
          offsetDaBorda: fu.parafuso.offsetDaBorda,
          ...(parafusoSideExplicit != null ? { sideOffset: parafusoSideExplicit } : {}),
        },
        cavilha: {
          ...cavilhaNorm,
          distanciaFrente: cavilhaFront,
          distanciaFundo: cavilhaBack,
          ...(cavilhaSideExplicit != null ? { sideOffset: cavilhaSideExplicit } : {}),
        },
        prateleira: {
          ...normalizedRules.furos.tecnicos.prateleira,
          margemTopo: pr.margemTop,
          margemBase: pr.margemBottom,
          margemFrente: distanciaDaBordaPrateleira,
          margemFundo: distanciaDaBordaPrateleira,
          minFurosPorColuna: minFuros,
          maxFurosPorColuna: maxFuros,
          espacamentoVertical: pr.espacamentoVertical,
          distanciaDaBorda: distanciaDaBordaPrateleira,
        },
        dobradica: {
          ...normalizedRules.furos.tecnicos.dobradica,
          distanciaCentroDaBorda: toFiniteNumber(fu.dobradica.distanciaCentroDaBorda, normalizedRules.furos.tecnicos.dobradica.distanciaCentroDaBorda) || 22.5,
          distanciaDobradiçaTopo: fu.dobradica.distanciaDobradiçaTopo,
          distanciaDobradiçaFundo: fu.dobradica.distanciaDobradiçaFundo,
          numeroPorPorta: Math.max(2, fu.dobradica.numeroPorPorta ?? normalizedRules.furos.tecnicos.dobradica.numeroPorPorta ?? 2),
          distribuicaoAutomatica:
            fu.dobradica.distribuicaoAutomatica ?? normalizedRules.furos.tecnicos.dobradica.distribuicaoAutomatica ?? true,
        },
        ...(df && {
          dobradica_fixacao: {
            ...normalizedRules.furos.tecnicos.dobradica_fixacao,
            distanciaDaBordaCalco: clampNumber(
              toFiniteNumber(df.distanciaDaBordaCalco, normalizedRules.furos.tecnicos.dobradica_fixacao.distanciaDaBordaCalco),
              10,
              80
            ),
            // Parafuso união: sempre 53 mm (padrão ferragem). Valor 60 = legado (regra de prateleira) → forçar 53.
            distanciaDaBordaParafusoUniao: (() => {
              const v = toFiniteNumber(
                df.distanciaDaBordaParafusoUniao,
                normalizedRules.furos.tecnicos.dobradica_fixacao.distanciaDaBordaParafusoUniao
              );
              const legacyShelf = Math.abs(v - 60) < 1;
              return clampNumber(legacyShelf ? 53 : (v || 53), 20, 120);
            })(),
            distanciaEntreFurosCalco:
              df.distanciaEntreFurosCalco ?? normalizedRules.furos.tecnicos.dobradica_fixacao.distanciaEntreFurosCalco,
            profundidadeFuro: df.profundidadeFuro,
            diametro: df.diametro ?? normalizedRules.furos.tecnicos.dobradica_fixacao.diametro,
            diametroParafusoUniao:
              df.diametroParafusoUniao ?? normalizedRules.furos.tecnicos.dobradica_fixacao.diametroParafusoUniao,
            profundidadeParafusoUniao:
              df.profundidadeParafusoUniao ?? normalizedRules.furos.tecnicos.dobradica_fixacao.profundidadeParafusoUniao,
          },
        }),
      },
    },
  };
}

export function buildPanelDrilling(
  input: PanelDrillingInput,
  rules: RulesConfig
): PanelDrillingOutput {
  const result = buildPanelDrillingResult(input, rules);
  return result.success ? result.data ?? { drillHoles: [] } : { drillHoles: [] };
}

export function buildPanelDrillingResult(
  input: PanelDrillingInput,
  rules: RulesConfig
): OperationResult<PanelDrillingOutput> {
  if (!Number.isFinite(input.larguraMm) || !Number.isFinite(input.alturaMm) || !Number.isFinite(input.espessuraMm)) {
    return { success: false, error: "Dimensões inválidas para cálculo de furação." };
  }

  const isLateral = input.tipo === "lateral_esquerda" || input.tipo === "lateral_direita";
  const isFixedFront = input.tipo === "frente_fixa";
  const isDoor = isIndustrialDoorPanelTipo(input.tipo);
  const isTopPanel = input.tipo === "cima";
  const isBottomPanel = input.tipo === "fundo";
  const distEntreFixacao = rules.furos.tecnicos.dobradica_fixacao.distanciaEntreFurosCalco;
  // Regras da Porta (Configuração de Regras → Regras da Porta): número de dobradiças por altura/largura da porta.
  const numHingesForDoor = isDoor
    ? (input.hingeSide === "top" || input.hingeSide === "bottom"
        ? getNumDobradicas(input.larguraMm, rules)
        : getNumDobradicas(input.alturaMm, rules))
    : 0;
  const numHinges = isDoor ? numHingesForDoor : rules.furos.tecnicos.dobradica.numeroPorPorta;

  let hingePositions: number[] = [];
  const openingHeightMm =
    Number.isFinite(input.openingHeightMm) && Number(input.openingHeightMm) > 0
      ? Number(input.openingHeightMm)
      : input.alturaMm;
  // Folgas podem ser negativas (porta overlay maior que o vão físico do painel lateral).
  const bottomGapMm = Number(input.bottomGapMm ?? 0);
  // topGapMm é usado apenas para reconstrução de eixo global no caller; aqui não é necessário.

  // Porta é sempre a fonte primária: se posições vierem do upstream, apenas copiar.
  if (Array.isArray(input.hingePositionsMm) && input.hingePositionsMm.length > 0) {
    const refLenMm =
      input.hingeSide === "top" || input.hingeSide === "bottom" ? input.larguraMm : openingHeightMm;
    const globalOffsets = sanitizeHingeOffsetsFromEdge(input.hingePositionsMm, refLenMm, distEntreFixacao);
    // Converter offsets globais do vão para offsets locais da peça.
    // Porta flutua no vão → offsetLocal = offsetGlobal - bottomGap.
    if (isDoor && (input.hingeSide === "left" || input.hingeSide === "right")) {
      hingePositions = globalOffsets.map((o) => o - bottomGapMm);
    } else {
      // Laterais representam o próprio vão (openingHeightMm deve bater com a altura do painel lateral).
      hingePositions = globalOffsets;
    }
  } else if (isDoor) {
    /* Porta: top/bottom = posições ao longo da largura (X); left/right = ao longo da altura (Y). */
    if (input.hingeSide === "top" || input.hingeSide === "bottom") {
      const rawDoorHinges = getHingeYPositions(input.larguraMm, numHinges, rules);
      hingePositions = sanitizeHingeOffsetsFromEdge(rawDoorHinges, input.larguraMm, distEntreFixacao);
    } else {
      // Offsets SEMPRE em relação ao vão (openingHeightMm), não à altura isolada da porta.
      const rawGlobal = getHingeYPositions(openingHeightMm, numHinges, rules);
      const globalOffsets = sanitizeHingeOffsetsFromEdge(rawGlobal, openingHeightMm, distEntreFixacao);
      hingePositions = globalOffsets.map((o) => o - bottomGapMm);
    }
  } else if (isLateral || isFixedFront) {
    if (isLateral && !lateralModuleAllowsHingeDrilling(input)) {
      hingePositions = [];
    } else if (Array.isArray(input.hingePositionsMm) && input.hingePositionsMm.length > 0) {
      hingePositions = sanitizeHingeOffsetsFromEdge(input.hingePositionsMm, openingHeightMm, distEntreFixacao);
    } else if (isFixedFront) {
      hingePositions = [];
    } else {
      const raw = getHingeYPositions(openingHeightMm, Math.max(2, getNumDobradicas(openingHeightMm, rules)), rules);
      hingePositions = sanitizeHingeOffsetsFromEdge(raw, openingHeightMm, distEntreFixacao);
    }
  } else if ((isTopPanel && input.hingeSide === "top") || (isBottomPanel && input.hingeSide === "bottom")) {
    /* Painel cima/fundo: posições X copiadas da largura da porta (porta = master). Fallback: usar largura do painel. */
    const refWidthMm = Number.isFinite(input.doorWidthMm) ? Number(input.doorWidthMm) : input.larguraMm;
    if (Number.isFinite(refWidthMm) && refWidthMm > 0) {
      const panelPositions = getHingePositionsFromDoorWidth(rules, refWidthMm, input.larguraMm);
      hingePositions = sanitizeHingeOffsetsFromEdge(panelPositions, input.larguraMm, distEntreFixacao);
    }
  }

  if (isLateral && !lateralModuleAllowsHingeDrilling(input)) {
    hingePositions = [];
  }
  if (isFixedFront && hingePositions.length === 0 && Array.isArray(input.hingePositionsMm) && input.hingePositionsMm.length > 0) {
    hingePositions = sanitizeHingeOffsetsFromEdge(input.hingePositionsMm, openingHeightMm, distEntreFixacao);
  }

  // Furos de prateleira: regra existente do motor (desativar quando há gavetas no mesmo módulo).
  // Para roupeiros (gavetas só na zona inferior), o upstream deve passar hasDrawers=false
  // ao calcular as furações das prateleiras.
  const shelfHolesEnabled = input.hasShelves === true && !input.hasDrawers;

  let furacoesTecnicas: TechnicalDrillHole[] = [];
  try {
    furacoesTecnicas = calculateTechnicalDrillingsForPiece(
      {
        tipo: input.tipo,
        largura: input.larguraMm,
        altura: input.alturaMm,
        espessura: input.espessuraMm,
        handleType: input.handleType,
        handleProfileId: input.handleProfileId,
        handleCenterDistanceMm: input.handleCenterDistanceMm,
        handlePosition: input.handlePosition,
        handlePositionPercent: input.handlePositionPercent,
        handleOffsetXMm: input.handleOffsetXMm,
        handleOffsetYMm: input.handleOffsetYMm,
        handleOffsetMm: input.handleOffsetMm,
        slideType: input.slideType,
        metalBoxType: input.metalBoxType,
        metalBoxProfileId: input.metalBoxProfileId,
        metalBoxHeightMm: input.metalBoxHeightMm,
        softClose: input.softClose,
        isLowestDrawer: input.isLowestDrawer,
        isHighestDrawer: input.isHighestDrawer,
        drawerStackRole: input.drawerStackRole,
        drawerSideHeightMm: input.drawerSideHeightMm,
        drawerBodyWidthMm: input.drawerBodyWidthMm,
        drawerSideThicknessMm: input.drawerSideThicknessMm,
        drawerBottomThicknessMm: input.drawerBottomThicknessMm,
        drawerBottomWidthMm: input.drawerBottomWidthMm,
        drawerSideBaseElevationMm: input.drawerSideBaseElevationMm,
        shelfHolesEnabled,
        shelfMode: input.shelfMode,
        hingeSide: input.hingeSide,
        hingePositionsMm: hingePositions.length > 0 ? hingePositions : undefined,
      },
      rules
    );
  } catch (err) {
      devLogger.warn(`[drillingAdapter] Error generating technical holes for ${input.tipo}:`, err);
    return { success: false, error: `Erro ao gerar furação para painel ${input.tipo}.` };
  }

  return {
    success: true,
    data: {
      drillHoles: toPanelDrillHoles(furacoesTecnicas, input.tipo as PieceType),
    },
  };
}

export function buildViewerDrillMarkersByPanel(cutList: CutListItem[] | undefined): ViewerDrillMarkersByPanel {
  const result = buildViewerDrillMarkersByPanelResult(cutList);
  return result.success ? result.data ?? EMPTY_VIEWER_DRILL_MARKERS : EMPTY_VIEWER_DRILL_MARKERS;
}

/** Converte PanelDrillHole[] em TechnicalDrillHole[] para o viewer (face padrão por painel). */
function panelDrillHolesToTechnical(
  holes: PanelDrillHole[] | undefined,
  defaultFace: DrillFace
): TechnicalDrillHole[] {
  if (!holes?.length) return [];
  return holes.map((h) => ({
    x: h.x,
    y: h.y,
    diametro: h.diameter,
    profundidade: h.depth,
    tipo: (h.holeType ?? "parafuso") as DrillType,
    face: defaultFace,
  }));
}

export function buildViewerDrillMarkersByPanelResult(
  cutList: CutListItem[] | undefined
): OperationResult<ViewerDrillMarkersByPanel> {
  if (!Array.isArray(cutList) || cutList.length === 0) {
    return { success: true, data: EMPTY_VIEWER_DRILL_MARKERS };
  }

  if (import.meta.env.DEV) {
    // Log cutlist recebido
    devLogger.debug("[DRILL-DIAG] buildViewerDrillMarkersByPanelResult: cutList recebido", cutList.map(item => ({
      id: item.id,
      tipo: item.tipo,
      drillHoles: item.drillHoles,
    })));
  }

  const byType = new Map(cutList.map((item) => [item.tipo, item]));
  const doorItemsInOrder = cutList.filter((item) => isIndustrialDoorPanelTipo(item.tipo));
  const firstDoorItem = doorItemsInOrder[0];
  const canonicalDoorItem =
    cutList.find((item) => item.tipo === "porta_dupla" && /-(2|02)$/.test(String(item.id ?? ""))) ?? firstDoorItem;

  /** Filtra furos da face externa (A): no Viewer mostramos apenas os da face interna (B). */
  const onlyInternalFaceHoles = (holes: PanelDrillHole[]): PanelDrillHole[] =>
    holes.filter((h) => h.face !== "A");

  const portaPerDoor: TechnicalDrillHole[][] = doorItemsInOrder.map((item) =>
    item?.drillHoles?.length
      ? panelDrillHolesToTechnical(onlyInternalFaceHoles(item.drillHoles), "tras")
      : []
  );
  const portaMerged =
    canonicalDoorItem?.drillHoles?.length
      ? panelDrillHolesToTechnical(onlyInternalFaceHoles(canonicalDoorItem.drillHoles), "tras")
      : portaPerDoor[0] ?? [];

  const getHolesFor = (tipo: DrillPanelKey): TechnicalDrillHole[] => {
    if (tipo === "porta") return portaMerged;
    const item = byType.get(tipo);
    if (!item?.drillHoles?.length) return [];
    if (tipo === "lateral_esquerda" || tipo === "lateral_direita") {
      const holesToUse = onlyInternalFaceHoles(item.drillHoles);
      const lateralFace: DrillFace = tipo === "lateral_esquerda" ? "direita" : "esquerda";
      return holesToUse.map((h) => {
        if (h.holeType === "cavilha" && h.topDrillable === false) {
          return {
            x: h.x,
            y: h.y,
            diametro: h.diameter,
            profundidade: h.depth,
            tipo: "cavilha" as DrillType,
            face: lateralFace,
          };
        }
        const xForViewer =
          tipo === "lateral_direita" &&
          (h.holeType === "dobradica_fixacao" || h.holeType === "dobradica" || h.holeType === "dobradica_parafuso_uniao")
            ? item.dimensoes.largura - h.x
            : h.x;
        return {
          x: xForViewer,
          y: h.y,
          diametro: h.diameter,
          profundidade: h.depth,
          tipo: (h.holeType ?? "parafuso") as DrillType,
          face: lateralFace,
        };
      });
    }
    const face: DrillFace =
      tipo === "cima" ? "fundo" : tipo === "fundo" ? "cima" : tipo === "lateral_esquerda" ? "direita" : "esquerda";
    // Modelo unificado (docs/matriz-faces-A-B-FINAL.md): Viewer mostra apenas face interna (B) em todos os painéis.
    const holesToUse = onlyInternalFaceHoles(item.drillHoles);
    return panelDrillHolesToTechnical(holesToUse, face);
  };

  const frenteFixaItem = byType.get("frente_fixa");
  const frente_fixa =
    frenteFixaItem?.drillHoles?.length
      ? onlyInternalFaceHoles(frenteFixaItem.drillHoles).map((h) => ({
          x: h.x,
          y: h.y,
          diametro: h.diameter,
          profundidade: h.depth,
          tipo: (h.holeType ?? "cavilha") as DrillType,
          face: "frente" as DrillFace,
        }))
      : [];

  const separadoresById: Record<string, TechnicalDrillHole[]> = {};
  for (const item of cutList) {
    if (item.tipo !== "separador" || !item.drillHoles?.length) continue;
    const panelId = String(item.metadata?.panelId ?? item.id);
    const larguraMm = Number(item.dimensoes?.largura) || 0;
    separadoresById[panelId] = onlyInternalFaceHoles(item.drillHoles).map((h) =>
      panelSeparadorDrillHoleToTechnical(h, larguraMm)
    );
  }

  const divisoresById: Record<string, TechnicalDrillHole[]> = {};
  for (const item of cutList) {
    if (item.tipo !== "divisorio" || !item.drillHoles?.length) continue;
    const panelId = String(item.metadata?.panelId ?? item.id);
    // Prateleiras no DIV: face A/B indica o lado (direita/esquerda); não filtrar face A.
    divisoresById[panelId] = item.drillHoles.map((h) => panelDivisorDrillHoleToTechnical(h));
  }

  const result = {
    cima: getHolesFor("cima"),
    fundo: getHolesFor("fundo"),
    lateral_esquerda: getHolesFor("lateral_esquerda"),
    lateral_direita: getHolesFor("lateral_direita"),
    porta: portaMerged,
    portaPerDoor: portaPerDoor.length > 0 ? portaPerDoor : undefined,
    frente_fixa,
    separadoresById: Object.keys(separadoresById).length > 0 ? separadoresById : undefined,
    divisoresById: Object.keys(divisoresById).length > 0 ? divisoresById : undefined,
  };
  if (import.meta.env.DEV) {
    // Log resultado do mapeamento
    devLogger.debug("[DRILL-DIAG] buildViewerDrillMarkersByPanelResult: drillMarkersByPanel gerado", result);
  }
  return {
    success: true,
    data: result,
  };
}
