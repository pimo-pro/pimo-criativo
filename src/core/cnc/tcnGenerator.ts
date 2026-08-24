/**
 * Gera??o de ficheiro TCN (Nesting) ? compat?vel HARNNETT TRACK (TPA/WSCM).
 *
 * Regras:
 * - Contorno EXTERNO: compensa??o 100% geom?trica no TCN (sem G41/G42 na m?quina). Centro da fresa segue o percurso;
 *   o ret?ngulo do percurso ? o da pe?a expandido de R para fora: x0'=x0-R, x1'=x1+R, y0'=y0-R, y1'=y1+R (nominal = canto inf.-esq. + largura/altura).
 * - Entrada/sa?da: s? lados C (direita) ou D (esquerda); rampas Z ao longo da espessura (comprimento = DS mm).
 * - Furos e contornos: mesma cadeia em todas as variantes ? placement (+ rota??o 90?) ? toLayoutAbsoluteX ? flip ?ncora topo-direito.
 * - Espa?amento m?nimo entre pe?as: o valor em defini??es aplica-se ao espa?o entre contornos de ferramenta;
 *   na filtragem usa-se gap m?nimo entre ret?ngulos de placement ? minSpacing + 2?raio (contorno exterior).
 * - v2/v5: mesmo padr?o de rampa Z lateral (C/D) que v1; v2 for?a lado C, v5 lado D.
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

const HEADER = "TPA\\ALBATROS\\EDICAD\\00.00:0";

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
const fmtZ = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n);
  return Math.abs(n - rounded) < 0.0001 ? String(rounded) : n.toFixed(2);
};

const intVal = (n: number) => Math.round(Number.isFinite(n) ? n : 0);

const Z_SAFETY_MM = 10;
const EPSILON_MM = 0.001;

const DEFAULT_MIN_SPACING_BETWEEN_PIECES_MM = 15;

const TOOL_113_NOMINAL_DIAMETER_MM = 12;
const MIN_TOOL_DIAMETER_MM = 1;
type TcnMetodo =
  | "v1_corner"
  | "v2_ramp"
  | "v3_ramp_noflip"
  | "v4_corner_noflip"
  | "v5_ramp_noanchor"
  | "v6_ramp";

function getContourToolDiameterMm(settings: {
  cnc?: { diametroFresaContornoMm?: number };
}): number {
  const fromCnc = Number(settings?.cnc?.diametroFresaContornoMm);
  if (Number.isFinite(fromCnc) && fromCnc > 0) return Math.max(MIN_TOOL_DIAMETER_MM, fromCnc);
  return TOOL_113_NOMINAL_DIAMETER_MM;
}

/**
 * Ret?ngulo do centro da fresa no contorno EXTERIOR: sempre FORA do ret?ngulo nominal da pe?a.
 * Pe?a na chapa: canto inferior-esquerdo (x, y), largura w, altura h (Y+).
 * R = raio da fresa (metade de `diametroFresaContornoMm`).
 * Equivalente: x0'=x_nom-R, x1'=x_nom+w+R, y0'=y_nom-R, y1'=y_nom+h+R.
 */
function rectToolCenterExteriorFromPlacementMm(
  x: number,
  y: number,
  w: number,
  h: number,
  raioFresaMm: number
): { x0: number; y0: number; x1: number; y1: number } {
  const R = Math.max(0, raioFresaMm);
  return {
    x0: x - R,
    y0: y - R,
    x1: x + w + R,
    y1: y + h + R,
  };
}

function flipPointToTopRightAnchor(x: number, y: number, maxW: number, maxH: number): { x: number; y: number } {
  return {
    x: maxW - x,
    y: maxH - y,
  };
}

function toTopRightAnchoredPoint(
  x: number,
  y: number,
  sheetWidthMm: number,
  maxW: number,
  maxH: number,
  applyLayoutX: boolean
): { x: number; y: number } {
  const xForFlip = applyLayoutX ? toLayoutAbsoluteX(x, sheetWidthMm) : x;
  return flipPointToTopRightAnchor(xForFlip, y, maxW, maxH);
}

