/**
 * Sistema TCN v2_new (independente do v1).
 *
 * Requisitos:
 * - NÃO importar nem reutilizar lógica do `tcnGenerator.ts` (v1).
 * - Contorno: replicar comportamento geométrico do v1 (OUTSIDE + rampa em Y).
 * - Furos: coordenadas locais à peça somadas ao placement físico (pl.x_mm/pl.y_mm),
 *   com swap x↔y apenas em rotação 90°, e só depois aplicar transformPlacementToTcn.
 * - Nunca aplicar toolRadius/toolOffset nos furos.
 */

import type { SheetResult } from "../cutlayout/cutLayoutTypes";
import type { CncDrillOperation } from "./cncTypes";
import { toLayoutAbsoluteX } from "../cutlayout/layoutCoordinateSystem";
import { getSettings } from "../settings/settingsService";
import {
  logTcnThicknessDebug,
  resolveTcnPanelThicknessMm,
  resolveTcnUnmDsMm,
} from "./tcnPanelThickness";
import { resolveTcnDrillDepthMm, resolveTcnDrillDiameterMm } from "./tcnDrillParams";
import { tcnHoleLocalToSheetOffsetMm } from "./tcnHolePlacementOffset";

const HEADER = "TPA\\ALBATROS\\EDICAD\\00.00:0";

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
const fmtZ = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n);
  return Math.abs(n - rounded) < 0.0001 ? String(rounded) : n.toFixed(2);
};
const intVal = (n: number) => Math.round(Number.isFinite(n) ? n : 0);

const EPSILON_MM = 0.001;
const DEFAULT_MIN_SPACING_BETWEEN_PIECES_MM = 15;
const DEFAULT_SHEET_MARGIN_MM = 10;
const DEFAULT_RAMP_DISTANCE_MM = 20;
const DEFAULT_Z_SAFETY_MM = 10;

const TOOL_113_NOMINAL_DIAMETER_MM = 12;
const MIN_TOOL_DIAMETER_MM = 1;

function getContourToolDiameterMm(settings: { cnc?: { diametroFresaContornoMm?: number } }): number {
  const fromCnc = Number(settings?.cnc?.diametroFresaContornoMm);
  if (Number.isFinite(fromCnc) && fromCnc > 0) return Math.max(MIN_TOOL_DIAMETER_MM, fromCnc);
  return TOOL_113_NOMINAL_DIAMETER_MM;
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

function flipPointToTopRightAnchor(x: number, y: number, maxW: number, maxH: number): { x: number; y: number } {
  return { x: maxW - x, y: maxH - y };
}

/** Igual ao layout_corte_pro (toLayoutAbsoluteX em X) + âncora topo-direito da máquina. */
function transformPlacementToTcn(
  p: { x: number; y: number; z: number },
  sheetWidthMm: number,
  maxW: number,
  maxH: number
): { x: number; y: number; z: number } {
  const xAbs = toLayoutAbsoluteX(p.x, sheetWidthMm);
  const flipped = flipPointToTopRightAnchor(xAbs, p.y, maxW, maxH);
  return { x: flipped.x, y: flipped.y, z: p.z };
}

function isPlacementInsideSheet(x: number, y: number, w: number, h: number, sheetW: number, sheetH: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return false;
  if (w <= 0 || h <= 0) return false;
  if (x < -EPSILON_MM || y < -EPSILON_MM) return false;
  if (x + w > sheetW + EPSILON_MM) return false;
  if (y + h > sheetH + EPSILON_MM) return false;
  return true;
}

/**
 * Sanitização alinhada ao v1:
 * - placements duplicados: remove
 * - garante que o contorno exterior (centro ferramenta) cabe dentro da chapa, respeitando sheetMargin
 * - garante espaçamento mínimo entre peças (distância entre placements >= minSpacing)
 */
function sanitizePlacementsForTcn(
  placements: SheetResult["placements"],
  sheet: SheetResult["sheet"],
  minSpacingMm: number,
  toolRadiusMm: number,
  sheetMarginMm: number
): SheetResult["placements"] {
  const unique: SheetResult["placements"] = [];
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

    const contour = rectToolCenterExteriorFromPlacementMm(x, y, w, h, toolRadiusMm);
    const minFromEdge = Math.max(0, sheetMarginMm - toolRadiusMm);
    if (
      contour.x0 < -minFromEdge ||
      contour.y0 < -minFromEdge ||
      contour.x1 > sheet.largura_mm + minFromEdge ||
      contour.y1 > sheet.altura_mm + minFromEdge
    ) {
      continue;
    }

    const rect = { x, y, w, h };
    const tooClose = placedRects.some((r) => rectDistance(r, rect) < minSpacingMm - EPSILON_MM);
    if (tooClose) continue;

    signatures.add(signature);
    placedRects.push(rect);
    unique.push(pl);
  }

  return unique;
}

