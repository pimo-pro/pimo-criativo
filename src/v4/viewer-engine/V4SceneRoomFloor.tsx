import type { V4RoomConfig } from "../state/V4RoomConfig";

interface V4SceneRoomFloorProps {
  config: V4RoomConfig;
}

export function V4SceneRoomFloor({ config }: V4SceneRoomFloorProps) {
  const w = config.width  / 1000;
  const d = config.depth  / 1000;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial
        color={config.floorColor}
        roughness={0.6}
        metalness={0}
      />
    </mesh>
  );
}