/**
 * mapContourToLayoutCoordinates + flipContourPointsToTopRightAnchor (equivalente ao pipeline v1 original).
 */
function mapContourToLayoutCoordinates(
  points: Array<{ x: number; y: number; z: number }>,
  sheetWidthMm: number,
  _winding: "CW" | "CCW"
): Array<{ x: number; y: number; z: number }> {
  return points.map((p) => ({ ...p, x: toLayoutAbsoluteX(p.x, sheetWidthMm) }));
}

function flipContourPointsToTopRightAnchor(
  points: Array<{ x: number; y: number; z: number }>,
  maxW: number,
  maxH: number,
  _invert?: boolean
): Array<{ x: number; y: number; z: number }> {
  return points.map((p) => {
    // Nesta etapa os pontos já estão no sistema de layout absoluto em X.
    // Reutilizamos o utilitário unificado de ancoragem topo-direito sem reaplicar toLayoutAbsoluteX.
    const f = toTopRightAnchoredPoint(p.x, p.y, 0, maxW, maxH, false);
    return { x: f.x, y: f.y, z: p.z };
  });
}

/** Igual ao layout_corte_pro (toLayoutAbsoluteX em X) + ?ncora topo-direito da m?quina. */
function transformPlacementToTcn(
  p: { x: number; y: number; z: number },
  sheetWidthMm: number,
  maxW: number,
  maxH: number
): { x: number; y: number; z: number } {
  const afterLayout = mapContourToLayoutCoordinates([p], sheetWidthMm, "CW")[0];
  const afterFlip = flipContourPointsToTopRightAnchor([afterLayout], maxW, maxH)[0];
  return { x: afterFlip.x, y: afterFlip.y, z: p.z };
}

type ContourSide = "right" | "left";
type ContourDirection = "CW" | "CCW";
type ContourEyBaseMode = "sideC" | "sideD" | "center" | "upperThird" | "lowerThird" | "quarter";

/** Entrada apenas por aresta esquerda ou direita (nunca topo/fundo) ? evita mergulho junto a pe?as vizinhas em Y. */
/**
 * Builder central para os 6 variants v1-v6.
 * Ramp industrial em X (Y fixo = eyBase), sem Z=0 intermedio:
 *   w89 + [0]  approach em xApproach (antes da peca em X)
 *   [1]        ramp: avanca rampDistMm em X ate entryX (X_first), Y fixo, desce para zCut  (#2008=8)
 *   [2-5]      4 cantos do rectangulo exterior
 *   [6]        fecha em entryX, Y_entry
 *   [7]        avanca EXIT_OVERRUN_MM (20mm) em X, Z=zCut
 *   [8]        lift directo para Z=safe (sem Z=0 intermedio)
 */
