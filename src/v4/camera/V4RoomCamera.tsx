import { useRef } from "react";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { V4RoomConfig } from "../state/V4RoomConfig";

interface V4RoomCameraProps {
  config: V4RoomConfig;
}

/**
 * Câmera inicial dentro da sala, olhando para a parede traseira.
 * OrbitControls livres (360°) — as paredes ocultam-se dinamicamente
 * via useFrame em V4Room conforme a câmera se move.
 */
export default function V4RoomCamera({ config }: V4RoomCameraProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);

  const w = config.width  / 1000;
  const d = config.depth  / 1000;
  const h = config.height / 1000;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, h * 0.5, d * 0.3]}
        fov={50}
        near={0.05}
        far={Math.max(w, d, h) * 10}
      />
      <OrbitControls
        ref={orbitRef}
        target={[0, h * 0.3, -d * 0.3]}
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={Math.max(w, d, h) * 4}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minPolarAngle={0}
      />
    </>
  );
}
