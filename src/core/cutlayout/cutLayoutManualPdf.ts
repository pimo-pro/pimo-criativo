/**
 * PDF "Layout de Corte manual" - leitura do mesmo SSOT/nesting do Layout PRO,
 * com cotagem e simbologia para trabalho de marceneiro (sem alterar motores industriais).
 *
 * Textos do PDF usam escapes Unicode (\uXXXX) para evitar corrupcao de encoding
 * com a fonte Helvetica (WinAnsi) do jsPDF.
 */

import jsPDF from "jspdf";
import type { CutPlacement, SheetResult } from "./cutLayoutTypes";
import { holeLocalToSheetOffsetMm } from "./layoutCoordinateSystem";
import { holesForPdf } from "./cutLayoutPdf";
import { buildV5BottomStripIndustrialName } from "../etiquetas/industrialDisplayName";
import { assertIndustrialOutputAuthorized } from "../industrial/industrialOutputGuard";
import {
  drawLogoIndustrialInBox,
  loadLogoIndustrialDataUrl,
  LOGO_INDUSTRIAL_SIZE_MM,
} from "../pdf/logoIndustrialPublic";
import { resolveAuthoritativeLabelNumber } from "../qrcode/panelLabelNumber";

/** A4 landscape: largura x altura (mm) */
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 8;
const INNER_W = PAGE_W - MARGIN * 2;
const INNER_H = PAGE_H - MARGIN * 2;

const COLOR_CAVILHA: [number, number, number] = [180, 20, 20];
const COLOR_PRATELEIRA: [number, number, number] = [20, 140, 60];
const COLOR_FIXACAO: [number, number, number] = [30, 80, 180];
const COLOR_PASSANTE: [number, number, number] = [40, 40, 40];
const COLOR_OUTRO: [number, number, number] = [100, 100, 100];
const COLOR_RASGO: [number, number, number] = [160, 100, 20];
const BRAND_RED: [number, number, number] = [139, 0, 0];

/** Diametro (O cortado) - WinAnsi U+00D8 */
const DIA = "\u00D8";
/** Traco tipografico - U+2014 (fallback "-" se a fonte falhar) */
const EM = "\u2014";
const TIMES = "\u00D7"; // x
const ELLIPSIS_SEP = " \u00B7 "; // middle dot

export type ManualHoleKind =
  | "cavilha"
  | "prateleira"
  | "fixacao"
  | "passante"
  | "trilho"
  | "outro";

export type CutLayoutManualSheetInput = {
  sheetResult: SheetResult;
  /** Pasta/bucket (ex.: MDF_BRANCO_19MM) - so para cabecalho. */
  bucket?: string;
};

export type CutLayoutManualPdfOptions = {
  projectName?: string;
  industrialProjectName?: string;
  boxNomeById?: Readonly<Record<string, string>> | ReadonlyMap<string, string>;
  nestingTopRightOrigin?: boolean;
};

type PdfHole = NonNullable<CutPlacement["drillHoles"]>[number];
type ManualHoleView = {
  sx: number;
  sy: number;
  diameter: number;
  depth: number;
  kind: ManualHoleKind;
  holeType?: string;
};

type InnerContour = { x_mm: number; y_mm: number; largura_mm: number; altura_mm: number };

type CotaLabel = { x: number; y: number; text: string; align?: "left" | "center" | "right" };

/** Resultado engenheirado de um sistema de trilho (uma fila alinhada). */
export type RailCotaSystem = {
  yMm: number;
  firstOffset: number;
  lastOffset: number;
  spacings: number[];
  spacingUnique: number | null;
  count: number;
};

