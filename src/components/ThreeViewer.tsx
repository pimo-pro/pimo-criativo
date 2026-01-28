import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mdfLibrary } from "../materials/mdfLibrary";

type ThreeViewerProps = {
  height?: number | string;
  backgroundColor?: string;
  cubeCount?: number;
  cubeSize?: number;
  gap?: number;
  animationEnabled?: boolean;
  modelUrl?: string;
  modelUrls?: string[];
  loadingText?: string;
  pbrMaps?: {
    map?: string;
    normalMap?: string;
    roughnessMap?: string;
    metalnessMap?: string;
    aoMap?: string;
  };
  pbrRepeat?: {
    map?: { x: number; y: number };
    normalMap?: { x: number; y: number };
    roughnessMap?: { x: number; y: number };
    metalnessMap?: { x: number; y: number };
    aoMap?: { x: number; y: number };
  };
  pbrColor?: string;
  materialId?: string;
  showFloor?: boolean;
  colorize?: boolean;
  wireframe?: boolean;
  cameraPreset?: "perspective" | "top" | "front" | "left";
  materialConfig?: unknown;
  modelSpacing?: number;
  enableIdleMotion?: boolean;
  idleMotionAmplitudeDeg?: number;
  notifyChangeSignal?: unknown;
  registerViewerApi?: unknown;
};

const fitCameraToObject = (
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  marginFactor: number
) => {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (maxDim / 2) / Math.tan(fov / 2) * marginFactor;
  const elevation = THREE.MathUtils.degToRad(30);
  const direction = new THREE.Vector3(1, Math.tan(elevation), 1).normalize();
  camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
  camera.near = Math.max(0.05, distance - maxDim * 2.5);
  camera.far = distance + maxDim * 4;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
};

const normalizeObject = (object: THREE.Object3D) => {
  object.rotation.set(0, 0, 0);
  object.position.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  object.position.sub(center);
  object.updateMatrixWorld(true);
  return box;
};

const getObjectWidth = (object: THREE.Object3D) => {
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(object).getSize(size);
  return Math.max(0.01, size.x);
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
};

