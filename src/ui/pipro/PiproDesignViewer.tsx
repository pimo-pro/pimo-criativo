/**
 * Viewer 3D leve pipro — sem sala / sem projeto.
 * Malhas esquemáticas + marcadores de furos DRILL.
 */

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PiproDimensionsMm, PiproPieceSnapshot } from "../../core/pipro/piproDesignTypes";

export type PiproDesignViewerProps = {
  dimensions: PiproDimensionsMm;
  pieces: PiproPieceSnapshot[];
  showDrill?: boolean;
  showOrla?: boolean;
  showCnc?: boolean;
  /** Snapshot compacto (cartões `/moveis`). */
  compact?: boolean;
};

function colorForPiece(p: PiproPieceSnapshot, showCnc: boolean): string {
  if (showCnc && p.machineTarget === "cnc") return "#60a5fa";
  if (p.machineTarget === "drill") return "#34d399";
  if ((p.orlaSides?.length ?? 0) > 0) return "#fbbf24";
  return "#94a3b8";
}

function BoxShell({ dimensions }: { dimensions: PiproDimensionsMm }) {
  const W = dimensions.largura / 1000;
  const H = dimensions.altura / 1000;
  const D = dimensions.profundidade / 1000;
  return (
    <mesh position={[0, H / 2, 0]}>
      <boxGeometry args={[W, H, D]} />
      <meshStandardMaterial color="#1e293b" transparent opacity={0.25} wireframe={false} />
    </mesh>
  );
}

function PieceMarkers({
  pieces,
  dimensions,
  showDrill,
  showCnc,
}: {
  pieces: PiproPieceSnapshot[];
  dimensions: PiproDimensionsMm;
  showDrill: boolean;
  showCnc: boolean;
}) {
  const H = dimensions.altura / 1000;
  return (
    <group>
      {pieces.slice(0, 40).map((p, idx) => {
        const y = 0.05 + (idx % 12) * 0.04;
        const x = ((idx % 5) - 2) * 0.08;
        const z = (Math.floor(idx / 5) % 4) * 0.06 - 0.09;
        return (
          <group key={p.id} position={[x, Math.min(y, H - 0.05), z]}>
            <mesh>
              <boxGeometry args={[0.06, 0.02, 0.04]} />
              <meshStandardMaterial color={colorForPiece(p, showCnc)} />
            </mesh>
            {showDrill &&
              (p.drillHoles ?? []).slice(0, 8).map((h, hi) => (
                <mesh
                  key={`${p.id}-h-${hi}`}
                  position={[((h.x ?? 0) % 50) / 1000 - 0.02, 0.02, ((h.y ?? 0) % 50) / 1000 - 0.02]}
                >
                  <sphereGeometry args={[0.006, 8, 8]} />
                  <meshStandardMaterial color="#ef4444" />
                </mesh>
              ))}
          </group>
        );
      })}
    </group>
  );
}

export function PiproDesignViewer({
  dimensions,
  pieces,
  showDrill = true,
  showOrla: _showOrla = true,
  showCnc = true,
  compact = false,
}: PiproDesignViewerProps) {
  void _showOrla;
  return (
    <div
      data-testid="pipro-design-viewer"
      style={{
        width: "100%",
        height: "100%",
        minHeight: compact ? 160 : 360,
        background: "#0f172a",
        borderRadius: 8,
      }}
    >
      <Canvas camera={{ position: [1.2, 1.0, 1.4], fov: 45 }} frameloop={compact ? "demand" : "always"}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} />
        <BoxShell dimensions={dimensions} />
        <PieceMarkers
          pieces={pieces}
          dimensions={dimensions}
          showDrill={showDrill}
          showCnc={showCnc}
        />
        {!compact && <OrbitControls makeDefault />}
        <gridHelper args={[2, 20, "#334155", "#1e293b"]} />
      </Canvas>
    </div>
  );
}

export default PiproDesignViewer;
