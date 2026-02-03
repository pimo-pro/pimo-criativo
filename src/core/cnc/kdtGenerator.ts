/**
 * Geração de ficheiro KDT (KDTPanelFormat) simplificado.
 */

import type { CncDrillOperation, CncPanel } from "./cncTypes";

const fmt = (n: number) => Number.isFinite(n) ? n.toFixed(2) : "0.00";

function quadrantForX(x: number, panelLength: number): number {
  return x <= panelLength / 2 ? 1 : 2;
}

export function generateKdt(panel: CncPanel, drills: CncDrillOperation[]): string {
  const lines: string[] = [];
  lines.push("<PANEL>");
  lines.push(`  <PanelLength>${fmt(panel.largura_mm)}</PanelLength>`);
  lines.push(`  <PanelWidth>${fmt(panel.altura_mm)}</PanelWidth>`);
  lines.push(`  <PanelThickness>${fmt(panel.espessura_mm)}</PanelThickness>`);
  lines.push("</PANEL>");

  for (const op of drills) {
    const typeNo = op.tipo === "horizontal" ? 2 : 1;
    const typeName = op.tipo === "horizontal" ? "Horizontal Hole" : "Vertical Hole";
    const quadrant = quadrantForX(op.x, panel.largura_mm);
    const z1 = panel.espessura_mm / 2;
    lines.push("<CAD>");
    lines.push(`  <TypeNo>${typeNo}</TypeNo>`);
    lines.push(`  <TypeName>${typeName}</TypeName>`);
    lines.push(`  <Quadrant>${quadrant}</Quadrant>`);
    lines.push(`  <X1>${fmt(op.x)}</X1>`);
    lines.push(`  <Y1>${fmt(op.y)}</Y1>`);
    lines.push(`  <Z1>${fmt(z1)}</Z1>`);
    lines.push(`  <Depth>${fmt(op.profundidade)}</Depth>`);
    lines.push(`  <Diameter>${fmt(op.diametro)}</Diameter>`);
    lines.push("</CAD>");
  }

  return lines.join("\n");
}
