import { useEffect, useMemo, useRef } from "react";
import { usePimoViewer } from "../hooks/usePimoViewer";
import AcoesMultiBox from "../components/AcoesMultiBox";
import {
  DEFAULT_VIEWER_OPTIONS,
  VIEWER_BACKGROUND,
} from "../constants/viewerOptions";

export default function DevActionsTest() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerOptions = useMemo(
    () => ({
      ...DEFAULT_VIEWER_OPTIONS,
      background: VIEWER_BACKGROUND,
      skipInitialBox: true as const,
    }),
    []
  );
  const {
    viewerRef,
    selectedBoxId,
    addBox,
    removeBox,
    updateBox,
    setBoxIndex,
    setBoxGap,
    addModelToBox,
    removeModelFromBox,
    clearModelsFromBox,
    listModels,
  } = usePimoViewer(containerRef as React.RefObject<HTMLDivElement>, viewerOptions);

  useEffect(() => {
    addBox("modulo-1", { width: 60, height: 80, depth: 50 });
  }, [addBox]);

  return (
    <div className="app-root">
      <div className="app-main">
        <div className="app-panels">
          <div className="panel panel-shell panel-shell--side left-panel panel-shell-left">
            <div className="panel-content panel-content--side">
              <AcoesMultiBox
                selectedBoxId={selectedBoxId}
                addBox={addBox}
                removeBox={removeBox}
                updateBox={updateBox}
                setBoxIndex={setBoxIndex}
                setBoxGap={setBoxGap}
                addModelToBox={addModelToBox}
                removeModelFromBox={removeModelFromBox}
                listModels={listModels}
              />
            </div>
          </div>

          <div className="workspace-root">
            <div className="workspace-canvas">
              <div ref={containerRef} className="workspace-viewer" />
            </div>
          </div>

          <div className="panel panel-shell panel-shell--side right-panel panel-shell-right">
            <div className="right-panel-stack">
              <div className="panel-content panel-content--side">
                <div className="stack">
                  <div className="card">
                    <div className="card-title">Ações rápidas</div>
                    <div className="list-vertical">
                      <button
                        type="button"
                        className="panel-button"
                        onClick={() => {
                          if (viewerRef.current) {
                            viewerRef.current.setCameraFrontView();
                          }
                        }}
                        title="Vista Frontal"
                      >
                        <span className="icon-button">👁️</span> Vista Frontal
                      </button>
                      <button
                        type="button"
                        className="panel-button"
                        onClick={() => {
                          clearModelsFromBox("modulo-1");
                        }}
                        title="Limpar Modelos"
                      >
                        <span className="icon-button">🗑️</span> Limpar Modelos
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
