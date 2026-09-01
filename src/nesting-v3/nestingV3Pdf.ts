/**
 * Nesting V3 — PDF Técnico Completo
 *
 * Gera um PDF com:
 * 1. Capa com resumo do projeto
 * 2. Vista geral de cada folha (escala real, peças posicionadas, furos)
 * 3. Detalhe técnico de cada peça (cotas, distâncias às bordas, furos detalhados)
 *
 * Usa jsPDF (já no projeto). Completamente independente do motor industrial.
 */

import jsPDF from "jspdf";
import type { NestingV3State, V3Piece, V3Placement, V3Sheet } from "./nestingV3Types";
import { rotateHoles } from "./nestingV3Engine";
import { calcSheetUtilization } from "./nestingV3Engine";

// ── Constantes visuais ────────────────────────────────────────────────────────

const A4_W = 210;  // mm
const A4_H = 297;  // mm
const MARGIN = 14;
const INNER_W = A4_W - MARGIN * 2;

// Cores (R, G, B)
const CLR_NAVY:   [number, number, number] = [15,  23,  42];
const CLR_MUTED:  [number, number, number] = [100, 116, 139];
const CLR_TEXT:   [number, number, number] = [30,  41,  59];
const CLR_SHEET:  [number, number, number] = [232, 228, 221];
const CLR_BORDER: [number, number, number] = [180, 174, 166];
const CLR_DIM:    [number, number, number] = [59,  130, 246];  // dimension arrows
const CLR_HOLE:   [number, number, number] = [20,  20,  20];

// ── Helpers ───────────────────────────────────────────────────────────────────

function effectiveDims(piece: V3Piece): { w: number; h: number } {
  const rotated = piece.rotation === 90 || piece.rotation === 270;
  return rotated
    ? { w: piece.heightMm, h: piece.widthMm }
    : { w: piece.widthMm, h: piece.heightMm };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [200, 190, 180];
  return [Math.max(120, r), Math.max(120, g), Math.max(120, b)];
}

// ── Seta de dimensão (estilo técnico industrial) ──────────────────────────────

function drawDimArrow(
  doc: jsPDF,
  x1: number, y1: number,
  x2: number, y2: number,
  label: string,
  side: "top" | "bottom" | "left" | "right" = "top",
  offset = 4
) {
  const [cr, cg, cb] = CLR_DIM;
  doc.setDrawColor(cr, cg, cb);
  doc.setLineWidth(0.25);
  doc.setTextColor(cr, cg, cb);
  doc.setFontSize(6);

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Extension lines
  if (side === "top" || side === "bottom") {
    const oy = side === "top" ? -offset : offset;
    doc.line(x1, y1 + oy, x1, y1);
    doc.line(x2, y2 + oy, x2, y2);
    doc.line(x1, y1 + oy, x2, y2 + oy);
    // Arrowheads
    const ah = 0.8;
    doc.line(x1, y1 + oy, x1 + ah, y1 + oy + ah * 0.4);
    doc.line(x1, y1 + oy, x1 + ah, y1 + oy - ah * 0.4);
    doc.line(x2, y2 + oy, x2 - ah, y2 + oy + ah * 0.4);
    doc.line(x2, y2 + oy, x2 - ah, y2 + oy - ah * 0.4);
    doc.text(label, mx, y1 + oy - 0.8, { align: "center" });
  } else {
    const ox = side === "left" ? -offset : offset;
    doc.line(x1 + ox, y1, x1, y1);
    doc.line(x2 + ox, y2, x2, y2);
    doc.line(x1 + ox, y1, x2 + ox, y2);
    const ah = 0.8;
    doc.line(x1 + ox, y1, x1 + ox + ah * 0.4, y1 + ah);
    doc.line(x1 + ox, y1, x1 + ox - ah * 0.4, y1 + ah);
    doc.line(x2 + ox, y2, x2 + ox + ah * 0.4, y2 - ah);
    doc.line(x2 + ox, y2, x2 + ox - ah * 0.4, y2 - ah);
    doc.text(label, x1 + ox - 1, my, { angle: 90, align: "center" });
  }
  doc.setTextColor(0, 0, 0);
}

