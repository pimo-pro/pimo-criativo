/**
 * DrawerDrillingRules — FASE 3
 * Fonte única de regras de furação de corrediças (moderno + PI).
 * Não altera geometria das peças — apenas coordenadas de furos.
 */

import type { PieceType } from "../../drilling/drillingService";
import { defaultRulesConfig, type RulesConfig } from "../../rules/rulesConfig";
import type { PanelDrillHole, TechnicalDrillHole } from "../../types";
import {
  settingsDefaults,
  type DrawerMetalBoxType,
  type DrawerSlideType,
  type SettingsSchema,
} from "../../settings/settingsSchema";
import { getSettings } from "../../settings/settingsService";
import type { DrillFace } from "../../types";
import {
  isMetalBoxCatalogType,
  normalizeDrawerMetalBoxType,
  resolveMetalBoxProfile,
} from "../drawerMetalBoxCatalog";
import {
  clampHoleToPanel,
  mirrorSlideHoleXFromFront,
  MODULE_SLIDE_EDGE_SETBACK_MM,
  MODULE_SLIDE_MARK_DEPTH_MM,
  resolveSlideDrillingPattern,
  type ResolvedSlideDrillingPattern,
  type SlideDrillingHoleDef,
} from "./drawerSlideDrillingCatalog";
import { DRAWER_VERTICAL_BASE_OFFSET_MM } from "../drawerVerticalPosition";
import {
  DRAWER_BOTTOM_GROOVE_DEPTH_EXTRA_MM,
  DRAWER_BOTTOM_GROOVE_WIDTH_MM,
  DRAWER_BOTTOM_GROOVE_Y_FROM_TOP_MM,
  DRAWER_LAT_GROOVE_BOTTOM_DEPTH_MM,
  DRAWER_LAT_GROOVE_BOTTOM_FROM_TOP_MM,
  DRAWER_LAT_GROOVE_BOTTOM_WIDTH_MM,
  DRAWER_LAT_GROOVE_CORRECTION,
  DRAWER_LAT_GROOVE_TOOL_NAME,
  DRAWER_LAT_GROOVE_TOP_DEPTH_MM,
  DRAWER_LAT_GROOVE_TOP_FROM_TOP_MM,
  DRAWER_LAT_GROOVE_TOP_WIDTH_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM,
  DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM,
  DRAWER_LOWEST_FRONT_GROOVE_X_INSET_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
} from "../drawerGeometryConstants";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_EDGE_HOLE_TYPE_ID,
  CAVILHA_FACE_HOLE_TYPE_ID,
} from "../../drill/cavilha10x40Rule";
import type { DrawerStackRole } from "../drawerStackPosition";
import {
  clampDrawerFaceDowelDepthMm,
  DRAWER_DOWEL_DIAMETER_MM,
  DRAWER_DOWEL_EDGE_DEPTH_MM,
  DRAWER_LAT_GUIDE_DEPTH_MM,
  DRAWER_LAT_GUIDE_DIAMETER_MM,
  DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM,
  drawerThicknessCenterMm,
  getDrawerCostaDowelYPositionsMm,
  getDrawerFrontDowelYPositionsMm,
  getDrawerLateralEdgeDowelYPositionsMm,
  getDrawerLateralGuideXPositionsMm,
  getDrawerLateralGuideYPositionsMm,
  getDrawerLateralTransversalDowelYPositionsMm,
} from "./drawerDowelInterlock";

export {
  DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM,
  clampDrawerEdgeDowelDepthMm,
  clampDrawerFaceDowelDepthMm,
  DRAWER_DOWEL_DIAMETER_MM,
  DRAWER_DOWEL_FACE_DEPTH_MM,
  DRAWER_DOWEL_EDGE_DEPTH_MM,
  DRAWER_REAR_DOWEL_Y_FROM_BOTTOM_MM,
  getDrawerFrontDowelYPositionsMm,
  getDrawerRearDowelYPositionsMm,
  drawerThicknessCenterMm,
} from "./drawerDowelInterlock";

export type DrawerDrillingMode = "drawer_piece" | "pi_module_lateral";

export type DrawerDrillingContext = {
  slideType?: string;
  metalBoxType?: string;
  softClose?: boolean;
  drawerCount?: number;
  mode?: DrawerDrillingMode;
  corredicaConfig?: RulesConfig["furos"]["tecnicos"]["corredica"];
  gavetasSettings?: SettingsSchema["gavetas"];
  /** Profundidade do painel lateral (mm) — resolve comprimento/padrão X. */
  panelDepthMm?: number;
  /** Comprimento de corrediça forçado (mm). */
  slideLengthMm?: number;
  /** Altura do painel (mm) — clamp Y. */
  panelHeightMm?: number;
};