function buildLateralContourPath(
  x: number,
  y: number,
  w: number,
  h: number,
  toolRadiusMm: number,
  thicknessMm: number,
  zSafe: number,
  side: ContourSide,
  eyBaseMode: ContourEyBaseMode,
  direction: ContourDirection,
  rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  const { x0, y0, x1, y1 } = rectToolCenterExteriorFromPlacementMm(x, y, w, h, toolRadiusMm);
  const zCut = -Math.abs(thicknessMm);
  const spanY = y1 - y0;
  const EXIT_OVERRUN_MM = 20;

  let eyBase: number;
  switch (eyBaseMode) {
    case "sideC":      eyBase = y0; break;               // v1 — lado C (borda do lado, Y_max)
    case "sideD":      eyBase = y1; break;               // v6 — lado D (borda oposta, Y_min)
    case "upperThird": eyBase = y0 + spanY * 0.25; break; // v2 — 1/4 lado C
    case "lowerThird": eyBase = y0 + spanY * 0.75; break; // v3 — 3/4 lado C
    case "quarter":    eyBase = y0 + spanY * 0.33; break; // v4 — 1/3 lado C
    default:           eyBase = y0 + spanY * 0.67; break; // "center" = v5 — 2/3 lado C
  }

  // entryX = X_first (primeiro ponto de corte = bordo de entrada da peca + offset)
  const entryX = side === "right" ? x1 : x0;
  const otherX = side === "right" ? x0 : x1;

  // Ramp em X: approach rampDist antes da borda de entrada
  const xApproach  = side === "right" ? entryX - rampDistMm : entryX + rampDistMm;
  // Exit/lift ficam sempre dentro dos limites do contorno exterior (x0..x1)
  const xExitRaw   = side === "right" ? entryX + EXIT_OVERRUN_MM : entryX - EXIT_OVERRUN_MM;
  const xLiftRaw   = side === "right" ? xExitRaw + rampDistMm    : xExitRaw - rampDistMm;
  // garantir que xExit e xLift são sempre pontos distintos e dentro do contorno
  const xBound = side === "right" ? x1 : x0;
  const xExit  = side === "right"
    ? Math.min(xExitRaw, xBound - rampDistMm)  // deixa espaço para xLift
    : Math.max(xExitRaw, xBound + rampDistMm);
  const xLift  = side === "right"
    ? Math.min(xLiftRaw, xBound)
    : Math.max(xLiftRaw, xBound);

  // eyBase esta sempre entre y0 e y1 (nunca nos extremos) — sem risco de segmento zero
  // CW:  desce primeiro para y0 (corner1), sobe para y1 (corner2)
  // CCW: sobe primeiro para y1 (corner1), desce para y0 (corner2)
  const corner1Y = direction === "CW" ? y0 : y1;
  const corner2Y = direction === "CW" ? y1 : y0;

  const w89 = { x: xApproach, y: eyBase };
  const path = [
    { x: entryX,    y: eyBase,   z: zCut },  // [0] ramp em X, Y fixo (#2008=8)
    { x: entryX,    y: corner1Y, z: zCut },  // [1] 1.o canto — lado entrada
    { x: otherX,    y: corner1Y, z: zCut },  // [2] 1.o canto — lado oposto
    { x: otherX,    y: corner2Y, z: zCut },  // [3] 2.o canto — lado oposto
    { x: entryX,    y: corner2Y, z: zCut },  // [4] 2.o canto — lado entrada
    { x: entryX,    y: eyBase,   z: zCut },  // [5] fecha em X_first, Y_entry
    { x: xExit,     y: eyBase,   z: zCut },  // [6] +EXIT_OVERRUN em X, Z=zCut
    { x: xLift,     y: eyBase,   z: zSafe }, // [7] lift directo para Z=safe
  ];
  return { w89, path };
}

/**
 * v1 — Ramp em Y (protocolo fábrica).
 * Entrada: x0 (borda direita física), eyBase = centro Y do contorno.
 * W#89 approach: (x0, eyBase_layout + rampDist)  — acima do ponto de entrada.
 * Ramp [0]: Y desce de approach para eyBase, X fixo em x0, #2008=8.
 * Rect CW: (x0,y0)→(x1,y0)→(x1,y1)→(x0,y1) → fecha em (x0,eyBase).
 * Exit [6]: Y continua 20mm abaixo de eyBase, Z=zCut (ainda a cortar).
 * Lift [7]: Y continua mais rampDist abaixo, Z=zSafe.
 */
