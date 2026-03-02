/**
 * Geração de ficheiro TCN (Nesting) — padrão ALBATROS/EDICAD.
 * Blocos SIDE no formato exato da máquina: }SIDE, SIDE#N{ $=top ::LF=DL HF=DH SF=DS ::NSEQ=N }.
 * LF/HF/SF = dimensões da chapa (DL, DH, DS). W#81 iniciais dentro de SIDE#1.
 *
 * Estrutura preparada para furos superiores (top drilling):
 * - Furação apenas pela parte superior (top).
 * - Sem furação lateral. Sem ficheiros de drill separados.
 * - Furos futuros serão emitidos via buildDrillLines() / pl.holes no mesmo .tcn.
 */

import type { SheetResult } from "../cutlayout/cutLayoutTypes";
import type { CncDrillOperation } from "./cncTypes";
import { getSettings } from "../settings/settingsService";

const HEADER = "TPA\\ALBATROS\\EDICAD\\00.00:0";

const fmt = (n: number) => Number.isFinite(n) ? n.toFixed(2) : "0.00";
const fmtZ = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n);
  return Math.abs(n - rounded) < 0.0001 ? String(rounded) : n.toFixed(2);
};

/** Inteiro para DL/DH/DS/LF/HF/SF (ficheiro original usa sem decimais). */
const intVal = (n: number) => Math.round(Number.isFinite(n) ? n : 0);

/** Z de segurança (acima do material). */
const Z_SAFETY_MM = 10;
const EPSILON_MM = 0.001;

function buildContourPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  toolRadiusMm: number
): Array<{ x: number; y: number; z: number }> {
  const offset = Math.max(0, toolRadiusMm);
  const ox = x - offset;
  const oy = y - offset;
  const ow = w + offset * 2;
  const oh = h + offset * 2;
  return [
    { x: ox, y: oy, z },
    { x: ox + ow, y: oy, z },
    { x: ox + ow, y: oy + oh, z },
    { x: ox, y: oy + oh, z },
    { x: ox, y: oy, z },
  ];
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w - EPSILON_MM && a.x + a.w > b.x + EPSILON_MM && a.y < b.y + b.h - EPSILON_MM && a.y + a.h > b.y + EPSILON_MM;
}