function buildToolBlock(x: number, y: number, zSafe: number): string {
  return `W#89{ ::WTs WS=1 #8015=0 #1=${fmt(x)} #2=${fmt(y)} #3=${fmtZ(zSafe)} #205=113 #1001=100 #2005=3 #2002=21000 #40=1 }W`;
}

function buildW81Drill(x: number, y: number, zDepth: number, diameter: number): string {
  const feedRate = 1000;
  const rpm = 18000;
  return `W#81{ ::WTs WS=1 #8015=0 #1=${fmt(x)} #2=${fmt(y)} #3=${fmtZ(zDepth)} #1002=${fmt(diameter)} #2008=${feedRate} #2002=${rpm} #201=1 #203=1 #1001=0 }W`;
}

function buildDrillLines(drills: CncDrillOperation[]): string[] {
  const lines: string[] = [];
  for (const d of drills) {
    if (d.tipo !== "vertical") continue;
    const zDepth = -Math.abs(d.profundidade);
    lines.push(buildW81Drill(d.x, d.y, zDepth, d.diametro));
  }
  return lines;
}

/** Usa Z de cada ponto (rampas ...); #2008=8 no primeiro movimento útil após aproximação. */
function buildW2201(points: Array<{ x: number; y: number; z: number }>, zSafe: number): string {
  const isSamePoint = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
    Math.abs(a.x - b.x) < EPSILON_MM && Math.abs(a.y - b.y) < EPSILON_MM && Math.abs(a.z - b.z) < 0.02;

  const compact: Array<{ x: number; y: number; z: number }> = [];
  for (const p of points) {
    const last = compact[compact.length - 1];
    if (!last || !isSamePoint(last, p)) compact.push(p);
  }
  if (compact.length === 0) return "";

  const feedStartIdx = compact.length > 1 && Math.abs(compact[0].z - zSafe) < 0.02 ? 1 : 0;
  return compact
    .map((p, i) => {
      const startFlag = i === feedStartIdx ? " #2008=8" : "";
      return `W#2201{ ::WTl #8015=0 #1=${fmt(p.x)} #2=${fmt(p.y)} #3=${fmtZ(p.z)}${startFlag} }W`;
    })
    .join("\n");
}

function buildSideBlock(
  n: number,
  lf: number,
  hf: number,
  sf: number,
  innerLines: string[] = [],
  leadingCloseSide: boolean = false,
  sideName: string = "top",
  includeNseq: boolean = false
): string[] {
  const lines: string[] = [];
  if (leadingCloseSide) lines.push("}SIDE");
  lines.push(`SIDE#${n}{`);
  lines.push(`$=${sideName}`);
  lines.push(`::LF=${intVal(lf)} HF=${intVal(hf)} SF=${intVal(sf)}`);
  if (includeNseq) lines.push(`::NSEQ=${n}`);
  for (const ln of innerLines) {
    if (ln !== "}") lines.push(ln);
  }
  lines.push("}SIDE");
  return lines;
}

/**
 * Contorno EXTERIOR (v1): rampa em Y + rect CW, com centro da ferramenta FORA por R.
 * x,y,w,h: placement nominal (canto físico inferior-esquerdo).
 */
