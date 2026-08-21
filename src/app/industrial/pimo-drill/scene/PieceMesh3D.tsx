import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';

import { pieceSizeM } from '../geometry/pieceGeometry';
import type { DrillHoleViewModel, PieceModel, PimoDrillToolId } from '../pimoDrillTypes';

type Props = {
  piece: PieceModel;
  holes: DrillHoleViewModel[];
  activeTool: PimoDrillToolId;
  selectedHoleId: string | null;
  onSelectHole: (id: string | null) => void;
  onPlaceHole: (xMm: number, yMm: number) => void;
};

/**
 * Peça centrada em [0,0,0] — L/W/T só alteram o tamanho. Convenção de eixos
 * alinhada com o viewer 2D / DRILL real: X+ cresce para a esquerda (-x local),
 * Y+ cresce para baixo (-y local).
 */
export default function PieceMesh3D({
  piece,
  holes,
  activeTool,
  selectedHoleId,
  onSelectHole,
  onPlaceHole,
}: Props) {
  const size = pieceSizeM(piece);

  const handlePieceClick = (e: ThreeEvent<MouseEvent>) => {
    if (activeTool !== 'hole') return;
    e.stopPropagation();
    const xMm = (size.x / 2 - e.point.x) * 1000;
    const yMm = (size.y / 2 - e.point.y) * 1000;
    onPlaceHole(xMm, yMm);
  };

  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow receiveShadow onClick={handlePieceClick}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshStandardMaterial color="#8b9cb3" roughness={0.65} metalness={0.05} />
        <Edges color="#94a3b8" threshold={15} />
      </mesh>
      {holes.map((hole) => {
        const radiusM = hole.diameterMm / 2 / 1000;
        const heightM = Math.max(0.001, Math.min(hole.depthMm, piece.thicknessMm) / 1000);
        const localX = size.x / 2 - hole.xMm / 1000;
        const localY = size.y / 2 - hole.yMm / 1000;
        const isSelected = hole.id === selectedHoleId;
        return (
          <mesh
            key={hole.id}
            position={[localX, localY, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelectHole(hole.id);
            }}
          >
            <cylinderGeometry args={[radiusM, radiusM, heightM, 16]} />
            <meshStandardMaterial color={isSelected ? '#22d3ee' : '#0f172a'} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}
