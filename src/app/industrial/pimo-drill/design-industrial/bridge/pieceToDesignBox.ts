import {
  type DesignDrillHole,
  type IndustrialDesignBox,
} from '@/core/industrialDesigner';

import { sanitizeMm, sanitizePiece } from '../../geometry/pieceGeometry';
import type { PieceModel } from '../../pimoDrillTypes';

/** Painel único que representa a chapa L×W×T no DRILL. */
export function getDrillPrimaryPanelId(pieceId: string): string {
  return `${pieceId}:chapa`;
}

/**
 * Converte a peça DRILL num IndustrialDesignBox mínimo (1 painel).
 * Reutiliza o domínio industrialDesigner sem ViewerCore.
 */
export function pieceModelToDesignBox(piece: PieceModel): IndustrialDesignBox {
  const p = sanitizePiece(piece);
  const panelId = getDrillPrimaryPanelId(p.id);

  return {
    id: p.id,
    nome: 'Peça PIMO DRILL',
    outerWidthMm: p.lengthMm,
    outerHeightMm: p.widthMm,
    outerDepthMm: p.thicknessMm,
    espessuraMm: p.thicknessMm,
    materialId: 'default',
    panels: [
      {
        id: panelId,
        tipo: 'frente',
        widthMm: p.lengthMm,
        heightMm: p.widthMm,
        thicknessMm: p.thicknessMm,
        materialId: 'default',
        drillHoles: [],
      },
    ],
    constraints: [],
    designWorkspace: true,
  };
}

/**
 * Actualiza dims da design box a partir da peça, preservando furos do painel principal.
 */
export function syncDesignBoxToPiece(
  designBox: IndustrialDesignBox,
  piece: PieceModel,
): IndustrialDesignBox {
  const p = sanitizePiece(piece);
  const panelId = getDrillPrimaryPanelId(p.id);
  const primary =
    designBox.panels.find((panel) => panel.id === panelId) ?? designBox.panels[0];

  const nextPrimary = primary
    ? {
        ...primary,
        id: panelId,
        widthMm: p.lengthMm,
        heightMm: p.widthMm,
        thicknessMm: sanitizeMm(p.thicknessMm),
      }
    : {
        id: panelId,
        tipo: 'frente' as const,
        widthMm: p.lengthMm,
        heightMm: p.widthMm,
        thicknessMm: sanitizeMm(p.thicknessMm),
        materialId: 'default',
        drillHoles: [] as DesignDrillHole[],
      };

  const otherPanels = designBox.panels.filter((panel) => panel.id !== primary?.id);

  return {
    ...designBox,
    id: p.id,
    outerWidthMm: p.lengthMm,
    outerHeightMm: p.widthMm,
    outerDepthMm: p.thicknessMm,
    espessuraMm: sanitizeMm(p.thicknessMm),
    panels: [nextPrimary, ...otherPanels],
  };
}

export function formatDesignHoleLabel(hole: DesignDrillHole): string {
  return `${hole.holeTypeId} @ (${hole.xMm.toFixed(0)}, ${hole.yMm.toFixed(0)}) mm`;
}

export function listDesignHoles(
  designBox: IndustrialDesignBox,
): Array<{ panelId: string; hole: DesignDrillHole }> {
  const rows: Array<{ panelId: string; hole: DesignDrillHole }> = [];
  for (const panel of designBox.panels) {
    for (const hole of panel.drillHoles) {
      rows.push({ panelId: panel.id, hole });
    }
  }
  return rows;
}