function buildContourPathV1(
  x: number, y: number, w: number, h: number,
  toolRadiusMm: number, thicknessMm: number, zSafe: number, rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  const R      = Math.max(0, toolRadiusMm);
  const x0     = x - R;         // borda direita física do contorno (entrada)
  const x1     = x + w + R;     // borda esquerda física do contorno
  const y0     = y - R;         // borda inferior do contorno (layout)
  const y1     = y + h + R;     // borda superior do contorno (layout)
  const eyBase = (y0 + y1) / 2; // centro Y — ponto de entrada na face
  const zCut   = -Math.abs(thicknessMm);
  const EXIT_OVERRUN_MM = 20;

  // Approach ACIMA do eyBase em layout (menor Y_tcn = acima na chapa)
  const w89 = { x: x0, y: eyBase + rampDistMm };

  // Exit e lift continuam NO MESMO SENTIDO do ramp (para y0, afastando-se do approach)
  const yExit = Math.max(y0, eyBase - EXIT_OVERRUN_MM);
  const yLift = Math.max(y0, eyBase - EXIT_OVERRUN_MM - rampDistMm);

  const path: Array<{ x: number; y: number; z: number }> = [
    { x: x0, y: eyBase, z: zCut },  // [0] ramp end → #2008=8
    { x: x0, y: y0,     z: zCut },  // [1] corner inferior lado entrada
    { x: x1, y: y0,     z: zCut },  // [2] corner inferior lado oposto
    { x: x1, y: y1,     z: zCut },  // [3] corner superior lado oposto
    { x: x0, y: y1,     z: zCut },  // [4] corner superior lado entrada
    { x: x0, y: eyBase, z: zCut },  // [5] fecha no centro (eyBase)
    { x: x0, y: yExit,  z: zCut },  // [6] saída +20mm em Y, Z=zCut
    { x: x0, y: yLift,  z: zSafe }, // [7] lift directo Z=+safe
  ];
  return { w89, path };
}

/** v2: direita, CW, 1/4 lado C (25%). */
function buildContourPathV2(
  x: number, y: number, w: number, h: number,
  toolRadiusMm: number, thicknessMm: number, zSafe: number, rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  return buildLateralContourPath(x, y, w, h, toolRadiusMm, thicknessMm, zSafe, "right", "upperThird", "CW", rampDistMm);
}

/** v3: direita, CW, 3/4 lado C (75%). */
function buildContourPathV3(
  x: number, y: number, w: number, h: number,
  toolRadiusMm: number, thicknessMm: number, zSafe: number, rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  return buildLateralContourPath(x, y, w, h, toolRadiusMm, thicknessMm, zSafe, "right", "lowerThird", "CW", rampDistMm);
}

/** v4: direita, CW, 1/3 lado C (33%). */
function buildContourPathV4(
  x: number, y: number, w: number, h: number,
  toolRadiusMm: number, thicknessMm: number, zSafe: number, rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  return buildLateralContourPath(x, y, w, h, toolRadiusMm, thicknessMm, zSafe, "right", "quarter", "CW", rampDistMm);
}

/** v5: direita, CW, 2/3 lado C (67%). */
function buildContourPathV5(
  x: number, y: number, w: number, h: number,
  toolRadiusMm: number, thicknessMm: number, zSafe: number, rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  return buildLateralContourPath(x, y, w, h, toolRadiusMm, thicknessMm, zSafe, "right", "center", "CW", rampDistMm);
}

/** v6: esquerda, CW, centro lado D (entrada pela esquerda). */
function buildContourPathV6(
  x: number, y: number, w: number, h: number,
  toolRadiusMm: number, thicknessMm: number, zSafe: number, rampDistMm: number
): { w89: { x: number; y: number }; path: Array<{ x: number; y: number; z: number }> } {
  return buildLateralContourPath(x, y, w, h, toolRadiusMm, thicknessMm, zSafe, "left", "sideD", "CW", rampDistMm);
}

/**
 * Contorno interno (rasgo): centro da ferramenta DENTRO do v?o (inset = raio).
 * Isto ? geometria de corte interno, n?o ?offset externo? do per?metro da pe?a.
 */
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