/** Classificacao local so para o PDF manual — nao altera SSOT. */
export function classifyManualHole(
  h: { diameter: number; depth: number; holeType?: string; topDrillable?: boolean },
  pieceThicknessMm?: number
): ManualHoleKind {
  const tipo = String(h.holeType ?? "").toLowerCase();
  const d = Number(h.diameter) || 0;
  const depth = Number(h.depth) || 0;
  const thick = Number(pieceThicknessMm) || 0;

  if (thick > 0 && depth >= thick - 0.6) return "passante";
  if (tipo.includes("corredica") || tipo.includes("trilho") || tipo.includes("quadro")) {
    return "trilho";
  }
  if (tipo.includes("cavilha") || (d >= 9.5 && d <= 10.5 && depth >= 10 && depth <= 35)) {
    return "cavilha";
  }
  if (tipo.includes("prateleira") || (d >= 4.5 && d <= 5.5)) {
    return "prateleira";
  }
  if (
    tipo.includes("parafuso") ||
    tipo.includes("fixacao") ||
    tipo.includes("minifix") ||
    tipo.includes("dobradica") ||
    (d >= 5.8 && d <= 8.5)
  ) {
    return "fixacao";
  }
  return "outro";
}

/**
 * Agrupa furos de trilho no mesmo eixo Y e calcula first / spacing / last.
 * Nao gera cotas por furo — so o sistema.
 */
export function computeRailCotaSystems(
  holes: Array<{ sx: number; sy: number; kind: ManualHoleKind }>,
  pieceW: number,
  yTolMm = 2
): RailCotaSystem[] {
  const rails = holes.filter((h) => h.kind === "trilho");
  if (rails.length === 0) return [];

  const sorted = [...rails].sort((a, b) => a.sy - b.sy || a.sx - b.sx);
  const groups: Array<typeof rails> = [];
  for (const h of sorted) {
    const g = groups.find((row) => Math.abs(row[0].sy - h.sy) <= yTolMm);
    if (g) g.push(h);
    else groups.push([h]);
  }

  const out: RailCotaSystem[] = [];
  for (const g of groups) {
    const xs = [...g].sort((a, b) => a.sx - b.sx);
    if (xs.length < 2) continue;
    const firstOffset = xs[0].sx;
    const lastOffset = pieceW - xs[xs.length - 1].sx;
    const spacings: number[] = [];
    for (let i = 1; i < xs.length; i++) {
      spacings.push(xs[i].sx - xs[i - 1].sx);
    }
    const rounded = spacings.map((s) => Math.round(s * 10) / 10);
    const allEqual = rounded.every((s) => Math.abs(s - rounded[0]) < 0.6);
    out.push({
      yMm: xs.reduce((a, h) => a + h.sy, 0) / xs.length,
      firstOffset,
      lastOffset,
      spacings,
      spacingUnique: allEqual ? rounded[0] : null,
      count: xs.length,
    });
  }
  return out;
}

function colorForKind(kind: ManualHoleKind): [number, number, number] {
  switch (kind) {
    case "cavilha":
      return COLOR_CAVILHA;
    case "prateleira":
      return COLOR_PRATELEIRA;
    case "fixacao":
    case "trilho":
      return COLOR_FIXACAO;
    case "passante":
      return COLOR_PASSANTE;
    default:
      return COLOR_OUTRO;
  }
}

/** Escala visual do raio por tipo (coerencia marceneiro). */
function visualRadiusFactor(kind: ManualHoleKind): number {
  switch (kind) {
    case "cavilha":
      return 1.35;
    case "prateleira":
      return 0.85;
    case "fixacao":
      return 1.1;
    case "trilho":
      return 0.95;
    case "passante":
      return 1.2;
    default:
      return 1;
  }
}

function resolveBoxNome(
  boxId: string | undefined,
  boxNomeById?: CutLayoutManualPdfOptions["boxNomeById"]
): string {
  const id = String(boxId ?? "").trim();
  if (!id || !boxNomeById) return id || "-";
  if (boxNomeById instanceof Map) return boxNomeById.get(id)?.trim() || id;
  return String(boxNomeById[id] ?? "").trim() || id;
}

