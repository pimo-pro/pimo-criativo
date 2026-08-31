/**
 * MaterialEngine — Cache global de texturas por URL.
 * Evita carregamento duplicado; usa THREE.TextureLoader internamente.
 */

import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();
let loader: THREE.TextureLoader | null = null;

/** THREE.TextureLoader usa ImageLoader, que depende de `document`. */
function canLoadTextures(): boolean {
  return typeof document !== "undefined";
}

function getLoader(): THREE.TextureLoader {
  if (!loader) loader = new THREE.TextureLoader();
  return loader;
}

/**
 * Obtém textura por URL; devolve da cache se já existir, senão carrega.
 * Não faz clone; a mesma instância é partilhada (Three.js permite).
 */
export function getCachedTexture(url: string): THREE.Texture | null {
  if (!url || typeof url !== "string") return null;
  const key = url.trim();
  if (!key) return null;
  const existing = cache.get(key);
  if (existing) return existing;
  if (!canLoadTextures()) return null;
  try {
    const texture = getLoader().load(key);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    cache.set(key, texture);
    return texture;
  } catch {
    return null;
  }
}

/**
 * Carrega textura de forma assíncrona; coloca na cache ao concluir.
 */
export function loadTextureAsync(url: string): Promise<THREE.Texture | null> {
  if (!url || typeof url !== "string") return Promise.resolve(null);
  const key = url.trim();
  if (!key) return Promise.resolve(null);
  const existing = cache.get(key);
  if (existing) return Promise.resolve(existing);
  if (!canLoadTextures()) return Promise.resolve(null);
  return new Promise((resolve) => {
    getLoader().load(
      key,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        cache.set(key, texture);
        resolve(texture);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/**
 * Remove uma textura da cache e faz dispose (útil para limpeza).
 */
export function releaseTexture(url: string): void {
  const tex = cache.get(url?.trim());
  if (tex) {
    tex.dispose();
    cache.delete(url.trim());
  }
}

/**
 * Limpa toda a cache e faz dispose das texturas.
 */
export function clearTextureCache(): void {
  cache.forEach((tex) => tex.dispose());
  cache.clear();
}
