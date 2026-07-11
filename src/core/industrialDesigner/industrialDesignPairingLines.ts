/**
 * Segmentos de linha entre furos emparelhados (cavilha frente/verso).
 */

import type { DesignDrillHole, DesignPanel, IndustrialDesignBox } from "./types";
import { holeMmToLocalMeters } from "./panelHoleCoords";

export type Vec3 = { x: number; y: number; z: number };

export type DesignPanelMeshRef = {
  panelId: string;
  panelType: string;
  widthM: number;
  heightM: number;
  /** Transforma ponto local do painel → espaço da caixa (4x4 column-major). */
  matrix: number[];
};

function transformPoint(matrix: number[], p: Vec3): Vec3 {
  const x = matrix[0] * p.x + matrix[4] * p.y + matrix[8] * p.z + matrix[12];
  const y = matrix[1] * p.x + matrix[5] * p.y + matrix[9] * p.z + matrix[13];
  const z = matrix[2] * p.x + matrix[6] * p.y + matrix[10] * p.z + matrix[14];
  return { x, y, z };
}

function holeToBoxSpace(
  mesh: DesignPanelMeshRef,
  hole: DesignDrillHole
): Vec3 {
  const local = holeMmToLocalMeters(mesh.panelType, mesh.widthM, mesh.heightM, hole.xMm, hole.yMm, {
    face: hole.drillFace,
  });
  return transformPoint(mesh.matrix, local);
}

function findHoleById(box: IndustrialDesignBox, holeId: string): { panel: DesignPanel; hole: DesignDrillHole } | null {
  for (const panel of box.panels) {
    const hole = panel.drillHoles.find((h) => h.id === holeId);
    if (hole) return { panel, hole };
  }
  return null;
}

export type PairedHoleLineSegment = { from: Vec3; to: Vec3 };

/**
 * Gera linhas entre pares hole.pairedHoleId (evita duplicar A→B e B→A).
 */
export function collectPairedHoleLineSegments(
  designBox: IndustrialDesignBox,
  meshByPanelId: Map<string, DesignPanelMeshRef>
): PairedHoleLineSegment[] {
  const segments: PairedHoleLineSegment[] = [];
  const seen = new Set<string>();

  for (const panel of designBox.panels) {
    const meshA = meshByPanelId.get(panel.id);
    if (!meshA) continue;

    for (const hole of panel.drillHoles) {
      if (!hole.pairedHoleId) continue;
      const pairKey = [hole.id, hole.pairedHoleId].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const paired = findHoleById(designBox, hole.pairedHoleId);
      if (!paired) continue;
      const meshB = meshByPanelId.get(paired.panel.id);
      if (!meshB) continue;

      segments.push({
        from: holeToBoxSpace(meshA, hole),
        to: holeToBoxSpace(meshB, paired.hole),
      });
    }
  }

  return segments;
}

export function pairedSegmentsToFloat32Array(segments: PairedHoleLineSegment[]): Float32Array {
  const out = new Float32Array(segments.length * 6);
  segments.forEach((seg, i) => {
    const o = i * 6;
    out[o] = seg.from.x;
    out[o + 1] = seg.from.y;
    out[o + 2] = seg.from.z;
    out[o + 3] = seg.to.x;
    out[o + 4] = seg.to.y;
    out[o + 5] = seg.to.z;
  });
  return out;
}
