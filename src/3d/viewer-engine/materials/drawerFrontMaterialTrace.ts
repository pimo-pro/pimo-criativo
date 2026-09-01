import * as THREE from "three";

/**
 * Trace DEV: quem escreve matéria na frente da gaveta (ordem temporal).
 * Activar no browser: window.__PIMO_TRACE_DRAWER_FRONT__ = true
 * (em import.meta.env.DEV também imprime por defeito se a flag não estiver false)
 */
export function shouldTraceDrawerFrontMaterial(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { __PIMO_TRACE_DRAWER_FRONT__?: boolean };
  if (w.__PIMO_TRACE_DRAWER_FRONT__ === false) return false;
  if (w.__PIMO_TRACE_DRAWER_FRONT__ === true) return true;
  return Boolean(import.meta.env.DEV);
}

export function isDrawerFrontExteriorMesh(node: THREE.Object3D): boolean {
  const ud = node.userData as {
    drawerPart?: string;
    drawerFrontMaterialId?: string;
    drawerLayerId?: string;
    isDrawerFrontExteriorCap?: boolean;
  };
  if (ud?.isDrawerFrontExteriorCap === true) return true;
  if (ud?.drawerPart === "front") return true;
  if (typeof node.name === "string" && node.name.startsWith("drawer-front-ext-")) return true;
  if (ud?.drawerFrontMaterialId && ud?.drawerLayerId) return true;
  return false;
}

export function traceDrawerFrontMaterial(
  source: string,
  payload: Record<string, unknown>
): void {
  if (!shouldTraceDrawerFrontMaterial()) return;
  const ts = typeof performance !== "undefined" ? performance.now().toFixed(2) : String(Date.now());
   
  console.warn(`[DRAWER-FRONT-MAT ${ts}ms] ${source}`, payload);
}

export function describeMeshMaterial(mesh: THREE.Mesh): Record<string, unknown> {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const std = mat instanceof THREE.MeshStandardMaterial ? mat : null;
  return {
    name: mesh.name,
    drawerPart: mesh.userData?.drawerPart,
    drawerLayerId: mesh.userData?.drawerLayerId,
    drawerFrontMaterialId: mesh.userData?.drawerFrontMaterialId,
    panelType: mesh.userData?.panelType,
    materialUuid: mat?.uuid ?? null,
    materialName: mat?.name ?? null,
    color: std ? `#${std.color.getHexString()}` : null,
    hasMap: Boolean(std?.map),
  };
}
