import type { RulesConfig } from "../rules/rulesConfig";
import type { PanelDrillHole } from "../types";
import { getDivSepRules } from "./cavilhaRules";
import { resolveSeparadorBottomY, resolveDivisorBottomYAbs } from "./coupling";
import {
  getDivSepInternalDims,
  resolveDivisorCenterX,
  resolveDivisorDimensions,
  resolveFullInternalShelfWidthMm,
} from "./dimensions";
import {
  boxHasDivisores,
  boxHasSeparadores,
  direcaoToPrateleiraLado,
  resolveShelfDirecao,
  resolveShelfGridMode,
  resolveShelfGridStepMm,
  resolveShelfMargemMm,
  shelfDirecaoIsSuperior,
} from "./shelfOptions";
import type { DivisorItem, DivisorPrateleiraLado, DivSepBoxLike, SeparadorItem } from "./types";
import { resolveAncoraHorizontal, resolvePosicaoRelativaAoSep } from "./types";

const SHELF_DIV_CLEARANCE_MM = 1;
const DEFAULT_SHELF_GRID_STEP_MM = 32;
const SEGMENTED_BLOCK_MIN = 4;
const SEGMENTED_BLOCK_MAX = 8;
const SEGMENTED_BLOCK_DEFAULT = 6;
/** Altura mínima (mm) de referência para zona acima do SEP sem DIV acima. */
export const MIN_ABOVE_SEP_SHELF_HEIGHT_MM = 500;

export type VerticalCompartment = {
  yMin: number;
  yMax: number;
  /** Zona utilizável para prateleiras curtas (LAT+DIV). */
  shelfEnabled: boolean;
};

/** Opções de runtime da grelha (passo / modo / margem de centragem). */
export type ShelfGridRuntimeOptions = {
  stepMm?: number;
  gridMode?: "continua" | "segmentada";
  /** Margem igual topo/base (mm). 0 = margens das regras industriais. */
  margemSuperiorInferiorMm?: number;
};

const MIN_SHELF_COMPARTMENT_HEIGHT_MM = 80;

/**
 * SEP parcial só corta o vão que ocupa; SEP completo corta ambos os lados.
 * No lado livre (sem SEP), a grelha de prateleiras é contínua — sem “furos do meio”.
 */
export function separadorCutsShelfSide(
  sep: SeparadorItem,
  side: DivisorPrateleiraLado
): boolean {
  const ancora = resolveAncoraHorizontal(sep);
  if (ancora === "completo") return true;
  return ancora === side;
}

function separadoresCuttingShelfSide(
  box: DivSepBoxLike,
  side?: DivisorPrateleiraLado
): SeparadorItem[] {
  const seps = box.separadores ?? [];
  if (!side) return seps;
  return seps.filter((sep) => separadorCutsShelfSide(sep, side));
}

function compartmentHasDivSupport(
  zone: VerticalCompartment,
  divBottomY: number,
  divTopY: number
): boolean {
  if (!zone.shelfEnabled) return false;
  const effectiveYMin = Math.max(zone.yMin, divBottomY);
  const effectiveYMax = Math.min(zone.yMax, divTopY);
  return effectiveYMax - effectiveYMin > MIN_SHELF_COMPARTMENT_HEIGHT_MM;
}

function resolveEffectiveShelfBounds(
  zone: VerticalCompartment,
  divBottomY: number,
  divTopY: number
): { yMin: number; yMax: number } | null {
  if (!compartmentHasDivSupport(zone, divBottomY, divTopY)) return null;
  return {
    yMin: Math.max(zone.yMin, divBottomY),
    yMax: Math.min(zone.yMax, divTopY),
  };
}

