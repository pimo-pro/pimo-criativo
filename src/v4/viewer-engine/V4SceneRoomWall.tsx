import { DoubleSide } from "three";
import type { Vector3Tuple } from "three";

interface V4SceneRoomWallProps {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  width: number;   // meters
  height: number;  // meters
  color: string;
  opacity: number; // 0 = invisível, 1 = sólida
}

export function V4SceneRoomWall({ position, rotation, width, height, color, opacity }: V4SceneRoomWallProps) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0}
        side={DoubleSide}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
