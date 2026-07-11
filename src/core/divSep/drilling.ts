import type { PanelDrillHole } from "../types";
import { dedupeDrillHoles } from "../../modules/drilling/drillHoleDedup";
import type { DivSepRules } from "../../admin/rules/divSepRules/rulesDefaults";
import {
  clampPanelDrillHolesToPieceBounds,
  clampPanelHoleLocalMm,
  type PanelDrillPieceBounds,
} from "../../modules/drilling/panelDrillingBoundsUtils";
import { CORNER_FF_EDGE_DOWEL_DEPTH_MM } from "../cornerCabinet/cornerFixedFrontDowels";
import {
  calcularPosicoesCavilha,
  getCavilhaDepthMm,
  getCavilhaDiameterMm,
  getDivSepRules,
  getParafusoDistanceFromCavilhaMm,
} from "./cavilhaRules";
import {
  getDivSepInternalDims,
  resolveDivisorCenterX,
  resolveDivisorDimensions,
  resolveSeparadorCenterY,
  resolveSeparadorDimensions,
} from "./dimensions";
import type { DivisorItem, DivSepBoxLike, SeparadorItem } from "./types";

type HoleBucket = {
  separador: Map<string, PanelDrillHole[]>;
  divisorio: Map<string, PanelDrillHole[]>;
  lateral_esquerda: PanelDrillHole[];
  lateral_direita: PanelDrillHole[];
  cima: PanelDrillHole[];
  fundo: PanelDrillHole[];
};

function createHoleBucket(): HoleBucket {
  return {
    separador: new Map(),
    divisorio: new Map(),
    lateral_esquerda: [],
    lateral_direita: [],
    cima: [],
    fundo: [],
  };
}

function pushHole(
  out: PanelDrillHole[],
  x: number,
  y: number,
  diameter: number,
  depth: number,
  holeType: PanelDrillHole["holeType"],
  face: "A" | "B" = "B",
  topDrillable?: boolean
): void {
  out.push({ x, y, diameter, depth, holeType, face, topDrillable });
}

function addScrewFromCavilha(
  out: PanelDrillHole[],
  cx: number,
  cy: number,
  receptorThickness: number,
  direction: 1 | -1,
  rules: DivSepRules
): void {
  const dist = getParafusoDistanceFromCavilhaMm(rules);
  pushHole(out, cx + direction * dist, cy, 5, receptorThickness, "parafuso", "B");
}

/** Furos SEP→lateral: Y referenciado ao módulo; clamp à altura real da lateral em getExtraHoles. */
function pushLateralSeparadorHole(
  bucket: HoleBucket,
  latX: number,
  moduleCenterYMm: number,
  cavilhaD: number,
  lateralCavilhaDepth: number,
  receptorThickness: number,
  rules: DivSepRules
): void {
  pushHole(bucket.lateral_esquerda, latX, moduleCenterYMm, cavilhaD, lateralCavilhaDepth, "cavilha", "B", false);
  addScrewFromCavilha(bucket.lateral_esquerda, latX, moduleCenterYMm, receptorThickness, 1, rules);
  pushHole(bucket.lateral_direita, latX, moduleCenterYMm, cavilhaD, lateralCavilhaDepth, "cavilha", "B", false);
  addScrewFromCavilha(bucket.lateral_direita, latX, moduleCenterYMm, receptorThickness, -1, rules);
}

function clampLateralSeparadorHolesToPiece(
  holes: PanelDrillHole[],
  pieceBounds: PanelDrillPieceBounds,
  context: string
): PanelDrillHole[] {
  const { larguraMm, alturaMm } = pieceBounds;
  const out: PanelDrillHole[] = [];
  for (const h of holes) {
    const { x, y } = clampPanelHoleLocalMm(h.x, h.y, larguraMm, alturaMm);
    out.push({ ...h, x, y });
  }
  return clampPanelDrillHolesToPieceBounds(out, larguraMm, alturaMm, context);
}

/** Cavilha na espessura (borda esq/dir) — alinhada ao catálogo cavilha_10x30. */
function pushSeparadorEdgeCavilha(
  out: PanelDrillHole[],
  xEdgeMm: number,
  depthPosMm: number,
  rules: DivSepRules,
  receptorThickness: number
): void {
  const cavilhaD = getCavilhaDiameterMm(rules);
  pushHole(
    out,
    xEdgeMm,
    depthPosMm,
    cavilhaD,
    CORNER_FF_EDGE_DOWEL_DEPTH_MM,
    "cavilha",
    "B",
    false
  );
  addScrewFromCavilha(out, xEdgeMm, depthPosMm, receptorThickness, 1, rules);
  addScrewFromCavilha(out, xEdgeMm, depthPosMm, receptorThickness, -1, rules);
}

