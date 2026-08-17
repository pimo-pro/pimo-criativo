/**
 * Sistema TCN v3_new (ambiente de testes dinâmico).
 *
 * Regras:
 * - Lê TODOS os parâmetros em `settings.cnc.*` (Admin → System Settings → Fabricação/TCN)
 * - Não altera v1 nem v2_new — este ficheiro só é usado quando `tcnMetodo === "v3_new"`
 * - Furos: nunca aplicam toolRadius/toolOffset (apenas coords locais + placement, com swap 90°)
 * - Contorno: aplica compensação de ferramenta (fora/dentro) APENAS no contorno
 */

import type { SheetResult } from "../cutlayout/cutLayoutTypes";
import type { CncDrillOperation } from "./cncTypes";
import { holeLocalToSheetOffsetMm, toLayoutAbsoluteX } from "../cutlayout/layoutCoordinateSystem";
import { getSettings } from "../settings/settingsService";
import {
  logTcnThicknessDebug,
  resolveTcnPanelThicknessMm,
  resolveTcnUnmDsMm,
} from "./tcnPanelThickness";
import { resolveTcnDrillDepthMm, resolveTcnDrillDiameterMm } from "./tcnDrillParams";
import {
  buildPlacementExteriorContourPath,
  buildPlacementInnerContourPaths,
  isPlacementInsideSheet,
  sanitizePlacementsForTcn,
} from "./tcnContourPaths";

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

function resolveContourToolOffsetMm(settings: { cnc?: { diametroFresaContornoMm?: number; compensacaoFerramenta?: "fora" | "dentro" } }): number {
  const toolDiameterMm = getContourToolDiameterMm(settings);
  const toolRadiusMm = toolDiameterMm / 2;
  const compensacao = settings?.cnc?.compensacaoFerramenta ?? "fora";
  // v3_new: compensação só afeta o contorno; furos nunca usam toolOffset
  return compensacao === "dentro" ? 0 : toolRadiusMm;
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

export function generateTcnForPanelV3New(
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
  const V3_TOOL_DIAMETER_MM = getContourToolDiameterMm(runtimeSettings);
  const V3_TOOL_RADIUS_MM = V3_TOOL_DIAMETER_MM / 2;
  const contourToolOffsetMm = resolveContourToolOffsetMm(runtimeSettings);

  const V3_GAP_MM = Number.isFinite(Number(runtimeSettings?.cnc?.minSpacingMm))
    ? Math.max(0, Number(runtimeSettings?.cnc?.minSpacingMm))
    : DEFAULT_MIN_SPACING_BETWEEN_PIECES_MM;
  const V3_SHEET_MARGIN_MM = Number.isFinite(Number(runtimeSettings?.cnc?.sheetMarginMm))
    ? Math.max(0, Number(runtimeSettings?.cnc?.sheetMarginMm))
    : DEFAULT_SHEET_MARGIN_MM;
  const V3_Z_SAFETY_MM =
    Number.isFinite(Number(runtimeSettings?.cnc?.zSafetyMm)) && Number(runtimeSettings?.cnc?.zSafetyMm) > 0
      ? Number(runtimeSettings?.cnc?.zSafetyMm)
      : DEFAULT_Z_SAFETY_MM;
  const V3_RAMP_DISTANCE_MM =
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
  const sanitizedPlacements = sanitizePlacementsForTcn(
    placements,
    sheet,
    V3_GAP_MM,
    Math.max(0, contourToolOffsetMm),
    V3_SHEET_MARGIN_MM
  );

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
    const w89T = transformPlacementToTcn({ x: w89x, y: w89y, z: V3_Z_SAFETY_MM }, dl, maxW, maxH);
    const pathT = result.path.map((p) => transformPlacementToTcn(p, dl, maxW, maxH));
    sideInnerLines.push(buildToolBlock(w89T.x, w89T.y, V3_Z_SAFETY_MM));
    sideInnerLines.push(buildW2201(pathT, V3_Z_SAFETY_MM));
  };

  // Loop 1 — furos (v2_new): coords locais à peça + placement físico, sem toolRadius
  const allDrillOps: CncDrillOperation[] = [];
  for (const pl of sanitizedPlacements) {
    logTcnThicknessDebug(pl, sheet);
    const rot = ((pl.rotacao ?? 0) % 360 + 360) % 360;
    for (const hole of pl.drillHoles ?? pl.holes ?? []) {
      const topDrillable = (hole as { topDrillable?: boolean }).topDrillable;
      if (topDrillable === false) continue;

      const off = holeLocalToSheetOffsetMm(hole.x, hole.y, rot);
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

    // v3_new: compensação de ferramenta aplica-se apenas ao contorno (fora/dentro)
    pushContourFromPath(
      buildPlacementExteriorContourPath(pl, contourToolOffsetMm, panelMm, V3_Z_SAFETY_MM, V3_RAMP_DISTANCE_MM)
    );
    for (const inner of buildPlacementInnerContourPaths(pl, V3_TOOL_RADIUS_MM, zCut, V3_Z_SAFETY_MM)) {
      pushContourFromPath(inner);
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

