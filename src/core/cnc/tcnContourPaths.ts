/**
 * Fase E — paths de contorno TCN (sem Three.js).
 * Exterior: compensação da fresa para fora. Interior: inset para dentro.
 * Rectângulo exterior = `buildContourPathV1Style` (caixaria 19 mm inalterada).
 */

import type { CutPlacement, SheetDefinition } from "../cutlayout/cutLayoutTypes";
import { holeLocalToSheetOffsetMm } from "../cutlayout/layoutCoordinateSystem";
import { TAMPO_FIXED_WIDTH_MM } from "../remate/tampoCozinhaRules";

export type TcnPoint2 = { x: number; y: number };
export type TcnPathPoint = { x: number; y: number; z: number };
export type TcnContourPath = {
  w89: { x: number; y: number };
  path: TcnPathPoint[];
};

type PlacementTcnExt = CutPlacement & {
  originalOuterPolygonMm?: Array<{ x: number; y: number }>;
};

const EPS_MM = 0.001;
const EXIT_OVERRUN_MM = 20;
export const INNER_CIRCLE_SEGMENTS = 32;

function unit(v: TcnPoint2): TcnPoint2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-12) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function ringWithoutClose(points: TcnPoint2[]): TcnPoint2[] {
  if (points.length < 3) return [];
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  const a = out[0]!;
  const b = out[out.length - 1]!;
  if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) out.pop();
  return out;
}

function polygonSignedArea(pts: TcnPoint2[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    area += p.x * q.y - q.x * p.y;
  }
  return area / 2;
}

function ensureCcw(pts: TcnPoint2[]): TcnPoint2[] {
  return polygonSignedArea(pts) < 0 ? [...pts].reverse() : pts;
}

function intersectLines(p1: TcnPoint2, d1: TcnPoint2, p2: TcnPoint2, d2: TcnPoint2): TcnPoint2 | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-12) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / cross;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

/** Offset para fora de um anel CCW (convexos: rectângulo / trapézio milan). */
export function offsetPolygonOutward(points: TcnPoint2[], distMm: number): TcnPoint2[] {
  const ring = ensureCcw(ringWithoutClose(points));
  if (ring.length < 3) return [];
  const R = Math.max(0, distMm);
  if (R === 0) return ring.map((p) => ({ ...p }));

  const n = ring.length;
  const out: TcnPoint2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!;
    const curr = ring[i]!;
    const next = ring[(i + 1) % n]!;
    const e1 = unit({ x: curr.x - prev.x, y: curr.y - prev.y });
    const e2 = unit({ x: next.x - curr.x, y: next.y - curr.y });
    const n1 = { x: e1.y, y: -e1.x };
    const n2 = { x: e2.y, y: -e2.x };
    const line1p = { x: curr.x + n1.x * R, y: curr.y + n1.y * R };
    const line2p = { x: curr.x + n2.x * R, y: curr.y + n2.y * R };
    out.push(intersectLines(line1p, e1, line2p, e2) ?? line1p);
  }
  return out;
}

