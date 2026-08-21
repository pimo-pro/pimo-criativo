import { useCallback, useEffect, useMemo, useState } from 'react';

import type { HoleType, HoleTypeId } from '@/core/drill/holeCatalog';
import {
  addDesignDrillHole,
  findDesignPanel,
  getHoleTypeById,
  nextDesignId,
  removeDesignDrillHole,
  validateIndustrialDesignBox,
  type DesignValidationIssue,
  type IndustrialDesignBox,
} from '@/core/industrialDesigner';

import { sanitizePiece } from '../../geometry/pieceGeometry';
import { parseKdtXml } from '../../import/kdtXmlParser';
import { matchHoleToCatalog } from '../../import/matchHoleToCatalog';
import { readDrillState, writeDrillState } from '../../localDrillStorage';
import type {
  DrillHoleViewModel,
  ImportSummary,
  LocalHoleType,
  PieceModel,
  PimoDrillCustomHole,
} from '../../pimoDrillTypes';
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
  /** Ø/profundidade/face do tipo de furo seleccionado — vem sempre do catálogo (SSOT). */
  selectedHoleType: HoleType | null;
  validationIssues: DesignValidationIssue[];
  holes: Array<{ panelId: string; hole: import('@/core/industrialDesigner').DesignDrillHole }>;
  removeHole: (panelId: string, holeId: string) => void;
  /** Coloca furo em X/Y escolhidos pelo utilizador no painel principal (sem clique 3D — fase futura). */
  addHoleAt: (xMm: number, yMm: number) => void;
  formatHoleLabel: typeof formatDesignHoleLabel;
  /** Furos importados sem correspondência no catálogo oficial (ver pimoDrillTypes.LocalHoleType). */
  customHoles: PimoDrillCustomHole[];
  localCatalog: LocalHoleType[];
  removeCustomHole: (id: string) => void;
  /** Vista normalizada (catálogo + local) para os viewers 2D/3D. */
  holesView: DrillHoleViewModel[];
  /** Importa um XML DRILL/KDT — substitui peça e furos actuais. Leitura única, sem escrever no pipeline real. */
  importFromKdtXml: (xmlText: string) => ImportSummary;
  /** Guarda o estado actual (peça + furos) isolado em localStorage, chave própria do pimo-drill. */
  saveState: () => void;
  /** Carrega o último estado guardado. Devolve false se não houver nada guardado. */
  loadState: () => boolean;
};

/**
 * Sessão Design Industrial no DRILL — sem ViewerCore / PimoViewerApi.
 * Domínio SSOT: core/industrialDesigner. Import/guardar são isolados ao pimo-drill
 * (leitura única do XML na importação; nunca escreve de volta no pipeline real).
 */
