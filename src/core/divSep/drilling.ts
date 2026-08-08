import type { PanelDrillHole } from "../types";
import type { DivSepRules } from "../../admin/rules/divSepRules/rulesDefaults";
import { CORNER_FF_EDGE_DOWEL_DEPTH_MM } from "../cornerCabinet/cornerFixedFrontDowels";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_EDGE_HOLE_TYPE_ID,
  CAVILHA_FACE_DEPTH_MM,
  CAVILHA_FACE_HOLE_TYPE_ID,
} from "../drill/cavilha10x40Rule";
import {
  calcularPosicoesCavilha,
  getCavilhaDepthMm,
  getCavilhaDiameterMm,
  getDivSepRules,
  getParafusoDistanceFromCavilhaMm,
} from "./cavilhaRules";
import { findSeparadorById } from "./coupling";
import {
  getDivSepInternalDims,
  resolveDivisorCenterX,
  resolveDivisorDimensions,
  resolveSeparadorCenterY,
  resolveSeparadorDimensions,
} from "./dimensions";
import { absoluteYToLateralPanelY } from "./shelfDrilling";
import type { DivisorItem, DivSepBoxLike, SeparadorItem } from "./types";
import {
  isPartialSepCavilhaOnly,
  partialSepSideFromId,
  resolvePartialSepLeftXAbsMm,
  WARDROBE_PARTIAL_SEP_ID_LEFT,
} from "../wardrobe/partialSepToDiv";

type HoleBucket = {
  separador: Map<string, PanelDrillHole[]>;
  divisorio: Map<string, PanelDrillHole[]>;
  lateral_esquerda: PanelDrillHole[];
  lateral_direita: PanelDrillHole[];
  cima: PanelDrillHole[];
  fundo: PanelDrillHole[];
};

export type DepthHolePositions = {
  cavilha: number[];
  parafuso: number[];
};

type TopBottomPanels = {
  includeCima: boolean;
  includeFundo: boolean;
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
  topDrillable?: boolean,
  meta?: {
    pairedHoleKey?: string;
    holeCatalogId?: string;
    ferragemId?: string;
  }
): void {
  out.push({
    x,
    y,
    diameter,
    depth,
    holeType,
    face,
    topDrillable,
    pairedHoleKey: meta?.pairedHoleKey,
    holeCatalogId: meta?.holeCatalogId,
    ferragemId: meta?.ferragemId,
  });
}

/** Posições ao longo da profundidade: cavilha 60/60 mm, parafuso 90/90 mm. */
export function calcDepthHolePositions(comprimento: number, rules?: DivSepRules): DepthHolePositions {
  const cavilha = calcularPosicoesCavilha(comprimento, rules);
  const dist = getParafusoDistanceFromCavilhaMm(rules ?? getDivSepRules());
  const parafuso = cavilha.map((pos) => {
    if (pos <= comprimento / 2) return pos + dist;
    return pos - dist;
  });
  return { cavilha, parafuso };
}

function mapDivCenterXToSepLocalX(box: DivSepBoxLike, sep: SeparadorItem, divCenterX: number): number {
  if (isPartialSepCavilhaOnly(sep)) {
    const side = partialSepSideFromId(String(sep.id));
    const sepLeftX = resolvePartialSepLeftXAbsMm(box, sep, side);
    return divCenterX - sepLeftX;
  }
  const internal = getDivSepInternalDims(box);
  const sepDims = resolveSeparadorDimensions(box, sep);
  const sepLeftX = internal.espessura + (internal.larguraInterna - sepDims.larguraMm) / 2;
  return divCenterX - sepLeftX;
}

function drillSeparadorEdgeHoles(
  sepHoles: PanelDrillHole[],
  panelLarguraMm: number,
  profundidadeMm: number,
  rules: DivSepRules,
  sepId: string
): void {
  const cavilhaD = getCavilhaDiameterMm(rules);
  const depthPos = calcDepthHolePositions(profundidadeMm, rules);
  depthPos.cavilha.forEach((yPos, i) => {
    const keyL = `divsep-sep-${sepId}-L-${i}`;
    const keyR = `divsep-sep-${sepId}-R-${i}`;
    pushHole(sepHoles, 0, yPos, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
      pairedHoleKey: keyL,
      holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
      ferragemId: CAVILHA_10x40_FERRAGEM_ID,
    });
    pushHole(sepHoles, panelLarguraMm, yPos, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
      pairedHoleKey: keyR,
      holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
      ferragemId: CAVILHA_10x40_FERRAGEM_ID,
    });
  });
}