function buildContourPathV1Style(
  x: number,
  y: number,
  w: number,
  h: number,
  toolRadiusMm: number,
  thicknessMm: number,
  zSafe: number,
  rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  const R = Math.max(0, toolRadiusMm);
  const x0 = x - R;
  const x1 = x + w + R;
  const y0 = y - R;
  const y1 = y + h + R;
  const eyBase = (y0 + y1) / 2;
  const zCut = -Math.abs(thicknessMm);
  const EXIT_OVERRUN_MM = 20;

  const w89 = { x: x0, y: eyBase + rampDistMm };
  const yExit = Math.max(y0, eyBase - EXIT_OVERRUN_MM);
  const yLift = Math.max(y0, eyBase - EXIT_OVERRUN_MM - rampDistMm);

  const path: Array<{ x: number; y: number; z: number }> = [
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

/** Contorno interno (rasgo): centro ferramenta DENTRO (inset = raio). */
function buildInternalContourPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  toolRadiusMm: number
): Array<{ x: number; y: number; z: number }> {
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

export function generateTcnForPanelV2New(
  sheetResult: SheetResult,
  _kerf_mm = 3,
  acamName = "Sheet",
  anchorMaxWidthMm?: number,
  anchorMaxHeightMm?: number
): string {
  const lines: string[] = [];
  lines.push(HEADER);

  const sheet = sheetResult.sheet;
  const dl = sheet.largura_mm;
  const dh = sheet.altura_mm;

  const runtimeSettings = getSettings();
  const toolDiameterMm = getContourToolDiameterMm(runtimeSettings);
  const toolRadiusMm = toolDiameterMm / 2;

  const minSpacingMm = Number.isFinite(Number(runtimeSettings?.cnc?.minSpacingMm))
    ? Math.max(0, Number(runtimeSettings?.cnc?.minSpacingMm))
    : DEFAULT_MIN_SPACING_BETWEEN_PIECES_MM;
  const sheetMarginMm = Number.isFinite(Number(runtimeSettings?.cnc?.sheetMarginMm))
    ? Math.max(0, Number(runtimeSettings?.cnc?.sheetMarginMm))
    : DEFAULT_SHEET_MARGIN_MM;
  const zSafe =
    Number.isFinite(Number(runtimeSettings?.cnc?.zSafetyMm)) && Number(runtimeSettings?.cnc?.zSafetyMm) > 0
      ? Number(runtimeSettings?.cnc?.zSafetyMm)
      : DEFAULT_Z_SAFETY_MM;
  const rampDistMm =
    Number.isFinite(Number(runtimeSettings?.cnc?.rampDistanceMm)) && Number(runtimeSettings?.cnc?.rampDistanceMm) > 0
      ? Number(runtimeSettings?.cnc?.rampDistanceMm)
      : DEFAULT_RAMP_DISTANCE_MM;

  const maxW =
    anchorMaxWidthMm != null && anchorMaxWidthMm > 0 && Number.isFinite(anchorMaxWidthMm) ? anchorMaxWidthMm : dl;
  const maxH =
    anchorMaxHeightMm != null && anchorMaxHeightMm > 0 && Number.isFinite(anchorMaxHeightMm) ? anchorMaxHeightMm : dh;

  const placements = sheetResult.placements.filter((pl) =>
    isPlacementInsideSheet(pl.x_mm, pl.y_mm, pl.largura_mm, pl.altura_mm, dl, dh)
  );
  const sanitizedPlacements = sanitizePlacementsForTcn(placements, sheet, minSpacingMm, toolRadiusMm, sheetMarginMm);

  const ds = resolveTcnUnmDsMm(sanitizedPlacements, sheet);
  lines.push(`$=Acam Name=${acamName}`);
  lines.push(`::UNm DL=${intVal(dl)} DH=${intVal(dh)} DS=${intVal(ds)} OX=0 OY=0 OZ=0`);
  lines.push("VAR{");
  lines.push("}VAR");
  lines.push("OPTI{");
  lines.push("}OPTI");

  const sideInnerLines: string[] = [];

  const pushContourFromPath = (
    result: { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> }
  ) => {
    const w89x = Math.max(0, Math.min(result.w89.x, dl));
    const w89y = Math.max(0, Math.min(result.w89.y, dh));
    const w89T = transformPlacementToTcn({ x: w89x, y: w89y, z: zSafe }, dl, maxW, maxH);
    const pathT = result.path.map((p) => transformPlacementToTcn(p, dl, maxW, maxH));
    sideInnerLines.push(buildToolBlock(w89T.x, w89T.y, zSafe));
    sideInnerLines.push(buildW2201(pathT, zSafe));
  };

  // Loop 1 — furos (v2_new): coords locais à peça + placement físico, sem toolRadius
  const allDrillOps: CncDrillOperation[] = [];
  for (const pl of sanitizedPlacements) {
    logTcnThicknessDebug(pl, sheet);
    for (const hole of pl.drillHoles ?? pl.holes ?? []) {
      const topDrillable = (hole as { topDrillable?: boolean }).topDrillable;
      if (topDrillable === false) continue;

      const off = tcnHoleLocalToSheetOffsetMm(hole.x, hole.y, pl);
      const xAbs = pl.x_mm + off.sx;
      const yAbs = pl.y_mm + off.sy;
      const tcnPt = transformPlacementToTcn({ x: xAbs, y: yAbs, z: 0 }, dl, maxW, maxH);

      allDrillOps.push({
        x: tcnPt.x,
        y: tcnPt.y,
        z: 0,
        diametro: resolveTcnDrillDiameterMm(hole),
        profundidade: resolveTcnDrillDepthMm(pl, sheet),
        tipo: "vertical",
      });
    }
  }
  sideInnerLines.push(...buildDrillLines(allDrillOps));

  // Loop 2 — contornos exteriores + rasgos interiores
  for (const pl of sanitizedPlacements) {
    const panelMm = resolveTcnPanelThicknessMm(pl, sheet);
    const zCut = -panelMm;
    const w = pl.largura_mm;
    const h = pl.altura_mm;
    const x = pl.x_mm;
    const y = pl.y_mm;
    const rot = ((pl.rotacao ?? 0) % 360 + 360) % 360;

    pushContourFromPath(buildContourPathV1Style(x, y, w, h, toolRadiusMm, panelMm, zSafe, rampDistMm));

    const innerContours = pl.innerContours;
    if (innerContours?.length) {
      for (const rect of innerContours) {
        const offR = tcnHoleLocalToSheetOffsetMm(rect.x_mm, rect.y_mm, pl);
        const iw = rot === 90 ? rect.altura_mm : rect.largura_mm;
        const ih = rot === 90 ? rect.largura_mm : rect.altura_mm;
        const innerPointsRaw = buildInternalContourPoints(x + offR.sx, y + offR.sy, iw, ih, zCut, toolRadiusMm);
        if (innerPointsRaw.length === 0) continue;

        const innerPointsTcn = innerPointsRaw.map((p) => transformPlacementToTcn(p, dl, maxW, maxH));
        const first = innerPointsTcn[0];
        const innerClosed = [...innerPointsTcn, { x: first.x, y: first.y, z: zSafe }];

        sideInnerLines.push(buildToolBlock(first.x, first.y, zSafe));
        sideInnerLines.push(buildW2201(innerClosed, zSafe));
      }
    }
  }

  lines.push(...buildSideBlock(1, dl, dh, ds, sideInnerLines, true, "top", true));
  lines.push(...buildSideBlock(3, dl, ds, dh, [], false, "front", false));
  lines.push(...buildSideBlock(4, dh, ds, dl, [], false, "right", false));
  lines.push(...buildSideBlock(5, dl, ds, dh, [], false, "back", false));
  lines.push(...buildSideBlock(6, dh, ds, dl, [], false, "left", false));
  lines.push(...buildSideBlock(2, dl, dh, ds, [], false, "bottom", false));

  return lines.join("\n");
}