function roundHoleMm(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** True se existe pelo menos um DIV ligado acima de um SEP que corta o lado indicado. */
export function boxHasDivisorAboveSep(
  box: DivSepBoxLike,
  shelfSide?: DivisorPrateleiraLado
): boolean {
  const cuttingIds = new Set(
    separadoresCuttingShelfSide(box, shelfSide).map((s) => s.id)
  );
  return (box.divisores ?? []).some((div) => {
    if (!Boolean(div.linkedSeparadorId) || resolvePosicaoRelativaAoSep(div) !== "cima") {
      return false;
    }
    if (!shelfSide) return true;
    return cuttingIds.has(String(div.linkedSeparadorId));
  });
}

export function isDivisorAboveSep(div: DivisorItem): boolean {
  return Boolean(div.linkedSeparadorId) && resolvePosicaoRelativaAoSep(div) === "cima";
}

/**
 * Compartimentos verticais delimitados pelos SEP (mm absolutos na caixa).
 * Com `shelfSide`, SEP parciais do lado oposto são ignorados (vão contínuo).
 * Zona acima do SEP: DIV acima, direcção superior, ou modo só-SEP com direcção superior.
 */
export function resolveVerticalCompartments(
  box: DivSepBoxLike,
  shelfSide?: DivisorPrateleiraLado
): VerticalCompartment[] {
  const internal = getDivSepInternalDims(box);
  const yBottom = internal.espessura;
  const yTop = internal.espessura + internal.alturaInterna;
  const separadores = separadoresCuttingShelfSide(box, shelfSide);
  if (separadores.length === 0) {
    return [{ yMin: yBottom, yMax: yTop, shelfEnabled: true }];
  }

  const boundaries = [yBottom, ...separadores.map((s) => resolveSeparadorBottomY(box, s)), yTop]
    .map((y) => Math.round(y))
    .sort((a, b) => a - b);

  const direcao = resolveShelfDirecao(box);
  const enableAbove =
    boxHasDivisorAboveSep(box, shelfSide) ||
    shelfDirecaoIsSuperior(direcao) ||
    (!boxHasDivisores(box) && shelfDirecaoIsSuperior(direcao));

  const zones: VerticalCompartment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const yMin = boundaries[i]!;
    const yMax = boundaries[i + 1]!;
    if (yMax - yMin <= MIN_SHELF_COMPARTMENT_HEIGHT_MM) continue;
    const isTopZoneAboveSeparador = i === boundaries.length - 2;
    zones.push({
      yMin,
      yMax,
      shelfEnabled: !isTopZoneAboveSeparador || enableAbove,
    });
  }
  return zones.length > 0 ? zones : [{ yMin: yBottom, yMax: yTop, shelfEnabled: true }];
}

function resolveHolesPerBlock(zoneHeightMm: number, stepMm: number): number {
  const capacity = Math.max(1, Math.floor(zoneHeightMm / Math.max(1, stepMm)));
  if (capacity <= SEGMENTED_BLOCK_MIN) return Math.min(SEGMENTED_BLOCK_MIN, capacity);
  if (capacity < SEGMENTED_BLOCK_DEFAULT) {
    return Math.min(SEGMENTED_BLOCK_MAX, Math.max(SEGMENTED_BLOCK_MIN, capacity));
  }
  // Entre 4 e 8: cresce ligeiramente com a altura útil.
  const scaled = SEGMENTED_BLOCK_MIN + Math.round((capacity - SEGMENTED_BLOCK_MIN) / 12);
  return Math.min(SEGMENTED_BLOCK_MAX, Math.max(SEGMENTED_BLOCK_MIN, scaled));
}

/**
 * Grelha segmentada: blocos de 4–8 furos centrados no LAT, com espaços vazios
 * proporcionais à altura da zona.
 */