export default function ThreeViewer({
  height = 300,
  backgroundColor = "#f0f0f0",
  cubeCount = 2,
  cubeSize = 1,
  gap = 0.2,
  animationEnabled: _animationEnabled = false,
  pbrMaps,
  pbrRepeat,
  pbrColor = "#c9a27a",
  materialId: _materialId,
  modelUrl: _modelUrl,
  modelUrls: _modelUrls,
  showFloor: _showFloor,
  colorize: _colorize,
  wireframe: _wireframe,
  cameraPreset: _cameraPreset,
  materialConfig: _materialConfig,
  modelSpacing: _modelSpacing,
  enableIdleMotion: _enableIdleMotion,
  idleMotionAmplitudeDeg: _idleMotionAmplitudeDeg,
  notifyChangeSignal: _notifyChangeSignal,
  registerViewerApi: _registerViewerApi,
}: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeRef = useRef<ResizeObserver | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridVisibleRef = useRef(true);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const materialAssetsRef = useRef<{
    baseMap: THREE.Texture | null;
    normalMap: THREE.Texture | null;
    roughnessMap: THREE.Texture | null;
    metalnessMap: THREE.Texture | null;
    aoMap: THREE.Texture | null;
    neutralNormal: THREE.DataTexture;
    neutralAO: THREE.DataTexture;
  } | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const materialId = _materialId;

  const resolvedCubeCount = useMemo(() => Math.max(0, cubeCount), [cubeCount]);
  const resolvedModelUrls = useMemo(() => {
    const urls = _modelUrls ? [..._modelUrls] : [];
    if (_modelUrl) urls.push(_modelUrl);
    return urls;
  }, [_modelUrl, _modelUrls]);

  useEffect(() => {
    gridVisibleRef.current = gridVisible;
  }, [gridVisible]);

  const resolvedMdf = useMemo(() => {
    if (!materialId) return null;
    return mdfLibrary.find((material) => material.id === materialId) ?? null;
  }, [materialId]);

  const resolveRepeat = useMemo(() => {
    const repeatPadrao = resolvedMdf?.repeatPadrao ?? { x: 1, y: 1 };
    const repeatMadeira = resolvedMdf?.pbrRepeat ?? { x: 2, y: 2 };
    return {
      map: pbrRepeat?.map ?? repeatMadeira,
      normalMap: pbrRepeat?.normalMap ?? repeatPadrao,
      roughnessMap: pbrRepeat?.roughnessMap ?? repeatPadrao,
      metalnessMap: pbrRepeat?.metalnessMap ?? repeatPadrao,
      aoMap: pbrRepeat?.aoMap ?? repeatPadrao,
    };
  }, [pbrRepeat, resolvedMdf]);

  const resolveMaps = useMemo(() => {
    if (resolvedMdf) {
      return {
        map: resolvedMdf.texturas.map,
        normalMap: resolvedMdf.texturas.normal,
        roughnessMap: resolvedMdf.texturas.roughness,
        metalnessMap: undefined,
        aoMap: resolvedMdf.texturas.ao,
        corBase: resolvedMdf.corBase,
        roughnessPadrao: resolvedMdf.fallback.roughnessPadrao,
        metalnessPadrao: resolvedMdf.fallback.metalnessPadrao,
      };
    }
    return {
      map: pbrMaps?.map,
      normalMap: pbrMaps?.normalMap,
      roughnessMap: pbrMaps?.roughnessMap,
      metalnessMap: pbrMaps?.metalnessMap,
      aoMap: pbrMaps?.aoMap,
      corBase: pbrColor,
      roughnessPadrao: 0.82,
      metalnessPadrao: 0,
    };
  }, [pbrMaps, pbrColor, resolvedMdf]);

  const hasPbrMaps = useMemo(
    () =>
      Boolean(
        resolveMaps.map ||
          resolveMaps.normalMap ||
          resolveMaps.roughnessMap ||
          resolveMaps.metalnessMap ||
          resolveMaps.aoMap
      ),
    [resolveMaps]
  );

  const showOverlay = useCallback(() => {
    overlayRef.current?.classList.remove("hidden");
  }, []);

  const hideOverlay = useCallback(() => {
    overlayRef.current?.classList.add("hidden");
  }, []);

  const createLoadingManager = useCallback(() => {
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => {
      hideOverlay();
    };
    manager.onError = () => {
      hideOverlay();
    };
    return manager;
  }, [hideOverlay]);

  const buildPbrMaterial = useCallback((manager?: THREE.LoadingManager) => {
    const textureLoader = new THREE.TextureLoader(manager);
    const baseMap = resolveMaps.map ? textureLoader.load(resolveMaps.map) : null;
    const normalMap = resolveMaps.normalMap ? textureLoader.load(resolveMaps.normalMap) : null;
    const roughnessMap = resolveMaps.roughnessMap
      ? textureLoader.load(resolveMaps.roughnessMap)
      : null;
    const metalnessMap = resolveMaps.metalnessMap
      ? textureLoader.load(resolveMaps.metalnessMap)
      : null;
    const aoMap = resolveMaps.aoMap ? textureLoader.load(resolveMaps.aoMap) : null;

    const neutralNormal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    neutralNormal.needsUpdate = true;
    neutralNormal.colorSpace = THREE.NoColorSpace;

    const neutralAO = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    neutralAO.needsUpdate = true;
    neutralAO.colorSpace = THREE.NoColorSpace;

    const applyMapDefaults = (
      map: THREE.Texture | null,
      colorSpace: THREE.ColorSpace,
      repeat?: { x: number; y: number }
    ) => {
      if (!map) return;
      map.colorSpace = colorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      const targetRepeat = repeat ?? { x: 1, y: 1 };
      map.repeat.set(targetRepeat.x, targetRepeat.y);
    };

    applyMapDefaults(baseMap, THREE.SRGBColorSpace, resolveRepeat.map);
    applyMapDefaults(normalMap, THREE.NoColorSpace, resolveRepeat.normalMap);
    applyMapDefaults(roughnessMap, THREE.NoColorSpace, resolveRepeat.roughnessMap);
    applyMapDefaults(metalnessMap, THREE.NoColorSpace, resolveRepeat.metalnessMap);
    applyMapDefaults(aoMap, THREE.NoColorSpace, resolveRepeat.aoMap);

    const material = new THREE.MeshStandardMaterial({
      color: baseMap ? "#ffffff" : resolveMaps.corBase,
      roughness: roughnessMap ? 1 : resolveMaps.roughnessPadrao,
      metalness: metalnessMap ? 1 : resolveMaps.metalnessPadrao,
      map: baseMap ?? undefined,
      normalMap: normalMap ?? neutralNormal,
      roughnessMap: roughnessMap ?? undefined,
      metalnessMap: metalnessMap ?? undefined,
      aoMap: aoMap ?? neutralAO,
    });

    return {
      material,
      assets: {
        baseMap,
        normalMap,
        roughnessMap,
        metalnessMap,
        aoMap,
        neutralNormal,
        neutralAO,
      },
    };
  }, [resolveMaps, resolveRepeat]);

  const applyMaterialToMeshes = useCallback(
    (
    material: THREE.MeshStandardMaterial,
    forceOverride: boolean,
    previousMaterial: THREE.Material | null
  ) => {
    if (!rootGroupRef.current) return;
    rootGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (forceOverride) {
          child.material = material;
          return;
        }
        if (Array.isArray(child.material)) {
          const shouldReplace = child.material.some((mat) => mat === previousMaterial);
          if (shouldReplace) {
            child.material = material;
          }
        } else if (child.material === previousMaterial) {
          child.material = material;
        }
      }
    });
  },
  []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    const shouldShowOverlay = resolvedModelUrls.length > 0 || hasPbrMaps;
    if (shouldShowOverlay) {
      showOverlay();
    } else {
      hideOverlay();
    }
    const loadingManager = shouldShowOverlay ? createLoadingManager() : undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera + renderer bootstrap
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    if ("outputColorSpace" in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      (renderer as unknown as { outputEncoding: number }).outputEncoding = (THREE as unknown as {
        sRGBEncoding: number;
      }).sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Root group: único ponto de rotação
    const rootGroup = new THREE.Group();
    rootGroup.position.set(0, 0, 0);
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;
    const { material: pbrMaterial, assets } = buildPbrMaterial(loadingManager);
    materialRef.current = pbrMaterial;
    materialAssetsRef.current = assets;

    const addCube = (size: number) => {
      // Cubo normalizado com pivot em (0,0,0)
      const geometry = new THREE.BoxGeometry(size, size, size);
      const cube = new THREE.Mesh(geometry, pbrMaterial);
      cube.castShadow = true;
      cube.receiveShadow = true;
      normalizeObject(cube);
      return { object: cube, width: getObjectWidth(cube) };
    };

    const loadGLB = async (url: string) => {
      const loader = new GLTFLoader(loadingManager);
      const gltf = await loader.loadAsync(url);
      const model = gltf.scene;
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const material = child.material;
          const materialArray = Array.isArray(material) ? material : [material];
          const hasStrongMaterial = materialArray.every((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              return (
                Boolean(mat.normalMap) &&
                Boolean(mat.roughnessMap) &&
                Boolean(mat.metalnessMap) &&
                Boolean(mat.aoMap)
              );
            }
            return false;
          });
          if (materialId || !hasStrongMaterial) {
            child.material = pbrMaterial;
          }
        }
      });
      normalizeObject(model);
      return { object: model, width: getObjectWidth(model) };
    };

    const buildScene = async () => {
      const items: { object: THREE.Object3D; width: number }[] = [];
      for (let i = 0; i < resolvedCubeCount; i += 1) {
        items.push(addCube(cubeSize));
      }
      if (resolvedModelUrls.length > 0) {
        const glbItems = await Promise.all(resolvedModelUrls.map((url) => loadGLB(url)));
        items.push(...glbItems);
      }
      if (!active) return;
      let cursor = 0;
      items.forEach((item) => {
        item.object.position.x += cursor + item.width / 2;
        cursor += item.width + gap;
        rootGroup.add(item.object);
      });
      // Recentraliza o conjunto no rootGroup e assenta no chão (Y=0)
      const groupBox = new THREE.Box3().setFromObject(rootGroup);
      const groupCenter = new THREE.Vector3();
      groupBox.getCenter(groupCenter);
      rootGroup.position.sub(groupCenter);
      rootGroup.position.y -= groupBox.min.y;
      rootGroup.updateMatrixWorld(true);
      // Auto-fit inicial da câmara
      fitCameraToObject(rootGroup, camera, 1.12);
    };
    void buildScene();

    // Chão para sombras e referência visual
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.2 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(10, 20, "#94a3b8", "#94a3b8");
    const gridMaterial = grid.material as THREE.Material | THREE.Material[];
    const applyGridOpacity = (material: THREE.Material) => {
      material.transparent = true;
      material.opacity = 0.5;
      material.depthWrite = false;
    };
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach(applyGridOpacity);
    } else {
      applyGridOpacity(gridMaterial);
    }
    grid.position.y = 0.001;
    grid.visible = gridVisibleRef.current;
    scene.add(grid);

    const wallGrid = new THREE.GridHelper(10, 20, "#94a3b8", "#94a3b8");
    const wallMaterial = wallGrid.material as THREE.Material | THREE.Material[];
    if (Array.isArray(wallMaterial)) {
      wallMaterial.forEach(applyGridOpacity);
    } else {
      applyGridOpacity(wallMaterial);
    }
    wallGrid.rotation.x = Math.PI / 2;
    wallGrid.position.set(0, 5, -5);
    wallGrid.visible = gridVisibleRef.current;
    scene.add(wallGrid);

    // Iluminação soft studio
    const keyLight = new THREE.DirectionalLight("#ffe2b3", 0.8);
    keyLight.position.set(6, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.00015;
    keyLight.shadow.radius = 8;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#fff6e8", 0.4);
    fillLight.position.set(-5, 4, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#f8fbff", 0.2);
    rimLight.position.set(0, 5, -8);
    scene.add(rimLight);

    // Loop de animação (apenas rootGroup)
    const clock = new THREE.Clock();

    const animate = () => {
      clock.getDelta();
      grid.visible = gridVisibleRef.current;
      wallGrid.visible = gridVisibleRef.current;
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // Resize responsivo
    const handleResize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitCameraToObject(rootGroup, camera, 1.12);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    resizeRef.current = resizeObserver;

    return () => {
      active = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      resizeObserver.disconnect();
      disposeObject(rootGroup);
      if (Array.isArray(grid.material)) {
        grid.material.forEach((material) => material.dispose());
      } else {
        grid.material.dispose();
      }
      grid.geometry.dispose();
      if (Array.isArray(wallGrid.material)) {
        wallGrid.material.forEach((material) => material.dispose());
      } else {
        wallGrid.material.dispose();
      }
      wallGrid.geometry.dispose();
      materialRef.current?.dispose();
      materialAssetsRef.current?.baseMap?.dispose();
      materialAssetsRef.current?.normalMap?.dispose();
      materialAssetsRef.current?.roughnessMap?.dispose();
      materialAssetsRef.current?.metalnessMap?.dispose();
      materialAssetsRef.current?.aoMap?.dispose();
      materialAssetsRef.current?.neutralNormal.dispose();
      materialAssetsRef.current?.neutralAO.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [
    backgroundColor,
    buildPbrMaterial,
    createLoadingManager,
    cubeSize,
    gap,
    hasPbrMaps,
    hideOverlay,
    materialId,
    resolvedCubeCount,
    resolvedModelUrls,
    showOverlay,
  ]);

  useEffect(() => {
    if (!rootGroupRef.current) return;
    if (hasPbrMaps) {
      showOverlay();
    } else {
      hideOverlay();
    }
    const loadingManager = hasPbrMaps ? createLoadingManager() : undefined;
    const { material: nextMaterial, assets } = buildPbrMaterial(loadingManager);
    const previousMaterial = materialRef.current;
    const previousAssets = materialAssetsRef.current;
    materialRef.current = nextMaterial;
    materialAssetsRef.current = assets;
    const forceOverride = Boolean(materialId);
    applyMaterialToMeshes(nextMaterial, forceOverride, previousMaterial ?? null);
    if (previousMaterial) {
      previousMaterial.dispose();
    }
    if (previousAssets) {
      previousAssets.baseMap?.dispose();
      previousAssets.normalMap?.dispose();
      previousAssets.roughnessMap?.dispose();
      previousAssets.metalnessMap?.dispose();
      previousAssets.aoMap?.dispose();
      previousAssets.neutralNormal.dispose();
      previousAssets.neutralAO.dispose();
    }
  }, [
    applyMaterialToMeshes,
    buildPbrMaterial,
    createLoadingManager,
    hasPbrMaps,
    hideOverlay,
    materialId,
    showOverlay,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        background: backgroundColor,
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setGridVisible((prev) => !prev)}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 2,
          background: "rgba(15, 23, 42, 0.8)",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          color: "#e2e8f0",
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 12,
          cursor: "pointer",
        }}
        aria-label="Alternar grid"
      >
        grid
      </button>
      <div ref={overlayRef} className="viewer-loading-overlay hidden">
        <div className="spinner"></div>
      </div>
      <style>{`
        .viewer-loading-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
          opacity: 1;
          transition: opacity 0.3s ease;
        }

        .viewer-loading-overlay.hidden {
          opacity: 0;
          pointer-events: none;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
