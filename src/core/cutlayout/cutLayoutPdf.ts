/**
 * PDF do Layout de Corte — A4 retrato, cabeçalho em 2 colunas, diagrama a preencher
 * o espaço entre cabeçalho e tabela (escala até à caixa útil, sem limite scale≤1).
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CutLayoutResult, CutPlacement, SheetResult } from "./cutLayoutTypes";
import { holeLocalToSheetOffsetMm } from "./layoutCoordinateSystem";
import { buildV5BottomStripIndustrialName } from "../etiquetas/industrialDisplayName";
import { assertIndustrialOutputAuthorized } from "../industrial/industrialOutputGuard";
import { drawLogoIndustrialInBox, loadLogoIndustrialDataUrl, LOGO_INDUSTRIAL_SIZE_MM } from "../pdf/logoIndustrialPublic";
import { resolveAuthoritativeLabelNumber } from "../qrcode/panelLabelNumber";

/** A4 retrato: largura × altura (mm) */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 8;
/** Largura útil (210 − 16). */
const INNER_W = PAGE_W - MARGIN * 2;
const HEADER_BAND_MM = 28;
const BRAND_RED: [number, number, number] = [139, 0, 0];
const GAP_HEADER_DIAGRAM = 2;
const GAP_DIAGRAM_TABLE = 3;

const FONT_TITLE = 11;
const FONT_LABEL = 8;
const FONT_VALUE = 9;
const LINE_STEP = 5.1;

const TABLE_FONT_PT = 8;
/** Altura de linha da lista — ~2× a anterior (~9–12 mm) para miniatura legível. */
const TABLE_ROW_H_MM = 26;
const TABLE_HEAD_H_MM = 7;
/**
 * Reserva mínima no fim da 1.ª página para cabeçalho da tabela + ≥1 linha
 * (a tabela continua noutras páginas se precisar). Não depende do nº total de peças.
 */
const MIN_TABLE_SLICE_MM = TABLE_HEAD_H_MM + TABLE_ROW_H_MM + 6;

export type CutLayoutPdfOptions = {
  projectName?: string;
  brandRight?: string;
  nestingTopRightOrigin?: boolean;
  /** Nome do projeto alinhado à etiqueta (sem sufixo de espessura). */
  industrialProjectName?: string;
  /** Mapa caixa → nome de display (para Projeto_Caixa_Peça). */
  boxNomeById?: Readonly<Record<string, string>> | ReadonlyMap<string, string>;
};

type EdgeBands = { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
type PdfHole = NonNullable<CutPlacement["drillHoles"]>[number];

function resolveBoxNomeForDisplay(
  boxId: string | undefined,
  boxNomeById?: CutLayoutPdfOptions["boxNomeById"]
): string {
  const id = String(boxId ?? "").trim();
  if (!id || !boxNomeById) return id || "—";
  if (boxNomeById instanceof Map) return boxNomeById.get(id)?.trim() || id;
  return String(boxNomeById[id] ?? "").trim() || id;
}

/** Nome exibido na tabela = mesmo formato da etiqueta (Projeto_Caixa_Peça). */
function formatCutLayoutProPieceDisplayName(
  pl: CutPlacement,
  options: CutLayoutPdfOptions
): string {
  const project =
    (options.industrialProjectName ?? options.projectName ?? "Projeto").trim() || "Projeto";

  // Se o cabeçalho vier como "Projeto — 19mm", usar só a parte do projeto.
  const projectClean = project.includes(" — ")
    ? project.slice(0, project.indexOf(" — ")).trim() || project
    : project;

  const boxNome = resolveBoxNomeForDisplay(pl.boxId, options.boxNomeById);
  const nomeIndustrial = String(pl.partName ?? "").trim() || "peca";

  return buildV5BottomStripIndustrialName(projectClean, boxNome, nomeIndustrial);
}

function placementEdgeBands(pl: CutPlacement): EdgeBands | undefined {
  return (pl as CutPlacement & { fitaBordas?: EdgeBands }).fitaBordas;
}

function normalizedRotation(rotacao: number | undefined): number {
  return ((rotacao ?? 0) % 360 + 360) % 360;
}

function placementPhysicalLeft(pl: CutPlacement, sheetWidthMm: number, topRightOrigin: boolean): number {
  return topRightOrigin ? sheetWidthMm - pl.x_mm - pl.largura_mm : pl.x_mm;
}

function pdfDisplayHoleOffset(pl: CutPlacement, h: PdfHole): { sx: number; sy: number } {
  return holeLocalToSheetOffsetMm(h.x, h.y, normalizedRotation(pl.rotacao), pl.largura_mm, pl.altura_mm);
}

type PlacementPdfExt = CutPlacement & {
  originalOuterPolygonMm?: Array<{ x: number; y: number }>;
  originalInnerContours?: NonNullable<CutPlacement["innerContours"]>;
};

export type PlacementPdfDrawOp =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "polygon"; points: Array<{ x: number; y: number }> }
  | { kind: "inner-rect"; x: number; y: number; w: number; h: number }
  | { kind: "inner-circle"; cx: number; cy: number; r: number };

