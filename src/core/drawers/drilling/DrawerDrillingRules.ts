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
  DRAWER_BOTTOM_GROOVE_WIDTH_MM,
  DRAWER_BOTTOM_GROOVE_Y_FROM_TOP_MM,
  DRAWER_BOTTOM_SIDE_ENTRY_MM,
  DRAWER_COSTA_BOTTOM_FACE_DEPTH_MM,
  DRAWER_COSTA_BOTTOM_FACE_DIAMETER_MM,
  DRAWER_FRONT_BOTTOM_GROOVE_DEPTH_MM,
  DRAWER_LAT_GROOVE_BOTTOM_DEPTH_MM,
  DRAWER_LAT_GROOVE_BOTTOM_FROM_TOP_MM,
  DRAWER_LAT_GROOVE_BOTTOM_WIDTH_MM,
  DRAWER_LAT_GROOVE_CORRECTION,
  DRAWER_LAT_GROOVE_TOOL_NAME,
  DRAWER_LAT_GROOVE_TOP_DEPTH_MM,
  DRAWER_LAT_GROOVE_TOP_FROM_TOP_MM,
  DRAWER_LAT_GROOVE_TOP_WIDTH_MM,
  DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
} from "../drawerGeometryConstants";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_EDGE_HOLE_TYPE_ID,
  CAVILHA_FACE_HOLE_TYPE_ID,
} from "../../drill/cavilha10x40Rule";
import { resolveDrawerStackRole, type DrawerStackRole } from "../drawerStackPosition";
import {
  clampDrawerFaceDowelDepthMm,
  DRAWER_DOWEL_DIAMETER_MM,
  DRAWER_DOWEL_EDGE_DEPTH_MM,
  DRAWER_SLIDE_OFFSET_FROM_BOTTOM_MM,
  drawerThicknessCenterMm,
  getDrawerCostaDowelYPositionsMm,
  getDrawerFrontDowelYPositionsMm,
  getDrawerLateralEdgeDowelYPositionsMm,
  getDrawerLateralFaceDowelYPositionsMm,
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
 * Eixo da corrediça para gavetas middle/highest (mm acima da base da gaveta).
 * Usado apenas no modo legado `eixo_desde_frente`.
 */
const DRAWER_UPPER_SLIDE_AXIS_FROM_BOTTOM_MM = 22.5;

/** Modo de cálculo Y das corrediças nos laterais do módulo. */
export type CorredicaModoCalculoY =
  | "pitch_H_sobre_n"
  | "eixo_desde_frente"
  /** Progressivas: GAV_1=41; i≥1 → bodyBottom + 22,5. */
  | "eixo_desde_corpo_base";

/** Defaults industriais (gavita 8 / drill certo) — sem schema Admin nesta fase. */
export const DEFAULT_CORREDICA_EIXO_GAVETA1_MM = 41;
export const DEFAULT_CORREDICA_DESCONTO_PAINEL_MM = 19;
export const DEFAULT_CORREDICA_MODO_CALCULO_Y: CorredicaModoCalculoY =
  "pitch_H_sobre_n";

/**
 * Eixos Y das corrediças desde a base do painel (mm).
 * Modelo industrial gavita 8 / drill certo:
 *   Y(0) = eixo1
 *   Y(i) = eixo1 + i·(H/n) − T   (i ≥ 1)
 */
export function resolvePitchRunnerLinesFromBottomMm(params: {
  boxExternalHeightMm: number;
  drawerCount: number;
  eixoGaveta1Mm?: number;
  descontoPainelMm?: number;
}): number[] {
  const n = Math.max(0, Math.floor(params.drawerCount));
  if (n <= 0) return [];
  const H = Math.max(1, Number(params.boxExternalHeightMm) || 1);
  const eixo1 =
    params.eixoGaveta1Mm != null && Number.isFinite(params.eixoGaveta1Mm)
      ? Math.max(1, Number(params.eixoGaveta1Mm))
      : DEFAULT_CORREDICA_EIXO_GAVETA1_MM;
  const T =
    params.descontoPainelMm != null && Number.isFinite(params.descontoPainelMm)
      ? Math.max(0, Number(params.descontoPainelMm))
      : DEFAULT_CORREDICA_DESCONTO_PAINEL_MM;
  const pitch = H / n;
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? eixo1 : eixo1 + i * pitch - T
  );
}