export type DrawerSlideDrillingRules = {
  enabled: boolean;
  slideType: string;
  metalBoxType: string;
  softClose: boolean;
  skipLateralWoodPieces: boolean;
  skipCorredicaOnDrawerPieces: boolean;
  yLineMode: "single_from_bottom" | "pi_runner_lines";
  offsetFrenteMm: number;
  offsetFundoMm: number;
  offsetMarkMm: number;
  alturaRelativaFundoMm: number;
  offsetVerticalAdicionalMm: number;
  softCloseVerticalOffsetMm: number;
  diametroMm: number;
  profundidadeMm: number;
  profundidadeMarkMm: number;
  mirrorLeftRight: boolean;
  /** Comprimento industrial resolvido. */
  slideLengthMm: number;
  /** Padrão X a partir da frente (catálogo por slideType). */
  holePatternFromFront: SlideDrillingHoleDef[];
  patternSource: string;
};

export type DrawerCorredicaHoleSpec = {
  x: number;
  y: number;
  diametro: number;
  profundidade: number;
  face: DrillFace;
  isMarkOnly?: boolean;
};

const PI_LEGACY_REAR_X = 293;
const PI_LEGACY_MARK_X = 69;
const PI_LEGACY_FRONT_X = 37;

function clampMm(value: number, min: number, max?: number): number {
  const v = Number.isFinite(value) ? value : min;
  if (max != null) return Math.min(max, Math.max(min, v));
  return Math.max(min, v);
}

function normalizeMetalBoxType(value?: string): DrawerMetalBoxType {
  return normalizeDrawerMetalBoxType(value);
}

function isMetalBoxEnabled(metalBoxType?: string): boolean {
  return isMetalBoxCatalogType(metalBoxType);
}

function resolveSlideType(
  slideType?: string,
  gavetas?: SettingsSchema["gavetas"]
): DrawerSlideType | string {
  return slideType ?? gavetas?.gavetaTipoCorredica ?? settingsDefaults.gavetas.gavetaTipoCorredica;
}

/**
 * API principal — regras industriais por tipo de corrediça (catálogo) + caixa metálica.
 */
export function getDrawerSlideDrillingRules(
  slideType?: string,
  metalBoxType?: string,
  ctx: DrawerDrillingContext = {}
): DrawerSlideDrillingRules {
  const gavetas = ctx.gavetasSettings ?? getSettings().gavetas;
  const cfg = ctx.corredicaConfig ?? defaultRulesConfig.furos.tecnicos.corredica;
  const resolvedSlide = resolveSlideType(slideType, gavetas);
  const resolvedMetal = normalizeMetalBoxType(metalBoxType ?? gavetas.gavetaTipoCaixaMetalica);
  const softClose = ctx.softClose === true;
  const metalEnabled = isMetalBoxEnabled(resolvedMetal);
  const metalProfile = metalEnabled ? resolveMetalBoxProfile(resolvedMetal) : null;

  const panelDepthMm = clampMm(ctx.panelDepthMm ?? 500, 50);
  const pattern: ResolvedSlideDrillingPattern = resolveSlideDrillingPattern({
    slideType: resolvedSlide,
    panelDepthMm,
    preferredLengthMm: ctx.slideLengthMm,
  });

  const offsetFrente =
    metalProfile?.slideOffsetFrontMm ??
    pattern.holes.find((h) => h.role === "front")?.xFromFrontMm ??
    clampMm(cfg?.offsetFrente ?? MODULE_SLIDE_EDGE_SETBACK_MM, 5);
  const rearHole = [...pattern.holes].reverse().find((h) => h.role === "rear" || h.role === "mount" || h.role === "mark");
  const offsetFundo =
    metalProfile?.slideOffsetRearMm ??
    (rearHole
      ? Math.max(5, panelDepthMm - rearHole.xFromFrontMm)
      : clampMm(cfg?.offsetFundo ?? MODULE_SLIDE_EDGE_SETBACK_MM, 5));
  const offsetMark =
    pattern.holes.find((h) => h.role === "mark")?.xFromFrontMm ??
    clampMm(cfg?.offsetMark ?? PI_LEGACY_MARK_X, 5);

  const alturaRelativaFundo = clampMm(
    pattern.alturaRelativaFundoMm ?? cfg?.alturaRelativaFundo ?? 41,
    5
  );
  const offsetVerticalAdicional = clampMm(cfg?.offsetVerticalAdicional ?? 0, 0);
  const softCloseVerticalOffsetMm = softClose ? 2 : 0;
  const mode = ctx.mode ?? "drawer_piece";
  // Furos de corredica no modulo = apenas marcacao (1 mm). Nao estruturais.
  const profundidadeMm = clampMm(
    cfg?.profundidade ?? pattern.profundidadeMm ?? MODULE_SLIDE_MARK_DEPTH_MM,
    0.1
  );
  const profundidadeMarkMm = clampMm(
    cfg?.profundidadeMark ?? pattern.profundidadeMarkMm ?? MODULE_SLIDE_MARK_DEPTH_MM,
    0.1
  );

  // Metal box: offsets frente/traseiro do perfil; manter padrao de furos do slideType.
  let holePatternFromFront = pattern.holes.map((h) => ({ ...h, isMarkOnly: true as const }));
  if (metalProfile) {
    const mid = pattern.holes.filter((h) => h.role === "mark" || h.role === "mount");
    holePatternFromFront = [
      { xFromFrontMm: offsetFrente, role: "front" as const, isMarkOnly: true },
      ...mid.map((h) => ({ ...h, isMarkOnly: true as const })),
      {
        xFromFrontMm: Math.max(offsetFrente + 10, panelDepthMm - offsetFundo),
        role: "rear" as const,
        isMarkOnly: true,
      },
    ];
  }

  return {
    enabled: cfg?.enabled !== false,
    slideType: resolvedSlide,
    metalBoxType: resolvedMetal,
    softClose,
    skipLateralWoodPieces: metalEnabled,
    skipCorredicaOnDrawerPieces: metalEnabled,
    yLineMode: mode === "pi_module_lateral" ? "pi_runner_lines" : "single_from_bottom",
    offsetFrenteMm: offsetFrente,
    offsetFundoMm: offsetFundo,
    offsetMarkMm: offsetMark,
    alturaRelativaFundoMm: alturaRelativaFundo,
    offsetVerticalAdicionalMm: offsetVerticalAdicional,
    softCloseVerticalOffsetMm,
    diametroMm: clampMm(cfg?.diametro ?? pattern.diametroMm, 1),
    profundidadeMm,
    profundidadeMarkMm,
    mirrorLeftRight: pattern.mirrorLeftRight,
    slideLengthMm: pattern.comprimentoMm,
    holePatternFromFront,
    patternSource: pattern.source,
  };
}