export function buildSegmentedShelfGridYs(
  continuousYs: number[],
  stepMm: number,
  zoneHeightMm: number
): number[] {
  const n = continuousYs.length;
  if (n === 0) return [];
  const holesPerBlock = resolveHolesPerBlock(zoneHeightMm, stepMm);
  if (n <= holesPerBlock) return continuousYs;

  const gapSteps = Math.max(1, Math.round((zoneHeightMm * 0.12) / Math.max(1, stepMm)));
  let blocks = Math.max(1, Math.floor((n + gapSteps) / (holesPerBlock + gapSteps)));
  while ((blocks + 1) * holesPerBlock + blocks * gapSteps <= n) {
    blocks += 1;
  }

  const used = blocks * holesPerBlock + (blocks - 1) * gapSteps;
  const start = Math.max(0, Math.floor((n - used) / 2));
  const out: number[] = [];
  let idx = start;
  for (let b = 0; b < blocks; b++) {
    for (let h = 0; h < holesPerBlock && idx < n; h++, idx++) {
      out.push(continuousYs[idx]!);
    }
    idx += gapSteps;
  }
  return out.length > 0 ? out : continuousYs.slice(0, holesPerBlock);
}

function resolveGridRuntimeFromBox(box?: DivSepBoxLike | null): ShelfGridRuntimeOptions {
  if (!box) return {};
  return {
    stepMm: resolveShelfGridStepMm(box),
    gridMode: resolveShelfGridMode(box),
    margemSuperiorInferiorMm: resolveShelfMargemMm(box),
  };
}

/**
 * Grelha industrial de prateleiras (margens + passo 32/64 mm, contínua ou segmentada).
 * Exportada para UI de posição exacta — mesmo motor dos furos.
 */
export function resolveShelfGridYs(
  yMin: number,
  yMax: number,
  rules?: Pick<RulesConfig, "furos"> | RulesConfig | null,
  runtime?: ShelfGridRuntimeOptions | null
): number[] {
  const cfg = rules?.furos?.tecnicos?.prateleira;
  const stepMm = Math.max(1, Number(runtime?.stepMm) || DEFAULT_SHELF_GRID_STEP_MM);
  const marginEqual = Math.max(0, Number(runtime?.margemSuperiorInferiorMm) || 0);

  let zoneMin: number;
  let zoneMax: number;
  if (marginEqual > 0) {
    // Margem > 0: centrar a grelha no LAT com inset igual.
    zoneMin = yMin + marginEqual;
    zoneMax = yMax - marginEqual;
  } else {
    const margemTopo = cfg?.margemTopo ?? 200;
    const margemBase = cfg?.margemBase ?? 200;
    zoneMin = yMin + margemBase;
    zoneMax = yMax - margemTopo;
  }
  if (zoneMax < zoneMin) return [];

  const continuous: number[] = [];
  for (let y = zoneMin; y <= zoneMax + 0.001; y += stepMm) {
    continuous.push(roundHoleMm(y));
  }

  if (runtime?.gridMode === "segmentada") {
    return buildSegmentedShelfGridYs(continuous, stepMm, yMax - yMin);
  }
  return continuous;
}

/** Grelha na zona principal do DIV (para escolha de posição exacta). */
export function resolveDivShelfGridYs(
  box: DivSepBoxLike,
  div: DivisorItem,
  rules?: Pick<RulesConfig, "furos"> | RulesConfig | null
): number[] {
  const zone = resolvePrimaryDivShelfPlacementZone(box, div);
  if (!zone) return [];
  const divBottomY = resolveDivisorBottomYAbs(box, div);
  const divTopY = divBottomY + resolveDivisorDimensions(box, div).alturaMm;
  const bounds = resolveEffectiveShelfBounds(zone, divBottomY, divTopY);
  if (!bounds) return [];
  return resolveShelfGridYs(bounds.yMin, bounds.yMax, rules, resolveGridRuntimeFromBox(box));
}

function calcShelfGridYs(
  yMin: number,
  yMax: number,
  rules: RulesConfig,
  box?: DivSepBoxLike
): number[] {
  return resolveShelfGridYs(yMin, yMax, rules, resolveGridRuntimeFromBox(box));
}

/** Converte Y absoluto da caixa → Y local do painel lateral (base = topo do FUNDO). */
export function absoluteYToLateralPanelY(box: DivSepBoxLike, absoluteY: number): number {
  const espessura = Math.max(0, Number(box.espessura) || 0);
  return roundHoleMm(absoluteY - espessura);
}