function pdfLocalPoint(pl: CutPlacement, hx: number, hy: number): { x: number; y: number } {
  const off = holeLocalToSheetOffsetMm(hx, hy, normalizedRotation(pl.rotacao), pl.largura_mm, pl.altura_mm);
  return { x: off.sx, y: off.sy };
}

function axisAlignedFromCorners(corners: Array<{ x: number; y: number }>): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * Operações de desenho no espaço local do placement (mesmo offset que os furos).
 * Prefere `originalOuterPolygonMm` / `originalInnerContours` quando existirem.
 */
export function placementPdfDrawOps(pl: CutPlacement): PlacementPdfDrawOp[] {
  const ext = pl as PlacementPdfExt;
  const ops: PlacementPdfDrawOp[] = [];
  const poly = ext.originalOuterPolygonMm ?? pl.outerPolygonMm;
  if (poly && poly.length >= 3) {
    ops.push({ kind: "polygon", points: poly.map((p) => pdfLocalPoint(pl, p.x, p.y)) });
  } else {
    ops.push({ kind: "rect", x: 0, y: 0, w: pl.largura_mm, h: pl.altura_mm });
  }

  const contours = ext.originalInnerContours ?? pl.innerContours ?? [];
  for (const c of contours) {
    if (c.innerCircle && c.innerCircle.diameter_mm > 0) {
      const ctr = pdfLocalPoint(pl, c.innerCircle.cx_mm, c.innerCircle.cy_mm);
      ops.push({ kind: "inner-circle", cx: ctr.x, cy: ctr.y, r: c.innerCircle.diameter_mm / 2 });
    }
    const box = axisAlignedFromCorners([
      pdfLocalPoint(pl, c.x_mm, c.y_mm),
      pdfLocalPoint(pl, c.x_mm + c.largura_mm, c.y_mm),
      pdfLocalPoint(pl, c.x_mm + c.largura_mm, c.y_mm + c.altura_mm),
      pdfLocalPoint(pl, c.x_mm, c.y_mm + c.altura_mm),
    ]);
    ops.push({ kind: "inner-rect", ...box });
  }
  return ops;
}

function drawClosedPath(
  doc: jsPDF,
  pts: Array<{ x: number; y: number }>,
  style: "S" | "F" | "FD"
): void {
  if (pts.length < 3) return;
  const lines: number[][] = [];
  for (let i = 1; i < pts.length; i++) {
    lines.push([pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y]);
  }
  doc.lines(lines, pts[0]!.x, pts[0]!.y, [1, 1], style, true);
}