/**
 * Corrediças furam-se apenas nos laterais do MÓDULO (`pi_module_lateral`).
 * Peças da gaveta (lat/costa/frente) — modelo industrial: apenas cavilhas + rasgo.
 * Nunca injectar Ø5 / marcação de corrediça nestas peças.
 *
 * @deprecated Mantido por compatibilidade de API; retorna sempre `false`.
 */
export function shouldDrillCorredicaOnDrawerPieceType(
  _pieceType: PieceType,
  _rules: DrawerSlideDrillingRules
): boolean {
  return false;
}

export function getDrawerPieceCorredicaFace(pieceType: PieceType): DrillFace {
  if (pieceType === "gaveta_lat_esq") return "direita";
  if (pieceType === "gaveta_lat_dir") return "esquerda";
  if (pieceType === "gaveta_frente_int" || pieceType === "gaveta_frente") return "tras";
  if (pieceType === "gaveta_traseira") return "frente";
  return "frente";
}

/**
 * @deprecated Não usar no pipeline. Corrediças = laterais do módulo apenas.
 * Peças da gaveta não recebem furos Ø5 — retorna sempre `[]`.
 */
export function computeDrawerPieceCorredicaHoles(_params: {
  pieceType: PieceType;
  largura: number;
  altura: number;
  rules: DrawerSlideDrillingRules;
}): DrawerCorredicaHoleSpec[] {
  return [];
}

const DRAWER_FRONT_BASE_HEIGHTS_MM = [122, 178, 350, 350] as const;
const GRID_STEP_MM = 32;

/**
 * Linhas Y para módulo PI — alinhadas ao centro de cada gaveta.
 */
export function resolvePiRunnerLinesYMm(
  panelHeightMm: number,
  drawerCount: number,
  frontHeightsMm?: number[]
): number[] {
  const qty = clampMm(drawerCount, 1, 4);
  const usefulHeight = Math.max(1, panelHeightMm - 8);
  const baseHeights =
    frontHeightsMm && frontHeightsMm.length === qty
      ? frontHeightsMm
      : DRAWER_FRONT_BASE_HEIGHTS_MM.slice(0, qty);
  const baseSum = baseHeights.reduce((s, h) => s + h, 0);
  const ratio = usefulHeight / Math.max(1, baseSum);
  const scaled = baseHeights.map((h) => h * ratio);

  let cursor = 2;
  const centers = scaled.map((h) => {
    const center = cursor + h / 2;
    cursor += h + 2;
    return center;
  });

  const roundToGrid = (value: number) => Math.round(value / GRID_STEP_MM) * GRID_STEP_MM;

  return centers.map((centerY) => {
    const snapped = clampMm(
      roundToGrid(centerY),
      GRID_STEP_MM,
      Math.max(GRID_STEP_MM, panelHeightMm - GRID_STEP_MM)
    );
    return clampCorredicaYFromTop(snapped, panelHeightMm, DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM);
  });
}

/**
 * Furos de corrediça nas laterais do módulo (padrão industrial por slideType).
 * Espelhamento L/R completo e simétrico; clamp à peça.
 */