// ── Cabeçalho de página ───────────────────────────────────────────────────────

function drawPageHeader(doc: jsPDF, title: string, subtitle: string, pageNum: number) {
  const [nr, ng, nb] = CLR_NAVY;
  doc.setFillColor(nr, ng, nb);
  doc.rect(0, 0, A4_W, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PIMO Criativo", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(title, A4_W / 2, 9, { align: "center" });
  doc.text(`Pág. ${pageNum}`, A4_W - MARGIN, 9, { align: "right" });
  doc.setTextColor(0, 0, 0);
  if (subtitle) {
    const [mr, mg, mb] = CLR_MUTED;
    doc.setTextColor(mr, mg, mb);
    doc.setFontSize(7);
    doc.text(subtitle, MARGIN, 17.5);
    doc.setTextColor(0, 0, 0);
  }
}

// ── Linha separadora ──────────────────────────────────────────────────────────

function drawHRule(doc: jsPDF, y: number) {
  const [mr, mg, mb] = CLR_MUTED;
  doc.setDrawColor(mr, mg, mb);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, A4_W - MARGIN, y);
}

// ── Capa ──────────────────────────────────────────────────────────────────────

function addCoverPage(doc: jsPDF, state: NestingV3State, projectName: string): void {
  const [nr, ng, nb] = CLR_NAVY;
  doc.setFillColor(nr, ng, nb);
  doc.rect(0, 0, A4_W, 50, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("PIMO Criativo", MARGIN, 22);

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text("Nesting V3 — Layout de Corte Manual", MARGIN, 32);

  doc.setFontSize(9);
  const [mr, mg, mb] = [148, 163, 184];
  doc.setTextColor(mr, mg, mb);
  doc.text(`Projeto: ${projectName}`, MARGIN, 41);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-PT")}`, MARGIN, 47);
  doc.setTextColor(0, 0, 0);

  let y = 62;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const [tr, tg, tb] = CLR_TEXT;
  doc.setTextColor(tr, tg, tb);
  doc.text("Resumo do projeto", MARGIN, y);
  drawHRule(doc, y + 2);
  y += 8;

  const totalPieces = state.pieces.length;
  const placed = state.placements.length;
  const unplaced = state.unplacedPieceIds.length;
  const sheetsUsed = new Set(state.placements.map((p) => p.sheetIndex)).size;

  const rows: [string, string][] = [
    ["Total de peças",     String(totalPieces)],
    ["Peças colocadas",    String(placed)],
    ["Peças por colocar",  String(unplaced)],
    ["Folhas utilizadas",  String(sheetsUsed)],
    ["Folhas totais",      String(state.sheets.length)],
    ["Kerf (folga)",       `${state.kerfMm} mm`],
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const [label, val] of rows) {
    const [mr, mg, mb] = CLR_MUTED;
    doc.setTextColor(mr, mg, mb);
    doc.text(label, MARGIN, y);
    const [tr, tg, tb] = CLR_TEXT;
    doc.setTextColor(tr, tg, tb);
    doc.text(val, MARGIN + 60, y);
    y += 7;
  }

  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(tr, tg, tb);
  doc.text("Folhas", MARGIN, y);
  drawHRule(doc, y + 2);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const sheet of state.sheets) {
    const util = calcSheetUtilization(sheet.index, sheet, state.placements, state.pieces);
    const piecesOnSheet = state.placements.filter((p) => p.sheetIndex === sheet.index).length;
    const [mr2, mg2, mb2] = CLR_MUTED;
    doc.setTextColor(mr2, mg2, mb2);
    doc.text(`Folha ${sheet.index + 1}:`, MARGIN, y);
    const [tr2, tg2, tb2] = CLR_TEXT;
    doc.setTextColor(tr2, tg2, tb2);
    doc.text(`${sheet.widthMm} × ${sheet.heightMm} × ${sheet.thicknessMm} mm · ${piecesOnSheet} peças · ${Math.round(util)}% utilização`, MARGIN + 24, y);
    y += 6;
  }

  // Footer
  doc.setFontSize(7);
  const [mr3, mg3, mb3] = CLR_MUTED;
  doc.setTextColor(mr3, mg3, mb3);
  doc.text("Gerado pelo PIMO Criativo — Nesting V3 — Layout Manual de Corte", A4_W / 2, A4_H - 8, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

// ── Vista geral da folha ──────────────────────────────────────────────────────

function addSheetOverviewPage(
  doc: jsPDF,
  sheet: V3Sheet,
  placements: V3Placement[],
  pieces: V3Piece[],
  pageNum: number
): void {
  drawPageHeader(doc, `Folha ${sheet.index + 1} — Vista Geral`, `${sheet.widthMm} × ${sheet.heightMm} × ${sheet.thicknessMm} mm`, pageNum);

  const startY = 22;
  const availH = A4_H - startY - MARGIN - 50; // leave space for table
  const availW = INNER_W;

  // Scale to fit
  const scaleX = availW / sheet.widthMm;
  const scaleY = availH / sheet.heightMm;
  const scale  = Math.min(scaleX, scaleY);

  const drawW = sheet.widthMm * scale;
  const drawH = sheet.heightMm * scale;
  const offsetX = MARGIN + (availW - drawW) / 2;
  const offsetY = startY;

  // Sheet background
  const [sr, sg, sb] = CLR_SHEET;
  doc.setFillColor(sr, sg, sb);
  const [br, bg, bb] = CLR_BORDER;
  doc.setDrawColor(br, bg, bb);
  doc.setLineWidth(0.5);
  doc.rect(offsetX, offsetY, drawW, drawH, "FD");

  // Dimension arrows for the sheet
  drawDimArrow(doc,
    offsetX, offsetY + drawH,
    offsetX + drawW, offsetY + drawH,
    `${sheet.widthMm} mm`, "bottom", 5
  );
  drawDimArrow(doc,
    offsetX + drawW, offsetY,
    offsetX + drawW, offsetY + drawH,
    `${sheet.heightMm} mm`, "right", 5
  );

  const myPlacements = placements.filter((p) => p.sheetIndex === sheet.index);
  let pieceNum = 0;

  for (const pl of myPlacements) {
    const piece = pieces.find((p) => p.id === pl.pieceId);
    if (!piece) continue;
    pieceNum++;

    const { w, h } = effectiveDims(piece);
    const px = offsetX + pl.xMm * scale;
    const py = offsetY + pl.yMm * scale;
    const pw = w * scale;
    const ph = h * scale;

    // Piece fill
    const [pr, pg, pb] = hexToRgb(piece.color);
    doc.setFillColor(pr, pg, pb);
    doc.setDrawColor(Math.max(0, pr - 50), Math.max(0, pg - 50), Math.max(0, pb - 50));
    doc.setLineWidth(0.3);
    doc.rect(px, py, pw, ph, "FD");

    // Piece number badge
    const [nr, ng, nb] = CLR_NAVY;
    doc.setFillColor(nr, ng, nb);
    const badgeR = Math.min(3, pw / 2, ph / 2);
    doc.circle(px + pw / 2, py + ph / 2, badgeR, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(Math.min(5, pw * 0.4, ph * 0.4));
    doc.text(String(pieceNum), px + pw / 2, py + ph / 2 + 0.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Rotation indicator
    if (piece.rotation !== 0) {
      const [mr, mg, mb] = CLR_MUTED;
      doc.setTextColor(mr, mg, mb);
      doc.setFontSize(3.5);
      doc.text(`${piece.rotation}°`, px + pw - 1.5, py + 2.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
    }

    // Holes
    const holes = rotateHoles(piece.originalHoles, piece.rotation, piece.widthMm, piece.heightMm);
    for (const h of holes) {
      const hx = px + h.x * scale;
      const hy = py + h.y * scale;
      const hr = Math.max(0.4, h.diameter * scale * 0.5);
      const [hr2, hg, hb] = CLR_HOLE;
      doc.setFillColor(hr2, hg, hb);
      doc.circle(hx, hy, hr, "F");
    }
  }

  // Piece legend table below drawing
  let tableY = offsetY + drawH + 10;
  const [tr, tg, tb] = CLR_TEXT;
  doc.setTextColor(tr, tg, tb);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Legenda das peças", MARGIN, tableY);
  tableY += 4;
  drawHRule(doc, tableY);
  tableY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  const colWidths = [8, 50, 22, 22, 22, 22, 20];
  const headers = ["#", "Nome", "L (mm)", "A (mm)", "E (mm)", "Rotação", "Furos"];
  let cx = MARGIN;
  const [mr, mg, mb] = CLR_MUTED;
  doc.setTextColor(mr, mg, mb);
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx, tableY);
    cx += colWidths[i];
  }
  tableY += 4;
  drawHRule(doc, tableY);
  tableY += 3;

  pieceNum = 0;
  for (const pl of myPlacements) {
    const piece = pieces.find((p) => p.id === pl.pieceId);
    if (!piece) continue;
    pieceNum++;
    if (tableY > A4_H - 10) break;

    const { w, h } = effectiveDims(piece);
    const rowData = [
      String(pieceNum),
      piece.name.slice(0, 22),
      String(Math.round(w)),
      String(Math.round(h)),
      String(piece.thicknessMm),
      `${piece.rotation}°`,
      String(piece.originalHoles.length),
    ];

    cx = MARGIN;
    doc.setTextColor(tr, tg, tb);
    for (let i = 0; i < rowData.length; i++) {
      doc.text(rowData[i], cx, tableY);
      cx += colWidths[i];
    }
    tableY += 5;

    // Light row divider
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);
    doc.line(MARGIN, tableY - 1, A4_W - MARGIN, tableY - 1);
  }

  // Utilization
  const util = calcSheetUtilization(sheet.index, sheet, placements, pieces);
  doc.setFontSize(7);
  const [mr2, mg2, mb2] = CLR_MUTED;
  doc.setTextColor(mr2, mg2, mb2);
  doc.text(`Utilização da folha: ${Math.round(util)}%`, A4_W - MARGIN, A4_H - 10, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

// ── Detalhe técnico de uma peça ───────────────────────────────────────────────

function addPieceDetailPage(
  doc: jsPDF,
  piece: V3Piece,
  placement: V3Placement | undefined,
  pageNum: number
): void {
  const { w: ew, h: eh } = effectiveDims(piece);
  drawPageHeader(
    doc,
    `Peça: ${piece.name}`,
    `Folha ${placement ? placement.sheetIndex + 1 : "—"} · ${ew} × ${eh} × ${piece.thicknessMm} mm · Rotação ${piece.rotation}°`,
    pageNum
  );

  const y = 24;

  // ── Technical drawing area ────────────────────────────────────────────────
  const DRAW_AREA_H = 120;
  const DRAW_AREA_W = INNER_W * 0.65;
  const scaleX = DRAW_AREA_W / ew;
  const scaleY = DRAW_AREA_H / eh;
  const scale  = Math.min(scaleX, scaleY, 1.5); // never bigger than 1.5 px/mm

  const drawW = ew * scale;
  const drawH = eh * scale;
  const dox = MARGIN + (DRAW_AREA_W - drawW) / 2 + 10; // +10 for left dim
  const doy = y + 10; // +10 for top dim

  // Sheet/piece body
  const [pr, pg, pb] = hexToRgb(piece.color);
  doc.setFillColor(Math.min(255, pr + 20), Math.min(255, pg + 20), Math.min(255, pb + 20));
  doc.setDrawColor(Math.max(0, pr - 30), Math.max(0, pg - 30), Math.max(0, pb - 30));
  doc.setLineWidth(0.5);
  doc.rect(dox, doy, drawW, drawH, "FD");

  // Grain direction line
  const [mr, mg, mb] = CLR_MUTED;
  doc.setDrawColor(mr, mg, mb);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(dox + drawW * 0.1, doy + drawH / 2, dox + drawW * 0.9, doy + drawH / 2);
  doc.setLineDashPattern([], 0);

  // Dimension arrows
  drawDimArrow(doc, dox, doy, dox + drawW, doy, `${Math.round(ew)} mm`, "top", 5);
  drawDimArrow(doc, dox, doy, dox, doy + drawH, `${Math.round(eh)} mm`, "left", 6);

  // Holes with crosshair + labels
  const holes = rotateHoles(piece.originalHoles, piece.rotation, piece.widthMm, piece.heightMm);
  const holeLabels: string[] = [];

  holes.forEach((h, idx) => {
    const hx = dox + h.x * scale;
    const hy = doy + h.y * scale;
    const hr = Math.max(0.6, h.diameter * scale * 0.5);

    // Crosshair
    const [dr, dg, db] = CLR_DIM;
    doc.setDrawColor(dr, dg, db);
    doc.setLineWidth(0.2);
    const cs = 1.5;
    doc.line(hx - cs, hy, hx + cs, hy);
    doc.line(hx, hy - cs, hx, hy + cs);

    // Circle
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.circle(hx, hy, hr);

    // Label number
    doc.setFontSize(5);
    const [nr, ng, nb] = CLR_NAVY;
    doc.setTextColor(nr, ng, nb);
    doc.setFont("helvetica", "bold");
    doc.text(String(idx + 1), hx + hr + 0.5, hy - hr - 0.3);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    // Dimension lines to edges
    const [dr2, dg2, db2] = CLR_DIM;
    doc.setDrawColor(dr2, dg2, db2);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.line(hx, hy, dox, hy); // to left edge
    doc.line(hx, hy, hx, doy + drawH); // to bottom edge
    doc.setLineDashPattern([], 0);

    // Distance labels
    doc.setFontSize(4.5);
    doc.setTextColor(dr2, dg2, db2);
    const distLeft   = Math.round(h.x);
    const distBottom = Math.round(eh - h.y);
    if (h.x > 5)  doc.text(`${distLeft}`, (hx + dox) / 2, hy - 1, { align: "center" });
    if (distBottom > 5) doc.text(`${distBottom}`, hx + 1, (hy + doy + drawH) / 2);
    doc.setTextColor(0, 0, 0);

    holeLabels.push(`${idx + 1}`);
  });

  // Position info (if placed)
  if (placement) {
    doc.setFontSize(6.5);
    const [mr3, mg3, mb3] = CLR_MUTED;
    doc.setTextColor(mr3, mg3, mb3);
    doc.text(
      `Posição na folha: X = ${Math.round(placement.xMm)} mm · Y = ${Math.round(placement.yMm)} mm`,
      dox, doy + drawH + 8
    );
    doc.setTextColor(0, 0, 0);
  }

  // ── Right panel: properties ───────────────────────────────────────────────
  const rightX = MARGIN + DRAW_AREA_W + 14;
  let ry = y;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const [tr, tg, tb] = CLR_TEXT;
  doc.setTextColor(tr, tg, tb);
  doc.text("Propriedades", rightX, ry);
  ry += 5;
  drawHRule(doc, ry);
  ry += 4;

  const props: [string, string][] = [
    ["Nome",       piece.name],
    ["Largura",    `${ew} mm`],
    ["Altura",     `${eh} mm`],
    ["Espessura",  `${piece.thicknessMm} mm`],
    ["Rotação",    `${piece.rotation}°`],
    ["Furos",      String(holes.length)],
    ...(piece.materialName ? [["Material", piece.materialName] as [string, string]] : []),
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  for (const [label, val] of props) {
    const [mr2, mg2, mb2] = CLR_MUTED;
    doc.setTextColor(mr2, mg2, mb2);
    doc.text(label, rightX, ry);
    const [tr2, tg2, tb2] = CLR_TEXT;
    doc.setTextColor(tr2, tg2, tb2);
    doc.text(val, rightX + 22, ry);
    ry += 6;
  }

  // ── Hole table ────────────────────────────────────────────────────────────
  if (holes.length > 0) {
    ry += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const [tr3, tg3, tb3] = CLR_TEXT;
    doc.setTextColor(tr3, tg3, tb3);
    doc.text(`Furos (${holes.length})`, MARGIN, doy + drawH + 18);
    drawHRule(doc, doy + drawH + 20);

    const tStart = doy + drawH + 25;
    const tColW  = [8, 18, 18, 18, 16, 20, 50];
    const tCols  = ["#", "X (mm)", "Y (mm)", "Ø (mm)", "Prof.", "Tipo", "Observação"];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let tx = MARGIN;
    const [mr4, mg4, mb4] = CLR_MUTED;
    doc.setTextColor(mr4, mg4, mb4);
    for (let i = 0; i < tCols.length; i++) {
      doc.text(tCols[i], tx, tStart);
      tx += tColW[i];
    }

    let holeRow = tStart + 4;
    drawHRule(doc, holeRow - 1);
    holeRow += 2;

    holes.forEach((h, idx) => {
      if (holeRow > A4_H - 10) return;
      tx = MARGIN;
      const holeData = [
        String(idx + 1),
        String(Math.round(h.x)),
        String(Math.round(h.y)),
        String(h.diameter),
        String(h.depth),
        h.holeType ?? "geral",
        "",
      ];
      const [tr4, tg4, tb4] = CLR_TEXT;
      doc.setTextColor(tr4, tg4, tb4);
      for (let i = 0; i < holeData.length; i++) {
        doc.text(holeData[i], tx, holeRow);
        tx += tColW[i];
      }
      holeRow += 5;
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.1);
      doc.line(MARGIN, holeRow - 1, A4_W - MARGIN, holeRow - 1);
    });
  } else {
    doc.setFontSize(7.5);
    const [mr5, mg5, mb5] = CLR_MUTED;
    doc.setTextColor(mr5, mg5, mb5);
    doc.text("Esta peça não tem furos definidos.", MARGIN, doy + drawH + 22);
    doc.setTextColor(0, 0, 0);
  }

  doc.setTextColor(0, 0, 0);
}

// ── Entrada pública ───────────────────────────────────────────────────────────

/**
 * Gera o PDF técnico completo do Nesting V3.
 * Retorna um Blob para download.
 */
export function generateNestingV3Pdf(
  state: NestingV3State,
  projectName = "Projeto"
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let pageNum = 1;

  // ── 1. Capa ───────────────────────────────────────────────────────────────
  addCoverPage(doc, state, projectName);

  // ── 2. Vista geral por folha ──────────────────────────────────────────────
  const sheetsWithPieces = state.sheets.filter((sheet) =>
    state.placements.some((p) => p.sheetIndex === sheet.index)
  );

  for (const sheet of sheetsWithPieces) {
    doc.addPage();
    pageNum++;
    addSheetOverviewPage(doc, sheet, state.placements, state.pieces, pageNum);
  }

  // ── 3. Detalhe de cada peça colocada ─────────────────────────────────────
  for (const piece of state.pieces) {
    const placement = state.placements.find((p) => p.pieceId === piece.id);
    doc.addPage();
    pageNum++;
    addPieceDetailPage(doc, piece, placement, pageNum);
  }

  return doc.output("blob");
}

/**
 * Download do Layout PRO industrial (mesmo pipeline geométrico que TCN).
 */
export async function downloadNestingV3LayoutProPdf(
  state: NestingV3State,
  projectName = "Projeto"
): Promise<void> {
  const { prepareNestingV3IndustrialLayout } = await import("./nestingV3Export");
  const { buildCutLayoutPdf } = await import("../core/cutlayout/cutLayoutPdf");
  const layoutResult = prepareNestingV3IndustrialLayout(state);
  const doc = await buildCutLayoutPdf(layoutResult, { projectName });
  doc.save(`${projectName.replace(/\s+/g, "_")}_Layout_PRO.pdf`);
}

/**
 * Download directo do PDF.
 * Layout PRO (visual) + PDF industrial_armazem (resumo para armazém).
 */
export async function downloadNestingV3Pdf(state: NestingV3State, projectName = "Projeto"): Promise<void> {
  await downloadNestingV3LayoutProPdf(state, projectName);
  const { downloadNestingV3ArmazemPdf } = await import("./nestingV3Export");
  await downloadNestingV3ArmazemPdf(state, projectName);
}
