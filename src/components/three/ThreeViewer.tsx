import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { RGBELoader } from "three-stdlib";
import * as THREE from "three";
import type { MaterialSystemState, ModelPart } from "../../context/materialContext";
import { getPresetById } from "../../core/materials/materialPresets";

type ThreeViewerProps = {
  modelUrl: string;
  height?: number | string;
  backgroundColor?: string;
  showGrid?: boolean;
  showFloor?: boolean;
  colorize?: boolean;
  wireframe?: boolean;
  cameraPreset?: "perspective" | "top" | "front" | "left";
  materialConfig?: MaterialSystemState;
};

let sharedRenderer: THREE.WebGLRenderer | null = null;
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

const getSharedRenderer = () => {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    sharedRenderer.shadowMap.enabled = true;
    sharedRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  return sharedRenderer;
};

const buildPastelColor = (seed: number) => {
  const hue = (seed * 0.61803398875) % 1;
  return new THREE.Color().setHSL(hue, 0.35, 0.55);
};

const disposeScene = (root: THREE.Object3D) => {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    }
  });
};

const HDRI_FILE_URL = "/hdr/studio_neutral.hdr";

const TEXTURE_SETS = {
  wood: {
    map: "/textures/wood/base.svg",
    normalMap: "/textures/wood/normal.svg",
    roughnessMap: "/textures/wood/roughness.svg",
    metalnessMap: "/textures/wood/metalness.svg",
    aoMap: "/textures/wood/ao.svg",
  },
  metal: {
    map: "/textures/metal/base.svg",
    normalMap: "/textures/metal/normal.svg",
    roughnessMap: "/textures/metal/roughness.svg",
    metalnessMap: "/textures/metal/metalness.svg",
    aoMap: "/textures/metal/ao.svg",
  },
  glass: {
    map: "/textures/glass/base.svg",
    normalMap: "/textures/glass/normal.svg",
    roughnessMap: "/textures/glass/roughness.svg",
    metalnessMap: "/textures/glass/metalness.svg",
    aoMap: "/textures/glass/ao.svg",
  },
};