export function computePiModuleLateralCorredicaHoles(params: {
  runnerLinesYMm: number[];
  panelDepthMm: number;
  panelHeightMm?: number;
  side: "left" | "right";
  rules: DrawerSlideDrillingRules;
  useLegacyPiOffsets: boolean;
}): Array<{
  x: number;
  y: number;
  depth: number;
  holeType: "corredica";
  isMarkOnly?: boolean;
}> {
  if (!params.rules.enabled) return [];

  const { runnerLinesYMm, panelDepthMm, side, rules, useLegacyPiOffsets } = params;
  const panelHeightMm = params.panelHeightMm ?? Math.max(...runnerLinesYMm, 1) + 1;

  const holes: Array<{
    x: number;
    y: number;
    depth: number;
    holeType: "corredica";
    isMarkOnly?: boolean;
  }> = [];

  if (useLegacyPiOffsets) {
    const frontOff = PI_LEGACY_FRONT_X;
    const markOff = PI_LEGACY_MARK_X;
    const rearOff = PI_LEGACY_REAR_X;
    for (const y of runnerLinesYMm) {
      const xs =
        side === "left"
          ? [panelDepthMm - frontOff, panelDepthMm - markOff, panelDepthMm - rearOff]
          : [frontOff, markOff, rearOff];
      // Legacy PI: tambem marcacao 1 mm (nao atravessa a peca).
      const markDepth = rules.profundidadeMarkMm || MODULE_SLIDE_MARK_DEPTH_MM;
      xs.forEach((xRaw) => {
        const clamped = clampHoleToPanel(xRaw, y, panelDepthMm, panelHeightMm, rules.diametroMm);
        holes.push({
          x: clamped.x,
          y: clamped.y,
          depth: markDepth,
          holeType: "corredica",
          isMarkOnly: true,
        });
      });
    }
    return holes;
  }

  const pattern =
    rules.holePatternFromFront?.length > 0
      ? rules.holePatternFromFront
      : [
          { xFromFrontMm: rules.offsetFrenteMm, role: "front" as const },
          { xFromFrontMm: rules.offsetMarkMm, role: "mark" as const, isMarkOnly: true },
          {
            xFromFrontMm: Math.max(
              rules.offsetFrenteMm,
              (rules.slideLengthMm || panelDepthMm) - rules.offsetFundoMm
            ),
            role: "rear" as const,
          },
        ];

  for (const y of runnerLinesYMm) {
    for (const hole of pattern) {
      const xRaw = mirrorSlideHoleXFromFront(
        hole.xFromFrontMm,
        panelDepthMm,
        side,
        rules.mirrorLeftRight
      );
      const ySafe = clampCorredicaYFromTop(
        y,
        panelHeightMm,
        rules.alturaRelativaFundoMm || DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM
      );
      const clamped = clampHoleToPanel(xRaw, ySafe, panelDepthMm, panelHeightMm, rules.diametroMm);
      // Re-aplicar piso de 41 mm após clamp geométrico (raio).
      const yFinal = clampCorredicaYFromTop(
        clamped.y,
        panelHeightMm,
        rules.alturaRelativaFundoMm || DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM
      );
      // Laterais do modulo: todos os furos de corredica sao so marcacao (1 mm).
      const markDepth = rules.profundidadeMarkMm || MODULE_SLIDE_MARK_DEPTH_MM;
      holes.push({
        x: clamped.x,
        y: yFinal,
        depth: markDepth,
        holeType: "corredica",
        isMarkOnly: true,
      });
    }
  }

  return holes;
}

/**
 * Linhas Y (topo=0) nas laterais do módulo europeu.
 *
 * Regra industrial:
 * - eixo da corrediça = 41 mm acima da base de cada gaveta
 * - nunca < 41 mm acima do bordo inferior do painel lateral
 * - nunca < 41 mm abaixo do bordo superior
 */
export function resolveEuropeanModuleRunnerLinesYMm(params: {
  panelHeightMm: number;
  boxInternalHeightMm: number;
  drawers: Array<{ posYMm: number; frontHeightMm: number }>;
  rules?: DrawerSlideDrillingRules;
}): number[] {
  const rules =
    params.rules ??
    getDrawerSlideDrillingRules(undefined, undefined, {
      mode: "pi_module_lateral",
      panelDepthMm: 500,
    });
  const axisFromDrawerBottomMm = Math.max(1, rules.alturaRelativaFundoMm); // 41
  const minFromPanelBottomMm = axisFromDrawerBottomMm;
  const panelH = Math.max(1, params.panelHeightMm);
  const internalH = Math.max(1, params.boxInternalHeightMm);
  const internalBottomCenterY = -internalH / 2;
  const sorted = [...params.drawers].sort((a, b) => a.posYMm - b.posYMm);

  return sorted.map((drawer) => {
    const frontH = Math.max(0, Number(drawer.frontHeightMm) || 0);
    const drawerBottomCenterY = Number(drawer.posYMm) - frontH / 2;
    /** mm acima do piso interno do vão. */
    const drawerBottomFromFloorMm = drawerBottomCenterY - internalBottomCenterY;
    /**
     * O offset de stack (10 mm) não puxa a 1ª linha para a aresta:
     * base de furação da gaveta inferior = piso útil → eixo a +41 mm do bordo do painel.
     */
    const drawerBottomDrillingMm = Math.max(
      0,
      drawerBottomFromFloorMm - DRAWER_VERTICAL_BASE_OFFSET_MM
    );
    let yFromPanelBottomMm = drawerBottomDrillingMm + axisFromDrawerBottomMm;
    yFromPanelBottomMm = Math.max(minFromPanelBottomMm, yFromPanelBottomMm);
    yFromPanelBottomMm = Math.min(panelH - minFromPanelBottomMm, yFromPanelBottomMm);
    /** Coordenada de painel topo→baixo (Y=0 no topo). */
    return panelH - yFromPanelBottomMm;
  });
}