function isHoleInsidePlacementAndSheet(
  pl: CutPlacement,
  h: PdfHole,
  sheet: SheetResult["sheet"],
  topRightOrigin: boolean
): boolean {
  if (!Number.isFinite(h.x) || !Number.isFinite(h.y)) return false;
  const off = pdfDisplayHoleOffset(pl, h);
  // Permitir furos de aresta (X=0 / X=L, Y=0 / Y=H) — interlock TypeNo=2 no SSOT.
  // Centro pode coincidir com o perímetro; o círculo é desenhado na borda.
  const eps = 0.05;
  if (off.sx < -eps || off.sy < -eps) return false;
  if (off.sx > pl.largura_mm + eps || off.sy > pl.altura_mm + eps) return false;

  const absX = placementPhysicalLeft(pl, sheet.largura_mm, topRightOrigin) + off.sx;
  const absY = pl.y_mm + off.sy;
  return (
    absX >= -eps &&
    absY >= -eps &&
    absX <= sheet.largura_mm + eps &&
    absY <= sheet.altura_mm + eps
  );
}

/**
 * Furos do placement para o layout PDF — mesma origem SSOT que o XML (drillHoles pós-cutlist).
 * Preferir originalDrillHoles (coords pré-rotação nesting) quando existirem, para alinhar
 * rótulos/posições com as coordenadas locais da peça (XML).
 */
export function holesForPdf(pl: CutPlacement, sheet: SheetResult["sheet"], topRightOrigin: boolean): PdfHole[] {
  const raw =
    (pl as CutPlacement & { originalDrillHoles?: PdfHole[] }).originalDrillHoles ??
    pl.drillHoles ??
    pl.holes ??
    [];
  return raw.filter((h) => isHoleInsidePlacementAndSheet(pl, h, sheet, topRightOrigin));
}

function formatDatePt(): string {
  return new Date().toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function computeWastePercent(sheetResult: SheetResult): number {
  const { sheet, placements } = sheetResult;
  const sheetArea = Math.max(1, sheet.largura_mm * sheet.altura_mm);
  const used = placements.reduce((a, p) => a + Math.max(0, p.largura_mm) * Math.max(0, p.altura_mm), 0);
  const pct = 100 * (1 - Math.min(used, sheetArea) / sheetArea);
  return Math.round(pct * 10) / 10;
}

function drawDottedLine(
  doc: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.01) return;
  const dash = 0.8;
  const gap = 0.9;
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  let t = 0;
  doc.setDrawColor(...BRAND_RED);
  doc.setLineWidth(0.2);
  while (t < len) {
    const t2 = Math.min(t + dash, len);
    doc.line(x1 + dx * t, y1 + dy * t, x1 + dx * t2, y1 + dy * t2);
    t = t2 + gap;
  }
}

/**
 * Cabeçalho em 2 colunas (máx. HEADER_BAND_MM). Devolve Y abaixo do cabeçalho + folga.
 */
function drawPageHeader(
  doc: jsPDF,
  sheetResult: SheetResult,
  globalSheetIndex: number,
  options: CutLayoutPdfOptions,
  logoDataUrl: string | null
): number {
  const { sheet } = sheetResult;
  const project = (options.projectName ?? "Projeto").trim() || "Projeto";
  const material = (sheet.materialName ?? sheet.materialId ?? "Material").trim() || "Material";
  const thickness = sheet.espessura_mm;
  const waste = computeWastePercent(sheetResult);

  const y0 = MARGIN;
  const colGap = 6;
  const leftColW = INNER_W * 0.46;
  const rightX = MARGIN + leftColW + colGap;
  const rightColW = PAGE_W - MARGIN - rightX;
  const labelW = 34;

  const logoSize = LOGO_INDUSTRIAL_SIZE_MM;
  const textStartX = MARGIN + logoSize + 2.5;
  const textMaxW = leftColW - logoSize - 3;

  drawLogoIndustrialInBox(doc, logoDataUrl, MARGIN, y0 + 0.5, logoSize, BRAND_RED);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TITLE);
  doc.setTextColor(15, 15, 15);
  const projLines = doc.splitTextToSize(project, textMaxW);
  let ty = y0 + FONT_TITLE * 0.35;
  doc.text(projLines.slice(0, 2), textStartX, ty);
  if (projLines.length > 1) ty += LINE_STEP * 0.95;

  doc.setFontSize(FONT_LABEL);
  doc.text("Data:", textStartX, ty + LINE_STEP);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_VALUE);
  doc.text(formatDatePt(), textStartX + 14, ty + LINE_STEP);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_TITLE);
  doc.setTextColor(15, 15, 15);
  doc.text(`Chapa A${globalSheetIndex}`, rightX, y0 + FONT_TITLE * 0.35);

  let yr = y0 + LINE_STEP + 3;
  const valX = rightX + labelW;

  const row = (label: string, value: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_LABEL);
    doc.text(label, rightX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_VALUE);
    doc.text(value, valX, y);
  };

  row("Material:", doc.splitTextToSize(material, rightColW - labelW - 2)[0] ?? material, yr);
  yr += LINE_STEP;
  row("Comprimento:", `${Math.round(sheet.largura_mm)} mm`, yr);
  yr += LINE_STEP;
  row("Largura:", `${Math.round(sheet.altura_mm)} mm`, yr);
  yr += LINE_STEP;
  row("Espessura:", `${thickness} mm`, yr);
  yr += LINE_STEP;
  row("Desperdício:", `${waste}%`, yr);

  doc.setTextColor(0, 0, 0);
  return MARGIN + HEADER_BAND_MM + GAP_HEADER_DIAGRAM;
}

