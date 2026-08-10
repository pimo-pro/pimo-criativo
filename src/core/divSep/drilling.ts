/**
 * Furação estrutural DIV/SEP (cavilhas + parafusos).
 * Os furos de prateleira (grelha 32/64, segmentada, direcção) vivem em `shelfDrilling.ts`
 * e são fundidos no cutlist via `buildDivShelfDrilling` — este módulo não os gera.
 *
 * A migração dinâmica Esquerda ↔ Direita (SEP.ancoraHorizontal + shelfOptions.direcao)
 * altera quais laterais recebem cavilhas de SEP parcial via `resolveSeparadorLateralSides`.
 */
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
import { resolveEffectiveLinkedSeparador } from "./coupling";
import {
  getDivSepInternalDims,
  resolveDivisorCenterX,
  resolveDivisorDimensions,
  resolveSeparadorCenterY,
  resolveSeparadorDimensions,
  resolveSeparadorLeftXAbsMm,
} from "./dimensions";
import { absoluteYToLateralPanelY } from "./shelfDrilling";
import type { DivisorItem, DivSepBoxLike, SeparadorItem } from "./types";
import { resolveAncoraHorizontal, resolvePosicaoRelativaAoSep } from "./types";
import {
  isPartialSepCavilhaOnly,
  WARDROBE_PARTIAL_SEP_ID_LEFT,
} from "../wardrobe/partialSepToDiv";

/** Lado(s) LAT / aresta SEP que tocam a caixa — segue a âncora horizontal. */
function resolveSeparadorLateralSides(
  item: SeparadorItem
): "both" | "left" | "right" {
  if (isPartialSepCavilhaOnly(item)) {
    return String(item.id) === WARDROBE_PARTIAL_SEP_ID_LEFT ? "left" : "right";
  }
  const ancora = resolveAncoraHorizontal(item);
  if (ancora === "esquerda") return "left";
  if (ancora === "direita") return "right";
  return "both";
}

/**
 * SEP parcial (esquerda/direita ou wardrobe): sem parafuso Ø5 nos receptores
 * CIMA/FUNDO e na peça DIV. No LAT genérico (SEP 2), o Ø5 continua activo
 * no lado da âncora — ver `drillSeparador`.
 */
function isSeparadorCavilhaOnly(item: SeparadorItem): boolean {
  if (isPartialSepCavilhaOnly(item)) return true;
  return resolveAncoraHorizontal(item) !== "completo";
}

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
  const sepLeftX = resolveSeparadorLeftXAbsMm(box, sep);
  return divCenterX - sepLeftX;
}