function drillLateralAtSepHeight(
  bucket: HoleBucket,
  box: DivSepBoxLike,
  profundidadeMm: number,
  absoluteCenterY: number,
  receptorThickness: number,
  rules: DivSepRules,
  includeParafuso: boolean,
  sepId: string,
  sides: "both" | "left" | "right" = "both"
): void {
  // Mesma convenção das prateleiras: Y absoluto → Y local do painel LAT (base = topo FUNDO).
  const centerY = absoluteYToLateralPanelY(box, absoluteCenterY);
  const cavilhaD = getCavilhaDiameterMm(rules);
  const faceCavilhaDepth = Math.min(getCavilhaDepthMm(rules), CAVILHA_FACE_DEPTH_MM);
  const depthPos = calcDepthHolePositions(profundidadeMm, rules);
  const doLeft = sides === "both" || sides === "left";
  const doRight = sides === "both" || sides === "right";
  depthPos.cavilha.forEach((latX, i) => {
    const keyL = `divsep-sep-${sepId}-L-${i}`;
    const keyR = `divsep-sep-${sepId}-R-${i}`;
    if (doLeft) {
      pushHole(bucket.lateral_esquerda, latX, centerY, cavilhaD, faceCavilhaDepth, "cavilha", "B", true, {
        pairedHoleKey: keyL,
        holeCatalogId: CAVILHA_FACE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    }
    if (doRight) {
      pushHole(bucket.lateral_direita, latX, centerY, cavilhaD, faceCavilhaDepth, "cavilha", "B", true, {
        pairedHoleKey: keyR,
        holeCatalogId: CAVILHA_FACE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    }
  });
  if (!includeParafuso) return;
  for (const latX of depthPos.parafuso) {
    if (doLeft) {
      pushHole(bucket.lateral_esquerda, latX, centerY, 5, receptorThickness, "parafuso", "B", true);
    }
    if (doRight) {
      pushHole(bucket.lateral_direita, latX, centerY, 5, receptorThickness, "parafuso", "B", true);
    }
  }
}

function drillSeparadorBottomFaceForDiv(
  sepHoles: PanelDrillHole[],
  sepLocalX: number,
  profundidadeMm: number,
  rules: DivSepRules,
  pairKeyPrefix: string
): void {
  const cavilhaD = getCavilhaDiameterMm(rules);
  const depthPos = calcDepthHolePositions(profundidadeMm, rules);
  depthPos.cavilha.forEach((yPos, i) => {
    // Face do SEP: 10×13 (par da aresta superior do DIV 10×30)
    pushHole(sepHoles, sepLocalX, yPos, cavilhaD, CAVILHA_FACE_DEPTH_MM, "cavilha", "B", true, {
      pairedHoleKey: `${pairKeyPrefix}-${i}`,
      holeCatalogId: CAVILHA_FACE_HOLE_TYPE_ID,
      ferragemId: CAVILHA_10x40_FERRAGEM_ID,
    });
  });
}

function drillSeparador(
  bucket: HoleBucket,
  box: DivSepBoxLike,
  item: SeparadorItem,
  panelId: string,
  rules: DivSepRules,
  linkedDivs: DivisorItem[],
  cavilhaOnlyOnDivForPartialSep: boolean
): void {
  const internal = getDivSepInternalDims(box);
  const dims = resolveSeparadorDimensions(box, item);
  const centerY = resolveSeparadorCenterY(box, item);
  const sepHoles: PanelDrillHole[] = [];
  const panelLarguraMm = item.larguraMm ?? dims.larguraMm;

  const cavilhaOnly =
    cavilhaOnlyOnDivForPartialSep && isPartialSepCavilhaOnly(item);
  const lateralSides: "both" | "left" | "right" = cavilhaOnly
    ? String(item.id) === WARDROBE_PARTIAL_SEP_ID_LEFT
      ? "left"
      : "right"
    : "both";

  drillSeparadorEdgeHoles(sepHoles, panelLarguraMm, dims.profundidadeMm, rules, panelId);
  // Receptores LAT: comprimento = Pint (largura real do painel). Peça SEP continua Pint−5.
  // Fase C (SEP parcial): sem parafusos; só lateral do lado da caixa.
  drillLateralAtSepHeight(
    bucket,
    box,
    internal.profundidadeInterna,
    centerY,
    internal.espessura,
    rules,
    linkedDivs.length > 0 && !cavilhaOnly,
    panelId,
    lateralSides
  );

  if (rules.enableDivSepCombinations) {
    for (const linkedDiv of linkedDivs) {
      const divCenterX = resolveDivisorCenterX(box, linkedDiv);
      const sepLocalX = mapDivCenterXToSepLocalX(box, item, divCenterX);
      if (sepLocalX >= 0 && sepLocalX <= panelLarguraMm) {
        drillSeparadorBottomFaceForDiv(
          sepHoles,
          sepLocalX,
          dims.profundidadeMm,
          rules,
          `divsep-div-${linkedDiv.id ?? "div"}-sep-${item.id}`
        );
      }
    }
  }

  bucket.separador.set(panelId, sepHoles);
}

/**
 * Face 10×13 em CIMA/FUNDO — pares das arestas do DIV (10×30).
 * Parafusos de bordo mantêm-se na espessura (CNC TypeNo 2).
 */
function drillTopBottomForDiv(
  bucket: HoleBucket,
  box: DivSepBoxLike,
  item: DivisorItem,
  rules: DivSepRules,
  panels: TopBottomPanels
): void {
  const internal = getDivSepInternalDims(box);
  const centerX = resolveDivisorCenterX(box, item);
  // Receptores CIMA/FUNDO: comprimento = Pint (altura/profundidade real do painel). Peça DIV = Pint−5.
  const depthPos = calcDepthHolePositions(internal.profundidadeInterna, rules);
  const cavilhaD = getCavilhaDiameterMm(rules);
  const faceDepth = Math.min(getCavilhaDepthMm(rules), CAVILHA_FACE_DEPTH_MM);
  const divId = item.id ?? "div";

  const faceTargets: Array<{ holes: PanelDrillHole[]; edge: "top" | "bot" }> = [];
  if (panels.includeCima) faceTargets.push({ holes: bucket.cima, edge: "top" });
  if (panels.includeFundo) faceTargets.push({ holes: bucket.fundo, edge: "bot" });

  for (const { holes, edge } of faceTargets) {
    depthPos.cavilha.forEach((yPos, i) => {
      pushHole(holes, centerX, yPos, cavilhaD, faceDepth, "cavilha", "B", true, {
        pairedHoleKey: `divsep-div-${divId}-${edge}-${i}`,
        holeCatalogId: CAVILHA_FACE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    });
    for (const yPos of depthPos.parafuso) {
      pushHole(holes, centerX, yPos, 5, internal.espessura, "parafuso", "B", false);
    }
  }
}

function resolveDivTopBottomPanels(item: DivisorItem, box: DivSepBoxLike, rules: DivSepRules): TopBottomPanels {
  const linked =
    rules.enableDivSepCombinations && Boolean(findSeparadorById(box, item.linkedSeparadorId));
  return {
    includeCima: !linked,
    includeFundo: true,
  };
}

/** Arestas 10×30 no DIV — pares de CIMA/FUNDO (face) ou SEP (face). */
function drillDivisorEdgeCavilhas(
  divHoles: PanelDrillHole[],
  box: DivSepBoxLike,
  item: DivisorItem,
  rules: DivSepRules,
  panels: TopBottomPanels
): void {
  const dims = resolveDivisorDimensions(box, item);
  const depthPos = calcDepthHolePositions(dims.profundidadeMm, rules);
  const cavilhaD = getCavilhaDiameterMm(rules);
  const edgeOffset = Math.max(0.5, box.espessura ? Number(box.espessura) / 2 : 9.5);
  const yTop = Math.max(edgeOffset, dims.alturaMm - edgeOffset);
  const yBot = edgeOffset;
  const divId = item.id ?? "div";

  const linkedSep =
    rules.enableDivSepCombinations && item.linkedSeparadorId
      ? findSeparadorById(box, item.linkedSeparadorId)
      : undefined;

  depthPos.cavilha.forEach((xPos, i) => {
    if (panels.includeFundo) {
      pushHole(divHoles, xPos, yBot, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
        pairedHoleKey: `divsep-div-${divId}-bot-${i}`,
        holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    }
    if (panels.includeCima) {
      pushHole(divHoles, xPos, yTop, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
        pairedHoleKey: `divsep-div-${divId}-top-${i}`,
        holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    } else if (linkedSep) {
      const sepId = linkedSep.id ?? item.linkedSeparadorId ?? "sep";
      pushHole(divHoles, xPos, yTop, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
        pairedHoleKey: `divsep-div-${divId}-sep-${sepId}-${i}`,
        holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    }
  });
}

function drillDivisor(
  bucket: HoleBucket,
  box: DivSepBoxLike,
  item: DivisorItem,
  panelId: string,
  rules: DivSepRules
): void {
  const panels = resolveDivTopBottomPanels(item, box, rules);
  drillTopBottomForDiv(bucket, box, item, rules, panels);
  const divHoles: PanelDrillHole[] = [];
  drillDivisorEdgeCavilhas(divHoles, box, item, rules, panels);
  bucket.divisorio.set(panelId, divHoles);
}

export type DivSepDrillingResult = {
  getExtraHoles: (tipo: string, panelId?: string) => PanelDrillHole[];
  countFerragens: () => { cavilhas10: number; parafusos4x50: number };
};

function countHoleTypes(holes: PanelDrillHole[]): { cavilhas10: number; parafusos4x50: number } {
  let cavilhas10 = 0;
  let parafusos4x50 = 0;
  for (const h of holes) {
    // 1× CAVILHA_10x40 por furo de aresta 10×30 (não contar faces 13)
    if (
      h.holeType === "cavilha" &&
      h.diameter === 10 &&
      h.depth === CORNER_FF_EDGE_DOWEL_DEPTH_MM &&
      h.topDrillable === false
    ) {
      cavilhas10 += 1;
    }
    if (h.holeType === "parafuso") parafusos4x50 += 1;
  }
  return { cavilhas10, parafusos4x50 };
}

function buildSepToLinkedDivsMap(box: DivSepBoxLike, rules: DivSepRules): Map<string, DivisorItem[]> {
  const sepToLinkedDivs = new Map<string, DivisorItem[]>();
  if (!rules.enableDivSepCombinations) return sepToLinkedDivs;

  for (const div of box.divisores ?? []) {
    if (!div.linkedSeparadorId) continue;
    const existing = sepToLinkedDivs.get(div.linkedSeparadorId) ?? [];
    existing.push(div);
    sepToLinkedDivs.set(div.linkedSeparadorId, existing);
  }
  return sepToLinkedDivs;
}

export type BuildDivSepDrillingOptions = {
  /** Fase C: SEP parcial → DIV só cavilha (sem parafusos na ligação / laterais). */
  cavilhaOnlyOnDivForPartialSep?: boolean;
};

export function buildDivSepDrilling(
  box: DivSepBoxLike,
  panelIds: { divisores?: string[]; separadores?: string[] } | undefined,
  rules?: DivSepRules,
  options?: BuildDivSepDrillingOptions
): DivSepDrillingResult {
  const cfg = rules ?? getDivSepRules();
  const bucket = createHoleBucket();
  const cavilhaOnlyOnDivForPartialSep = options?.cavilhaOnlyOnDivForPartialSep !== false;

  const divisores = box.divisores ?? [];
  const separadores = box.separadores ?? [];
  const sepToLinkedDivs = buildSepToLinkedDivsMap(box, cfg);

  separadores.forEach((sep, i) => {
    const pid = panelIds?.separadores?.[i] ?? sep.id;
    const linkedDivs = sepToLinkedDivs.get(sep.id) ?? [];
    drillSeparador(bucket, box, sep, pid, cfg, linkedDivs, cavilhaOnlyOnDivForPartialSep);
  });

  divisores.forEach((div, i) => {
    const pid = panelIds?.divisores?.[i] ?? div.id;
    drillDivisor(bucket, box, div, pid, cfg);
  });

  const getExtraHoles = (tipo: string, panelId?: string): PanelDrillHole[] => {
    if (tipo === "separador" && panelId) return bucket.separador.get(panelId) ?? [];
    if (tipo === "divisorio" && panelId) return bucket.divisorio.get(panelId) ?? [];
    if (tipo === "lateral_esquerda") return bucket.lateral_esquerda;
    if (tipo === "lateral_direita") return bucket.lateral_direita;
    if (tipo === "cima") return bucket.cima;
    if (tipo === "fundo") return bucket.fundo;
    return [];
  };

  const countFerragens = (): { cavilhas10: number; parafusos4x50: number } => {
    const all: PanelDrillHole[] = [
      ...bucket.lateral_esquerda,
      ...bucket.lateral_direita,
      ...bucket.cima,
      ...bucket.fundo,
      ...Array.from(bucket.separador.values()).flat(),
      ...Array.from(bucket.divisorio.values()).flat(),
    ];
    return countHoleTypes(all);
  };

  return { getExtraHoles, countFerragens };
}

export function mergeDrillHoles(
  base: PanelDrillHole[] | undefined,
  extra: PanelDrillHole[]
): PanelDrillHole[] {
  if (!extra.length) return base ?? [];
  return [...(base ?? []), ...extra];
}