/** Garante Y de corrediça com ≥ minFromBottom mm às arestas inferior/superior. */
export function clampCorredicaYFromTop(
  yFromTopMm: number,
  panelHeightMm: number,
  minFromBottomMm: number = DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM
): number {
  const panelH = Math.max(1, panelHeightMm);
  const minB = Math.max(1, minFromBottomMm);
  const yFromBottom = panelH - yFromTopMm;
  const clampedBottom = Math.min(panelH - minB, Math.max(minB, yFromBottom));
  return panelH - clampedBottom;
}

/** Furos de corrediça nas laterais do módulo (europeu) — paridade com cutlist / viewer / XML. */
export function buildEuropeanModuleLateralCorredicaDrilling(input: {
  runnerLinesYMm: number[];
  panelDepthMm: number;
  panelHeightMm?: number;
  side: "left" | "right";
  slideType?: string;
  metalBoxType?: string;
  softClose?: boolean;
  slideLengthMm?: number;
  corredicaConfig?: RulesConfig["furos"]["tecnicos"]["corredica"];
}): PanelDrillHole[] {
  const rules = getDrawerSlideDrillingRules(input.slideType, input.metalBoxType, {
    softClose: input.softClose === true,
    mode: "pi_module_lateral",
    corredicaConfig: input.corredicaConfig,
    panelDepthMm: input.panelDepthMm,
    slideLengthMm: input.slideLengthMm,
    panelHeightMm: input.panelHeightMm,
  });
  if (!rules.enabled) return [];

  const specs = computePiModuleLateralCorredicaHoles({
    runnerLinesYMm: input.runnerLinesYMm,
    panelDepthMm: input.panelDepthMm,
    panelHeightMm: input.panelHeightMm ?? Math.max(...input.runnerLinesYMm, 1) + 40,
    side: input.side,
    rules,
    useLegacyPiOffsets: false,
  });

  const markDepth = rules.profundidadeMarkMm || MODULE_SLIDE_MARK_DEPTH_MM;
  return specs.map((spec) => ({
    x: spec.x,
    y: spec.y,
    diameter: rules.diametroMm,
    depth: markDepth,
    holeType: "corredica" as const,
    face: "B" as const,
    topDrillable: true,
  }));
}

/**
 * Contagem oficial de gavetas para furação PI.
 */
export function resolvePiDrawerCountForDrilling(input: {
  drawersLayerCount?: number;
  numeroGavetasSettings?: number;
  legacyFixedLineCount?: number;
}): number {
  if ((input.drawersLayerCount ?? 0) > 0) {
    return clampMm(Math.round(input.drawersLayerCount!), 1, 4);
  }
  if (Number.isFinite(input.numeroGavetasSettings) && (input.numeroGavetasSettings ?? 0) > 0) {
    return clampMm(Math.round(input.numeroGavetasSettings!), 1, 4);
  }
  return clampMm(input.legacyFixedLineCount ?? 3, 1, 4);
}

// --- Furacao Estrutural (golden XML_COMPLITO) ---

/**
 * Laterais gaveta_lat_* — SSOT oficial `cx gav lat` (transversal).
 * Cutlist: largura=profundidade, altura=altura_gaveta.
 * Referencial furos/XML: L=altura, W=largura (profundidade).
 *   4× TypeNo2 Ø10×30 em X=0/L, Y=60/W−60
 *   15× TypeNo1 Ø5×1 (grelha 3×5; esq espelhado L−x)
 *   Sem face TypeNo1 Ø10; sem rasgos TypeNo3
 */