function rectDistance(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Garante que o espa?amento entre contornos exteriores (centro ferramenta, offset +R para fora) n?o fique
 * abaixo de `minSpacingMm`: exige dist?ncia entre ret?ngulos de pe?a ? minSpacingMm + 2?raio.
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
    if (signatures.has(signature)) { console.log(`[SANITIZE] Peça rejeitada: x=${x} y=${y} w=${w} h=${h} | motivo: duplicado`); continue; }

    if (!isPlacementInsideSheet(x, y, w, h, sheet.largura_mm, sheet.altura_mm)) { console.log(`[SANITIZE] Peça rejeitada: x=${x} y=${y} w=${w} h=${h} | motivo: fora da chapa (${sheet.largura_mm}x${sheet.altura_mm})`); continue; }
    // Contorno exterior (centro fresa) deve caber na chapa — sem allowance.
    // Peças cuja abordagem sairia da chapa são rejeitadas (evita W#89 fora dos limites).
    const contour = rectToolCenterExteriorFromPlacementMm(x, y, w, h, toolRadiusMm);
    // Margem mínima: a peça precisa de estar a pelo menos sheetMarginMm da borda da chapa.
    const minFromEdge = Math.max(0, sheetMarginMm - toolRadiusMm);
    if (
      contour.x0 < -minFromEdge ||
      contour.y0 < -minFromEdge ||
      contour.x1 > sheet.largura_mm + minFromEdge ||
      contour.y1 > sheet.altura_mm + minFromEdge
    ) {
      console.log(`[SANITIZE] Peça rejeitada: x=${x} y=${y} w=${w} h=${h} | motivo: contorno fora (x0=${contour.x0.toFixed(2)} y0=${contour.y0.toFixed(2)} x1=${contour.x1.toFixed(2)} y1=${contour.y1.toFixed(2)} | chapa=${sheet.largura_mm}x${sheet.altura_mm})`);
      continue;
    }

    const rect = { x, y, w, h };
    const tooClose = placedRects.some((r) => rectDistance(r, rect) < minSpacingMm - EPSILON_MM);
    if (tooClose) { console.log(`[SANITIZE] Peça rejeitada: x=${x} y=${y} w=${w} h=${h} | motivo: demasiado próxima (minSpacingMm=${minSpacingMm})`); continue; }

    signatures.add(signature);
    placedRects.push(rect);
    unique.push(pl);
  }

  return unique;
}

function isPlacementInsideSheet(
  x: number,
  y: number,
  w: number,
  h: number,
  sheetW: number,
  sheetH: number
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return false;
  if (w <= 0 || h <= 0) return false;
  if (x < -EPSILON_MM || y < -EPSILON_MM) return false;
  if (x + w > sheetW + EPSILON_MM) return false;
  if (y + h > sheetH + EPSILON_MM) return false;
  return true;
}

function buildToolBlock(x: number, y: number, zSafe: number): string {
  return `W#89{ ::WTs WS=1 #8015=0 #1=${fmt(x)} #2=${fmt(y)} #3=${fmtZ(zSafe)} #205=113 #1001=100 #2005=3 #2002=21000 #40=1 }W`;
}

function buildW81Drill(x: number, y: number, zDepth: number, diameter: number): string {
  const feedRate = 1000;
  const rpm = 18000;
  return `W#81{ ::WTs WS=1 #8015=0 #1=${fmt(x)} #2=${fmt(y)} #3=${fmtZ(zDepth)} #1002=${fmt(diameter)} #2008=${feedRate} #2002=${rpm} #201=1 #203=1 #1001=0 }W`;
}

