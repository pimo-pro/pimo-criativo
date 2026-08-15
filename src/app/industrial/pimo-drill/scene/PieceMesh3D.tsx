import { Edges } from '@react-three/drei';

import { pieceSizeM } from '../geometry/pieceGeometry';
import type { PieceModel } from '../pimoDrillTypes';

type Props = {
  piece: PieceModel;
};

/** Peça centrada em [0,0,0] — L/W/T só alteram o tamanho. */
export default function PieceMesh3D({ piece }: Props) {
  const size = pieceSizeM(piece);

  return (
    <mesh position={[0, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[size.x, size.y, size.z]} />
      <meshStandardMaterial color="#8b9cb3" roughness={0.65} metalness={0.05} />
      <Edges color="#94a3b8" threshold={15} />
    </mesh>
  );
}