function drillSeparador(
  bucket: HoleBucket,
  box: DivSepBoxLike,
  item: SeparadorItem,
  panelId: string,
  rules: DivSepRules
): void {
  const internal = getDivSepInternalDims(box);
  const dims = resolveSeparadorDimensions(box, item);
  const centerY = resolveSeparadorCenterY(box, item);
  const sepHoles: PanelDrillHole[] = [];
  const cavilhaD = getCavilhaDiameterMm(rules);
  const depthPositions = calcularPosicoesCavilha(dims.profundidadeMm, rules);
  const panelLarguraMm = item.larguraMm ?? dims.larguraMm;

  for (const depthPos of depthPositions) {
    pushSeparadorEdgeCavilha(sepHoles, 0, depthPos, rules, internal.espessura);
    pushSeparadorEdgeCavilha(sepHoles, panelLarguraMm, depthPos, rules, internal.espessura);
  }

  const lateralDepthPositions = calcularPosicoesCavilha(dims.profundidadeMm, rules);
  const lateralCavilhaDepth = CORNER_FF_EDGE_DOWEL_DEPTH_MM;
  /** Y na lateral = posição vertical do separador; deve usar altura real da peça (aplicada em getExtraHoles). */
  for (const latX of lateralDepthPositions) {
    pushLateralSeparadorHole(
      bucket,
      latX,
      centerY,
      cavilhaD,
      lateralCavilhaDepth,
      internal.espessura,
      rules
    );
  }

  bucket.separador.set(panelId, sepHoles);
}

function drillDivisor(
  bucket: HoleBucket,
  box: DivSepBoxLike,
  item: DivisorItem,
  panelId: string,
  rules: DivSepRules
): void {
  const internal = getDivSepInternalDims(box);
  const dims = resolveDivisorDimensions(box, item);
  const centerX = resolveDivisorCenterX(box, item);
  const divHoles: PanelDrillHole[] = [];
  const cavilhaPositions = calcularPosicoesCavilha(dims.alturaMm, rules);
  const cavilhaD = getCavilhaDiameterMm(rules);
  const cavilhaDepth = getCavilhaDepthMm(rules);
  const depthCenter = dims.profundidadeMm / 2;

  for (const yPos of cavilhaPositions) {
    pushHole(divHoles, depthCenter, yPos, cavilhaD, cavilhaDepth, "cavilha", "B");
    addScrewFromCavilha(divHoles, depthCenter, yPos, internal.espessura, 1, rules);
    addScrewFromCavilha(divHoles, depthCenter, yPos, internal.espessura, -1, rules);

    const topBottomPositions = calcularPosicoesCavilha(internal.larguraInterna, rules);
    for (const tbX of topBottomPositions) {
      const xOnPanel = centerX - internal.espessura + tbX;
      if (xOnPanel < 0 || xOnPanel > internal.larguraInterna + internal.espessura * 2) continue;
      pushHole(bucket.cima, xOnPanel, depthCenter, cavilhaD, cavilhaDepth, "cavilha", "B");
      addScrewFromCavilha(bucket.cima, xOnPanel, depthCenter, internal.espessura, 1, rules);
      pushHole(bucket.fundo, xOnPanel, depthCenter, cavilhaD, cavilhaDepth, "cavilha", "B");
      addScrewFromCavilha(bucket.fundo, xOnPanel, depthCenter, internal.espessura, -1, rules);
    }
  }

  bucket.divisorio.set(panelId, divHoles);
}

export type DivSepDrillingResult = {
  getExtraHoles: (tipo: string, panelId?: string, pieceBounds?: PanelDrillPieceBounds) => PanelDrillHole[];
};

export function buildDivSepDrilling(
  box: DivSepBoxLike,
  panelIds: { divisores?: string[]; separadores?: string[] } | undefined,
  rules?: DivSepRules
): DivSepDrillingResult {
  const cfg = rules ?? getDivSepRules();
  const bucket = createHoleBucket();

  (box.separadores ?? []).forEach((sep, i) => {
    const pid = panelIds?.separadores?.[i] ?? sep.id;
    drillSeparador(bucket, box, sep, pid, cfg);
  });

  (box.divisores ?? []).forEach((div, i) => {
    const pid = panelIds?.divisores?.[i] ?? div.id;
    drillDivisor(bucket, box, div, pid, cfg);
  });

  const getExtraHoles = (
    tipo: string,
    panelId?: string,
    pieceBounds?: PanelDrillPieceBounds
  ): PanelDrillHole[] => {
    if (tipo === "separador" && panelId) return bucket.separador.get(panelId) ?? [];
    if (tipo === "divisorio" && panelId) return bucket.divisorio.get(panelId) ?? [];
    if (tipo === "lateral_esquerda" || tipo === "lateral_direita") {
      const raw = tipo === "lateral_esquerda" ? bucket.lateral_esquerda : bucket.lateral_direita;
      if (!pieceBounds) return raw;
      return clampLateralSeparadorHolesToPiece(raw, pieceBounds, "divSep_getExtraHoles_lateral");
    }
    if (tipo === "cima") return bucket.cima;
    if (tipo === "fundo") return bucket.fundo;
    return [];
  };

  return { getExtraHoles };
}

export function mergeDrillHoles(
  base: PanelDrillHole[] | undefined,
  extra: PanelDrillHole[]
): PanelDrillHole[] {
  if (!extra.length) return dedupeDrillHoles(base ?? []);
  return dedupeDrillHoles([...(base ?? []), ...extra]);
}