function sanitizePlacementsForTcn(
  placements: SheetResult["placements"],
  sheet: SheetResult["sheet"],
  toolRadiusMm: number
): SheetResult["placements"] {
  const unique: SheetResult["placements"] = [];
  const contourRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const signatures = new Set<string>();

  for (const pl of placements) {
    const x = pl.x_mm;
    const y = pl.y_mm;
    const w = pl.largura_mm;
    const h = pl.altura_mm;
    const signature = `${Math.round(x * 1000)}:${Math.round(y * 1000)}:${Math.round(w * 1000)}:${Math.round(h * 1000)}`;
    if (signatures.has(signature)) continue;

    if (!isPlacementInsideSheet(x, y, w, h, sheet.largura_mm, sheet.altura_mm)) continue;

    const contourRect = {
      x: x - toolRadiusMm,
      y: y - toolRadiusMm,
      w: w + toolRadiusMm * 2,
      h: h + toolRadiusMm * 2,
    };

    const hasOverlap = contourRects.some((r) => rectsOverlap(r, contourRect));
    if (hasOverlap) continue;

    signatures.add(signature);
    contourRects.push(contourRect);
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

/** Bloco W#89 no formato ALBATROS real. */
function buildToolBlock(x: number, y: number, z: number): string {
  return `W#89{ ::WTs WS=1 #8015=0 #1=${fmt(x)} #2=${fmt(y)} #3=${fmt(z)} #205=113 #1001=100 #2005=3 #2002=21000 #40=1 }W`;
}

/**
 * W#81 no formato exato da máquina (evita Erro 284).
 * Formato: W#81{ ::WTs WS=1 #8015=0 #1=<X> #2=<Y> #3=<Z> #1002=10 #201=1 #203=1 #1001=0 }W
 */
function buildW81(points: Array<{ x: number; y: number; z: number }>, zSafety: number): string {
  return points
    .map(
      (p) =>
        `W#81{ ::WTs WS=1 #8015=0 #1=${fmt(p.x)} #2=${fmt(p.y)} #3=${fmt(zSafety)} #1002=10 #201=1 #203=1 #1001=0 }W`
    )
    .join("\n");
}

/**
 * W#81 para furação superior (top drilling).
 * Formato: W#81{ ::WTs WS=1 #8015=0 #1=<X> #2=<Y> #3=<Z> #1002=<DIAMETRO> #2008=<FEED> #2002=<RPM> #201=1 #203=1 #1001=0 }W
 * 
 * Parâmetros:
 * - #1: coordenada X (mm)
 * - #2: coordenada Y (mm)
 * - #3: profundidade Z (negativo, ex: -13 para 13mm de profundidade)
 * - #1002: diâmetro da broca (mm)
 * - #2008: feed rate (mm/min, ex: 1000)
 * - #2002: rotação (RPM, ex: 18000)
 */
function buildW81Drill(x: number, y: number, zDepth: number, diameter: number): string {
  const feedRate = 1000;
  const rpm = 18000;
  return `W#81{ ::WTs WS=1 #8015=0 #1=${fmt(x)} #2=${fmt(y)} #3=${fmtZ(zDepth)} #1002=${fmt(diameter)} #2008=${feedRate} #2002=${rpm} #201=1 #203=1 #1001=0 }W`;
}

/**
 * W#2201 no formato ALBATROS/EDICAD para contorno de corte.
 */
function buildW2201(points: Array<{ x: number; y: number; z: number }>, zCut: number): string {
  const lastIndex = points.length - 1;
  return points
    .map((p, i) => {
      const z = i === lastIndex ? 10 : zCut;
      const startFlag = i === 0 ? " #2008=8" : "";
      return `W#2201{ ::WTl #8015=0 #1=${fmt(p.x)} #2=${fmt(p.y)} #3=${fmtZ(z)}${startFlag} }W`;
    })
    .join("\n");
}

/**
 * Gera linhas de furação para o bloco SIDE#1.
 * Cada furo gera uma operação W#81 com formato ALBATROS/EDICAD.
 * Apenas furação vertical (top drilling) é suportada.
 */
function buildDrillLines(drills: CncDrillOperation[]): string[] {
  const lines: string[] = [];
  for (const d of drills) {
    if (d.tipo !== "vertical") continue; // Apenas furação superior
    const zDepth = -Math.abs(d.profundidade);
    lines.push(buildW81Drill(d.x, d.y, zDepth, d.diametro));
  }
  return lines;
}

/**
 * Gera bloco SIDE#N no formato exato da máquina.
 * Fecha diretamente com "}SIDE" (sem linha "}" isolada). Entre blocos: }SIDE + SIDE#N{
 */
function buildSideBlock(
  n: number,
  lf: number,
  hf: number,
  sf: number,
  innerLines: string[] = [],
  leadingCloseSide: boolean = false
): string[] {
  const lines: string[] = [];
  if (leadingCloseSide) lines.push("}SIDE");
  lines.push(`SIDE#${n}{`);
  lines.push("$=top");
  lines.push(`::LF=${intVal(lf)} HF=${intVal(hf)} SF=${intVal(sf)}`);
  lines.push(`::NSEQ=${n}`);
  for (const ln of innerLines) {
    if (ln !== "}") lines.push(ln);
  }
  lines.push("}SIDE");
  return lines;
}

/**
 * Gera TCN para um painel (sheet) único.
 * - Header: DL, DH, DS do próprio painel.
 * - SIDE#1 com operações W#81/W#89/W#2201 somente das peças desse painel.
 * - Final: SIDE#3, SIDE#4, SIDE#5, SIDE#6, SIDE#2 no mesmo padrão.
 */
export function generateTcnForPanel(
  sheetResult: SheetResult,
  _kerf_mm = 3,
  acamName = "Sheet"
): string {
  const lines: string[] = [];
  lines.push(HEADER);

  const thicknessMm = sheetResult.sheet.espessura_mm;
  const zCut = -thicknessMm;
  const zTool = Number(Math.abs(zCut).toFixed(2));

  const sheet = sheetResult.sheet;
  const dl = sheet.largura_mm;
  const dh = sheet.altura_mm;
  const ds = thicknessMm;

  lines.push(`$=Acam Name=${acamName}`);
  lines.push(`::UNm DL=${intVal(dl)} DH=${intVal(dh)} DS=${intVal(ds)} OX=0 OY=0 OZ=0`);
  lines.push("VAR{");
  lines.push("}VAR");
  lines.push("OPTI{");
  lines.push("}OPTI");

  const runtimeSettings = getSettings();
  const cutterDiameterMm = Math.max(0, Number(runtimeSettings.nesting.kerfPadraoMm) || 0);
  const effectiveCutterDiameterMm = cutterDiameterMm > 0 ? cutterDiameterMm : 3;
  const toolRadiusMm = effectiveCutterDiameterMm / 2;

  const placements = sheetResult.placements.filter((pl) =>
    isPlacementInsideSheet(
      pl.x_mm,
      pl.y_mm,
      pl.largura_mm,
      pl.altura_mm,
      sheet.largura_mm,
      sheet.altura_mm
    )
  );
  const sanitizedPlacements = sanitizePlacementsForTcn(placements, sheet, toolRadiusMm);
  const sideInnerLines: string[] = [];
  const drills: CncDrillOperation[] = [];
  
  // Primeiro: coletar apenas furos superiores (topDrillable) de todas as peças
  sanitizedPlacements.forEach((pl) => {
    for (const hole of pl.holes ?? []) {
      const topDrillable = (hole as { topDrillable?: boolean }).topDrillable;
      if (!topDrillable) continue;
      drills.push({
        x: pl.x_mm + hole.x,
        y: pl.y_mm + hole.y,
        z: 0,
        diametro: hole.diameter,
        profundidade: Math.min(hole.depth, thicknessMm),
        tipo: "vertical",
      });
    }
  });
  
  // Segundo: inserir operações de furação no início do bloco SIDE#1
  sideInnerLines.push(...buildDrillLines(drills));
  
  // Terceiro: operações de corte para cada peça
  sanitizedPlacements.forEach((pl) => {
    const w = pl.largura_mm;
    const h = pl.altura_mm;
    const x = pl.x_mm;
    const y = pl.y_mm;
    const points = buildContourPoints(x, y, w, h, zCut, toolRadiusMm);
    const firstPoint = points[0];
    sideInnerLines.push(buildW81(points, Z_SAFETY_MM));
    sideInnerLines.push(buildToolBlock(firstPoint.x, firstPoint.y, zTool));
    sideInnerLines.push(buildW2201(points, zCut));
  });
  
  lines.push(...buildSideBlock(1, dl, dh, ds, sideInnerLines, true));

  lines.push(...buildSideBlock(3, dl, ds, dh, [], false));
  lines.push(...buildSideBlock(4, dh, ds, dl, [], false));
  lines.push(...buildSideBlock(5, dl, ds, dh, [], false));
  lines.push(...buildSideBlock(6, dh, ds, dl, [], false));
  lines.push(...buildSideBlock(2, dl, dh, ds, [], false));

  return lines.join("\n");
}
