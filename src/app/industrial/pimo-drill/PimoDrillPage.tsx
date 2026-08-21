import { useState } from 'react';

import { useDrillDesignWorkspace } from './design-industrial/hooks/useDrillDesignWorkspace';
import PimoDrillLayout from './PimoDrillLayout';
import PimoDrillLeftPanel from './PimoDrillLeftPanel';
import PimoDrillToolbar from './PimoDrillToolbar';
import PimoDrillViewer2D from './PimoDrillViewer2D';
import PimoDrillViewer3D from './PimoDrillViewer3D';
import {
  bodyGridStyle,
  eyebrowStyle,
  pageMainStyle,
  panelStyle,
  titleStyle,
} from './pimoDrillStyles';
import {
  DEFAULT_PIECE,
  DEFAULT_VIEW_MODE,
  type PieceModel,
  type PimoDrillFeatureToolId,
  type PimoDrillToolId,
  type PimoDrillViewMode,
} from './pimoDrillTypes';

/**
 * PIMO DRILL — estado actual.
 *
 * TODO / NOTA TÉCNICA INTERNA:
 * Simulador DRILL — incompleto, requer desenvolvimento futuro.
 * Ainda não é funcional: não é possível inserir furos de forma operativa,
 * nem validar, nem operar o fluxo completo. Não avançar fases até nova ordem.
 *
 * Shell M0–M1 parcial apenas (UI, peça 2D/3D, bridge Design Industrial mínimo).
 * Workspace principal / Design Industrial global: não desligados nesta etapa.
 */
export default function PimoDrillPage() {
  const [viewMode, setViewMode] = useState<PimoDrillViewMode>(DEFAULT_VIEW_MODE);
  const [activeTool, setActiveTool] = useState<PimoDrillToolId>('hole');
  const [piece, setPiece] = useState<PieceModel>(DEFAULT_PIECE);
  const design = useDrillDesignWorkspace(piece, setPiece);

  const handleSelectView = (mode: PimoDrillViewMode) => {
    setViewMode(mode);
    setActiveTool(mode);
  };

  const handleSelectFeature = (tool: PimoDrillFeatureToolId) => {
    setActiveTool(tool);
  };

  return (
    <PimoDrillLayout>
      <main style={pageMainStyle}>
        <header>
          <p style={eyebrowStyle}>PIMO-TRAK Industrial</p>
          <h1 style={titleStyle}>PIMO DRILL</h1>
        </header>

        <PimoDrillToolbar
          viewMode={viewMode}
          activeTool={activeTool}
          onSelectView={handleSelectView}
          onSelectFeature={handleSelectFeature}
        />

        <div style={bodyGridStyle}>
          <PimoDrillLeftPanel
            activeTool={activeTool}
            piece={piece}
            onChangePiece={setPiece}
            design={design}
          />

          <div style={panelStyle}>
            {viewMode === '2d' ? (
              <PimoDrillViewer2D piece={piece} holes={design.holesView} />
            ) : (
              <PimoDrillViewer3D piece={piece} holes={design.holesView} />
            )}
          </div>
        </div>
      </main>
    </PimoDrillLayout>
  );
}