function absoluteYToDivisorPanelY(divBottomY: number, _divHeightMm: number, absoluteY: number): number {
  void _divHeightMm;
  return roundHoleMm(absoluteY - divBottomY);
}

function resolveDivisorShelfPanelId(
  panelIds: { divisores?: string[] } | undefined,
  index: number
): string {
  const fromBox = panelIds?.divisores?.[index];
  if (typeof fromBox === "string" && fromBox.length > 0) return fromBox;
  return `divisorio-${index + 1}`;
}

function resolveDivisorShelfFace(lado: "esquerda" | "direita"): "A" | "B" {
  return lado === "direita" ? "A" : "B";
}

function dedupePanelDrillHoles(holes: PanelDrillHole[]): PanelDrillHole[] {
  const deduped = new Map<string, PanelDrillHole>();
  for (const hole of holes) {
    const key = [
      roundHoleMm(hole.x),
      roundHoleMm(hole.y),
      roundHoleMm(hole.diameter),
      roundHoleMm(hole.depth),
      hole.holeType ?? "",
      hole.face ?? "",
      hole.topDrillable === false ? "0" : "1",
    ].join("|");
    if (!deduped.has(key)) deduped.set(key, hole);
  }
  return [...deduped.values()];
}

export type DivShelfDrillingResult = {
  lateral_esquerda: PanelDrillHole[];
  lateral_direita: PanelDrillHole[];
  divisorio: Map<string, PanelDrillHole[]>;
};

function pushLateralPair(
  out: PanelDrillHole[],
  lateralTipo: "lateral_esquerda" | "lateral_direita",
  profundidadeLateral: number,
  margemFrente: number,
  margemFundo: number,
  lateralY: number,
  diametro: number,
  profundidade: number
): void {
  const xFrente = lateralTipo === "lateral_esquerda" ? profundidadeLateral - margemFrente : margemFrente;
  const xFundo = lateralTipo === "lateral_esquerda" ? margemFundo : profundidadeLateral - margemFundo;
  out.push({
    x: xFrente,
    y: lateralY,
    diameter: diametro,
    depth: profundidade,
    holeType: "prateleira",
    face: "B",
    topDrillable: true,
  });
  out.push({
    x: xFundo,
    y: lateralY,
    diameter: diametro,
    depth: profundidade,
    holeType: "prateleira",
    face: "B",
    topDrillable: true,
  });
}

/** Zona de prateleiras só-SEP (sem DIV): superior ou inferior. */
export function resolveSepOnlyShelfPlacementZone(box: DivSepBoxLike): VerticalCompartment | null {
  if (boxHasDivisores(box)) return null;
  if (!boxHasSeparadores(box)) return null;
  const direcao = resolveShelfDirecao(box);
  const zones = resolveVerticalCompartments(box).filter((z) => z.shelfEnabled);
  if (zones.length === 0) return null;
  if (shelfDirecaoIsSuperior(direcao)) {
    return zones.reduce((best, zone) => (zone.yMin > best.yMin ? zone : best));
  }
  return zones.reduce((best, zone) => (zone.yMin < best.yMin ? zone : best));
}

