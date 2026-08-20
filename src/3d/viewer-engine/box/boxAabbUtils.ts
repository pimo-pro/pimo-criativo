/**
 * Utilitários de AABB para caixas com proxy de layout (`viewerLayoutBounds`).
 * O proxy vive na layer VIEWER_LAYOUT_PROXY_LAYER (picking/raycaster = layer 0 não o vê).
 * Em render normal fica `visible: false` para não participar no pipeline visual; só se ativa
 * `visible` temporariamente aqui para `Box3.expandByObject` / `setFromObject` (Three.js ignora invisíveis).
 * Box3.expandByObject ignora layers — para excluir o proxy nos cálculos “só carcaça”, usar as funções abaixo.
 *
 * `viewerPickBounds` é um hitbox L×A×P separado (layer 0) só para selecção de caixa — não entra em bbox/reflow.
 */

import * as THREE from "three";

/** Layer dedicada ao volume L×A×P de layout (não interage com raycaster padrão layer 0). */
export const VIEWER_LAYOUT_PROXY_LAYER = 31;

export function isViewerLayoutProxyObject(obj: THREE.Object3D): boolean {
  return obj.userData?.viewerLayoutBounds === true;
}

/** Hitbox invisível de picking de caixa (layer 0) — não é painel nem proxy de layout. */
export function isViewerPickBoundsObject(obj: THREE.Object3D): boolean {
  return obj.userData?.viewerPickBounds === true;
}

/** Recolhe proxies de layout sob as raízes dadas (sem duplicar referência). */
function collectLayoutBoundsProxies(roots: Iterable<THREE.Object3D>): THREE.Object3D[] {
  const seen = new Set<THREE.Object3D>();
  const out: THREE.Object3D[] = [];
  for (const root of roots) {
    root.traverse((o) => {
      if (isViewerLayoutProxyObject(o) && !seen.has(o)) {
        seen.add(o);
        out.push(o);
      }
    });
  }
  return out;
}

/**
 * Ativa temporariamente os proxies para `Box3` inclusivo; repõe o estado no `finally`.
 * Não usar no render: só em cálculos síncronos de bbox.
 */
export function runWithAllLayoutBoundsProxiesVisible(roots: Iterable<THREE.Object3D>, fn: () => void): void {
  const proxies = collectLayoutBoundsProxies(roots);
  const stash = proxies.map((o) => ({ o, v: o.visible }));
  proxies.forEach((o) => {
    o.visible = true;
  });
  try {
    fn();
  } finally {
    stash.forEach(({ o, v }) => {
      o.visible = v;
    });
  }
}

/** Igual a `runWithAllLayoutBoundsProxiesVisible` com uma única raiz (grupo da caixa). */
export function runWithLayoutBoundsProxiesVisible(root: THREE.Object3D, fn: () => void): void {
  runWithAllLayoutBoundsProxiesVisible([root], fn);
}

/** Expande `target` com meshes descendentes de `root`, exceto proxy de layout e pick-bounds. */
export function expandBox3ByObjectExcludingLayoutProxy(target: THREE.Box3, root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, false);
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (!node.visible) return;
    if (isViewerLayoutProxyObject(node)) return;
    if (isViewerPickBoundsObject(node)) return;
    const geometry = node.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const bb = geometry.boundingBox.clone();
    bb.applyMatrix4(node.matrixWorld);
    target.union(bb);
  });
  return target;
}

/** Bbox só da geometria “real” (carcassa, portas, pés, GLB), sem o proxy de layout. */
export function setBox3FromObjectExcludingLayoutProxy(target: THREE.Box3, root: THREE.Object3D): THREE.Box3 {
  target.makeEmpty();
  return expandBox3ByObjectExcludingLayoutProxy(target, root);
}

/**
 * Bbox APENAS do proxy de layout (volume L×A×P estrutural da caixa).
 * Não verifica node.visible — o proxy está normalmente invisível.
 * Retorna true se encontrou proxy; false se não havia proxy (objeto não é caixa paramétrica).
 */
export function setBox3FromLayoutProxyOnly(target: THREE.Box3, root: THREE.Object3D): boolean {
  target.makeEmpty();
  root.updateWorldMatrix(true, true);
  root.traverse((node) => {
    if (!isViewerLayoutProxyObject(node)) return;
    if (!(node instanceof THREE.Mesh)) return;
    const geometry = node.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const bb = geometry.boundingBox.clone();
    bb.applyMatrix4(node.matrixWorld);
    target.union(bb);
  });
  return !target.isEmpty();
}
