import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { RGBELoader } from "three-stdlib";
import * as THREE from "three";
import type { MaterialSystemState, ModelPart } from "../../context/materialUtils";
import type {
  Viewer2DAngle,
  ViewerApi,
  ViewerRenderOptions,
  ViewerRenderResult,
  ViewerSnapshot,
} from "../../context/projectTypes";
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
  notifyChangeSignal?: unknown;
  registerViewerApi?: (api: ViewerApi | null) => void;
};

let sharedRenderer: THREE.WebGLRenderer | null = null;
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const ORTHO_FRUSTUM = 2.4;
const RENDER_SIZES: Record<ViewerRenderOptions["quality"], { width: number; height: number }> = {
  low: { width: 1280, height: 720 },
  medium: { width: 1600, height: 900 },
  high: { width: 1920, height: 1080 },
};

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

const disposeMaterial = (material: THREE.Material) => {
  const mat = material as THREE.MeshStandardMaterial;
  if (mat.map instanceof THREE.Texture) mat.map.dispose();
  if (mat.normalMap instanceof THREE.Texture) mat.normalMap.dispose();
  if (mat.roughnessMap instanceof THREE.Texture) mat.roughnessMap.dispose();
  if (mat.metalnessMap instanceof THREE.Texture) mat.metalnessMap.dispose();
  if (mat.aoMap instanceof THREE.Texture) mat.aoMap.dispose();
  material.dispose?.();
};

