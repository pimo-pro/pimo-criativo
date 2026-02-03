/**
 * Pipeline oficial: GLB → Extração de Peças → Lista de Peças → Calculator.
 * Módulo unificado para carregar modelos GLB, extrair meshes e integrar ao sistema.
 */

export type { ExtractedPart } from "./types";
export { extractPartsFromGLB } from "./extractPartsFromGLB";
export { glbPartsToCutListItems } from "./glbPartsToCutList";
export { loadGLB } from "./glbLoader";
export { GLB_REGISTRY, getCatalogGlbPath } from "./glbRegistry";
