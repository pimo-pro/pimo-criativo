/**
 * Catalogo industrial de furacao de corredicas nos laterais do modulo.
 *
 * Coordenadas X: distancia a frente interior do corpo (mm).
 * Coordenadas Y: altura do eixo da linha de furacao acima da base da gaveta (mm).
 *
 * Padrao de marcacao (modulo):
 *   X1 = 38 mm (frente)
 *   X_last = profundidadeLateral - 38 mm (traseira)
 *   NL 350-400 → 4 furos; NL 450-600 → 5 furos (sistemas proporcionais)
 *   Todos os furos: marcacao, profundidade 1 mm (nao estruturais).
 *
 * Hettich Quadro V6 YOU M: dois intermedios oficiais a 38+b1(NL) da frente e da traseira.
 * NL 550/600: sem b1 confirmado → fallback proporcional (TODO).
 * ArciTech / Blum / etc.: distribuicao proporcional entre X1 e X_last.
 */

import type { DrawerSlideType } from "../../settings/settingsSchema";
import {
  DRAWER_SLIDE_LENGTHS_MM,
  type DrawerSlideLengthMm,
  resolveDrawerSlideLength,
} from "../drawerSlideDepth";
import {
  lookupQuadroV6B1Mm,
  quadroV6IntermediateDistanceFromFaceMm,
} from "./hettichQuadroV6B1Config";

/**
 * Eixo Y da corrediça GAV_1 no **lateral do módulo** (mm desde a base do painel).
 * Não confundir com o datum de montagem no lado da gaveta (22,5 mm acima da base
 * da lateral — ver DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM).
 * Com bodyBottom(lowest)=18,5 → dY guia↔lado = 41 − 18,5 = 22,5.
 */
export const SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM = 41;

/** Recuo frontal / traseiro simetrico nos laterais do modulo (mm). */
export const MODULE_SLIDE_EDGE_SETBACK_MM = 38;

/** Profundidade de marcacao dos furos de corredica no modulo (mm). */
export const MODULE_SLIDE_MARK_DEPTH_MM = 1;

export type SlideHoleRole = "front" | "mark" | "mount" | "rear";

export type SlideDrillingHoleDef = {
  /** Distancia a frente do painel (mm). */
  xFromFrontMm: number;
  role: SlideHoleRole;
  /** Furo so de marcacao (profundidade reduzida). */
  isMarkOnly?: boolean;
};

export type SlideDrillingLengthTable = {
  comprimentoMm: DrawerSlideLengthMm;
  holes: SlideDrillingHoleDef[];
};

export type SlideDrillingSystemTable = {
  slideType: DrawerSlideType | string;
  /** Altura do eixo da corredica acima da base da gaveta (mm). */
  alturaRelativaFundoMm: number;
  diametroMm: number;
  profundidadeMm: number;
  profundidadeMarkMm: number;
  /** Espelhar X completo entre esquerda e direita. */
  mirrorLeftRight: boolean;
  /** Fonte / notas de validacao. */
  source: string;
  byLength: SlideDrillingLengthTable[];
  /**
   * Quadro V6: resolver b1 via lookup SSOT (null → fallback proporcional).
   * Outros sistemas: sem lookup.
   */
  useQuadroOfficialB1Lookup?: boolean;
};

/** Frente do modulo -> 1.o furo (atelier / ficha YOU: 38 mm). */
export const QUADRO_V6_YOU_M_FRONT_X_MM = MODULE_SLIDE_EDGE_SETBACK_MM;

export const HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM =
  "Hettich Quadro V6 You M Silent System" as const;

