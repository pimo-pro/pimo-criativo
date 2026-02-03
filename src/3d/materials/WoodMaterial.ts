import * as THREE from "three";

export type WoodMaterialMaps = {
  colorMap?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  aoMap?: string;
};

export type WoodMaterialOptions = {
  color?: string;
  repeat?: { x: number; y: number };
  anisotropy?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
};

export type LoadedWoodMaterial = {
  material: THREE.MeshStandardMaterial;
  textures: THREE.Texture[];
  loadDetailMaps: () => Promise<void>;
  areDetailMapsLoaded: () => boolean;
};

const applyTextureSettings = (
  texture: THREE.Texture,
  options: WoodMaterialOptions,
  isColorMap: boolean
) => {
  if (isColorMap) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeat = options.repeat ?? { x: 2, y: 2 };
  texture.repeat.set(repeat.x, repeat.y);
  const targetAnisotropy =
    options.anisotropy !== undefined ? Math.min(options.anisotropy, 4) : 4;
  texture.anisotropy = targetAnisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
};

export const createWoodMaterial = (
  maps: WoodMaterialMaps = {},
  options: WoodMaterialOptions = {},
  loader?: THREE.TextureLoader
): LoadedWoodMaterial => {
  const textureLoader = loader ?? new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];

  const loadTextureImmediate = (url: string, isColor = false) => {
    const texture = textureLoader.load(
      url,
      (loaded) => applyTextureSettings(loaded, options, isColor),
      undefined,
      () => {
        // Fallback: se falhar, usar cor sólida
        console.warn(`Failed to load texture: ${url}`);
      }
    );
    applyTextureSettings(texture, options, isColor);
    textures.push(texture);
    return texture;
  };

  const loadTextureAsync = (url: string, isColor = false) =>
    textureLoader.loadAsync(url).then((texture) => {
      applyTextureSettings(texture, options, isColor);
      return texture;
    }).catch((error) => {
      console.warn(`Failed to load texture: ${url}`, error);
      return null;
    });

  const colorMap = maps.colorMap ? loadTextureImmediate(maps.colorMap, true) : null;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? "#f5f5f5"), // Fallback mais claro
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0,
    map: colorMap ?? undefined,
    envMapIntensity: options.envMapIntensity ?? 0.4,
  });

  let detailMapsLoaded = false;
  let loadingPromise: Promise<void> | null = null;

  const loadDetailMaps = async () => {
    if (detailMapsLoaded) return;
    if (loadingPromise) {
      await loadingPromise;
      return;
    }
    loadingPromise = (async () => {
      const [normalMap, roughnessMap, metalnessMap, aoMap] = await Promise.all([
        maps.normalMap ? loadTextureAsync(maps.normalMap) : Promise.resolve(null),
        maps.roughnessMap ? loadTextureAsync(maps.roughnessMap) : Promise.resolve(null),
        maps.metalnessMap ? loadTextureAsync(maps.metalnessMap) : Promise.resolve(null),
        maps.aoMap ? loadTextureAsync(maps.aoMap) : Promise.resolve(null),
      ]);

      if (normalMap) {
        textures.push(normalMap);
        material.normalMap = normalMap;
      }
      if (roughnessMap) {
        textures.push(roughnessMap);
        material.roughnessMap = roughnessMap;
      }
      if (metalnessMap) {
        textures.push(metalnessMap);
        material.metalnessMap = metalnessMap;
      }
      if (aoMap) {
        textures.push(aoMap);
        material.aoMap = aoMap;
      }

      if (material.normalMap) {
        material.normalScale = new THREE.Vector2(0.8, 0.8);
      }
      material.needsUpdate = true;
      detailMapsLoaded = true;
    })();
    await loadingPromise;
  };

  const areDetailMapsLoaded = () => detailMapsLoaded;

  return { material, textures, loadDetailMaps, areDetailMapsLoaded };
};