/** Usa Z de cada ponto (rampas 0??zCut); #2008=8 no primeiro movimento ?til ap?s aproxima??o em Z seguro. */
function buildW2201(points: Array<{ x: number; y: number; z: number }>, zSafe: number): string {
  const isSamePoint = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
    Math.abs(a.x - b.x) < EPSILON_MM && Math.abs(a.y - b.y) < EPSILON_MM && Math.abs(a.z - b.z) < 0.02;

  const compact: Array<{ x: number; y: number; z: number }> = [];
  for (const p of points) {
    const last = compact[compact.length - 1];
    if (!last || !isSamePoint(last, p)) compact.push(p);
  }
  if (compact.length === 0) return "";

  const feedStartIdx =
    compact.length > 1 && Math.abs(compact[0].z - zSafe) < 0.02 ? 1 : 0;
  return compact
    .map((p, i) => {
      const startFlag = i === feedStartIdx ? " #2008=8" : "";
      return `W#2201{ ::WTl #8015=0 #1=${fmt(p.x)} #2=${fmt(p.y)} #3=${fmtZ(p.z)}${startFlag} }W`;
    })
    .join("\n");
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
 * @param anchorMaxWidthMm ?ncora horizontal para flip topo-direito (usar DL da chapa deste painel = sheet.largura_mm)
 * @param anchorMaxHeightMm ?ncora vertical (DH = sheet.altura_mm)
 */
export function generateTcnForPanel(
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
  // compensacaoFerramenta: "fora" = offset exterior completo; "dentro" = 0 (sem offset)
  const compensacaoFerramenta = runtimeSettings?.cnc?.compensacaoFerramenta ?? "fora";
  const toolOffsetMm = compensacaoFerramenta === "dentro" ? 0 : toolRadiusMm;
  const tcnMetodo = (runtimeSettings?.cnc?.tcnMetodo ?? "v1_corner") as TcnMetodo;
  const minSpacingMm = Number.isFinite(Number(runtimeSettings?.cnc?.minSpacingMm))
    ? Math.max(0, Number(runtimeSettings?.cnc?.minSpacingMm))
    : DEFAULT_MIN_SPACING_BETWEEN_PIECES_MM;
  const sheetMarginMm = Number.isFinite(Number(runtimeSettings?.cnc?.sheetMarginMm))
    ? Math.max(0, Number(runtimeSettings?.cnc?.sheetMarginMm))
    : 10;
  const zSafe =
    Number.isFinite(Number(runtimeSettings?.cnc?.zSafetyMm)) && Number(runtimeSettings?.cnc?.zSafetyMm) > 0
      ? Number(runtimeSettings?.cnc?.zSafetyMm)
      : Z_SAFETY_MM;
  const rampDistMm =
    Number.isFinite(Number(runtimeSettings?.cnc?.rampDistanceMm)) && Number(runtimeSettings?.cnc?.rampDistanceMm) > 0
      ? Number(runtimeSettings?.cnc?.rampDistanceMm)
      : 20;
  const maxW =
    anchorMaxWidthMm != null && anchorMaxWidthMm > 0 && Number.isFinite(anchorMaxWidthMm)
      ? anchorMaxWidthMm
      : sheet.largura_mm;
  const maxH =
    anchorMaxHeightMm != null && anchorMaxHeightMm > 0 && Number.isFinite(anchorMaxHeightMm)
      ? anchorMaxHeightMm
      : sheet.altura_mm;
  const placements = sheetResult.placements.filter((pl) =>
    isPlacementInsideSheet(pl.x_mm, pl.y_mm, pl.largura_mm, pl.altura_mm, sheet.largura_mm, sheet.altura_mm)
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
    // Clamp approach (W#89) aos limites da chapa em coordenadas de layout — evita coordenadas fora da chapa na máquina
    const w89x = Math.max(0, Math.min(result.w89.x, sheet.largura_mm));
    const w89y = Math.max(0, Math.min(result.w89.y, sheet.altura_mm));
    const w89T = transformPlacementToTcn({ x: w89x, y: w89y, z: zSafe }, sheet.largura_mm, maxW, maxH);
    const pathT = result.path.map((p) => transformPlacementToTcn(p, sheet.largura_mm, maxW, maxH));
    sideInnerLines.push(buildToolBlock(w89T.x, w89T.y, zSafe));
    sideInnerLines.push(buildW2201(pathT, zSafe));
  };

  // Loop 1 — todos os W#81 (furos) de todas as peças
  const allDrillOps: CncDrillOperation[] = [];
  for (const pl of sanitizedPlacements) {
    logTcnThicknessDebug(pl, sheet);
    const rot = ((pl.rotacao ?? 0) % 360 + 360) % 360;
    for (const hole of pl.drillHoles ?? pl.holes ?? []) {
      const topDrillable = (hole as { topDrillable?: boolean }).topDrillable;
      if (topDrillable === false) continue;
      const off = holeLocalToSheetOffsetMm(hole.x, hole.y, rot, pl.largura_mm, pl.altura_mm);
      const tcnPt = transformPlacementToTcn({ x: pl.x_mm + off.sx, y: pl.y_mm + off.sy, z: 0 }, sheet.largura_mm, maxW, maxH);
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

  // Loop 2 — todos os W#89+W#2201 (contornos exteriores + rasgos interiores) de todas as peças
  for (const pl of sanitizedPlacements) {
    const panelMm = resolveTcnPanelThicknessMm(pl, sheet);
    const zCut = -panelMm;
    const w = pl.largura_mm;
    const h = pl.altura_mm;
    const x = pl.x_mm;
    const y = pl.y_mm;
    const rot = ((pl.rotacao ?? 0) % 360 + 360) % 360;

    if (tcnMetodo === "v2_ramp") {
      pushContourFromPath(buildContourPathV2(x, y, w, h, toolOffsetMm, panelMm, zSafe, rampDistMm));
    } else if (tcnMetodo === "v3_ramp_noflip") {
      pushContourFromPath(buildContourPathV3(x, y, w, h, toolOffsetMm, panelMm, zSafe, rampDistMm));
    } else if (tcnMetodo === "v4_corner_noflip") {
      pushContourFromPath(buildContourPathV4(x, y, w, h, toolOffsetMm, panelMm, zSafe, rampDistMm));
    } else if (tcnMetodo === "v5_ramp_noanchor") {
      pushContourFromPath(buildContourPathV5(x, y, w, h, toolOffsetMm, panelMm, zSafe, rampDistMm));
    } else if (tcnMetodo === "v6_ramp") {
      pushContourFromPath(buildContourPathV6(x, y, w, h, toolOffsetMm, panelMm, zSafe, rampDistMm));
    } else {
      // v1_corner + fallback
      pushContourFromPath(buildContourPathV1(x, y, w, h, toolOffsetMm, panelMm, zSafe, rampDistMm));
    }

    const innerContours = pl.innerContours;
    if (innerContours?.length) {
      for (const rect of innerContours) {
        const offR = holeLocalToSheetOffsetMm(rect.x_mm, rect.y_mm, rot, pl.largura_mm, pl.altura_mm);
        const iw = rot === 90 ? rect.altura_mm : rect.largura_mm;
        const ih = rot === 90 ? rect.largura_mm : rect.altura_mm;
        const innerPointsRaw = buildInternalContourPoints(
          pl.x_mm + offR.sx,
          pl.y_mm + offR.sy,
          iw,
          ih,
          zCut,
          toolRadiusMm
        );
        if (innerPointsRaw.length > 0) {
          const innerPointsTcn = innerPointsRaw.map((p) => transformPlacementToTcn(p, sheet.largura_mm, maxW, maxH));
          const first = innerPointsTcn[0];
          const innerClosed = [
            ...innerPointsTcn,
            { x: first.x, y: first.y, z: zSafe },
          ];
          sideInnerLines.push(buildToolBlock(first.x, first.y, zSafe));
          sideInnerLines.push(buildW2201(innerClosed, zSafe));
        }
      }
    }
  }

  lines.push(...buildSideBlock(1, dl, dh, ds, sideInnerLines, true,  "top",    true));

  lines.push(...buildSideBlock(3, dl, ds, dh, [], false, "front",  false));
  lines.push(...buildSideBlock(4, dh, ds, dl, [], false, "right",  false));
  lines.push(...buildSideBlock(5, dl, ds, dh, [], false, "back",   false));
  lines.push(...buildSideBlock(6, dh, ds, dl, [], false, "left",   false));
  lines.push(...buildSideBlock(2, dl, dh, ds, [], false, "bottom", false));

  return lines.join("\n");
}