export function computeDrawerLateralStructuralHoles(params: {
  largura: number;
  altura: number;
  espessura: number;
  side: "esq" | "dir";
  isLowestDrawer?: boolean;
}): TechnicalDrillHole[] {
  void params.isLowestDrawer;
  void params.espessura;
  const { largura: depthMm, altura: heightMm, side } = params;
  const L = heightMm;
  const W = depthMm;
  const holes: TechnicalDrillHole[] = [];
  const dia = DRAWER_DOWEL_DIAMETER_MM;
  const edgeDepth = DRAWER_DOWEL_EDGE_DEPTH_MM;

  let edgeIdx = 0;
  for (const y of getDrawerLateralTransversalDowelYPositionsMm(W)) {
    if (y <= 0 || y >= W) continue;
    for (const x of [0, L]) {
      const edgeFace: DrillFace = x === 0
        ? side === "dir"
          ? "frente"
          : "tras"
        : side === "dir"
          ? "tras"
          : "frente";
      const sideKey = side === "dir" ? "dir" : "esq";
      holes.push({
        x,
        y,
        diametro: dia,
        profundidade: edgeDepth,
        tipo: "cavilha",
        face: edgeFace,
        holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
        pairedHoleKey: `gav-lat-transversal-${edgeIdx++}-${sideKey}`,
      });
    }
  }

  const xsRaw = getDrawerLateralGuideXPositionsMm(L);
  const xs =
    side === "esq"
      ? xsRaw.map((x) => Number((L - x).toFixed(2)))
      : xsRaw;
  for (const x of xs) {
    for (const y of getDrawerLateralGuideYPositionsMm(W)) {
      holes.push({
        x,
        y,
        diametro: DRAWER_LAT_GUIDE_DIAMETER_MM,
        profundidade: DRAWER_LAT_GUIDE_DEPTH_MM,
        tipo: "corredica",
        face: "cima",
        topDrillable: true,
      });
    }
  }

  return holes;
}

/**
 * Dois rasgos inferiores permanentes dos laterais (esq/dir).
 * Y/Width/Depth fixos relativos a W; comprimento CAD adapta-se a L no export.
 */
export function buildDrawerLateralBottomGrooves(
  larguraMm: number,
  alturaMm: number
): TechnicalDrillHole[] {
  const L = Math.max(0, Number(larguraMm) || 0);
  const W = Math.max(0, Number(alturaMm) || 0);
  if (W <= 0) return [];

  const meta = {
    tipo: "fixacao_estrutural" as const,
    face: "frente" as const,
    holeSubtype: "groove" as const,
    grooveFullPanelOvercut: true,
    grooveCorrection: DRAWER_LAT_GROOVE_CORRECTION,
    grooveToolName: DRAWER_LAT_GROOVE_TOOL_NAME,
    /** Comprimento útil do painel (informativo); export usa overcut L±10. */
    grooveLength: L,
  };

  return [
    {
      x: 0,
      y: W - DRAWER_LAT_GROOVE_TOP_FROM_TOP_MM,
      diametro: 0,
      profundidade: DRAWER_LAT_GROOVE_TOP_DEPTH_MM,
      grooveWidth: DRAWER_LAT_GROOVE_TOP_WIDTH_MM,
      ...meta,
    },
    {
      x: 0,
      y: W - DRAWER_LAT_GROOVE_BOTTOM_FROM_TOP_MM,
      diametro: 0,
      profundidade: DRAWER_LAT_GROOVE_BOTTOM_DEPTH_MM,
      grooveWidth: DRAWER_LAT_GROOVE_BOTTOM_WIDTH_MM,
      ...meta,
    },
  ];
}

/**
 * Costa � golden COSTA_GAVETA.
 * Altura SSOT = laterais - 23; Y = 15 e W-15; Depth 30; topo X=8/L-8 Depth 10.
 */
export function computeDrawerCostaStructuralHoles(params: {
  largura: number;
  altura: number;
  espessura: number;
  lateralAlturaMm?: number;
}): TechnicalDrillHole[] {
  void params.lateralAlturaMm;
  void params.espessura;
  const { largura, altura } = params;
  const holes: TechnicalDrillHole[] = [];
  const dia = DRAWER_DOWEL_DIAMETER_MM;
  const edgeDepth = DRAWER_DOWEL_EDGE_DEPTH_MM;

  for (const y of getDrawerCostaDowelYPositionsMm(altura)) {
    holes.push({
      x: 0,
      y,
      diametro: dia,
      profundidade: edgeDepth,
      tipo: "cavilha",
      face: "esquerda",
    });
    holes.push({
      x: largura,
      y,
      diametro: dia,
      profundidade: edgeDepth,
      tipo: "cavilha",
      face: "direita",
    });
  }

  const inset = 8;
  holes.push({
    x: inset,
    y: altura,
    diametro: dia,
    profundidade: 10,
    tipo: "fixacao_estrutural",
    face: "cima",
    topDrillable: true,
  });
  holes.push({
    x: largura - inset,
    y: altura,
    diametro: dia,
    profundidade: 10,
    tipo: "fixacao_estrutural",
    face: "cima",
    topDrillable: true,
  });

  return holes;
}

/**
 * Frente interna � Y sync laterais (15 / H-35); Depth 13.
 */