/**
 * Linhas Y (topo=0) nas laterais do módulo europeu.
 *
 * Default industrial (`pitch_H_sobre_n`, gavita 8):
 *   Y_from_bottom(0) = 41
 *   Y_from_bottom(i) = 41 + i·(H_ext/n) − T   (i ≥ 1)
 *
 * Progressivas (`eixo_desde_corpo_base` ou heightMode Progressivas):
 *   Y(0) = 41 · Y(i≥1) = bodyBottom + 22,5
 *
 * Legado (`eixo_desde_frente`): base da frente + 41/22,5 − B0.
 * Clamp: nunca < 41 mm às arestas inferior/superior do painel.
 */
export function resolveEuropeanModuleRunnerLinesYMm(params: {
  panelHeightMm: number;
  /** Datum legado / stack — em cutlist já é H externa. */
  boxInternalHeightMm: number;
  drawers: Array<{
    posYMm: number;
    frontHeightMm: number;
    sideBaseElevationMm?: number;
  }>;
  rules?: DrawerSlideDrillingRules;
  /** H externa do módulo (pitch). Default = boxInternalHeightMm. */
  boxExternalHeightMm?: number;
  /** T fundo / desconto painel. Default 19. */
  floorThicknessMm?: number;
  /** Modo de altura do stack — Progressivas activa eixo_desde_corpo_base. */
  heightMode?: string;
  corredicaModoCalculo?: CorredicaModoCalculoY;
  corredicaEixoGaveta1Mm?: number;
  corredicaDescontoPainelMm?: number;
}): number[] {
  const rules =
    params.rules ??
    getDrawerSlideDrillingRules(undefined, undefined, {
      mode: "pi_module_lateral",
      panelDepthMm: 500,
    });
  const sorted = [...params.drawers].sort((a, b) => a.posYMm - b.posYMm);
  const drawerCount = sorted.length;
  const panelH = Math.max(1, params.panelHeightMm);
  const eixo1 = Math.max(
    1,
    params.corredicaEixoGaveta1Mm ??
      rules.alturaRelativaFundoMm ??
      DEFAULT_CORREDICA_EIXO_GAVETA1_MM
  );
  const minFromPanelBottomMm = eixo1;
  const modo = params.corredicaModoCalculo ?? DEFAULT_CORREDICA_MODO_CALCULO_Y;
  const useCorpoBase =
    modo === "eixo_desde_corpo_base" ||
    params.heightMode === "top_small_mid_medium_bottom_large";

  const toFromTop = (fromBottom: number[]): number[] =>
    fromBottom.map((yFromBottom) => {
      let y = Math.max(minFromPanelBottomMm, yFromBottom);
      y = Math.min(panelH - minFromPanelBottomMm, y);
      return panelH - y;
    });

  // --- Progressivas: GAV_1=41; superiores = bodyBottom + 22,5 ---
  if (useCorpoBase && drawerCount > 0) {
    const H =
      params.boxExternalHeightMm != null && Number.isFinite(params.boxExternalHeightMm)
        ? Number(params.boxExternalHeightMm)
        : Math.max(1, params.boxInternalHeightMm);
    const moduleBase = -H / 2;
    const offsetMm = DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM;
    const fromBottom = sorted.map((d, i) => {
      if (i === 0) return eixo1;
      const frontH = Math.max(0, Number(d.frontHeightMm) || 0);
      const frontBottom = Number(d.posYMm) - moduleBase - frontH / 2;
      const elev =
        d.sideBaseElevationMm != null && Number.isFinite(d.sideBaseElevationMm)
          ? Number(d.sideBaseElevationMm)
          : DRAWER_BODY_ELEVATION_FROM_FRONT_MM;
      return frontBottom + elev + offsetMm;
    });
    return toFromTop(fromBottom);
  }

  // --- Modo industrial dinâmico (gavita 8 / drill certo) ---
  if (modo === "pitch_H_sobre_n" && drawerCount > 0) {
    const H =
      params.boxExternalHeightMm != null && Number.isFinite(params.boxExternalHeightMm)
        ? Number(params.boxExternalHeightMm)
        : Math.max(1, params.boxInternalHeightMm);
    const fromBottom = resolvePitchRunnerLinesFromBottomMm({
      boxExternalHeightMm: H,
      drawerCount,
      eixoGaveta1Mm: eixo1,
      descontoPainelMm:
        params.corredicaDescontoPainelMm ??
        params.floorThicknessMm ??
        DEFAULT_CORREDICA_DESCONTO_PAINEL_MM,
    });
    return toFromTop(fromBottom);
  }

  // --- Legado: eixo desde base da frente (41 / 22,5 + subtração B0) ---
  const lowestAxisFromDrawerBottomMm = Math.max(1, rules.alturaRelativaFundoMm);
  const internalH = Math.max(1, params.boxInternalHeightMm);
  const internalBottomCenterY = -internalH / 2;

  return sorted.map((drawer, index) => {
    const stackRole = resolveDrawerStackRole(index, drawerCount);
    const axisFromDrawerBottomMm =
      stackRole === "lowest" || stackRole === "single"
        ? lowestAxisFromDrawerBottomMm
        : DRAWER_UPPER_SLIDE_AXIS_FROM_BOTTOM_MM;
    const frontH = Math.max(0, Number(drawer.frontHeightMm) || 0);
    const drawerBottomCenterY = Number(drawer.posYMm) - frontH / 2;
    /** mm acima do piso interno do vão. */
    const drawerBottomFromFloorMm = drawerBottomCenterY - internalBottomCenterY;
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
 * Laterais — golden LAT_DIR / LAT_ESQ.
 * Face TypeNo=1: X=T/2|L-T/2; Y=15, W-38; Depth 13
 * Aresta TypeNo=2: X=0|L; Y=15, W-35; Depth 30
 * Rasgos inferiores fixos (independentes de L / frente / stack):
 *   W−13 → Width 13 Depth 3; W−23 → Width 11 Depth 10
 *   CAD: BeginX=L+10 … EndX=−10, Correction=2, FRESA_DESBASTE_10MM
 */
export function computeDrawerLateralStructuralHoles(params: {
  largura: number;
  altura: number;
  espessura: number;
  side: "esq" | "dir";
  isLowestDrawer?: boolean;
}): TechnicalDrillHole[] {
  const { largura, altura, espessura, side, isLowestDrawer } = params;
  const holes: TechnicalDrillHole[] = [];
  const dia = DRAWER_DOWEL_DIAMETER_MM;
  const faceDepth = clampDrawerFaceDowelDepthMm(espessura);
  const edgeDepth = DRAWER_DOWEL_EDGE_DEPTH_MM;
  const tHalf = drawerThicknessCenterMm(espessura);

  const faceX = side === "dir" ? largura - tHalf : tHalf;
  for (const y of getDrawerLateralFaceDowelYPositionsMm(altura)) {
    if (y <= 0 || y >= altura) continue;
    holes.push({
      x: faceX,
      y,
      diametro: dia,
      profundidade: faceDepth,
      tipo: "cavilha",
      face: "cima",
      topDrillable: true,
    });
  }

  const edgeX = side === "dir" ? 0 : largura;
  const edgeFace: DrillFace = side === "dir" ? "frente" : "tras";
  let edgeIdx = 0;
  for (const y of getDrawerLateralEdgeDowelYPositionsMm(altura, isLowestDrawer)) {
    // Aceitar Y=0 (legado); rejeitar apenas fora do painel.
    if (y < 0 || y >= altura) continue;
    const sideKey = side === "dir" ? "dir" : "esq";
    holes.push({
      x: edgeX,
      y,
      diametro: dia,
      profundidade: edgeDepth,
      tipo: "cavilha",
      face: edgeFace,
      holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
      ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      pairedHoleKey: `gav-frent-lat-${edgeIdx++}-${sideKey}`,
    });
  }

  holes.push(...buildDrawerLateralBottomGrooves(largura, altura));

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
 * Costa — golden COSTA_GAVETA.
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
  // Furos inferiores (Y=W): sempre Ø10×10 — nunca Ø5 (legado incorrecto).
  holes.push({
    x: inset,
    y: altura,
    diametro: DRAWER_COSTA_BOTTOM_FACE_DIAMETER_MM,
    profundidade: DRAWER_COSTA_BOTTOM_FACE_DEPTH_MM,
    tipo: "fixacao_estrutural",
    face: "cima",
    topDrillable: true,
  });
  holes.push({
    x: largura - inset,
    y: altura,
    diametro: DRAWER_COSTA_BOTTOM_FACE_DIAMETER_MM,
    profundidade: DRAWER_COSTA_BOTTOM_FACE_DEPTH_MM,
    tipo: "fixacao_estrutural",
    face: "cima",
    topDrillable: true,
  });

  return holes;
}

/**
 * Frente interna — Y sync laterais (15 / H-35); Depth 13.
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
 * GAV_1 / single: Y_aresta inferior = 54 → Y_peça = elev+54 = 70,5; middle/highest: 15.
 * Rasgo (todas): Y = elev + sideH − 13 (22 mm à cavilha superior).
 * Furação exclusiva DRILL — o pipeline CNC remove estes furos do TCN.
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
  const isLowest =
    params.isLowestDrawer === true ||
    params.stackRole === "lowest" ||
    params.stackRole === "single";

  const holes = projectDrawerLateralEdgeCavilhasOntoFront({
    frontWidthMm: largura,
    frontHeightMm: altura,
    espessuraMm: espessura,
    sideHeightMm,
    sideBaseElevationMm: elev,
    bodyWidthMm,
    sideThicknessMm,
    isLowestDrawer: isLowest,
  });

  // Rasgo do fundo: deve acompanhar bottomWidthMm (peça gav_fundo), não bodyWidthMm
  // (envelope das laterais) — bottomWidthMm = bodyWidthMm − 2×(sideThicknessMm − entrada
  // do fundo), i.e. 16−10=6mm úteis de cada lado. Cavilhas (acima) mantêm-se em bodyWidthMm,
  // que é o valor correto para o encaixe frente↔lateral.
  const bottomWidthMm = Math.max(
    0,
    bodyWidthMm - 2 * (sideThicknessMm - DRAWER_BOTTOM_SIDE_ENTRY_MM)
  );
  const grooveW = Math.min(Math.max(0, bottomWidthMm), largura);
  const overhang = Math.max(0, (largura - grooveW) / 2);
  const groove = buildDrawerFrenteBottomGroove({
    largura,
    altura,
    bottomThicknessMm,
    sideHeightMm,
    sideBaseElevationMm: elev,
    grooveLengthMm: grooveW > 0 ? grooveW : largura,
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
  isLowestDrawer?: boolean;
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
  const edgeYs = getDrawerLateralEdgeDowelYPositionsMm(sideH, params.isLowestDrawer);
  let pairIdx = 0;
  for (const yLat of edgeYs) {
    const y = elev + yLat;
    if (y < 0 || y >= altura) continue;
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

/** @deprecated P3.15 — só testes golden; ver drawerLowestFrenteExtFixedHoles.legacy. */
export {
  computeDrawerLowestFrenteExtFixedHoles,
  DRAWER_LOWEST_FRONT_BOTTOM_GROOVE_FROM_BASE_MM,
} from "./drawerLowestFrenteExtFixedHoles.legacy";

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
  // SSOT P3.12+: Y = elev + sideH - 13 (sem rasgo fixo 53 mm).
  const y =
    params.sideBaseElevationMm +
    params.sideHeightMm -
    DRAWER_BOTTOM_GROOVE_Y_FROM_TOP_MM;
  if (y <= 0 || y >= params.altura) return null;
  return {
    x: params.grooveStartXMm ?? 0,
    y,
    diametro: 0,
    // Industrial: Depth 11 e Width 11 (T_fundo+1). Y = elev+sideH-13 intacto.
    profundidade: DRAWER_FRONT_BOTTOM_GROOVE_DEPTH_MM,
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