export function useDrillDesignWorkspace(
  piece: PieceModel,
  onChangePiece: (next: PieceModel) => void,
): UseDrillDesignWorkspaceResult {
  const [designBox, setDesignBox] = useState<IndustrialDesignBox>(() =>
    pieceModelToDesignBox(piece),
  );
  const [selectedHoleTypeId, setSelectedHoleTypeId] = useState<HoleTypeId | null>(
    'parafuso_4x19',
  );
  const [customHoles, setCustomHoles] = useState<PimoDrillCustomHole[]>([]);
  const [localCatalog, setLocalCatalog] = useState<LocalHoleType[]>([]);

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

  const selectedHoleType = useMemo(
    () => (selectedHoleTypeId ? getHoleTypeById(selectedHoleTypeId) : null),
    [selectedHoleTypeId],
  );

  const removeHole = useCallback((panelId: string, holeId: string) => {
    setDesignBox((prev) => removeDesignDrillHole(prev, panelId, holeId));
  }, []);

  const addHoleAt = useCallback(
    (xMm: number, yMm: number) => {
      if (!selectedHoleTypeId) return;
      setDesignBox((prev) => {
        const panel = findDesignPanel(prev, primaryPanelId) ?? prev.panels[0];
        if (!panel) return prev;
        const catalog = getHoleTypeById(selectedHoleTypeId);
        const { box } = addDesignDrillHole(prev, panel.id, {
          holeTypeId: selectedHoleTypeId,
          xMm,
          yMm,
          face: catalog.face,
        });
        return box;
      });
    },
    [primaryPanelId, selectedHoleTypeId],
  );

  const removeCustomHole = useCallback((id: string) => {
    setCustomHoles((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const holesView = useMemo<DrillHoleViewModel[]>(() => {
    const fromCatalog = designBox.panels
      .filter((p) => p.id === primaryPanelId)
      .flatMap((p) => p.drillHoles)
      .map((h) => {
        const catalog = getHoleTypeById(h.holeTypeId);
        return {
          id: h.id,
          xMm: h.xMm,
          yMm: h.yMm,
          diameterMm: catalog.diametroMm,
          depthMm: catalog.profundidadeMm,
        };
      });
    const fromCustom = customHoles.map((h) => {
      const local = localCatalog.find((l) => l.id === h.localHoleTypeId);
      return {
        id: h.id,
        xMm: h.xMm,
        yMm: h.yMm,
        diameterMm: local?.diametroMm ?? 0,
        depthMm: local?.profundidadeMm ?? 0,
      };
    });
    return [...fromCatalog, ...fromCustom];
  }, [designBox, primaryPanelId, customHoles, localCatalog]);

  const importFromKdtXml = useCallback(
    (xmlText: string): ImportSummary => {
      const parsed = parseKdtXml(xmlText);
      const newPiece = sanitizePiece({
        id: piece.id,
        lengthMm: parsed.pieceDims.lengthMm,
        widthMm: parsed.pieceDims.widthMm,
        thicknessMm: parsed.pieceDims.thicknessMm,
      });
      const panelId = getDrillPrimaryPanelId(newPiece.id);

      let freshBox = pieceModelToDesignBox(newPiece);
      let matched = 0;
      const nextLocalCatalog: LocalHoleType[] = [];
      const nextCustomHoles: PimoDrillCustomHole[] = [];
      const localTypeByKey = new Map<string, LocalHoleType>();

      for (const rawHole of parsed.holes) {
        const holeTypeId = matchHoleToCatalog(rawHole);
        if (holeTypeId) {
          const catalog = getHoleTypeById(holeTypeId);
          const { box } = addDesignDrillHole(freshBox, panelId, {
            holeTypeId,
            xMm: rawHole.xMm,
            yMm: rawHole.yMm,
            face: catalog.face,
          });
          freshBox = box;
          matched += 1;
          continue;
        }

        const key = `${rawHole.diameterMm.toFixed(2)}|${rawHole.depthMm.toFixed(2)}|${rawHole.face}`;
        let localType = localTypeByKey.get(key);
        if (!localType) {
          localType = {
            id: nextDesignId('local-hole-type'),
            nome: `Importado Ø${rawHole.diameterMm}×${rawHole.depthMm}mm`,
            diametroMm: rawHole.diameterMm,
            profundidadeMm: rawHole.depthMm,
            face: rawHole.face,
          };
          localTypeByKey.set(key, localType);
          nextLocalCatalog.push(localType);
        }
        nextCustomHoles.push({
          id: nextDesignId('custom-hole'),
          localHoleTypeId: localType.id,
          xMm: rawHole.xMm,
          yMm: rawHole.yMm,
          face: rawHole.face,
        });
      }

      onChangePiece(newPiece);
      setDesignBox(freshBox);
      setCustomHoles(nextCustomHoles);
      setLocalCatalog(nextLocalCatalog);

      return {
        imported: matched + nextCustomHoles.length,
        matched,
        customCreated: nextCustomHoles.length,
        groovesSkipped: parsed.groovesSkipped,
      };
    },
    [piece.id, onChangePiece],
  );

  const saveState = useCallback(() => {
    writeDrillState({ piece, designBox, customHoles, localCatalog });
  }, [piece, designBox, customHoles, localCatalog]);

  const loadState = useCallback((): boolean => {
    const saved = readDrillState();
    if (!saved) return false;
    onChangePiece(saved.piece);
    setDesignBox(saved.designBox);
    setCustomHoles(saved.customHoles);
    setLocalCatalog(saved.localCatalog);
    return true;
  }, [onChangePiece]);

  return {
    designBox,
    primaryPanelId,
    selectedHoleTypeId,
    setSelectedHoleTypeId,
    selectedHoleType,
    validationIssues,
    holes,
    removeHole,
    addHoleAt,
    formatHoleLabel: formatDesignHoleLabel,
    customHoles,
    localCatalog,
    removeCustomHole,
    holesView,
    importFromKdtXml,
    saveState,
    loadState,
  };
}
