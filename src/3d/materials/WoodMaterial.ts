import * as THREE from "three";

export type WoodMaterialMaps = {
  colorMap?: string;
  normalMap?: string;
  roughnessMap?: string;
};

export type WoodMaterialOptions = {
  color?: string;
  repeat?: { x: number; y: number };
  anisotropy?: number;
  roughness?: number;
  metalness?: number;
};

export type LoadedWoodMaterial = {
  material: THREE.MeshStandardMaterial;
  textures: THREE.Texture[];
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
  if (options.anisotropy !== undefined) {
    texture.anisotropy = options.anisotropy;
  }
};

export const createWoodMaterial = (
  maps: WoodMaterialMaps = {},
  options: WoodMaterialOptions = {},
  loader?: THREE.TextureLoader
): LoadedWoodMaterial => {
  const textureLoader = loader ?? new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];

  const colorMap = maps.colorMap ? textureLoader.load(maps.colorMap) : null;
  if (colorMap) {
    applyTextureSettings(colorMap, options, true);
    textures.push(colorMap);
  }

  const normalMap = maps.normalMap ? textureLoader.load(maps.normalMap) : null;
  if (normalMap) {
    applyTextureSettings(normalMap, options, false);
    textures.push(normalMap);
  }

  const roughnessMap = maps.roughnessMap ? textureLoader.load(maps.roughnessMap) : null;
  if (roughnessMap) {
    applyTextureSettings(roughnessMap, options, false);
    textures.push(roughnessMap);
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? "#c9a27a"),
    roughness: options.roughness ?? 0.8,
    metalness: options.metalness ?? 0.05,
    map: colorMap ?? undefined,
    normalMap: normalMap ?? undefined,
    roughnessMap: roughnessMap ?? undefined,
  });

  return { material, textures };
};
