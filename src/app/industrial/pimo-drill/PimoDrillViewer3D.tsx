import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

import { pieceSizeM } from './geometry/pieceGeometry';
import { viewerShellStyle } from './pimoDrillStyles';
import type { PieceModel } from './pimoDrillTypes';
import PieceMesh3D from './scene/PieceMesh3D';

type Props = {
  piece: PieceModel;
};

/** Posição inicial fixa — NÃO depende de L/W/T (evita salto da câmara). */
const CAMERA_POSITION: [number, number, number] = [1.4, 1.05, 1.4];

/** Pivot estável do orbit — mesma referência em todos os renders. */
const ORBIT_TARGET: [number, number, number] = [0, 0, 0];

function Scene({ piece }: Props) {
  const size = pieceSizeM(piece);
  const span = Math.max(size.x, size.y, size.z, 0.2);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={CAMERA_POSITION}
        fov={42}
        near={0.01}
        far={200}
      />
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} />
      <PieceMesh3D piece={piece} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={Math.max(span * 0.35, 0.15)}
        maxDistance={Math.max(span * 14, 8)}
        target={ORBIT_TARGET}
      />
    </>
  );
}

export default function PimoDrillViewer3D({ piece }: Props) {
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
          <Scene piece={piece} />
        </Canvas>
      </Suspense>
    </div>
  );
}