function buildSepOnlyShelfDrilling(
  box: DivSepBoxLike,
  rules: RulesConfig
): DivShelfDrillingResult | null {
  const zone = resolveSepOnlyShelfPlacementZone(box);
  if (!zone) return null;

  const cfg = rules?.furos?.tecnicos?.prateleira;
  const diametro = cfg?.diametro ?? 5;
  const profundidade = cfg?.profundidade ?? 13;
  const margemFrente = cfg?.margemFrente ?? cfg?.distanciaDaBorda ?? 60;
  const margemFundo = cfg?.margemFundo ?? cfg?.distanciaDaBorda ?? 60;
  const internal = getDivSepInternalDims(box);
  const profundidadeLateral = internal.profundidadeInterna;

  const absoluteYs = calcShelfGridYs(zone.yMin, zone.yMax, rules, box);
  const lateral_esquerda: PanelDrillHole[] = [];
  const lateral_direita: PanelDrillHole[] = [];

  for (const absoluteY of absoluteYs) {
    const lateralY = absoluteYToLateralPanelY(box, absoluteY);
    pushLateralPair(
      lateral_esquerda,
      "lateral_esquerda",
      profundidadeLateral,
      margemFrente,
      margemFundo,
      lateralY,
      diametro,
      profundidade
    );
    pushLateralPair(
      lateral_direita,
      "lateral_direita",
      profundidadeLateral,
      margemFrente,
      margemFundo,
      lateralY,
      diametro,
      profundidade
    );
  }

  if (!lateral_esquerda.length && !lateral_direita.length) return null;
  return {
    lateral_esquerda: dedupePanelDrillHoles(lateral_esquerda),
    lateral_direita: dedupePanelDrillHoles(lateral_direita),
    divisorio: new Map(),
  };
}

export function buildDivShelfDrilling(
  box: DivSepBoxLike,
  panelIds: { divisores?: string[] } | undefined,
  rules: RulesConfig
): DivShelfDrillingResult | null {
  if (!getDivSepRules().enableShelfHoles) return null;

  const prateleiras = Math.max(0, Math.floor(box.prateleiras ?? 0));
  if (prateleiras <= 0) return null;

  const cfg = rules?.furos?.tecnicos?.prateleira;
  if (!cfg?.enabled) return null;

  const divisores = box.divisores ?? [];
  if (divisores.length === 0) {
    return buildSepOnlyShelfDrilling(box, rules);
  }

  const internal = getDivSepInternalDims(box);
  const diametro = cfg.diametro ?? 5;
  const profundidade = cfg.profundidade ?? 13;
  const margemFrente = cfg.margemFrente ?? cfg.distanciaDaBorda ?? 60;
  const margemFundo = cfg.margemFundo ?? cfg.distanciaDaBorda ?? 60;
  const profundidadeLateral = internal.profundidadeInterna;

  const lateral_esquerda: PanelDrillHole[] = [];
  const lateral_direita: PanelDrillHole[] = [];
  const divisorio = new Map<string, PanelDrillHole[]>();

  const boxDirecao = resolveShelfDirecao(box);

  divisores.forEach((div, index) => {
    const lado =
      div.prateleiraLado ??
      (boxDirecao === "esquerda" || boxDirecao === "direita"
        ? boxDirecao
        : direcaoToPrateleiraLado(boxDirecao));
    const compartments = resolveVerticalCompartments(box, lado);
    const panelId = resolveDivisorShelfPanelId(panelIds, index);
    const divFace = resolveDivisorShelfFace(lado);
    const divHoles: PanelDrillHole[] = [];
    const divDims = resolveDivisorDimensions(box, div);
    const divBottomY = resolveDivisorBottomYAbs(box, div);
    const divTopY = divBottomY + divDims.alturaMm;

    const lateralTipo = lado === "esquerda" ? "lateral_esquerda" : "lateral_direita";
    const lateralOut = lateralTipo === "lateral_esquerda" ? lateral_esquerda : lateral_direita;

    const divXFrente = margemFrente;
    const divXFundo = divDims.profundidadeMm - margemFundo;

    for (const zone of compartments) {
      const shelfBounds = resolveEffectiveShelfBounds(zone, divBottomY, divTopY);
      if (!shelfBounds) continue;
      const absoluteYs = calcShelfGridYs(shelfBounds.yMin, shelfBounds.yMax, rules, box);
      for (const absoluteY of absoluteYs) {
        const lateralY = absoluteYToLateralPanelY(box, absoluteY);
        const divisorY = absoluteYToDivisorPanelY(divBottomY, divDims.alturaMm, absoluteY);
        pushLateralPair(
          lateralOut,
          lateralTipo,
          profundidadeLateral,
          margemFrente,
          margemFundo,
          lateralY,
          diametro,
          profundidade
        );
        divHoles.push({
          x: divXFrente,
          y: divisorY,
          diameter: diametro,
          depth: profundidade,
          holeType: "prateleira",
          face: divFace,
          topDrillable: true,
        });
        divHoles.push({
          x: divXFundo,
          y: divisorY,
          diameter: diametro,
          depth: profundidade,
          holeType: "prateleira",
          face: divFace,
          topDrillable: true,
        });
      }
    }

    if (divHoles.length) {
      const deduped = dedupePanelDrillHoles(divHoles);
      divisorio.set(panelId, deduped);
      if (div.id && div.id !== panelId) divisorio.set(div.id, deduped);
    }
  });

  if (!lateral_esquerda.length && !lateral_direita.length && divisorio.size === 0) return null;
  return {
    lateral_esquerda: dedupePanelDrillHoles(lateral_esquerda),
    lateral_direita: dedupePanelDrillHoles(lateral_direita),
    divisorio,
  };
}