function drillSeparadorEdgeHoles(
  sepHoles: PanelDrillHole[],
  panelLarguraMm: number,
  profundidadeMm: number,
  rules: DivSepRules,
  sepId: string,
  sides: "both" | "left" | "right" = "both"
): void {
  const cavilhaD = getCavilhaDiameterMm(rules);
  const depthPos = calcDepthHolePositions(profundidadeMm, rules);
  const doLeft = sides === "both" || sides === "left";
  const doRight = sides === "both" || sides === "right";
  depthPos.cavilha.forEach((yPos, i) => {
    const keyL = `divsep-sep-${sepId}-L-${i}`;
    const keyR = `divsep-sep-${sepId}-R-${i}`;
    if (doLeft) {
      pushHole(sepHoles, 0, yPos, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
        pairedHoleKey: keyL,
        holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    }
    if (doRight) {
      pushHole(sepHoles, panelLarguraMm, yPos, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
        pairedHoleKey: keyR,
        holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    }
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

function drillSeparadorFaceForDiv(
  sepHoles: PanelDrillHole[],
  sepLocalX: number,
  profundidadeMm: number,
  rules: DivSepRules,
  pairKeyPrefix: string,
  /** Face do SEP: B = inferior (DIV abaixo); A = superior (DIV acima). */
  face: "A" | "B"
): void {
  const cavilhaD = getCavilhaDiameterMm(rules);
  const depthPos = calcDepthHolePositions(profundidadeMm, rules);
  depthPos.cavilha.forEach((yPos, i) => {
    // Face do SEP: 10×13 (par da aresta do DIV 10×30)
    pushHole(sepHoles, sepLocalX, yPos, cavilhaD, CAVILHA_FACE_DEPTH_MM, "cavilha", face, true, {
      pairedHoleKey: `${pairKeyPrefix}-${i}`,
      holeCatalogId: CAVILHA_FACE_HOLE_TYPE_ID,
      ferragemId: CAVILHA_10x40_FERRAGEM_ID,
    });
  });
}

/** SEP ligado para furação — respeita flag das rules passadas (não só admin global). */
function resolveLinkedSeparadorForDrill(
  box: DivSepBoxLike,
  div: DivisorItem,
  rules: DivSepRules
): SeparadorItem | undefined {
  if (!rules.enableDivSepCombinations) return undefined;
  return resolveEffectiveLinkedSeparador(box, div);
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
  const panelLarguraMm = dims.larguraMm;

  // Âncora esquerda/direita (ex. SEP 2) e wardrobe parcial: furos só no lado que toca a LAT.
  const wardrobePartialLatCavilhaOnly =
    cavilhaOnlyOnDivForPartialSep && isPartialSepCavilhaOnly(item);
  const lateralSides = resolveSeparadorLateralSides(item);
  // LAT: cavilha + Ø5 (prof. = espessura) no lado da âncora, com DIV ligado.
  // Wardrobe parcial mantém só cavilha no LAT. DIV/CIMA/FUNDO ficam sem Ø5 via isSeparadorCavilhaOnly.
  const includeLatParafuso = linkedDivs.length > 0 && !wardrobePartialLatCavilhaOnly;

  drillSeparadorEdgeHoles(
    sepHoles,
    panelLarguraMm,
    dims.profundidadeMm,
    rules,
    panelId,
    lateralSides
  );
  // Receptores LAT: comprimento = Pint (largura real do painel). Peça SEP continua Pint−5.
  drillLateralAtSepHeight(
    bucket,
    box,
    internal.profundidadeInterna,
    centerY,
    internal.espessura,
    rules,
    includeLatParafuso,
    panelId,
    lateralSides
  );

  if (rules.enableDivSepCombinations) {
    for (const linkedDiv of linkedDivs) {
      const divCenterX = resolveDivisorCenterX(box, linkedDiv);
      const sepLocalX = mapDivCenterXToSepLocalX(box, item, divCenterX);
      if (sepLocalX >= 0 && sepLocalX <= panelLarguraMm) {
        const pos = resolvePosicaoRelativaAoSep(linkedDiv);
        const face: "A" | "B" = pos === "cima" ? "A" : "B";
        drillSeparadorFaceForDiv(
          sepHoles,
          sepLocalX,
          dims.profundidadeMm,
          rules,
          `divsep-div-${linkedDiv.id ?? "div"}-sep-${item.id}`,
          face
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
  panels: TopBottomPanels,
  /** SEP parcial (esquerda/direita): só cavilha — sem parafuso Ø5 nos receptores CIMA/FUNDO. */
  includeParafuso = true
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
    if (!includeParafuso) continue;
    for (const yPos of depthPos.parafuso) {
      pushHole(holes, centerX, yPos, 5, internal.espessura, "parafuso", "B", false);
    }
  }
}

function resolveDivTopBottomPanels(
  item: DivisorItem,
  box: DivSepBoxLike,
  rules: DivSepRules
): TopBottomPanels {
  const linkedSep = resolveLinkedSeparadorForDrill(box, item, rules);
  if (!linkedSep) {
    return { includeCima: true, includeFundo: true };
  }
  if (resolvePosicaoRelativaAoSep(item) === "cima") {
    // DIV acima do SEP: CIMA + face superior do SEP (sem FUNDO).
    return { includeCima: true, includeFundo: false };
  }
  // DIV abaixo do SEP: FUNDO + face inferior do SEP (sem CIMA).
  return { includeCima: false, includeFundo: true };
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

  const linkedSep = resolveLinkedSeparadorForDrill(box, item, rules);
  const pos = resolvePosicaoRelativaAoSep(item);

  depthPos.cavilha.forEach((xPos, i) => {
    if (panels.includeFundo) {
      pushHole(divHoles, xPos, yBot, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
        pairedHoleKey: `divsep-div-${divId}-bot-${i}`,
        holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
        ferragemId: CAVILHA_10x40_FERRAGEM_ID,
      });
    } else if (linkedSep && pos === "cima") {
      // Aresta inferior do DIV → face superior do SEP
      const sepId = linkedSep.id ?? item.linkedSeparadorId ?? "sep";
      pushHole(divHoles, xPos, yBot, cavilhaD, CORNER_FF_EDGE_DOWEL_DEPTH_MM, "cavilha", "B", false, {
        pairedHoleKey: `divsep-div-${divId}-sep-${sepId}-${i}`,
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
    } else if (linkedSep && pos === "baixo") {
      // Aresta superior do DIV → face inferior do SEP
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
  const linkedSep = resolveLinkedSeparadorForDrill(box, item, rules);
  const includeParafuso = !(linkedSep != null && isSeparadorCavilhaOnly(linkedSep));
  drillTopBottomForDiv(bucket, box, item, rules, panels, includeParafuso);
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
    const sep = resolveLinkedSeparadorForDrill(box, div, rules);
    if (!sep) continue;
    const existing = sepToLinkedDivs.get(sep.id) ?? [];
    existing.push(div);
    sepToLinkedDivs.set(sep.id, existing);
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