const decodeBase64ToArrayBuffer = (base64: string) => {
  const binary = window.atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const loadTexture = (url: string, colorSpace: THREE.ColorSpace) => {
  if (textureCache.has(url)) {
    return textureCache.get(url) as THREE.Texture;
  }
  const texture = textureLoader.load(url);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache.set(url, texture);
  return texture;
};

const getPbrDefaults = (name: string) => {
  const lowered = name.toLowerCase();
  if (lowered.includes("metal") || lowered.includes("inox") || lowered.includes("steel")) {
    return {
      color: new THREE.Color("#cbd5f5"),
      roughness: 0.25,
      metalness: 0.8,
      transparent: false,
      opacity: 1,
    };
  }
  if (lowered.includes("glass") || lowered.includes("vidro")) {
    return {
      color: new THREE.Color("#e2e8f0"),
      roughness: 0.05,
      metalness: 0.0,
      transparent: true,
      opacity: 0.35,
    };
  }
  if (lowered.includes("wood") || lowered.includes("madeira")) {
    return {
      color: new THREE.Color("#c9a27a"),
      roughness: 0.55,
      metalness: 0.05,
      transparent: false,
      opacity: 1,
    };
  }
  return {
    color: new THREE.Color("#b9c0cc"),
    roughness: 0.5,
    metalness: 0.1,
    transparent: false,
    opacity: 1,
  };
};

const getMeshPart = (name: string): ModelPart => {
  const lowered = name.toLowerCase();
  if (lowered.includes("metal") || lowered.includes("inox") || lowered.includes("steel")) {
    return "metal";
  }
  if (lowered.includes("glass") || lowered.includes("vidro")) {
    return "glass";
  }
  if (lowered.includes("porta") || lowered.includes("door")) {
    return "door";
  }
  if (lowered.includes("gaveta") || lowered.includes("drawer")) {
    return "drawer";
  }
  if (
    lowered.includes("panel") ||
    lowered.includes("painel") ||
    lowered.includes("lateral") ||
    lowered.includes("tampo") ||
    lowered.includes("fundo") ||
    lowered.includes("prateleira")
  ) {
    return "panel";
  }
  if (lowered.includes("wood") || lowered.includes("madeira")) {
    return "wood";
  }
  return "wood";
};

const buildPbrMaterial = (
  source: THREE.Material,
  meshName: string,
  colorOverride?: THREE.Color,
  materialConfig?: MaterialSystemState
): THREE.MeshStandardMaterial => {
  const defaults = getPbrDefaults(meshName);
  const part = getMeshPart(meshName);
  const category = materialConfig?.assignments?.[part] ?? "wood";
  const config = materialConfig?.categories?.[category];
  const preset = config ? getPresetById(config.presetId) : undefined;
  const textureSet = preset?.maps ?? TEXTURE_SETS.wood;
  const standard = new THREE.MeshStandardMaterial({
    roughness: config?.roughness ?? defaults.roughness,
    metalness: config?.metalness ?? defaults.metalness,
    transparent: category === "glass" ? true : defaults.transparent,
    opacity: category === "glass" ? 0.35 : defaults.opacity,
  });

  const typed = source as THREE.MeshStandardMaterial;
  if (typed.color instanceof THREE.Color) {
    standard.color = colorOverride ?? typed.color.clone();
  } else {
    standard.color =
      colorOverride ??
      (config?.color ? new THREE.Color(config.color) : defaults.color);
  }

  if (typed.map instanceof THREE.Texture) {
    standard.map = typed.map;
  } else if (textureSet.map) {
    standard.map = loadTexture(textureSet.map, THREE.SRGBColorSpace);
  }
  if (typed.normalMap instanceof THREE.Texture) {
    standard.normalMap = typed.normalMap;
  } else if (textureSet.normalMap) {
    standard.normalMap = loadTexture(textureSet.normalMap, THREE.NoColorSpace);
  }
  if (typed.roughnessMap instanceof THREE.Texture) {
    standard.roughnessMap = typed.roughnessMap;
  } else if (textureSet.roughnessMap) {
    standard.roughnessMap = loadTexture(textureSet.roughnessMap, THREE.NoColorSpace);
  }
  if (typed.metalnessMap instanceof THREE.Texture) {
    standard.metalnessMap = typed.metalnessMap;
  } else if (textureSet.metalnessMap) {
    standard.metalnessMap = loadTexture(textureSet.metalnessMap, THREE.NoColorSpace);
  }
  if (typed.aoMap instanceof THREE.Texture) {
    standard.aoMap = typed.aoMap;
    standard.aoMapIntensity = 1;
  } else if (textureSet.aoMap) {
    standard.aoMap = loadTexture(textureSet.aoMap, THREE.NoColorSpace);
    standard.aoMapIntensity = 1;
  }

  standard.envMapIntensity = config?.envMapIntensity ?? 0.9;
  return standard;
};

function Model({
  url,
  colorize,
  wireframe,
  onCentered,
  materialConfig,
}: {
  url: string;
  colorize: boolean;
  wireframe: boolean;
  onCentered: (box: THREE.Box3) => void;
  materialConfig?: MaterialSystemState;
}) {
  const { scene } = useGLTF(url);

  const coloredScene = useMemo(() => {
    const cloned = scene.clone(true);
    let index = 0;
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.frustumCulled = true;
        child.castShadow = true;
        child.receiveShadow = true;
        const meshName = child.name || child.material?.name || "pimo_mesh";
        if (colorize) {
          const color = buildPastelColor(index);
          index += 1;
          if (Array.isArray(child.material)) {
            child.material = child.material.map((material) =>
              buildPbrMaterial(material, meshName, color, materialConfig)
            );
          } else {
            child.material = buildPbrMaterial(child.material, meshName, color, materialConfig);
          }
        } else if (Array.isArray(child.material)) {
          child.material = child.material.map((material) =>
            buildPbrMaterial(material, meshName, undefined, materialConfig)
          );
        } else {
          child.material = buildPbrMaterial(child.material, meshName, undefined, materialConfig);
        }
      }
    });
    return cloned;
  }, [scene, colorize, materialConfig]);

  useEffect(() => {
    const initialBox = new THREE.Box3().setFromObject(coloredScene);
    const size = new THREE.Vector3();
    initialBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const targetSize = 2;
    const scale = targetSize / maxDim;
    coloredScene.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(coloredScene);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    coloredScene.position.sub(center);

    const alignedBox = new THREE.Box3().setFromObject(coloredScene);
    const minY = alignedBox.min.y;
    coloredScene.position.y -= minY;

    const finalBox = new THREE.Box3().setFromObject(coloredScene);
    onCentered(finalBox);
  }, [coloredScene, onCentered]);

  useEffect(() => {
    coloredScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => {
            if ("wireframe" in material) {
              material.wireframe = wireframe;
            }
          });
        } else if ("wireframe" in child.material) {
          child.material.wireframe = wireframe;
        }
      }
    });
  }, [coloredScene, wireframe]);

  useEffect(() => {
    return () => {
      disposeScene(coloredScene);
    };
  }, [coloredScene]);

  return <primitive object={coloredScene} />;
}

