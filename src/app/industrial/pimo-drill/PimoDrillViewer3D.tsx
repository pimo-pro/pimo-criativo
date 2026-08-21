import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three';

import { pieceSizeM } from './geometry/pieceGeometry';
import { viewerShellStyle } from './pimoDrillStyles';
import type { DrillHoleViewModel, PieceModel, PimoDrillToolId } from './pimoDrillTypes';
import PieceMesh3D from './scene/PieceMesh3D';

type Props = {
  piece: PieceModel;
  holes: DrillHoleViewModel[];
  activeTool: PimoDrillToolId;
  selectedHoleId: string | null;
  onSelectHole: (id: string | null) => void;
  onPlaceHole: (xMm: number, yMm: number) => void;
};

/** Posição inicial fixa — NÃO depende de L/W/T (evita salto da câmara). */
const CAMERA_POSITION: [number, number, number] = [1.4, 1.05, 1.4];

/** Pivot estável do orbit — mesma referência em todos os renders. */
const ORBIT_TARGET: [number, number, number] = [0, 0, 0];

function Scene({ piece, holes, activeTool, selectedHoleId, onSelectHole, onPlaceHole }: Props) {
  const size = pieceSizeM(piece);
  const span = Math.max(size.x, size.y, size.z, 0.2);
  // Câmara ligada ao OrbitControls por referência explícita (state, não ref
  // "morta") — evita o OrbitControls ligar-se momentaneamente ao defaultCamera
  // implícito do R3F (via useThree) antes do efeito makeDefault da
  // PerspectiveCamera correr, o que causava órbita à volta de câmara errada.
  const [camera, setCamera] = useState<PerspectiveCameraImpl | null>(null);

  return (
    <>
      <PerspectiveCamera
        ref={setCamera}
        makeDefault
        position={CAMERA_POSITION}
        fov={42}
        near={0.01}
        far={200}
      />
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} />
      <PieceMesh3D
        piece={piece}
        holes={holes}
        activeTool={activeTool}
        selectedHoleId={selectedHoleId}
        onSelectHole={onSelectHole}
        onPlaceHole={onPlaceHole}
      />
      {camera ? (
        <OrbitControls
          makeDefault
          camera={camera}
          autoRotate={false}
          enableDamping={false}
          rotateSpeed={0.5}
          minDistance={Math.max(span * 0.35, 0.15)}
          maxDistance={Math.max(span * 14, 8)}
          target={ORBIT_TARGET}
        />
      ) : null}
    </>
  );
}

export default function PimoDrillViewer3D({
  piece,
  holes,
  activeTool,
  selectedHoleId,
  onSelectHole,
  onPlaceHole,
}: Props) {
  return (
    <div aria-label="Viewer 3D" style={viewerShellStyle}>
      <Suspense
        fallback={
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: '#64748b',
              fontSize: 12,
            }}
          >
            A carregar 3D…
          </div>
        }
      >
        {/* Sem key dinâmica — Canvas não remonta ao mudar L/W/T */}
        <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }}>
          <Scene
            piece={piece}
            holes={holes}
            activeTool={activeTool}
            selectedHoleId={selectedHoleId}
            onSelectHole={onSelectHole}
            onPlaceHole={onPlaceHole}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