/** Altura útil do diagrama: até à margem inferior, menos reserva fixa para a tabela na 1.ª página. */
function computeDiagramMaxHeightMm(yDiagramTop: number): number {
  const bottomReserve = MARGIN + MIN_TABLE_SLICE_MM + GAP_DIAGRAM_TABLE;
  return Math.max(40, PAGE_H - yDiagramTop - bottomReserve);
}

function drawSheetDiagram(
  doc: jsPDF,
  sheetResult: SheetResult,
  originY: number,
  maxDiagramHeightMm: number,
  topRightOrigin: boolean
): { originX: number; originY: number; drawW: number; drawH: number; scale: number } {
  const { sheet, placements } = sheetResult;
  const maxW = INNER_W;
  const scaleX = maxW / sheet.largura_mm;
  const scaleY = maxDiagramHeightMm / sheet.altura_mm;
  const scale = Math.min(scaleX, scaleY);
  const drawW = sheet.largura_mm * scale;
  const drawH = sheet.altura_mm * scale;
  const originX = MARGIN + (maxW - drawW) / 2;

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.35);
  doc.rect(originX, originY, drawW, drawH);

  type PlacedRect = { pl: CutPlacement; px: number; py: number; pw: number; ph: number };
  const layoutRects: PlacedRect[] = placements.map((pl) => ({
    pl,
    // Converte TRO x (distância da aresta direita da peça ao lado B) para x físico de A (lado esquerdo).
    // topRightOrigin=true: pl.x_mm está em TRO → físico = W - pl.x_mm - pl.largura_mm
    // topRightOrigin=false: pl.x_mm já está em coordenadas físicas (origem esquerda, sistema nesting)
    px: originX + (topRightOrigin
      ? (sheet.largura_mm - pl.x_mm - pl.largura_mm)
      : pl.x_mm) * scale,
    py: originY + pl.y_mm * scale,
    pw: pl.largura_mm * scale,
    ph: pl.altura_mm * scale,
  }));

  for (const { pl, px, py, pw, ph } of layoutRects) {
    doc.setDrawColor(...BRAND_RED);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.35);
    const piecePhysLeft = placementPhysicalLeft(pl, sheet.largura_mm, topRightOrigin);
    const toDiagram = (localX: number, localY: number) => ({
      x: originX + (piecePhysLeft + localX) * scale,
      y: originY + (pl.y_mm + localY) * scale,
    });
    const drawOps = placementPdfDrawOps(pl);
    const outer = drawOps.find((op) => op.kind === "polygon" || op.kind === "rect");
    if (outer?.kind === "polygon") {
      drawClosedPath(
        doc,
        outer.points.map((p) => toDiagram(p.x, p.y)),
        "FD"
      );
    } else {
      doc.rect(px, py, pw, ph, "FD");
    }

    const bands = placementEdgeBands(pl);
    if (bands && outer?.kind !== "polygon") {
      const inset = 0.35;
      if (bands.top) drawDottedLine(doc, px + inset, py + inset, px + pw - inset, py + inset);
      if (bands.bottom) drawDottedLine(doc, px + inset, py + ph - inset, px + pw - inset, py + ph - inset);
      if (bands.left) drawDottedLine(doc, px + inset, py + inset, px + inset, py + ph - inset);
      if (bands.right) drawDottedLine(doc, px + pw - inset, py + inset, px + pw - inset, py + ph - inset);
    }

    for (const op of drawOps) {
      if (op.kind === "inner-rect") {
        const p0 = toDiagram(op.x, op.y);
        doc.setDrawColor(...BRAND_RED);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.25);
        doc.rect(p0.x, p0.y, op.w * scale, op.h * scale, "S");
      } else if (op.kind === "inner-circle") {
        const c = toDiagram(op.cx, op.cy);
        doc.setDrawColor(...BRAND_RED);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.25);
        doc.circle(c.x, c.y, op.r * scale, "S");
      }
    }

    const displayHoles = holesForPdf(pl, sheet, topRightOrigin);
    if (displayHoles.length > 0) {
      doc.setFillColor(30, 30, 30);
      doc.setDrawColor(30, 30, 30);
      for (const h of displayHoles) {
        const off = pdfDisplayHoleOffset(pl, h);
        const hx = originX + (piecePhysLeft + off.sx) * scale;
        const hy = originY + (pl.y_mm + off.sy) * scale;
        const r = Math.max(0.35, Math.min(1.1, ((h.diameter ?? 5) / 2) * scale * 0.85));
        doc.circle(hx, hy, r, "FD");
      }
    }
  }

  for (let i = 0; i < layoutRects.length; i++) {
    const { pl, px, py, pw, ph } = layoutRects[i];
    const auth = resolveAuthoritativeLabelNumber(pl);
    const numStr = String(auth ?? pl.shortCode ?? pl.pieceNumber ?? "—");
    let fs = Math.min(ph * 0.66, pw * 0.55, 42);
    fs = Math.max(5, fs);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_RED);
    doc.setFontSize(fs);
    while (fs > 5 && doc.getTextWidth(numStr) > pw - 1.5) {
      fs -= 0.5;
      doc.setFontSize(fs);
    }
    const textY = py + ph / 2 + fs * 0.28;
    if (textY - fs * 0.85 > py + 0.5 && textY < py + ph - 0.5) {
      doc.text(numStr, px + pw / 2, textY, { align: "center" });
    } else {
      doc.setFontSize(Math.min(fs, ph * 0.45));
      doc.text(numStr, px + pw / 2, py + ph / 2 + Math.min(fs, ph * 0.45) * 0.28, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
  }

  return { originX, originY, drawW, drawH, scale };
}