/** Largura da prateleira no compartimento entre lateral e DIV (mm). */
export function resolveShelfWidthForDivSide(box: DivSepBoxLike, div: DivisorItem): number {
  const internal = getDivSepInternalDims(box);
  const divCenterX = resolveDivisorCenterX(box, div);
  const divDims = resolveDivisorDimensions(box, div);
  const lado =
    div.prateleiraLado ??
    (resolveShelfDirecao(box) === "esquerda" ? "esquerda" : "direita");
  const lateralInner = internal.espessura;
  const lateralOuter = internal.espessura + internal.larguraInterna;

  if (lado === "esquerda") {
    return Math.max(1, divCenterX - divDims.larguraMm / 2 - lateralInner - SHELF_DIV_CLEARANCE_MM);
  }
  return Math.max(1, lateralOuter - (divCenterX + divDims.larguraMm / 2) - SHELF_DIV_CLEARANCE_MM);
}

/** Largura de prateleira em modo só-SEP (vão interno completo). */
export function resolveShelfWidthForSepOnly(box: DivSepBoxLike): number {
  return resolveFullInternalShelfWidthMm(box);
}

export function boxUsesDivShelfMode(box: DivSepBoxLike): boolean {
  const n = Math.max(0, Math.floor(box.prateleiras ?? 0));
  if (n <= 0) return false;
  return boxHasDivisores(box) || boxHasSeparadores(box);
}

/**
 * Zonas industriais onde cada DIV pode receber prateleiras.
 * Zona acima do SEP só para DIV ligado acima (ou direcção superior).
 * SEP parcial do lado oposto a `prateleiraLado` não bloqueia nem parte a zona.
 */
export function resolveDivShelfPlacementZones(
  box: DivSepBoxLike,
  div: DivisorItem
): VerticalCompartment[] {
  const lado =
    div.prateleiraLado ??
    (resolveShelfDirecao(box) === "esquerda" ? "esquerda" : "direita");
  const divDims = resolveDivisorDimensions(box, div);
  const divBottomY = resolveDivisorBottomYAbs(box, div);
  const divTopY = divBottomY + divDims.alturaMm;
  const allowAbove = isDivisorAboveSep(div) || shelfDirecaoIsSuperior(resolveShelfDirecao(box));

  const cuttingSeps = separadoresCuttingShelfSide(box, lado);
  const sepBottoms = cuttingSeps
    .map((s) => resolveSeparadorBottomY(box, s))
    .filter((y) => Number.isFinite(y) && y > 0);
  const highestSepBottom = sepBottoms.length > 0 ? Math.max(...sepBottoms) : null;

  return resolveVerticalCompartments(box, lado).filter((zone) => {
    if (!zone.shelfEnabled) return false;
    if (!allowAbove) {
      if (highestSepBottom != null && zone.yMin >= highestSepBottom - 0.5) return false;
      if (
        highestSepBottom != null &&
        zone.yMax > highestSepBottom + 0.5 &&
        zone.yMin >= highestSepBottom - 0.5
      ) {
        return false;
      }
    }
    return resolveEffectiveShelfBounds(zone, divBottomY, divTopY) != null;
  });
}

