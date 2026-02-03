/**
 * Geração de ficheiro TCN (Nesting).
 * Baseado em estrutura real simplificada.
 */

import type { CutLayoutResult } from "../cutlayout/cutLayoutTypes";

const HEADER = "TPA\\ALBATROS\\EDICAD\\00.00:0";

const fmt = (n: number) => Number.isFinite(n) ? n.toFixed(2) : "0.00";

function buildContourPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  z = 0
): Array<{ x: number; y: number; z: number }> {
  return [
    { x, y, z },
    { x: x + w, y, z },
    { x: x + w, y: y + h, z },
    { x, y: y + h, z },
    { x, y, z },
  ];
}

function buildW81(points: Array<{ x: number; y: number; z: number }>): string {
  return points
    .map((p) => `W#81 X=${fmt(p.x)} Y=${fmt(p.y)} Z=${fmt(p.z)}`)
    .join("\n");
}

function buildW2201(points: Array<{ x: number; y: number; z: number }>): string {
  const segments: string[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    segments.push(`W#2201 X1=${fmt(a.x)} Y1=${fmt(a.y)} X2=${fmt(b.x)} Y2=${fmt(b.y)}`);
  }
  return segments.join("\n");
}

export function generateTcn(layout: CutLayoutResult, kerf_mm = 3): string {
  const lines: string[] = [];
  lines.push(HEADER);

  layout.sheets.forEach((sheetResult, index) => {
    const sheet = sheetResult.sheet;
    lines.push(`$=Acam Name=Sheet A${index + 1}`);
    lines.push(`::UNm DL=${fmt(sheet.largura_mm)} DH=${fmt(sheet.altura_mm)} DS=${fmt(sheet.espessura_mm)} OX=0 OY=0 OZ=0`);
    lines.push("SIDE#1");
    lines.push("::LF");
    lines.push("::HF");
    lines.push("::SF");

    sheetResult.placements.forEach((pl, idx) => {
      const w = pl.largura_mm;
      const h = pl.altura_mm;
      const x = pl.x_mm + kerf_mm / 2;
      const y = pl.y_mm + kerf_mm / 2;
      const points = buildContourPoints(x, y, w, h, 0);
      lines.push(`;PIECE ${pl.partName} (${pl.boxId}) #${idx + 1}`);
      lines.push(buildW81(points));
      lines.push("W#89"); // placeholder para operações especiais
      lines.push(buildW2201(points));
    });
  });

  return lines.join("\n");
}