const disposeScene = (root: THREE.Object3D) => {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => disposeMaterial(material));
      } else {
        disposeMaterial(child.material);
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

  const { coloredScene, finalBox } = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.name = "viewer-model";
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
    const initialBox = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    initialBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const targetSize = 2;
    const scale = targetSize / maxDim;
    cloned.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    const centeredPosition = cloned.position.clone().sub(center);
    cloned.position.copy(centeredPosition);

    const alignedBox = new THREE.Box3().setFromObject(cloned);
    const minY = alignedBox.min.y;
    const alignedPosition = cloned.position.clone();
    alignedPosition.y -= minY;
    cloned.position.copy(alignedPosition);

    const finalBox = new THREE.Box3().setFromObject(cloned);
    return { coloredScene: cloned, finalBox };
  }, [scene, colorize, materialConfig]);

  useLayoutEffect(() => {
    onCentered(finalBox);
  }, [finalBox, onCentered]);

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
      name="viewer-grid"
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
  onSceneReady,
  onViewerModeReady,
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
  onSceneReady?: (scene: THREE.Scene) => void;
  onViewerModeReady?: (
    api: { enable2DView: (angle: Viewer2DAngle) => void; disable2DView: () => void } | null
  ) => void;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
}) {
  const { camera, gl, scene, size } = useThree();
  const set = useThree((state) => state.set);
  const rafRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const internalRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const perspectiveRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthographicRef = useRef<THREE.OrthographicCamera | null>(null);
  const is2DRef = useRef(false);

  useEffect(() => {
    cameraRef.current = camera;
    rendererRef.current = gl as THREE.WebGLRenderer;
    internalRendererRef.current = gl as THREE.WebGLRenderer;
    sceneRef.current = scene;
    onSceneReady?.(scene);
    if (camera instanceof THREE.PerspectiveCamera) {
      perspectiveRef.current = camera;
    }
    if (!is2DRef.current) {
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
    }
  }, [camera, gl, scene, resetToken, controlsRef, cameraRef, rendererRef, onSceneReady]);

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
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        const mat = material as THREE.MeshStandardMaterial;
        const maps = [
          mat.map,
          mat.normalMap,
          mat.roughnessMap,
          mat.metalnessMap,
          mat.aoMap,
        ];
        maps.forEach((map) => {
          if (map instanceof THREE.Texture) {
            map.anisotropy = Math.min(4, maxAnisotropy);
            map.needsUpdate = true;
          }
        });
      });
    });
  }, [gl, scene, materialConfig]);

  useLayoutEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const nextCamera = camera.clone();
      nextCamera.aspect = size.width / size.height;
      nextCamera.updateProjectionMatrix();
      set({ camera: nextCamera });
      return;
    }
    if (camera instanceof THREE.OrthographicCamera) {
      const aspect = size.width / size.height;
      const nextCamera = camera.clone();
      nextCamera.left = -ORTHO_FRUSTUM * aspect;
      nextCamera.right = ORTHO_FRUSTUM * aspect;
      nextCamera.top = ORTHO_FRUSTUM;
      nextCamera.bottom = -ORTHO_FRUSTUM;
      nextCamera.updateProjectionMatrix();
      set({ camera: nextCamera });
    }
  }, [camera, size.width, size.height, set]);

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

  const createOrthoCamera = useCallback(() => {
    const aspect = size.width / size.height;
    const camera = new THREE.OrthographicCamera(
      -ORTHO_FRUSTUM * aspect,
      ORTHO_FRUSTUM * aspect,
      ORTHO_FRUSTUM,
      -ORTHO_FRUSTUM,
      0.1,
      100
    );
    camera.zoom = 60;
    camera.updateProjectionMatrix();
    return camera;
  }, [size.width, size.height]);

  const enable2DView = useCallback(
    (angle: Viewer2DAngle) => {
      let ortho = orthographicRef.current;
      if (!ortho) {
        ortho = createOrthoCamera();
        orthographicRef.current = ortho;
      }
      const target = new THREE.Vector3(0, 0, 0);
      if (angle === "top") {
        ortho.position.set(0, 5, 0);
        ortho.up.set(0, 0, -1);
      } else if (angle === "front") {
        ortho.position.set(0, 0, 5);
        ortho.up.set(0, 1, 0);
      } else if (angle === "right") {
        ortho.position.set(5, 0, 0);
        ortho.up.set(0, 1, 0);
      } else {
        ortho.position.set(-5, 0, 0);
        ortho.up.set(0, 1, 0);
      }
      ortho.lookAt(target);
      ortho.updateProjectionMatrix();
      set({ camera: ortho });
      cameraRef.current = ortho;
      is2DRef.current = true;
      const controls = controlsRef.current as unknown as {
        target?: THREE.Vector3;
        update?: () => void;
      } | null;
      if (controls?.target) {
        controls.target.copy(target);
        controls.update?.();
      }
    },
    [cameraRef, controlsRef, createOrthoCamera, set]
  );

  const disable2DView = useCallback(() => {
    const perspective = perspectiveRef.current;
    if (!perspective) return;
    perspective.lookAt(0, 0, 0);
    set({ camera: perspective });
    cameraRef.current = perspective;
    is2DRef.current = false;
    const controls = controlsRef.current as unknown as {
      target?: THREE.Vector3;
      update?: () => void;
    } | null;
    if (controls?.target) {
      controls.target.set(0, 0, 0);
      controls.update?.();
    }
  }, [cameraRef, controlsRef, set]);

  useEffect(() => {
    onViewerModeReady?.({ enable2DView, disable2DView });
    return () => onViewerModeReady?.(null);
  }, [enable2DView, disable2DView, onViewerModeReady]);

  const applyPreset = useCallback(
    (preset: "perspective" | "top" | "front" | "left") => {
      if (is2DRef.current) return;
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
      <hemisphereLight name="viewer-hemi" intensity={0.6} />
      <ambientLight name="viewer-ambient" intensity={0.25} />
      <directionalLight
        name="viewer-directional"
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
        <mesh
          name="viewer-floor"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.02, 0]}
          receiveShadow
        >
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
              if (is2DRef.current) return;
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
  notifyChangeSignal,
  registerViewerApi,
}: ThreeViewerProps) {
  const [resetToken, setResetToken] = useState(0);
  const [wireframeMode, setWireframeMode] = useState(wireframe);
  const [activePreset, setActivePreset] = useState(cameraPreset);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const viewerModeRef = useRef<{
    enable2DView: (angle: Viewer2DAngle) => void;
    disable2DView: () => void;
  } | null>(null);

  useEffect(() => {
    setWireframeMode(wireframe);
  }, [wireframe]);

  useEffect(() => {
    setActivePreset(cameraPreset);
  }, [cameraPreset]);

  const saveSnapshot = useCallback((): ViewerSnapshot | null => {
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!camera || !scene) return null;
    const controls = controlsRef.current as unknown as { target?: THREE.Vector3 } | null;
    const target = controls?.target ?? new THREE.Vector3(0, 0, 0);
    const cameraType =
      camera instanceof THREE.PerspectiveCamera
        ? "perspective"
        : camera instanceof THREE.OrthographicCamera
        ? "orthographic"
        : "unknown";
    const cameraZoom =
      camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera
        ? camera.zoom
        : 1;
    const snapshot: ViewerSnapshot = {
      camera: {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
        zoom: cameraZoom,
        type: cameraType,
      },
      objects: [],
      materials: [],
      scene: {
        hasFloor: false,
        hasGrid: false,
        environment: Boolean(scene.environment),
        lights: [],
      },
    };
    const materialMap = new Map<string, ViewerSnapshot["materials"][number]>();
    scene.traverse((child) => {
      if (child.type === "GridHelper" || child.name === "viewer-grid") {
        snapshot.scene.hasGrid = true;
      }
      if (child.name === "viewer-floor") {
        snapshot.scene.hasFloor = true;
      }
      if (child instanceof THREE.Light) {
        snapshot.scene.lights.push({
          id: child.name || child.uuid,
          type: child.type,
          position: [child.position.x, child.position.y, child.position.z],
          intensity: child.intensity,
          color: "color" in child ? `#${child.color.getHexString()}` : undefined,
        });
      }
      if (child instanceof THREE.Mesh) {
        snapshot.objects.push({
          id: child.uuid,
          name: child.name || undefined,
          position: [child.position.x, child.position.y, child.position.z],
          rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
          scale: [child.scale.x, child.scale.y, child.scale.z],
        });
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          const id = material.uuid;
          if (materialMap.has(id)) return;
          const entry: ViewerSnapshot["materials"][number] = {
            id,
            name: material.name || undefined,
            preset: material.name || "custom",
          };
          if (material instanceof THREE.MeshStandardMaterial) {
            entry.color = `#${material.color.getHexString()}`;
            entry.roughness = material.roughness;
            entry.metalness = material.metalness;
            entry.envMapIntensity = material.envMapIntensity ?? 1;
            entry.opacity = material.opacity;
            entry.transparent = material.transparent;
          }
          materialMap.set(id, entry);
        });
      }
    });
    snapshot.materials = Array.from(materialMap.values());
    return snapshot;
  }, []);

  const restoreSnapshot = useCallback((snapshot: ViewerSnapshot | null) => {
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!camera || !scene || !snapshot) return;
    camera.position.set(...snapshot.camera.position);
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      camera.zoom = snapshot.camera.zoom;
      camera.updateProjectionMatrix();
    }
    const controls = controlsRef.current as unknown as {
      target?: THREE.Vector3;
      update?: () => void;
    } | null;
    if (controls?.target) {
      controls.target.set(...snapshot.camera.target);
      controls.update?.();
    } else {
      camera.lookAt(...snapshot.camera.target);
    }
    const byName = new Map<string, ViewerSnapshot["objects"][number]>();
    const byId = new Map<string, ViewerSnapshot["objects"][number]>();
    snapshot.objects.forEach((item) => {
      byId.set(item.id, item);
      if (item.name) byName.set(item.name, item);
    });
    const materialsByName = new Map<string, ViewerSnapshot["materials"][number]>();
    const materialsById = new Map<string, ViewerSnapshot["materials"][number]>();
    snapshot.materials.forEach((item) => {
      materialsById.set(item.id, item);
      if (item.name) materialsByName.set(item.name, item);
    });
    const lightsById = new Map<string, ViewerSnapshot["scene"]["lights"][number]>();
    snapshot.scene.lights.forEach((item) => {
      lightsById.set(item.id, item);
    });
    scene.traverse((child) => {
      const snapshotObj = (child.name && byName.get(child.name)) ?? byId.get(child.uuid);
      if (snapshotObj) {
        child.position.set(...snapshotObj.position);
        child.rotation.set(...snapshotObj.rotation);
        child.scale.set(...snapshotObj.scale);
      }
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          const snapshotMat =
            materialsById.get(material.uuid) ||
            (material.name ? materialsByName.get(material.name) : undefined);
          if (snapshotMat && material instanceof THREE.MeshStandardMaterial) {
            if (snapshotMat.color) material.color.set(snapshotMat.color);
            if (snapshotMat.roughness !== undefined) material.roughness = snapshotMat.roughness;
            if (snapshotMat.metalness !== undefined) material.metalness = snapshotMat.metalness;
            if (snapshotMat.envMapIntensity !== undefined) {
              material.envMapIntensity = snapshotMat.envMapIntensity;
            }
            if (snapshotMat.opacity !== undefined) material.opacity = snapshotMat.opacity;
            if (snapshotMat.transparent !== undefined) material.transparent = snapshotMat.transparent;
            material.needsUpdate = true;
          }
        });
      }
      if (child instanceof THREE.Light) {
        const snapshotLight = lightsById.get(child.name || child.uuid);
        if (snapshotLight) {
          child.position.set(...snapshotLight.position);
          child.intensity = snapshotLight.intensity;
          if ("color" in child && snapshotLight.color) {
            child.color.set(snapshotLight.color);
          }
        }
      }
    });
  }, []);

  const renderScene = useCallback(
    (options: ViewerRenderOptions): ViewerRenderResult | null => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!scene || !camera) return null;
      const { width, height } = RENDER_SIZES[options.quality];
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: options.background === "transparent",
        preserveDrawingBuffer: true,
      });
      renderer.setSize(width, height);
      if (options.background === "transparent") {
        renderer.setClearColor(0x000000, 0);
      } else {
        renderer.setClearColor(0xffffff, 1);
      }

      const exportScene = scene.clone(true);
      if (options.background === "transparent") {
        exportScene.background = null;
      } else {
        exportScene.background = new THREE.Color("#ffffff");
      }
      const exportCamera = camera.clone();
      if (exportCamera instanceof THREE.PerspectiveCamera) {
        exportCamera.aspect = width / height;
        exportCamera.updateProjectionMatrix();
      } else if (exportCamera instanceof THREE.OrthographicCamera) {
        const aspect = width / height;
        exportCamera.left = -ORTHO_FRUSTUM * aspect;
        exportCamera.right = ORTHO_FRUSTUM * aspect;
        exportCamera.top = ORTHO_FRUSTUM;
        exportCamera.bottom = -ORTHO_FRUSTUM;
        exportCamera.updateProjectionMatrix();
      }

      renderer.render(exportScene, exportCamera);
      const dataUrl = renderer.domElement.toDataURL("image/png");
      renderer.dispose();
      return { dataUrl, width, height };
    },
    []
  );

  useEffect(() => {
    const api: ViewerApi = {
      saveSnapshot,
      restoreSnapshot,
      enable2DView: (angle) => viewerModeRef.current?.enable2DView(angle),
      disable2DView: () => viewerModeRef.current?.disable2DView(),
      renderScene,
    };
    registerViewerApi?.(api);
    return () => registerViewerApi?.(null);
  }, [registerViewerApi, saveSnapshot, restoreSnapshot, renderScene]);

  useEffect(() => {
    if (notifyChangeSignal === undefined) return;
    // placeholder: sincronização com ProjectState será aplicada depois
  }, [notifyChangeSignal]);

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
          onSceneReady={(scene) => {
            sceneRef.current = scene;
          }}
          onViewerModeReady={(api) => {
            viewerModeRef.current = api;
          }}
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