export function isAxisAlignedRectangle(points: TcnPoint2[]): { x: number; y: number; w: number; h: number } | null {
  const ring = ringWithoutClose(points);
  if (ring.length !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 4]!;
    if (Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6) return null;
  }
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  if (w <= EPS_MM || h <= EPS_MM) return null;
  const corners = new Set(ring.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`));
  const expected = [
    `${x.toFixed(4)},${y.toFixed(4)}`,
    `${(x + w).toFixed(4)},${y.toFixed(4)}`,
    `${(x + w).toFixed(4)},${(y + h).toFixed(4)}`,
    `${x.toFixed(4)},${(y + h).toFixed(4)}`,
  ];
  if (!expected.every((c) => corners.has(c))) return null;
  return { x, y, w, h };
}

/**
 * Contorno EXTERIOR (v1): rampa em Y + rect, centro da ferramenta FORA por R.
 * x,y,w,h: placement nominal (canto físico inferior-esquerdo).
 */
export function buildContourPathV1Style(
  x: number,
  y: number,
  w: number,
  h: number,
  toolRadiusMm: number,
  thicknessMm: number,
  zSafe: number,
  rampDistMm: number
): TcnContourPath {
  const R = Math.max(0, toolRadiusMm);
  const x0 = x - R;
  const x1 = x + w + R;
  const y0 = y - R;
  const y1 = y + h + R;
  const eyBase = (y0 + y1) / 2;
  const zCut = -Math.abs(thicknessMm);

  const w89 = { x: x0, y: eyBase + rampDistMm };
  const yExit = Math.max(y0, eyBase - EXIT_OVERRUN_MM);
  const yLift = Math.max(y0, eyBase - EXIT_OVERRUN_MM - rampDistMm);

  const path: TcnPathPoint[] = [
    { x: x0, y: eyBase, z: zCut },
    { x: x0, y: y0, z: zCut },
    { x: x1, y: y0, z: zCut },
    { x: x1, y: y1, z: zCut },
    { x: x0, y: y1, z: zCut },
    { x: x0, y: eyBase, z: zCut },
    { x: x0, y: yExit, z: zCut },
    { x: x0, y: yLift, z: zSafe },
  ];
  return { w89, path };
}

function buildV1StyleFromOffsetRing(
  offset: TcnPoint2[],
  thicknessMm: number,
  zSafe: number,
  rampDistMm: number
): TcnContourPath {
  const ring = ensureCcw(ringWithoutClose(offset));
  if (ring.length < 3) {
    return { w89: { x: 0, y: 0 }, path: [] };
  }
  let startIdx = 0;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[startIdx]!;
    if (a.x < b.x - 1e-9 || (Math.abs(a.x - b.x) < 1e-9 && a.y < b.y)) startIdx = i;
  }
  const ordered = [...ring.slice(startIdx), ...ring.slice(0, startIdx)];
  const xs = ordered.map((p) => p.x);
  const ys = ordered.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const eyBase = (y0 + y1) / 2;
  const zCut = -Math.abs(thicknessMm);
  const yExit = Math.max(y0, eyBase - EXIT_OVERRUN_MM);
  const yLift = Math.max(y0, eyBase - EXIT_OVERRUN_MM - rampDistMm);

  const path: TcnPathPoint[] = [
    { x: x0, y: eyBase, z: zCut },
    ...ordered.map((p) => ({ x: p.x, y: p.y, z: zCut })),
    { x: x0, y: eyBase, z: zCut },
    { x: x0, y: yExit, z: zCut },
    { x: x0, y: yLift, z: zSafe },
  ];
  return { w89: { x: x0, y: eyBase + rampDistMm }, path };
}

export function buildPolygonContourPath(
  points: TcnPoint2[],
  toolOffsetMm: number,
  thicknessMm: number,
  zSafe: number,
  rampDistMm: number
): TcnContourPath {
  const rect = isAxisAlignedRectangle(points);
  if (rect) {
    return buildContourPathV1Style(
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      toolOffsetMm,
      thicknessMm,
      zSafe,
      rampDistMm
    );
  }
  const offset = offsetPolygonOutward(points, toolOffsetMm);
  return buildV1StyleFromOffsetRing(offset, thicknessMm, zSafe, rampDistMm);
}

/** Contorno interno rectangular: centro da ferramenta DENTRO (inset = raio). */
export function buildInnerContourPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  toolRadiusMm: number
): TcnPathPoint[] {
  const inset = Math.max(0, toolRadiusMm);
  if (w <= 2 * inset || h <= 2 * inset) return [];
  const x0 = x + inset;
  const y0 = y + inset;
  const x1 = x + w - inset;
  const y1 = y + h - inset;
  return [
    { x: x0, y: y0, z },
    { x: x0, y: y1, z },
    { x: x1, y: y1, z },
    { x: x1, y: y0, z },
    { x: x0, y: y0, z },
  ];
}

export function buildInnerContourPath(
  x: number,
  y: number,
  w: number,
  h: number,
  zCut: number,
  zSafe: number,
  toolOffsetMm: number
): TcnContourPath | null {
  const pts = buildInnerContourPoints(x, y, w, h, zCut, toolOffsetMm);
  if (pts.length === 0) return null;
  const first = pts[0]!;
  return {
    w89: { x: first.x, y: first.y },
    path: [...pts, { x: first.x, y: first.y, z: zSafe }],
  };
}

export function buildInnerCirclePath(
  cx: number,
  cy: number,
  diameterMm: number,
  zCut: number,
  zSafe: number,
  toolOffsetMm: number,
  segments: number = INNER_CIRCLE_SEGMENTS
): TcnContourPath | null {
  const r = diameterMm / 2 - Math.max(0, toolOffsetMm);
  if (!(r > EPS_MM) || segments < 8) return null;
  const n = Math.max(8, Math.round(segments));
  const pts: TcnPathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: zCut });
  }
  const first = pts[0]!;
  pts.push({ x: first.x, y: first.y, z: zSafe });
  return { w89: { x: first.x, y: first.y }, path: pts };
}

function normalizedRotation(rotacao: number): number {
  return ((rotacao ?? 0) % 360 + 360) % 360;
}

function localPolygonForTcn(pl: CutPlacement): TcnPoint2[] | undefined {
  const ext = pl as PlacementTcnExt;
  const poly = ext.originalOuterPolygonMm ?? pl.outerPolygonMm;
  if (poly && poly.length >= 3) return poly;
  return undefined;
}

function toSheetPoint(pl: CutPlacement, hx: number, hy: number): TcnPoint2 {
  const rot = normalizedRotation(pl.rotacao);
  const off = holeLocalToSheetOffsetMm(hx, hy, rot, pl.largura_mm, pl.altura_mm);
  return { x: pl.x_mm + off.sx, y: pl.y_mm + off.sy };
}

export function sheetPolygonFromPlacement(pl: CutPlacement): TcnPoint2[] | undefined {
  const poly = localPolygonForTcn(pl);
  if (!poly) return undefined;
  return poly.map((p) => toSheetPoint(pl, p.x, p.y));
}

export function buildPlacementExteriorContourPath(
  pl: CutPlacement,
  toolOffsetMm: number,
  thicknessMm: number,
  zSafe: number,
  rampDistMm: number
): TcnContourPath {
  const sheetPoly = sheetPolygonFromPlacement(pl);
  if (sheetPoly && sheetPoly.length >= 3) {
    return buildPolygonContourPath(sheetPoly, toolOffsetMm, thicknessMm, zSafe, rampDistMm);
  }
  return buildContourPathV1Style(
    pl.x_mm,
    pl.y_mm,
    pl.largura_mm,
    pl.altura_mm,
    toolOffsetMm,
    thicknessMm,
    zSafe,
    rampDistMm
  );
}

export function buildPlacementInnerContourPaths(
  pl: CutPlacement,
  toolOffsetMm: number,
  zCut: number,
  zSafe: number
): TcnContourPath[] {
  const contours = pl.innerContours;
  if (!contours?.length) return [];
  const rot = normalizedRotation(pl.rotacao);
  const out: TcnContourPath[] = [];
  for (const rect of contours) {
    if (rect.innerCircle && rect.innerCircle.diameter_mm > 0) {
      const ctr = toSheetPoint(pl, rect.innerCircle.cx_mm, rect.innerCircle.cy_mm);
      const circle = buildInnerCirclePath(
        ctr.x,
        ctr.y,
        rect.innerCircle.diameter_mm,
        zCut,
        zSafe,
        toolOffsetMm
      );
      if (circle) out.push(circle);
      continue;
    }
    const offR = holeLocalToSheetOffsetMm(rect.x_mm, rect.y_mm, rot, pl.largura_mm, pl.altura_mm);
    const iw = rot === 90 ? rect.altura_mm : rect.largura_mm;
    const ih = rot === 90 ? rect.largura_mm : rect.altura_mm;
    const inner = buildInnerContourPath(
      pl.x_mm + offR.sx,
      pl.y_mm + offR.sy,
      iw,
      ih,
      zCut,
      zSafe,
      toolOffsetMm
    );
    if (inner) out.push(inner);
  }
  return out;
}

export function isTampoTcnPlacement(pl: CutPlacement): boolean {
  if ((pl.outerPolygonMm?.length ?? 0) >= 3) return true;
  if ((pl as PlacementTcnExt).originalOuterPolygonMm && (pl as PlacementTcnExt).originalOuterPolygonMm!.length >= 3) {
    return true;
  }
  if (/tampo/i.test(pl.partName ?? "")) return true;
  const meta = pl.metadata as { productType?: string } | undefined;
  return meta?.productType === "TAMPO_COZINHA";
}

export function isPlacementInsideSheet(
  x: number,
  y: number,
  w: number,
  h: number,
  sheetW: number,
  sheetH: number
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return false;
  if (w <= 0 || h <= 0) return false;
  if (x < -EPS_MM || y < -EPS_MM) return false;
  if (x + w > sheetW + EPS_MM) return false;
  if (y + h > sheetH + EPS_MM) return false;
  return true;
}

function rectToolCenterExteriorFromPlacementMm(
  x: number,
  y: number,
  w: number,
  h: number,
  toolRadiusMm: number
): { x0: number; y0: number; x1: number; y1: number } {
  const R = Math.max(0, toolRadiusMm);
  return { x0: x - R, y0: y - R, x1: x + w + R, y1: y + h + R };
}

function rectDistance(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.sqrt(dx * dx + dy * dy);
}

function aabbOfPoints(pts: TcnPoint2[]): { x0: number; y0: number; x1: number; y1: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function contourAabbForSanitize(
  pl: CutPlacement,
  toolRadiusMm: number
): { x0: number; y0: number; x1: number; y1: number } {
  const sheetPoly = sheetPolygonFromPlacement(pl);
  if (sheetPoly && sheetPoly.length >= 3) {
    const offset = offsetPolygonOutward(sheetPoly, toolRadiusMm);
    if (offset.length >= 3) return aabbOfPoints(offset);
  }
  return rectToolCenterExteriorFromPlacementMm(pl.x_mm, pl.y_mm, pl.largura_mm, pl.altura_mm, toolRadiusMm);
}

function axisFlush(pieceMm: number, sheetMm: number): boolean {
  return Math.abs(pieceMm - sheetMm) <= 0.5;
}

/**
 * TAMPO 630 na chapa 630: margem 0 no eixo da largura do tampo.
 * Permite o centro da fresa a −R / +R para além da chapa, sem alterar DL/DH.
 */
function tampoEdgeAllowanceMm(
  pl: CutPlacement,
  sheet: SheetDefinition,
  toolRadiusMm: number,
  sheetMarginMm: number
): { minFromEdgeX: number; minFromEdgeY: number } {
  const base = Math.max(0, sheetMarginMm - toolRadiusMm);
  if (!isTampoTcnPlacement(pl)) {
    return { minFromEdgeX: base, minFromEdgeY: base };
  }
  const w = pl.largura_mm;
  const h = pl.altura_mm;
  const R = Math.max(0, toolRadiusMm);
  const flushSheetDim = (size: number) =>
    axisFlush(size, sheet.altura_mm) ||
    axisFlush(size, sheet.largura_mm) ||
    axisFlush(size, TAMPO_FIXED_WIDTH_MM);
  return {
    minFromEdgeX: flushSheetDim(w) ? R : base,
    minFromEdgeY: flushSheetDim(h) ? R : base,
  };
}

export function sanitizePlacementsForTcn(
  placements: CutPlacement[],
  sheet: SheetDefinition,
  minSpacingMm: number,
  toolRadiusMm: number,
  sheetMarginMm: number
): CutPlacement[] {
  const unique: CutPlacement[] = [];
  const placedRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const signatures = new Set<string>();

  for (const pl of placements) {
    const x = pl.x_mm;
    const y = pl.y_mm;
    const w = pl.largura_mm;
    const h = pl.altura_mm;

    const signature = `${Math.round(x * 1000)}:${Math.round(y * 1000)}:${Math.round(w * 1000)}:${Math.round(h * 1000)}`;
    if (signatures.has(signature)) continue;

    if (!isPlacementInsideSheet(x, y, w, h, sheet.largura_mm, sheet.altura_mm)) continue;

    const contour = contourAabbForSanitize(pl, toolRadiusMm);
    const { minFromEdgeX, minFromEdgeY } = tampoEdgeAllowanceMm(pl, sheet, toolRadiusMm, sheetMarginMm);
    if (
      contour.x0 < -minFromEdgeX ||
      contour.y0 < -minFromEdgeY ||
      contour.x1 > sheet.largura_mm + minFromEdgeX ||
      contour.y1 > sheet.altura_mm + minFromEdgeY
    ) {
      continue;
    }

    const rect = { x, y, w, h };
    const tooClose = placedRects.some((r) => rectDistance(r, rect) < minSpacingMm - EPS_MM);
    if (tooClose) continue;

    signatures.add(signature);
    placedRects.push(rect);
    unique.push(pl);
  }

  return unique;
}