function formatPieceName(pl: CutPlacement, options: CutLayoutManualPdfOptions): string {
  const project =
    (options.industrialProjectName ?? options.projectName ?? "Projeto").trim() || "Projeto";
  // Remove sufixo de espessura do cabecalho ("Projeto - 19mm" / em-dash).
  let projectClean = project;
  const dashIdx = project.search(/\s[-\u2013\u2014]\s/);
  if (dashIdx > 0) projectClean = project.slice(0, dashIdx).trim() || project;
  const boxNome = resolveBoxNome(pl.boxId, options.boxNomeById);
  const nomeIndustrial = String(pl.partName ?? "").trim() || "peca";
  return buildV5BottomStripIndustrialName(projectClean, boxNome, nomeIndustrial);
}

function normalizedRotation(rotacao: number | undefined): number {
  return ((rotacao ?? 0) % 360 + 360) % 360;
}

function pdfDisplayHoleOffset(pl: CutPlacement, h: PdfHole): { sx: number; sy: number } {
  return holeLocalToSheetOffsetMm(
    h.x,
    h.y,
    normalizedRotation(pl.rotacao),
    pl.largura_mm,
    pl.altura_mm
  );
}

function holesForManual(pl: CutPlacement, sheet: SheetResult["sheet"]): ManualHoleView[] {
  const raw = holesForPdf(pl, sheet, false);
  const thick = pl.espessura_mm ?? sheet.espessura_mm;
  return raw.map((h) => {
    const off = pdfDisplayHoleOffset(pl, h);
    return {
      sx: off.sx,
      sy: off.sy,
      diameter: Number(h.diameter) || 0,
      depth: Number(h.depth) || 0,
      kind: classifyManualHole(h, thick),
      holeType: h.holeType,
    };
  });
}

function contoursForManual(pl: CutPlacement): InnerContour[] {
  const ext = pl as CutPlacement & { originalInnerContours?: InnerContour[] };
  return ext.originalInnerContours ?? pl.innerContours ?? [];
}

