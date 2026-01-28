import { useEffect, useRef } from "react";
import { usePimoViewer } from "../hooks/usePimoViewer";
import AcoesMultiBox from "./AcoesMultiBox";

export default function DevActionsTest() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    viewerRef,
    selectedBoxId,
    addBox,
    removeBox,
    updateBox,
    setBoxIndex,
    setBoxPosition,
    setBoxGap,
    addModelToBox,
    removeModelFromBox,
    clearModelsFromBox,
    listModels,
  } = usePimoViewer(containerRef);

  useEffect(() => {
    addBox("modulo-1", { width: 60, height: 80, depth: 50 });
  }, [addBox]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
      <div
        style={{
          width: 240,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(15, 23, 42, 0.85)",
        }}
      >
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
        <button
          type="button"
          onClick={() => {
            if (viewerRef.current) {
              viewerRef.current.setCameraFrontView();
            }
          }}
        >
          Vista Frontal
        </button>
        <button
          type="button"
          onClick={() => {
            clearModelsFromBox("modulo-1");
          }}
        >
          Limpar Modelos
        </button>
        <button
          type="button"
          onClick={() => {
            setBoxPosition("modulo-1", { x: 0, y: 40, z: 0 });
          }}
        >
          Reposicionar Box
        </button>
      </div>
    </div>
  );
}
