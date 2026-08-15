import { useCallback, useEffect, useMemo, useState } from 'react';

import type { HoleTypeId } from '@/core/drill/holeCatalog';
import {
  addDesignDrillHole,
  findDesignPanel,
  getHoleTypeById,
  removeDesignDrillHole,
  validateIndustrialDesignBox,
  type DesignValidationIssue,
  type IndustrialDesignBox,
} from '@/core/industrialDesigner';

import type { PieceModel } from '../../pimoDrillTypes';
import {
  formatDesignHoleLabel,
  getDrillPrimaryPanelId,
  listDesignHoles,
  pieceModelToDesignBox,
  syncDesignBoxToPiece,
} from '../bridge/pieceToDesignBox';

export type UseDrillDesignWorkspaceResult = {
  designBox: IndustrialDesignBox;
  primaryPanelId: string;
  selectedHoleTypeId: HoleTypeId | null;
  setSelectedHoleTypeId: (id: HoleTypeId | null) => void;
  validationIssues: DesignValidationIssue[];
  holes: Array<{ panelId: string; hole: import('@/core/industrialDesigner').DesignDrillHole }>;
  removeHole: (panelId: string, holeId: string) => void;
  /** Coloca furo no centro do painel (M1 — sem clique 3D). */
  addHoleAtCenter: () => void;
  formatHoleLabel: typeof formatDesignHoleLabel;
};

/**
 * Sessão Design Industrial no DRILL — sem ViewerCore / PimoViewerApi.
 * Domínio SSOT: core/industrialDesigner.
 */
export function useDrillDesignWorkspace(piece: PieceModel): UseDrillDesignWorkspaceResult {
  const [designBox, setDesignBox] = useState<IndustrialDesignBox>(() =>
    pieceModelToDesignBox(piece),
  );
  const [selectedHoleTypeId, setSelectedHoleTypeId] = useState<HoleTypeId | null>(
    'parafuso_4x19',
  );

  useEffect(() => {
    setDesignBox((prev) => syncDesignBoxToPiece(prev, piece));
  }, [piece.id, piece.lengthMm, piece.widthMm, piece.thicknessMm]);

  const primaryPanelId = useMemo(
    () => getDrillPrimaryPanelId(piece.id),
    [piece.id],
  );

  const validationIssues = useMemo(
    () => validateIndustrialDesignBox(designBox),
    [designBox],
  );

  const holes = useMemo(() => listDesignHoles(designBox), [designBox]);

  const removeHole = useCallback((panelId: string, holeId: string) => {
    setDesignBox((prev) => removeDesignDrillHole(prev, panelId, holeId));
  }, []);

  const addHoleAtCenter = useCallback(() => {
    if (!selectedHoleTypeId) return;
    setDesignBox((prev) => {
      const panel = findDesignPanel(prev, primaryPanelId) ?? prev.panels[0];
      if (!panel) return prev;
      const catalog = getHoleTypeById(selectedHoleTypeId);
      const { box } = addDesignDrillHole(prev, panel.id, {
        holeTypeId: selectedHoleTypeId,
        xMm: panel.widthMm / 2,
        yMm: panel.heightMm / 2,
        face: catalog.face,
      });
      return box;
    });
  }, [primaryPanelId, selectedHoleTypeId]);

  return {
    designBox,
    primaryPanelId,
    selectedHoleTypeId,
    setSelectedHoleTypeId,
    validationIssues,
    holes,
    removeHole,
    addHoleAtCenter,
    formatHoleLabel: formatDesignHoleLabel,
  };
}