/** Contagem de furos de marcacao por comprimento nominal (sistemas proporcionais). */
export function moduleSlideHoleCountForNl(nl: number): 4 | 5 {
  return nl <= 400 ? 4 : 5;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function holesFromXs(xs: number[]): SlideDrillingHoleDef[] {
  return xs.map((x, i) => {
    const role: SlideHoleRole =
      i === 0 ? "front" : i === xs.length - 1 ? "rear" : "mark";
    return { xFromFrontMm: x, role, isMarkOnly: true };
  });
}

/**
 * Padrao Quadro oficial: X1=38, midF=38+b1, midR=D-(38+b1), X_last=D-38.
 * Distancia real = sempre 38+b1 (nunca b1 sozinho).
 */
function buildQuadroOfficialIntermediatePattern(
  panelDepthMm: number,
  b1Mm: number
): SlideDrillingHoleDef[] {
  const x1 = MODULE_SLIDE_EDGE_SETBACK_MM;
  const depth = Math.max(x1 * 2 + 10, Number(panelDepthMm) || 0);
  const xLast = depth - MODULE_SLIDE_EDGE_SETBACK_MM;
  const distFromFace = quadroV6IntermediateDistanceFromFaceMm(
    b1Mm,
    MODULE_SLIDE_EDGE_SETBACK_MM
  );
  const xMidF = round1(distFromFace);
  const xMidR = round1(depth - distFromFace);
  const xs = [...new Set([x1, xMidF, xMidR, xLast].map(round1))].sort(
    (a, b) => a - b
  );
  if (xs[0] !== x1) xs[0] = x1;
  if (xs[xs.length - 1] !== xLast) xs[xs.length - 1] = xLast;
  return holesFromXs(xs);
}

/**
 * Constroi o padrao de marcacao simetrico nos laterais do modulo.
 * Com b1 oficial (Quadro): dois intermedios a 38+b1.
 * Sem b1: X1=38; X_last=D-38; intermedios proporcionais (4/5 por NL).
 */
export function buildModuleSlideMarkingPattern(input: {
  comprimentoMm: number;
  panelDepthMm: number;
  /** b1 oficial Hettich (mm). Se definido, usa padrao Quadro 38+b1. */
  officialB1Mm?: number | null;
}): SlideDrillingHoleDef[] {
  const x1 = MODULE_SLIDE_EDGE_SETBACK_MM;
  const depth = Math.max(x1 * 2 + 10, Number(input.panelDepthMm) || input.comprimentoMm);
  const xLast = depth - MODULE_SLIDE_EDGE_SETBACK_MM;

  if (input.officialB1Mm != null && Number.isFinite(input.officialB1Mm)) {
    return buildQuadroOfficialIntermediatePattern(depth, input.officialB1Mm);
  }

  // Fallback proporcional (ArciTech / Quadro NL 550-600 sem b1 / genericos).
  const nTotal = moduleSlideHoleCountForNl(input.comprimentoMm);
  const nMid = nTotal - 2;
  const xs: number[] = [x1];
  for (let i = 1; i <= nMid; i++) {
    xs.push(round1(x1 + ((xLast - x1) * i) / (nMid + 1)));
  }
  xs.push(xLast);

  const unique = [...new Set(xs.map((x) => round1(x)))].sort((a, b) => a - b);
  if (unique[0] !== x1) unique[0] = x1;
  if (unique[unique.length - 1] !== xLast) unique[unique.length - 1] = xLast;

  let finalXs = unique;
  if (finalXs.length < nTotal) {
    finalXs = [];
    for (let i = 0; i < nTotal; i++) {
      finalXs.push(round1(x1 + ((xLast - x1) * i) / (nTotal - 1)));
    }
  }

  return holesFromXs(finalXs);
}

function resolveOfficialB1ForTable(
  table: Pick<SlideDrillingSystemTable, "useQuadroOfficialB1Lookup">,
  nl: number
): number | undefined {
  if (!table.useQuadroOfficialB1Lookup) return undefined;
  const b1 = lookupQuadroV6B1Mm(nl);
  return b1 == null ? undefined : b1;
}

function lengthsForSystem(
  options?: Pick<SlideDrillingSystemTable, "useQuadroOfficialB1Lookup">
): SlideDrillingLengthTable[] {
  // Lazy: evita TDZ/ciclo de imports com drawerSlideDepth durante o boot do módulo.
  const lengths = DRAWER_SLIDE_LENGTHS_MM ?? [];
  return lengths.map((nl) => ({
    comprimentoMm: nl,
    // Tabela nominal: D = NL (referencia). resolveSlideDrillingPattern recalcula com panelDepth real.
    holes: buildModuleSlideMarkingPattern({
      comprimentoMm: nl,
      panelDepthMm: nl,
      officialB1Mm: resolveOfficialB1ForTable(options ?? {}, nl),
    }),
  }));
}

function buildSlideDrillingCatalog(): SlideDrillingSystemTable[] {
  return [
  {
    slideType: HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
    alturaRelativaFundoMm: SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM,
    diametroMm: 5,
    profundidadeMm: MODULE_SLIDE_MARK_DEPTH_MM,
    profundidadeMarkMm: MODULE_SLIDE_MARK_DEPTH_MM,
    mirrorLeftRight: true,
    source:
      "Hettich Quadro V6 YOU M Silent System — marcacao modulo (X1=38, mid=38+b1, X_last=D-38, prof. 1 mm).",
    useQuadroOfficialB1Lookup: true,
    byLength: lengthsForSystem({ useQuadroOfficialB1Lookup: true }),
  },
  {
    slideType: "Hettich ArciTech",
    alturaRelativaFundoMm: SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM,
    diametroMm: 5,
    profundidadeMm: MODULE_SLIDE_MARK_DEPTH_MM,
    profundidadeMarkMm: MODULE_SLIDE_MARK_DEPTH_MM,
    mirrorLeftRight: true,
    source:
      "Hettich ArciTech — marcacao modulo (X1=38, X_last=D-38, 4/5 furos, prof. 1 mm).",
    byLength: lengthsForSystem(),
  },
  {
    slideType: "Hettich InnoTech",
    alturaRelativaFundoMm: SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM,
    diametroMm: 5,
    profundidadeMm: MODULE_SLIDE_MARK_DEPTH_MM,
    profundidadeMarkMm: MODULE_SLIDE_MARK_DEPTH_MM,
    mirrorLeftRight: true,
    source: "Hettich InnoTech — mesmo padrao de marcacao que ArciTech.",
    byLength: lengthsForSystem(),
  },
  {
    slideType: "Genérica",
    alturaRelativaFundoMm: SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM,
    diametroMm: 5,
    profundidadeMm: MODULE_SLIDE_MARK_DEPTH_MM,
    profundidadeMarkMm: MODULE_SLIDE_MARK_DEPTH_MM,
    mirrorLeftRight: true,
    source: "Padrao atelier generico — marcacao modulo (X1=38, X_last=D-38, prof. 1 mm).",
    byLength: lengthsForSystem(),
  },
  {
    slideType: "Blum Tandem",
    alturaRelativaFundoMm: SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM,
    diametroMm: 5,
    profundidadeMm: MODULE_SLIDE_MARK_DEPTH_MM,
    profundidadeMarkMm: MODULE_SLIDE_MARK_DEPTH_MM,
    mirrorLeftRight: true,
    source: "Blum TANDEM — marcacao modulo (X1=38, X_last=D-38, prof. 1 mm).",
    byLength: lengthsForSystem(),
  },
  {
    slideType: "Blum Movento",
    alturaRelativaFundoMm: SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM,
    diametroMm: 5,
    profundidadeMm: MODULE_SLIDE_MARK_DEPTH_MM,
    profundidadeMarkMm: MODULE_SLIDE_MARK_DEPTH_MM,
    mirrorLeftRight: true,
    source: "Blum MOVENTO — marcacao modulo (X1=38, X_last=D-38, prof. 1 mm).",
    byLength: lengthsForSystem(),
  },
  {
    slideType: "Hafele Matrix",
    alturaRelativaFundoMm: SLIDE_AXIS_FROM_DRAWER_BOTTOM_MM,
    diametroMm: 5,
    profundidadeMm: MODULE_SLIDE_MARK_DEPTH_MM,
    profundidadeMarkMm: MODULE_SLIDE_MARK_DEPTH_MM,
    mirrorLeftRight: true,
    source: "Hafele Matrix — marcacao modulo (X1=38, X_last=D-38, prof. 1 mm).",
    byLength: lengthsForSystem(),
  },
  ];
}

let _slideDrillingCatalog: SlideDrillingSystemTable[] | null = null;
function getSlideDrillingCatalog(): SlideDrillingSystemTable[] {
  if (!_slideDrillingCatalog) _slideDrillingCatalog = buildSlideDrillingCatalog();
  return _slideDrillingCatalog;
}

function getByTypeMap(): Map<string, SlideDrillingSystemTable> {
  return new Map(getSlideDrillingCatalog().map((e) => [e.slideType, e]));
}

/** Aliases de UI / legado -> entrada canonica do catalogo. */
const SLIDE_TYPE_ALIASES: Record<string, string> = {
  "Hettich Quadro V6 You M Silent System": HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
  "Hettich Quadro V6 YOU M Silent System": HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
  "Hettich Quadro V6": HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
  "Quadro V6 You M Silent System": HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
  "Quadro V6 YOU M": HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
  "Quadro V6": HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
};

export function listSlideDrillingCatalog(): readonly SlideDrillingSystemTable[] {
  return getSlideDrillingCatalog();
}

export function getSlideDrillingSystemTable(
  slideType?: string | null
): SlideDrillingSystemTable {
  const BY_TYPE = getByTypeMap();
  if (slideType) {
    const canonical = SLIDE_TYPE_ALIASES[slideType] ?? slideType;
    if (BY_TYPE.has(canonical)) return BY_TYPE.get(canonical)!;
    const lower = slideType.toLowerCase();
    if (lower.includes("quadro")) {
      return BY_TYPE.get(HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM)!;
    }
  }
  return BY_TYPE.get("Hettich ArciTech")!;
}

export type ResolvedSlideDrillingPattern = {
  slideType: string;
  comprimentoMm: DrawerSlideLengthMm;
  alturaRelativaFundoMm: number;
  diametroMm: number;
  profundidadeMm: number;
  profundidadeMarkMm: number;
  mirrorLeftRight: boolean;
  holes: SlideDrillingHoleDef[];
  source: string;
};

/**
 * Resolve a tabela de furacao para um slideType + profundidade de painel/util.
 * Escolhe o maior comprimento industrial <= profundidade disponivel.
 * Furos recalculados com X_last = panelDepthMm - 38 (simetria L/R).
 */
export function resolveSlideDrillingPattern(input: {
  slideType?: string | null;
  panelDepthMm: number;
  /** Comprimento forcado (ex. settings.modeloPI.comprimentoCorredicaMm). */
  preferredLengthMm?: number | null;
}): ResolvedSlideDrillingPattern {
  const table = getSlideDrillingSystemTable(input.slideType);
  const preferred =
    input.preferredLengthMm != null && Number.isFinite(input.preferredLengthMm)
      ? Number(input.preferredLengthMm)
      : null;
  const length = (
    preferred != null && (DRAWER_SLIDE_LENGTHS_MM as readonly number[]).includes(preferred)
      ? preferred
      : resolveDrawerSlideLength(input.panelDepthMm)
  ) as DrawerSlideLengthMm;

  const holes = buildModuleSlideMarkingPattern({
    comprimentoMm: length,
    panelDepthMm: input.panelDepthMm,
    officialB1Mm: resolveOfficialB1ForTable(table, length),
  });

  return {
    slideType: table.slideType,
    comprimentoMm: length,
    alturaRelativaFundoMm: table.alturaRelativaFundoMm,
    diametroMm: table.diametroMm,
    profundidadeMm: table.profundidadeMm,
    profundidadeMarkMm: table.profundidadeMarkMm,
    mirrorLeftRight: table.mirrorLeftRight,
    holes,
    source: table.source,
  };
}

/**
 * Converte X a partir da frente para coordenada de painel por lado.
 * Espelhamento completo e simetrico (corrige bug do mark so a direita).
 */
export function mirrorSlideHoleXFromFront(
  xFromFrontMm: number,
  panelDepthMm: number,
  side: "left" | "right",
  mirrorLeftRight: boolean
): number {
  if (!mirrorLeftRight || side === "right") return xFromFrontMm;
  return panelDepthMm - xFromFrontMm;
}

/** Clamp de furo ao interior do painel com margem = raio. */
export function clampHoleToPanel(
  x: number,
  y: number,
  panelWidthMm: number,
  panelHeightMm: number,
  diameterMm: number
): { x: number; y: number; clamped: boolean } {
  const margin = Math.max(1, diameterMm / 2 + 0.5);
  const maxX = Math.max(margin, panelWidthMm - margin);
  const maxY = Math.max(margin, panelHeightMm - margin);
  const nx = Math.min(maxX, Math.max(margin, x));
  const ny = Math.min(maxY, Math.max(margin, y));
  return { x: nx, y: ny, clamped: nx !== x || ny !== y };
}

export const CORREDICA_OVERLAP_MIN_DIST_MM = 8;

/**
 * Ajusta Y de furos de corredica que colidem com furos existentes (DIV/SEP/etc.).
 * Tenta offsets pequenos; se impossivel, marca `overlapUnresolved`.
 */
export function resolveCorredicaOverlaps<T extends { x: number; y: number }>(
  corredica: T[],
  existing: Array<{ x: number; y: number }>,
  panelHeightMm: number,
  diameterMm: number
): { holes: T[]; unresolved: number } {
  if (!existing.length) return { holes: corredica, unresolved: 0 };
  const minDist = Math.max(CORREDICA_OVERLAP_MIN_DIST_MM, diameterMm + 2);
  const nudges = [0, 2, -2, 4, -4, 6, -6, 8, -8];
  let unresolved = 0;

  const result = corredica.map((hole) => {
    const collides = (y: number) =>
      existing.some((e) => {
        const dx = e.x - hole.x;
        const dy = e.y - y;
        return Math.hypot(dx, dy) < minDist;
      });

    for (const n of nudges) {
      const y = Math.min(panelHeightMm - 1, Math.max(1, hole.y + n));
      if (!collides(y)) {
        return y === hole.y ? hole : { ...hole, y };
      }
    }
    unresolved += 1;
    return hole;
  });

  return { holes: result, unresolved };
}