export function computeDrawerFrenteIntStructuralHoles(params: {
  largura: number;
  altura: number;
  espessura: number;
  isLowestDrawer?: boolean;
  bottomThicknessMm?: number;
  sideHeightMm?: number;
  sideBaseElevationMm?: number;
}): TechnicalDrillHole[] {
  const { largura, altura, espessura, isLowestDrawer } = params;
  const holes: TechnicalDrillHole[] = [];
  const faceDepth = clampDrawerFaceDowelDepthMm(espessura);
  const dia = DRAWER_DOWEL_DIAMETER_MM;

  for (const y of getDrawerFrontDowelYPositionsMm(altura, isLowestDrawer)) {
    holes.push({
      x: 0,
      y,
      diametro: dia,
      profundidade: faceDepth,
      tipo: "cavilha",
      face: "esquerda",
    });
    holes.push({
      x: largura,
      y,
      diametro: dia,
      profundidade: faceDepth,
      tipo: "cavilha",
      face: "direita",
    });
  }

  const groove = buildDrawerFrenteBottomGroove({
    largura,
    altura,
    bottomThicknessMm: params.bottomThicknessMm,
    sideHeightMm: params.sideHeightMm ?? altura,
    sideBaseElevationMm: params.sideBaseElevationMm ?? 0,
  });
  if (groove) holes.push(groove);

  return holes;
}

/**
 * Frente externa madeira — regra global CAVILHA_10×40:
 * cada 10×30 na aresta dos laterais → 10×13 na face da frente (Y = elev + Y_lateral).
 * - lowest/single: rasgo golden W−56.5 / X=12; cavilhas só do pairing (sem W−73.5 duplicado)
 * - highest/middle: mesmo pairing; rasgo alinhado ao topo das laterais
 */
export function computeDrawerFrenteExtStructuralHoles(params: {
  largura: number;
  altura: number;
  espessura: number;
  isLowestDrawer?: boolean;
  stackRole?: DrawerStackRole | string;
  sideHeightMm: number;
  bodyWidthMm: number;
  sideThicknessMm: number;
  bottomThicknessMm: number;
  sideBaseElevationMm?: number;
}): TechnicalDrillHole[] {
  const useLowestFixed =
    params.stackRole === "lowest" ||
    params.stackRole === "single" ||
    (params.stackRole == null && params.isLowestDrawer === true);

  if (useLowestFixed) {
    return computeDrawerLowestFrenteExtFixedHoles({
      largura: params.largura,
      altura: params.altura,
      espessura: params.espessura,
      bottomThicknessMm: params.bottomThicknessMm,
      sideHeightMm: params.sideHeightMm,
      sideBaseElevationMm: params.sideBaseElevationMm,
      bodyWidthMm: params.bodyWidthMm,
      sideThicknessMm: params.sideThicknessMm,
    });
  }

  const {
    largura,
    altura,
    espessura,
    sideHeightMm,
    bodyWidthMm,
    sideThicknessMm,
    bottomThicknessMm,
  } = params;
  const elev =
    params.sideBaseElevationMm != null && Number.isFinite(params.sideBaseElevationMm)
      ? params.sideBaseElevationMm
      : DRAWER_SIDE_BASE_ELEVATION_MM;

  const holes = projectDrawerLateralEdgeCavilhasOntoFront({
    frontWidthMm: largura,
    frontHeightMm: altura,
    espessuraMm: espessura,
    sideHeightMm,
    sideBaseElevationMm: elev,
    bodyWidthMm,
    sideThicknessMm,
  });

  const bodyW = Math.min(Math.max(0, bodyWidthMm), largura);
  const overhang = Math.max(0, (largura - bodyW) / 2);
  const groove = buildDrawerFrenteBottomGroove({
    largura,
    altura,
    bottomThicknessMm,
    sideHeightMm,
    sideBaseElevationMm: elev,
    grooveLengthMm: bodyW > 0 ? bodyW : largura,
    grooveStartXMm: overhang,
  });
  if (groove) holes.push(groove);

  return holes;
}

/**
 * Projecta os furos 10×30 da aresta dos laterais para a face da frente (10×13).
 * Y_frente = elevação + Y_aresta_lateral (15 e sideH−35).
 * X = overhang + T/2 (encaixe com a espessura do lateral), fallback inset 33.
 */