/** Compartimento principal: mais baixo (DIV abaixo) ou mais alto (DIV acima / superior). */
export function resolvePrimaryDivShelfPlacementZone(
  box: DivSepBoxLike,
  div: DivisorItem
): VerticalCompartment | null {
  const zones = resolveDivShelfPlacementZones(box, div);
  if (zones.length === 0) return null;
  if (isDivisorAboveSep(div) || shelfDirecaoIsSuperior(resolveShelfDirecao(box))) {
    return zones.reduce((best, zone) => (zone.yMin > best.yMin ? zone : best));
  }
  return zones.reduce((best, zone) => (zone.yMin < best.yMin ? zone : best));
}

/**
 * Centros Y absolutos das N prateleiras.
 * Com `prateleiraYsMm`: posições exactas na grelha.
 * Sem: distribuição automática (comportamento anterior).
 */
export function resolveDivShelfAbsoluteCenterYs(
  box: DivSepBoxLike,
  div: DivisorItem,
  count: number,
  rules?: Pick<RulesConfig, "furos"> | RulesConfig | null
): number[] {
  const n = Math.max(0, Math.floor(count));
  const zone = resolvePrimaryDivShelfPlacementZone(box, div);
  if (!zone || n < 1) return [];

  const divBottomY = resolveDivisorBottomYAbs(box, div);
  const divTopY = divBottomY + resolveDivisorDimensions(box, div).alturaMm;
  const bounds = resolveEffectiveShelfBounds(zone, divBottomY, divTopY);
  if (!bounds) return [];

  const grid = resolveShelfGridYs(bounds.yMin, bounds.yMax, rules, resolveGridRuntimeFromBox(box));
  const selected = (div.prateleiraYsMm ?? [])
    .map((y) => roundHoleMm(y))
    .filter((y) => grid.some((g) => Math.abs(g - y) <= 0.6))
    .sort((a, b) => a - b);

  if (selected.length > 0) {
    return selected.slice(0, n);
  }

  const spacing = (zone.yMax - zone.yMin) / (n + 1);
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    ys.push(roundHoleMm(zone.yMin + spacing * (i + 1)));
  }
  return ys;
}

/** Centros Y das N prateleiras em modo só-SEP. */
export function resolveSepOnlyShelfAbsoluteCenterYs(
  box: DivSepBoxLike,
  count: number,
  rules?: Pick<RulesConfig, "furos"> | RulesConfig | null
): number[] {
  const n = Math.max(0, Math.floor(count));
  const zone = resolveSepOnlyShelfPlacementZone(box);
  if (!zone || n < 1) return [];
  const grid = resolveShelfGridYs(zone.yMin, zone.yMax, rules, resolveGridRuntimeFromBox(box));
  if (grid.length >= n) {
    // Distribui N posições ao longo da grelha.
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.round(((i + 1) / (n + 1)) * (grid.length - 1));
      ys.push(grid[Math.min(grid.length - 1, Math.max(0, idx))]!);
    }
    return ys;
  }
  const spacing = (zone.yMax - zone.yMin) / (n + 1);
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    ys.push(roundHoleMm(zone.yMin + spacing * (i + 1)));
  }
  return ys;
}

export function countDivShelfPanels(box: DivSepBoxLike): number {
  const n = Math.max(0, Math.floor(box.prateleiras ?? 0));
  if (n <= 0) return 0;
  const divisores = box.divisores ?? [];
  if (divisores.length === 0) {
    return resolveSepOnlyShelfPlacementZone(box) != null ? n : 0;
  }
  let total = 0;
  for (const div of divisores) {
    if (resolvePrimaryDivShelfPlacementZone(box, div) != null) total += n;
  }
  return total;
}
