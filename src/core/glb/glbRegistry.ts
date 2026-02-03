/**
 * Mapeamento de itens do catálogo para caminhos GLB.
 * Nota: estes caminhos devem ser servidos pelo front (public/ ou CDN).
 */

export const GLB_REGISTRY: Record<string, string> = {
  // Cozinha - Base
  "cozinha-base-600": "/pimo-models-temp/kitchen/base/base_60cm.glb",
  "cozinha-base-800": "/pimo-models-temp/kitchen/base/base_80cm.glb",
  "cozinha-base-1000": "/pimo-models-temp/kitchen/base/base_100cm.glb",
  // Roupeiro - Superior
  "roupeiro-upper-800": "/pimo-models-temp/wardrobe/upper/upper_80cm.glb",
};

export function getCatalogGlbPath(catalogItemId: string): string | null {
  return GLB_REGISTRY[catalogItemId] ?? null;
}
