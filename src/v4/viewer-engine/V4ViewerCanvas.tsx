import { useRef, useEffect, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";

import { V4Lights } from "./V4Lights";
import { V4_BG_COLOR } from "./V4Ground";
import { V4BoxObject } from "./V4BoxObject";
import { V4DimensionLabel } from "./V4DimensionLabel";
import { V4ViewerToolbar } from "./V4ViewerToolbar";
import { useV4ViewerState } from "./useV4ViewerState";
import { V4SceneRoom } from "./V4SceneRoom";
import V4RoomCamera from "../camera/V4RoomCamera";
import type { V4RoomConfig } from "../state/V4RoomConfig";
import type { SceneItem } from "../../components/v4/V4Viewer";

interface V4ViewerCanvasProps {
  style?: CSSProperties;
  sceneItems: SceneItem[];
  selectedId: string | null;
  onSelectId?: (id: string | null) => void;
  roomConfig: V4RoomConfig;
}

/**
 * V4 Viewer — complete 3D viewer with toolbar, tools, and dimension labels.
 *
 * Performance targets (cross-browser):
 * - DPR capped at 1.5
 * - Shadow map 1024 (balanced quality/perf)
 * - PCFSoft shadows
 * - ACESFilmic tone mapping
 *
 * Rule R-02: reads from src/3d/ and src/components/v4/ — does NOT modify them.
 */
export function V4ViewerCanvas({
  style,
  sceneItems,
  selectedId: externalSelectedId,
  onSelectId,
  roomConfig,
}: V4ViewerCanvasProps) {
  const { state, actions } = useV4ViewerState(externalSelectedId);

  const selectedItem = sceneItems.find((i) => i.id === state.selectedId) ?? null;

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "s" || e.key === "S") actions.setTool("select");
      if (e.key === "m" || e.key === "M") actions.setTool("translate");
      if (e.key === "r" || e.key === "R") actions.setTool("rotate");
      if (e.key === "d" || e.key === "D") { actions.setTool("ruler"); actions.toggleDimensions(); }
      if (e.key === "g" || e.key === "G") actions.toggleGrid();
      if (e.key === "Escape")             { actions.setTool("select"); actions.setSelectedId(null); onSelectId?.(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, onSelectId]);

  return (
    <div className="v4-viewer-wrap" style={style}>

      {/* ── Toolbar ABOVE the canvas ── */}
      <V4ViewerToolbar
        activeTool={state.activeTool}
        showGrid={state.showGrid}
        showDimensions={state.showDimensions}
        hasSelection={!!state.selectedId}
        onTool={actions.setTool}
        onToggleGrid={actions.toggleGrid}
        onToggleDimensions={actions.toggleDimensions}
        onResetCamera={() => {}}
      />

      {/* ── 3D Canvas ── */}
      <div className="v4-canvas-fill">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace    = THREE.SRGBColorSpace;
            gl.toneMapping         = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
            gl.shadowMap.enabled   = true;
            gl.shadowMap.type      = THREE.PCFSoftShadowMap;
          }}
          style={{ background: V4_BG_COLOR }}
        >
          <color attach="background" args={[V4_BG_COLOR]} />

          <V4RoomCamera config={roomConfig} />

          {/* Lighting */}
          <V4Lights />

          {/* Sala (paredes + chão) */}
          <V4SceneRoom config={roomConfig} />

          {/* Scene boxes */}
          {sceneItems.map((item) => (
            <SelectableBox
              key={item.id}
              item={item}
              selected={item.id === state.selectedId}
              activeTool={state.activeTool}
              onSelect={(id) => {
                actions.setSelectedId(id);
                onSelectId?.(id);
              }}
            />
          ))}

          {/* Dimension labels */}
          {state.showDimensions && selectedItem && (
            <V4DimensionLabel item={selectedItem} />
          )}

          {/* Empty hint */}
          {sceneItems.length === 0 && <EmptyHint />}
        </Canvas>
      </div>
    </div>
  );
}

// ── Selectable box with optional TransformControls ─────────────

interface SelectableBoxProps {
  item: SceneItem;
  selected: boolean;
  activeTool: string;
  onSelect: (id: string | null) => void;
}

function SelectableBox({ item, selected, activeTool, onSelect }: SelectableBoxProps) {
  const groupRef = useRef<THREE.Group>(null);

  const isTransforming = selected && (activeTool === "translate" || activeTool === "rotate");

  return (
    <>
      <group
        ref={groupRef}
        onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      >
        <V4BoxObject item={item} selected={selected} />
      </group>

      {/* TransformControls — only visible when active tool is move/rotate AND box is selected */}
      {isTransforming && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={activeTool === "translate" ? "translate" : "rotate"}
          size={0.7}
          showX
          showY={activeTool === "translate"}
          showZ
        />
      )}
    </>
  );
}

// ── Empty scene placeholder ─────────────────────────────────────

function EmptyHint() {
  return (
    <group>
      {/* Soft pulsing cross at origin */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.2, 48]} />
        <meshBasicMaterial color="#3b82f6" opacity={0.25} transparent />
      </mesh>
    </group>
  );
}