export function projectDrawerLateralEdgeCavilhasOntoFront(params: {
  frontWidthMm: number;
  frontHeightMm: number;
  espessuraMm: number;
  sideHeightMm: number;
  sideBaseElevationMm: number;
  bodyWidthMm?: number;
  sideThicknessMm?: number;
  xInsetMm?: number;
}): TechnicalDrillHole[] {
  const {
    frontWidthMm: largura,
    frontHeightMm: altura,
    espessuraMm: espessura,
    sideHeightMm: sideH,
    sideBaseElevationMm: elev,
  } = params;
  if (!(sideH > 0) || !(largura > 0) || !(altura > 0)) return [];

  const faceDepth = clampDrawerFaceDowelDepthMm(espessura);
  const dia = DRAWER_DOWEL_DIAMETER_MM;
  const sideT = Math.max(0, params.sideThicknessMm ?? 16);
  const bodyW =
    params.bodyWidthMm != null && Number.isFinite(params.bodyWidthMm)
      ? Math.min(Math.max(0, params.bodyWidthMm), largura)
      : Math.max(0, largura - 2 * DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM);
  const overhang = Math.max(0, (largura - bodyW) / 2);
  const xLeft = overhang + sideT / 2;
  const xRight = largura - overhang - sideT / 2;
  const xInset = params.xInsetMm ?? DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM;
  const leftX =
    xLeft > 0 && xLeft < largura / 2 ? xLeft : Math.min(xInset, largura / 2);
  const rightX =
    xRight > largura / 2 && xRight < largura ? xRight : Math.max(largura - xInset, largura / 2);

  const holes: TechnicalDrillHole[] = [];
  const edgeYs = getDrawerLateralEdgeDowelYPositionsMm(sideH);
  let pairIdx = 0;
  for (const yLat of edgeYs) {
    const y = elev + yLat;
    if (y <= 0 || y >= altura) continue;
    const pairBase = `gav-frent-lat-${pairIdx++}`;
    for (const [x, side] of [
      [leftX, "esq"],
      [rightX, "dir"],
    ] as const) {
      holes.push({
        x,
        y,
        diametro: dia,
        profundidade: faceDepth,
        tipo: "cavilha",
        face: "tras",
        topDrillable: true,
        holeCatalogId: CAVILHA_FACE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
        pairedHoleKey: `${pairBase}-${side}`,
      });
    }
  }
  return holes;
}

/**
 * Frente inferior — rasgo golden XML_COMPLITO + cavilhas 10×13 só do pairing com laterais.
 * (Removido W−73.5 fixo que duplicava o furo superior ~elev+(sideH−35).)
 */
export function computeDrawerLowestFrenteExtFixedHoles(params: {
  largura: number;
  altura: number;
  espessura: number;
  bottomThicknessMm: number;
  sideHeightMm?: number;
  sideBaseElevationMm?: number;
  bodyWidthMm?: number;
  sideThicknessMm?: number;
}): TechnicalDrillHole[] {
  const { largura, altura, espessura, bottomThicknessMm } = params;
  const sideH = params.sideHeightMm ?? 0;
  const elev =
    params.sideBaseElevationMm != null && Number.isFinite(params.sideBaseElevationMm)
      ? params.sideBaseElevationMm
      : DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM;

  const holes =
    sideH > 0
      ? projectDrawerLateralEdgeCavilhasOntoFront({
          frontWidthMm: largura,
          frontHeightMm: altura,
          espessuraMm: espessura,
          sideHeightMm: sideH,
          sideBaseElevationMm: elev,
          bodyWidthMm: params.bodyWidthMm,
          sideThicknessMm: params.sideThicknessMm,
          xInsetMm: DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM,
        })
      : [];

  const xGroove = DRAWER_LOWEST_FRONT_GROOVE_X_INSET_MM;
  const yGroove = altura - DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM;
  const bottomT = Number(bottomThicknessMm);
  if (
    Number.isFinite(bottomT) &&
    bottomT > 0 &&
    yGroove > 0 &&
    yGroove < altura &&
    xGroove >= 0 &&
    largura > 2 * xGroove
  ) {
    holes.push({
      x: xGroove,
      y: yGroove,
      diametro: 0,
      profundidade: bottomT + DRAWER_BOTTOM_GROOVE_DEPTH_EXTRA_MM,
      tipo: "fixacao_estrutural",
      face: "tras",
      holeSubtype: "groove",
      grooveWidth: DRAWER_BOTTOM_GROOVE_WIDTH_MM,
      grooveLength: largura - 2 * xGroove,
    });
  }

  return holes;
}

function buildDrawerFrenteBottomGroove(params: {
  largura: number;
  altura: number;
  bottomThicknessMm?: number;
  sideHeightMm: number;
  sideBaseElevationMm: number;
  grooveLengthMm?: number;
  grooveStartXMm?: number;
}): TechnicalDrillHole | null {
  const bottomT = Number(params.bottomThicknessMm);
  if (!Number.isFinite(bottomT) || bottomT <= 0) return null;
  const y =
    params.sideBaseElevationMm +
    params.sideHeightMm -
    DRAWER_BOTTOM_GROOVE_Y_FROM_TOP_MM;
  if (y <= 0 || y >= params.altura) return null;
  return {
    x: params.grooveStartXMm ?? 0,
    y,
    diametro: 0,
    profundidade: bottomT + DRAWER_BOTTOM_GROOVE_DEPTH_EXTRA_MM,
    tipo: "fixacao_estrutural",
    face: "tras",
    holeSubtype: "groove",
    grooveWidth: DRAWER_BOTTOM_GROOVE_WIDTH_MM,
    grooveLength: params.grooveLengthMm ?? params.largura,
  };
}

/** Furação de puxadores — módulo independente (ver DrawerHandleDrillingRules). */
export {
  computeDrawerHandleHoles,
  type DrawerHandleDrillingInput,
} from "./DrawerHandleDrillingRules";

/** Furação da frente para caixas metálicas. */
export {
  computeDrawerMetalBoxFrontHoles,
  type DrawerMetalBoxFrontDrillingInput,
} from "./DrawerMetalBoxFrontDrilling";