function HDRIEnvironment() {
  const { scene, gl } = useThree();

  useEffect(() => {
    let active = true;
    let envMap: THREE.Texture | null = null;
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();

    fetch(HDRI_FILE_URL)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!active) return;
        const text = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 64)));
        const trimmed = text.trim();
        const isHdrBinary = trimmed.startsWith("#?RADIANCE");
        const finalBuffer = isHdrBinary
          ? buffer
          : decodeBase64ToArrayBuffer(trimmed || "");
        const loader = new RGBELoader();
        const hdr = loader.parse(finalBuffer) as unknown as THREE.DataTexture;
        envMap = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        scene.environment = envMap;
      })
      .catch(() => {
        if (active) {
          scene.environment = null;
        }
      });

    return () => {
      active = false;
      if (envMap) {
        envMap.dispose();
      }
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

function SoftGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const material = gridRef.current.material as THREE.Material | THREE.Material[];
    if (Array.isArray(material)) {
      material.forEach((item) => {
        item.transparent = true;
        item.opacity = 0.08;
      });
    } else {
      material.transparent = true;
      material.opacity = 0.08;
    }
  }, []);

  return (
    <gridHelper
      ref={gridRef}
      args={[20, 40, "rgba(148,163,184,0.25)", "rgba(148,163,184,0.1)"]}
      position={[0, -0.01, 0]}
    />
  );
}