export async function buildCutLayoutPdf(
  result: CutLayoutResult,
  options?: CutLayoutPdfOptions
): Promise<jsPDF> {
  assertIndustrialOutputAuthorized("pdf-layout-pro");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const opts: CutLayoutPdfOptions = options ?? {};
  const logoDataUrl = await loadLogoIndustrialDataUrl();

  for (let i = 0; i < result.sheets.length; i++) {
    if (i > 0) doc.addPage("a4", "portrait");
    const sheetResult = result.sheets[i];
    const globalSheetIndex = i + 1;

    const yDiagramTop = drawPageHeader(doc, sheetResult, globalSheetIndex, opts, logoDataUrl);
    const maxDiagramH = computeDiagramMaxHeightMm(yDiagramTop);
    const diagram = drawSheetDiagram(
      doc,
      sheetResult,
      yDiagramTop,
      maxDiagramH,
      Boolean(opts.nestingTopRightOrigin)
    );
    const tableStartY = diagram.originY + diagram.drawH + GAP_DIAGRAM_TABLE;

    drawPieceTablePaginated(doc, sheetResult, tableStartY, globalSheetIndex, opts);
  }

  return doc;
}

function drawPieceTablePaginated(
  doc: jsPDF,
  sheetResult: SheetResult,
  firstTableStartY: number,
  globalSheetIndex: number,
  options: CutLayoutPdfOptions
): void {
  const { placements, sheet } = sheetResult;
  const head = [["Nome da peça", "Dimensões", "Nº Peça", "Qtd na placa", "Imagem da peça"]];

  const bodyRows = placements.map((pl) => [
    formatCutLayoutProPieceDisplayName(pl, options),
    `${Math.round(pl.largura_mm)}\u00d7${Math.round(pl.altura_mm)} mm`,
    String(resolveAuthoritativeLabelNumber(pl) ?? pl.shortCode ?? pl.pieceNumber ?? "—"),
    "1",
    "",
  ]);

  const rowH = TABLE_ROW_H_MM;
  const headH = TABLE_HEAD_H_MM;
  let rowOffset = 0;
  let startY = firstTableStartY;

  while (rowOffset < bodyRows.length) {
    const available = PAGE_H - startY - MARGIN;
    const maxRows = Math.max(1, Math.floor((available - headH - 1) / rowH));
    const end = Math.min(rowOffset + maxRows, bodyRows.length);
    const slice = bodyRows.slice(rowOffset, end);
    const slicePlacements = placements.slice(rowOffset, end);

    autoTable(doc, {
      startY,
      head,
      body: slice,
      styles: {
        fontSize: TABLE_FONT_PT,
        cellPadding: 1,
        lineColor: [160, 160, 160],
        lineWidth: 0.12,
        minCellHeight: TABLE_ROW_H_MM,
      },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: 20,
        fontStyle: "bold",
        fontSize: TABLE_FONT_PT,
        minCellHeight: TABLE_HEAD_H_MM,
      },
      bodyStyles: { minCellHeight: TABLE_ROW_H_MM },
      // Soma = INNER_W (194 mm) — A4 retrato; col 4 maximizada (~90–110).
      columnStyles: {
        0: { cellWidth: 50 }, // nome completo
        1: { cellWidth: 22 }, // medidas
        2: { cellWidth: 14 }, // Nº Peça
        3: { cellWidth: 14 }, // Qtd na placa
        4: { cellWidth: 94, minCellHeight: TABLE_ROW_H_MM }, // Imagem da peça
      },
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      showHead: "everyPage",
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 4) return;
        const pl = slicePlacements[data.row.index];
        if (!pl) return;
        const cell = data.cell;
        const pad = 1;
        const cw = cell.width - 2;
        const ch = cell.height - 2;

        // Landscape só na miniatura da lista — não altera nesting nem coords industriais.
        const forceLandscape = pl.altura_mm > pl.largura_mm;
        const geoW = forceLandscape ? pl.altura_mm : pl.largura_mm;
        const geoH = forceLandscape ? pl.largura_mm : pl.altura_mm;
        const scaleThumb = Math.min(cw / Math.max(geoW, 1), ch / Math.max(geoH, 1));
        const rw = geoW * scaleThumb;
        const rh = geoH * scaleThumb;
        const rx = cell.x + pad + (cw - rw) / 2;
        const ry = cell.y + pad + (ch - rh) / 2;

        // Silhueta sem caixa envolvente nem contorno.
        doc.setFillColor(248, 244, 244);
        const thumbOps = placementPdfDrawOps(pl);
        const toThumb = (sx: number, sy: number) => {
          if (forceLandscape) {
            return {
              x: rx + (sy / Math.max(pl.altura_mm, 1)) * rw,
              y: ry + ((pl.largura_mm - sx) / Math.max(pl.largura_mm, 1)) * rh,
            };
          }
          return {
            x: rx + (sx / Math.max(pl.largura_mm, 1)) * rw,
            y: ry + (sy / Math.max(pl.altura_mm, 1)) * rh,
          };
        };
        const outer = thumbOps.find((op) => op.kind === "polygon" || op.kind === "rect");
        if (outer?.kind === "polygon") {
          drawClosedPath(doc, outer.points.map((p) => toThumb(p.x, p.y)), "F");
        } else {
          doc.rect(rx, ry, rw, rh, "F");
        }
        for (const op of thumbOps) {
          if (op.kind === "inner-rect") {
            const corners = [
              toThumb(op.x, op.y),
              toThumb(op.x + op.w, op.y),
              toThumb(op.x + op.w, op.y + op.h),
              toThumb(op.x, op.y + op.h),
            ];
            const xs = corners.map((p) => p.x);
            const ys = corners.map((p) => p.y);
            doc.setDrawColor(180, 140, 140);
            doc.setLineWidth(0.12);
            doc.rect(
              Math.min(...xs),
              Math.min(...ys),
              Math.max(...xs) - Math.min(...xs),
              Math.max(...ys) - Math.min(...ys),
              "S"
            );
          } else if (op.kind === "inner-circle") {
            const c = toThumb(op.cx, op.cy);
            const rThumb = forceLandscape
              ? (op.r / Math.max(pl.altura_mm, 1)) * rw
              : (op.r / Math.max(pl.largura_mm, 1)) * rw;
            doc.setDrawColor(180, 140, 140);
            doc.setLineWidth(0.12);
            doc.circle(c.x, c.y, Math.max(0.2, rThumb), "S");
          }
        }

        const thumbHoles = holesForPdf(pl, sheet, false);
        if (thumbHoles.length > 0) {
          doc.setFillColor(25, 25, 25);
          for (const h of thumbHoles) {
            const off = pdfDisplayHoleOffset(pl, h);
            let hx: number;
            let hy: number;
            let hr: number;
            if (forceLandscape) {
              // 90° CW visual: (sx, sy) → (sy, largura - sx) no espaço landscape.
              hx = rx + (off.sy / pl.altura_mm) * rw;
              hy = ry + ((pl.largura_mm - off.sx) / pl.largura_mm) * rh;
              hr = Math.max(0.18, Math.min(0.5, (h.diameter / 2 / pl.altura_mm) * rw));
            } else {
              hx = rx + (off.sx / pl.largura_mm) * rw;
              hy = ry + (off.sy / pl.altura_mm) * rh;
              hr = Math.max(0.18, Math.min(0.5, (h.diameter / 2 / pl.largura_mm) * rw));
            }
            doc.circle(hx, hy, hr, "F");
          }
        }
        const authThumb = resolveAuthoritativeLabelNumber(pl);
        const numStr = String(authThumb ?? pl.shortCode ?? pl.pieceNumber ?? "—");
        let nfs = Math.min(rh * 0.52, rw * 0.42, 16);
        nfs = Math.max(5, nfs);
        doc.setFontSize(nfs);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND_RED);
        while (nfs > 5 && doc.getTextWidth(numStr) > rw - 0.6) {
          nfs -= 0.5;
          doc.setFontSize(nfs);
        }
        doc.text(numStr, rx + rw / 2, ry + rh / 2 + nfs * 0.28, { align: "center" });
        doc.setTextColor(0, 0, 0);
      },
    });

    rowOffset = end;
    if (rowOffset >= bodyRows.length) break;

    doc.addPage("a4", "portrait");
    doc.setFontSize(FONT_TITLE);
    doc.setFont("helvetica", "bold");
    doc.text(`Chapa A${globalSheetIndex} — Lista de peças (continuação)`, MARGIN, MARGIN + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_LABEL);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Material: ${sheet.materialName ?? sheet.materialId ?? "—"} · ${Math.round(sheet.largura_mm)}\u00d7${Math.round(sheet.altura_mm)} mm`,
      MARGIN,
      MARGIN + 10
    );
    doc.setTextColor(0, 0, 0);
    startY = MARGIN + 14;
  }
}
