import { Edges } from '@react-three/drei';

import { pieceSizeM } from '../geometry/pieceGeometry';
import type { DrillHoleViewModel, PieceModel } from '../pimoDrillTypes';

type Props = {
  piece: PieceModel;
  holes: DrillHoleViewModel[];
};

/** Peça centrada em [0,0,0] — L/W/T só alteram o tamanho. */
export default function PieceMesh3D({ piece, holes }: Props) {
  const size = pieceSizeM(piece);

  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshStandardMaterial color="#8b9cb3" roughness={0.65} metalness={0.05} />
        <Edges color="#94a3b8" threshold={15} />
      </mesh>
      {holes.map((hole) => {
        const radiusM = hole.diameterMm / 2 / 1000;
        const heightM = Math.max(0.001, Math.min(hole.depthMm, piece.thicknessMm) / 1000);
        const localX = hole.xMm / 1000 - size.x / 2;
        const localY = hole.yMm / 1000 - size.y / 2;
        return (
          <mesh
            key={hole.id}
            position={[localX, localY, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[radiusM, radiusM, heightM, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}