function formatDatePt(): string {
  return new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Legenda em linha (lado a lado) para leitura rapida. */
function drawLegend(doc: jsPDF, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text("Legenda (trabalho manual)", MARGIN, y);
  y += 5;

  const items: Array<{
    color: [number, number, number];
    label: string;
    passante?: boolean;
    rasgo?: boolean;
  }> = [
    { color: COLOR_CAVILHA, label: `Cavilha (${DIA}10, prof. tip. 13) ${EM} vermelho` },
    { color: COLOR_PRATELEIRA, label: `Prateleira (${DIA}5) ${EM} verde` },
    { color: COLOR_FIXACAO, label: `Fixa\u00E7\u00E3o / parafuso ${EM} azul` },
    { color: COLOR_FIXACAO, label: `Trilho / corredica ${EM} azul (sistema)` },
    { color: COLOR_PASSANTE, label: `Passante ${EM} s\u00EDmbolo X`, passante: true },
    { color: COLOR_RASGO, label: `Rasgo / fresagem ${EM} ret\u00E2ngulo \u00E2mbar`, rasgo: true },
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  let x = MARGIN;
  const rowH = 5;
  for (const it of items) {
    const w = doc.getTextWidth(it.label) + 7;
    if (x + w > MARGIN + INNER_W) {
      x = MARGIN;
      y += rowH;
    }
    doc.setFillColor(...it.color);
    doc.setDrawColor(...it.color);
    if (it.passante) {
      doc.setLineWidth(0.35);
      doc.line(x, y - 1.1, x + 2.8, y + 1.1);
      doc.line(x + 2.8, y - 1.1, x, y + 1.1);
    } else if (it.rasgo) {
      doc.rect(x, y - 1.1, 3.2, 2.2, "FD");
    } else {
      doc.circle(x + 1.4, y, 1.15, "FD");
    }
    doc.setTextColor(30, 30, 30);
    doc.text(it.label, x + 4.2, y + 0.9);
    x += w + 4;
  }
  return y + 5;
}

function drawHoleSymbol(
  doc: jsPDF,
  cx: number,
  cy: number,
  rMm: number,
  kind: ManualHoleKind
): void {
  const color = colorForKind(kind);
  const r = Math.max(0.35, rMm * visualRadiusFactor(kind));
  doc.setDrawColor(...color);
  doc.setFillColor(...color);
  doc.setLineWidth(0.3);
  if (kind === "passante") {
    const arm = Math.max(1.0, r * 1.5);
    doc.line(cx - arm, cy - arm, cx + arm, cy + arm);
    doc.line(cx + arm, cy - arm, cx - arm, cy + arm);
    doc.circle(cx, cy, Math.max(0.45, r * 0.5), "S");
    return;
  }
  if (kind === "fixacao") {
    doc.circle(cx, cy, r, "S");
    doc.circle(cx, cy, Math.max(0.25, r * 0.42), "F");
    return;
  }
  doc.circle(cx, cy, r, "FD");
}

function pushCota(labels: CotaLabel[], x: number, y: number, text: string, align: CotaLabel["align"] = "center") {
  // Evitar sobreposicao: se ja existir label muito perto, desviar verticalmente
  let yy = y;
  for (let attempt = 0; attempt < 6; attempt++) {
    const clash = labels.some((L) => Math.abs(L.x - x) < 8 && Math.abs(L.y - yy) < 3.2);
    if (!clash) break;
    yy += 3.2;
  }
  labels.push({ x, y: yy, text, align });
}

/**
 * Cotas engenheiradas:
 * - trilho (corredica): UM sistema por fila Y - first / spacing / last FORA da peca
 * - prateleira: borda->1.o, ultimo->borda, espacamento unico
 * - isolados / fixacao: diam + profundidade (+ bordas quando aplicavel)
 */
function drawSmartCotas(
  doc: jsPDF,
  holes: ManualHoleView[],
  rx: number,
  ry: number,
  scale: number,
  pieceW: number,
  pieceH: number
): void {
  if (holes.length === 0) return;

  const labels: CotaLabel[] = [];
  doc.setDrawColor(55, 55, 55);
  doc.setLineWidth(0.18);

  const drawHDim = (xA: number, xB: number, yLine: number, text: string) => {
    const left = Math.min(xA, xB);
    const right = Math.max(xA, xB);
    if (right - left < 0.8) return;
    doc.line(left, yLine, right, yLine);
    doc.line(left, yLine - 1.0, left, yLine + 1.0);
    doc.line(right, yLine - 1.0, right, yLine + 1.0);
    pushCota(labels, (left + right) / 2, yLine - 1.8, text, "center");
  };

  // TRIHLHOS: sistemas por fila Y (cotas FORA da peca, sem repeticao por furo)
  const railSystems = computeRailCotaSystems(holes, pieceW, 2);
  const railsSorted = [...railSystems].sort((a, b) => a.yMm - b.yMm);
  railsSorted.forEach((sys, idx) => {
    const below = idx % 2 === 0;
    const yLine = below
      ? ry + pieceH * scale + 7 + Math.floor(idx / 2) * 10
      : ry - 7 - Math.floor(idx / 2) * 10;

    const xFirst = rx + sys.firstOffset * scale;
    const xLast = rx + (pieceW - sys.lastOffset) * scale;
    const xLeft = rx;
    const xRight = rx + pieceW * scale;

    // Cadeia engenheirada: first | spacing | last (uma vez cada)
    if (sys.firstOffset > 0.5) {
      drawHDim(xLeft, xFirst, yLine, String(Math.round(sys.firstOffset)));
    }
    if (sys.spacingUnique != null && sys.spacingUnique > 0.5 && sys.count >= 2) {
      drawHDim(xFirst, xFirst + sys.spacingUnique * scale, yLine, String(Math.round(sys.spacingUnique)));
    } else if (sys.spacings.length > 0) {
      drawHDim(xFirst, xFirst + sys.spacings[0] * scale, yLine, String(Math.round(sys.spacings[0])));
    }
    if (sys.lastOffset > 0.5) {
      drawHDim(xLast, xRight, yLine, String(Math.round(sys.lastOffset)));
    }
  });

  const singleRails = holes.filter(
    (h) => h.kind === "trilho" && !railsSorted.some((s) => Math.abs(s.yMm - h.sy) <= 2)
  );

  // Restantes (nao trilho-sistema)
  const rest = holes.filter((h) => h.kind !== "trilho").concat(singleRails);
  const byKindRow = new Map<string, ManualHoleView[]>();
  for (const h of rest) {
    const key = h.kind + "_" + String(Math.round(h.sy / 3) * 3);
    const list = byKindRow.get(key) ?? [];
    list.push(h);
    byKindRow.set(key, list);
  }

  for (const group of byKindRow.values()) {
    if (group.length === 0) continue;
    group.sort((a, b) => a.sx - b.sx);
    const kind = group[0].kind;
    const first = group[0];
    const last = group[group.length - 1];

    if (kind === "prateleira" && group.length >= 2) {
      const yOut = ry + pieceH * scale + 6;
      if (first.sx > 1.5) drawHDim(rx, rx + first.sx * scale, yOut, String(Math.round(first.sx)));
      if (pieceW - last.sx > 1.5) {
        drawHDim(rx + last.sx * scale, rx + pieceW * scale, yOut, String(Math.round(pieceW - last.sx)));
      }
      const gaps = [];
      for (let i = 1; i < group.length; i++) gaps.push(group[i].sx - group[i - 1].sx);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (avg > 1) {
        drawHDim(rx + group[0].sx * scale, rx + group[1].sx * scale, yOut + 9, "e=" + Math.round(avg));
      }
      continue;
    }

    for (const h of group) {
      const hx = rx + h.sx * scale;
      const hy = ry + h.sy * scale;
      if (kind === "fixacao" || group.length === 1) {
        if (h.sy > 1.5) {
          doc.line(hx + 4, ry, hx + 4, hy);
          doc.line(hx + 3.3, ry, hx + 4.7, ry);
          doc.line(hx + 3.3, hy, hx + 4.7, hy);
          pushCota(labels, hx + 6.2, (ry + hy) / 2, String(Math.round(h.sy)), "left");
        }
        if (h.sx > 1.5 && kind === "fixacao") {
          drawHDim(rx, hx, ry - 5, String(Math.round(h.sx)));
        }
      }
      if (kind === "cavilha" || kind === "passante") {
        if (h !== first) continue;
      }
      pushCota(
        labels,
        hx + 4,
        hy + 5,
        DIA + String(Math.round(h.diameter)) + " p" + String(Math.round(h.depth)),
        "left"
      );
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(25, 25, 25);
  for (const L of labels) {
    doc.text(L.text, L.x, L.y, { align: L.align ?? "center" });
  }
}

function drawManualPieceDetail(
  doc: jsPDF,
  pl: CutPlacement,
  sheet: SheetResult["sheet"],
  box: { x: number; y: number; w: number; h: number },
  options: CutLayoutManualPdfOptions
): void {
  const name = formatPieceName(pl, options);
  const num = String(
    resolveAuthoritativeLabelNumber(pl) ?? pl.pieceNumber ?? "-"
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 15, 15);
  const title = `#${num}  ${name}`;
  doc.text(doc.splitTextToSize(title, box.w).slice(0, 2), box.x, box.y + 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `${Math.round(pl.largura_mm)}${TIMES}${Math.round(pl.altura_mm)}${TIMES}${Math.round(pl.espessura_mm ?? sheet.espessura_mm)} mm`,
    box.x,
    box.y + 10
  );

  const drawAreaY = box.y + 13;
  const drawAreaH = box.h - 15;
  const drawAreaW = box.w;
  const forceLandscape = pl.altura_mm > pl.largura_mm;
  const geoW = forceLandscape ? pl.altura_mm : pl.largura_mm;
  const geoH = forceLandscape ? pl.largura_mm : pl.altura_mm;
  const scale = Math.min(drawAreaW / Math.max(geoW, 1), drawAreaH / Math.max(geoH, 1)) * 0.72;
  const rw = geoW * scale;
  const rh = geoH * scale;
  const rx = box.x + (drawAreaW - rw) / 2;
  const ry = drawAreaY + (drawAreaH - rh) / 2;

  doc.setFillColor(250, 248, 245);
  doc.rect(rx, ry, rw, rh, "F");
  doc.setDrawColor(170, 170, 170);
  doc.setLineWidth(0.25);
  doc.rect(rx, ry, rw, rh, "S");

  const mapPoint = (sx: number, sy: number): { x: number; y: number } => {
    if (!forceLandscape) return { x: rx + sx * scale, y: ry + sy * scale };
    return {
      x: rx + sy * scale,
      y: ry + (pl.largura_mm - sx) * scale,
    };
  };

  const holes = holesForManual(pl, sheet);
  for (const h of holes) {
    const p = mapPoint(h.sx, h.sy);
    const r = Math.max(0.4, (h.diameter / 2) * scale);
    drawHoleSymbol(doc, p.x, p.y, r, h.kind);
  }

  const contours = contoursForManual(pl);
  doc.setDrawColor(...COLOR_RASGO);
  doc.setFillColor(255, 230, 200);
  doc.setLineWidth(0.35);
  for (const c of contours) {
    const p0 = mapPoint(c.x_mm, c.y_mm);
    const p1 = mapPoint(c.x_mm + c.largura_mm, c.y_mm + c.altura_mm);
    const x = Math.min(p0.x, p1.x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);
    doc.rect(x, y, Math.max(0.4, w), Math.max(0.4, h), "FD");
    doc.setFontSize(6);
    doc.setTextColor(...COLOR_RASGO);
    doc.text(`${Math.round(c.largura_mm)}${TIMES}${Math.round(c.altura_mm)}`, x + 0.5, y - 0.6);
  }

  if (!forceLandscape) {
    drawSmartCotas(doc, holes, rx, ry, scale, pl.largura_mm, pl.altura_mm);
  } else {
    const mapped = holes.map((h) => ({
      ...h,
      sx: h.sy,
      sy: pl.largura_mm - h.sx,
    }));
    drawSmartCotas(doc, mapped, rx, ry, scale, pl.altura_mm, pl.largura_mm);
  }
}

function drawManualSheetDiagram(
  doc: jsPDF,
  sheetResult: SheetResult,
  originY: number,
  maxH: number,
  topRightOrigin: boolean
): number {
  const { sheet, placements } = sheetResult;
  const scale = Math.min(INNER_W / sheet.largura_mm, maxH / sheet.altura_mm);
  const drawW = sheet.largura_mm * scale;
  const drawH = sheet.altura_mm * scale;
  const originX = MARGIN + (INNER_W - drawW) / 2;

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.rect(originX, originY, drawW, drawH);

  for (const pl of placements) {
    const px =
      originX +
      (topRightOrigin ? sheet.largura_mm - pl.x_mm - pl.largura_mm : pl.x_mm) * scale;
    const py = originY + pl.y_mm * scale;
    const pw = pl.largura_mm * scale;
    const ph = pl.altura_mm * scale;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.25);
    doc.rect(px, py, pw, ph, "FD");

    const holes = holesForManual(pl, sheet);
    for (const h of holes) {
      const hx = px + h.sx * scale;
      const hy = py + h.sy * scale;
      const r = Math.max(0.3, Math.min(1.6, (h.diameter / 2) * scale * 0.95));
      drawHoleSymbol(doc, hx, hy, r, h.kind);
    }

    for (const c of contoursForManual(pl)) {
      doc.setDrawColor(...COLOR_RASGO);
      doc.setLineWidth(0.2);
      doc.rect(
        px + c.x_mm * scale,
        py + c.y_mm * scale,
        Math.max(0.3, c.largura_mm * scale),
        Math.max(0.3, c.altura_mm * scale),
        "S"
      );
    }

    const num = String(
      resolveAuthoritativeLabelNumber(pl) ?? pl.pieceNumber ?? "-"
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_RED);
    const fs = Math.max(4, Math.min(ph * 0.45, pw * 0.35, 12));
    doc.setFontSize(fs);
    doc.text(num, px + pw / 2, py + ph / 2 + fs * 0.28, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  return originY + drawH + 3;
}

function drawSheetHeader(
  doc: jsPDF,
  sheetResult: SheetResult,
  sheetIndex: number,
  totalSheets: number,
  options: CutLayoutManualPdfOptions,
  bucket: string | undefined,
  logoDataUrl: string | null
): number {
  const { sheet } = sheetResult;
  const project = (options.projectName ?? "Projeto").trim() || "Projeto";
  const y0 = MARGIN;
  drawLogoIndustrialInBox(doc, logoDataUrl, MARGIN, y0, LOGO_INDUSTRIAL_SIZE_MM, BRAND_RED);
  const tx = MARGIN + LOGO_INDUSTRIAL_SIZE_MM + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 15, 15);
  doc.text("Layout de Corte manual", tx, y0 + 5);
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(project, INNER_W - 50).slice(0, 1) as string[], tx, y0 + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  const mat = sheet.materialName ?? sheet.materialId ?? "-";
  const parts = [
    `Chapa ${sheetIndex}/${totalSheets}`,
    bucket || "",
    mat,
    `${Math.round(sheet.espessura_mm)} mm`,
    formatDatePt(),
  ].filter(Boolean);
  doc.text(parts.join(ELLIPSIS_SEP), tx, y0 + 17);
  doc.setTextColor(0, 0, 0);
  return y0 + 21;
}

/**
 * Gera um unico PDF landscape com todas as chapas (todas as espessuras/materiais).
 * Apenas leitura do nesting/SSOT - sem alterar CNC/DRILL/Cutlist.
 */
export async function buildCutLayoutManualPdf(
  sheets: CutLayoutManualSheetInput[],
  options?: CutLayoutManualPdfOptions
): Promise<jsPDF> {
  assertIndustrialOutputAuthorized("pdf-layout-manual");
  const opts: CutLayoutManualPdfOptions = options ?? {};
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logoDataUrl = await loadLogoIndustrialDataUrl();
  const list = sheets.filter((s) => s?.sheetResult?.placements?.length);
  if (list.length === 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Layout de Corte manual - sem pecas", MARGIN, MARGIN + 10);
    return doc;
  }

  let globalSheetIndex = 0;
  for (const entry of list) {
    if (globalSheetIndex > 0) doc.addPage("a4", "landscape");
    globalSheetIndex += 1;
    const sheetResult = entry.sheetResult;
    let y = drawSheetHeader(
      doc,
      sheetResult,
      globalSheetIndex,
      list.length,
      opts,
      entry.bucket,
      logoDataUrl
    );
    y = drawLegend(doc, y + 1);
    // Diagrama ocupa o maximo da area util landscape
    const maxDiagramH = Math.max(70, PAGE_H - y - MARGIN - 4);
    drawManualSheetDiagram(
      doc,
      sheetResult,
      y,
      maxDiagramH,
      Boolean(opts.nestingTopRightOrigin)
    );

    // Detalhe das pecas (2 por pagina landscape, lado a lado)
    const placements = sheetResult.placements;
    const perPage = 2;
    for (let i = 0; i < placements.length; i += perPage) {
      doc.addPage("a4", "landscape");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        `Chapa ${globalSheetIndex} - Detalhe manual (${i + 1}-${Math.min(i + perPage, placements.length)}/${placements.length})`,
        MARGIN,
        MARGIN + 4
      );
      const cardW = (INNER_W - 4) / perPage;
      const cardH = INNER_H - 12;
      for (let k = 0; k < perPage; k++) {
        const pl = placements[i + k];
        if (!pl) break;
        drawManualPieceDetail(
          doc,
          pl,
          sheetResult.sheet,
          {
            x: MARGIN + k * (cardW + 4),
            y: MARGIN + 8,
            w: cardW,
            h: cardH,
          },
          opts
        );
      }
    }
  }

  return doc;
}

/** Nome de ficheiro canonico do PDF manual (unico para o projeto). */
export function cutLayoutManualPdfFileName(): string {
  return "Layout_de_Corte_manual.pdf";
}