function ViewerScene({
  modelUrl,
  resetToken,
  showGrid,
  showFloor,
  colorize,
  wireframe,
  cameraPreset,
  backgroundColor,
  materialConfig,
  controlsRef,
  cameraRef,
  rendererRef,
}: {
  modelUrl: string;
  resetToken: number;
  showGrid: boolean;
  showFloor: boolean;
  colorize: boolean;
  wireframe: boolean;
  cameraPreset: "perspective" | "top" | "front" | "left";
  backgroundColor: string;
  materialConfig?: MaterialSystemState;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
}) {
  const { camera, gl, scene, size } = useThree();
  const rafRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const internalRendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
    rendererRef.current = gl as THREE.WebGLRenderer;
    internalRendererRef.current = gl as THREE.WebGLRenderer;
    sceneRef.current = scene;
    camera.position.set(2, 2, 2);
    camera.lookAt(0, 0, 0);
    const controls = controlsRef.current as unknown as {
      target?: THREE.Vector3;
      update?: () => void;
    } | null;
    if (controls?.target) {
      controls.target.set(0, 0, 0);
      controls.update?.();
    }
  }, [camera, gl, scene, resetToken, controlsRef, cameraRef, rendererRef]);

  useEffect(() => {
    const renderer = internalRendererRef.current;
    if (!renderer) return;
    if ("outputColorSpace" in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }, []);

  useEffect(() => {
    const currentScene = sceneRef.current;
    if (!currentScene) return;
    currentScene.background = new THREE.Color(backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);

  useEffect(() => {
    const tick = () => {
      const controls = controlsRef.current as unknown as { update?: () => void } | null;
      controls?.update?.();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [controlsRef]);

  const applyPreset = useCallback(
    (preset: "perspective" | "top" | "front" | "left") => {
      if (preset === "top") {
        camera.position.set(0, 5, 0);
      } else if (preset === "front") {
        camera.position.set(0, 1.5, 4);
      } else if (preset === "left") {
        camera.position.set(-4, 1.5, 0);
      } else {
        camera.position.set(2, 2, 2);
      }
      camera.lookAt(0, 0, 0);
      const controls = controlsRef.current as unknown as {
        target?: THREE.Vector3;
        update?: () => void;
      } | null;
      if (controls?.target) {
        controls.target.set(0, 0, 0);
        controls.update?.();
      }
    },
    [camera, controlsRef]
  );

  useEffect(() => {
    applyPreset(cameraPreset);
  }, [cameraPreset, applyPreset]);

  return (
    <>
      <HDRIEnvironment />
      <hemisphereLight intensity={0.6} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 6, 4]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-radius={6}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      {showGrid && <SoftGrid />}
      {showFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial
            color="#0f172a"
            roughness={0.9}
            metalness={0.02}
            envMapIntensity={0.35}
          />
        </mesh>
      )}
      {modelUrl ? (
        <Suspense fallback={null}>
          <Model
            url={modelUrl}
            colorize={colorize}
            wireframe={wireframe}
            materialConfig={materialConfig}
            onCentered={(box) => {
              const size = new THREE.Vector3();
              const center = new THREE.Vector3();
              box.getSize(size);
              box.getCenter(center);
              const maxDim = Math.max(size.x, size.y, size.z, 1);
              const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
              const distance =
                maxDim / (2 * Math.tan((fov * Math.PI) / 360)) + maxDim * 0.6;
              const targetY = Math.max(0, maxDim * 0.25);
              camera.position.set(distance, distance * 0.6, distance);
              camera.lookAt(0, targetY, 0);
              const controls = controlsRef.current as unknown as {
                target?: THREE.Vector3;
                update?: () => void;
              } | null;
              if (controls?.target) {
                controls.target.set(0, targetY, 0);
                controls.update?.();
              }
            }}
          />
        </Suspense>
      ) : null}
      <OrbitControls
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        minDistance={0.5}
        maxDistance={50}
        panSpeed={0.6}
        autoRotate={false}
      />
    </>
  );
}

export default function ThreeViewer({
  modelUrl,
  height = 300,
  backgroundColor = "#1e293b",
  showGrid = true,
  showFloor = true,
  colorize = true,
  wireframe = false,
  cameraPreset = "perspective",
  materialConfig,
}: ThreeViewerProps) {
  const [resetToken, setResetToken] = useState(0);
  const [wireframeMode, setWireframeMode] = useState(wireframe);
  const [activePreset, setActivePreset] = useState(cameraPreset);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    setWireframeMode(wireframe);
  }, [wireframe]);

  useEffect(() => {
    setActivePreset(cameraPreset);
  }, [cameraPreset]);

  const handleSnapshot = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const url = renderer.domElement.toDataURL("image/png");
    const win = window.open();
    if (win) {
      win.document.write(`<img src="${url}" style="max-width:100%"/>`);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        background: backgroundColor,
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      <Canvas shadows camera={{ position: [2, 2, 2], fov: 45 }} gl={getSharedRenderer()}>
        <ViewerScene
          modelUrl={modelUrl}
          resetToken={resetToken}
          showGrid={showGrid}
          showFloor={showFloor}
          colorize={colorize}
          wireframe={wireframeMode}
          cameraPreset={activePreset}
          backgroundColor={backgroundColor}
          materialConfig={materialConfig}
          controlsRef={controlsRef}
          cameraRef={cameraRef}
          rendererRef={rendererRef}
        />
      </Canvas>
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          display: "flex",
          gap: 6,
          background: "rgba(0,0,0,0.25)",
          padding: "6px 8px",
          borderRadius: 6,
        }}
      >
        <button
          onClick={() => setWireframeMode((prev) => !prev)}
          style={{
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--text-main)",
            padding: "4px 6px",
            fontSize: 11,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Wireframe
        </button>
        <button
          onClick={handleSnapshot}
          style={{
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--text-main)",
            padding: "4px 6px",
            fontSize: 11,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          📸 Snapshot
        </button>
        {(
          [
            { label: "Top", value: "top" },
            { label: "Front", value: "front" },
            { label: "Left", value: "left" },
            { label: "Persp", value: "perspective" },
          ] as { label: string; value: "top" | "front" | "left" | "perspective" }[]
        ).map((item) => (
          <button
            key={item.value}
            onClick={() => setActivePreset(item.value)}
            style={{
              background: "rgba(15,23,42,0.7)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--text-main)",
              padding: "4px 6px",
              fontSize: 11,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => setResetToken((prev) => prev + 1)}
          style={{
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--text-main)",
            padding: "4px 6px",
            fontSize: 11,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Reset Camera
        </button>
      </div>
    </div>
  );
}
