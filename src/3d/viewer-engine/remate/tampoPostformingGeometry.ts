import * as THREE from "three";

/** Raio postforming frontal (mm). ∈ [10, 12]. */
export const TAMPO_POSTFORM_RADIUS_MM = 11;
export const TAMPO_POSTFORM_RADIUS_M = TAMPO_POSTFORM_RADIUS_MM / 1000;

/**
 * Geometria centrada como BoxGeometry(w, h, d):
 *  w = comprimento, h = largura 630 mm, d = espessura 30 mm
 * Postforming só na aresta frontal-superior (local +Y / +Z do perfil).
 * Sem cantos laterais arredondados. Sem recortes.
 */
export function createTampoPostformingGeometry(
  w: number,
  h: number,
  d: number,
  radiusM: number = TAMPO_POSTFORM_RADIUS_M
): THREE.ExtrudeGeometry {
  const safeW = Math.max(0.001, w);
  const safeH = Math.max(0.001, h);
  const safeD = Math.max(0.001, d);
  const R = Math.min(Math.max(0, radiusM), safeD / 2 - 1e-4, safeH / 2 - 1e-4);

  // Perfil no plano Shape(X=profundidade h, Y=espessura d); extrudir em comprimento w
  const y0 = -safeH / 2;
  const y1 = safeH / 2;
  const z0 = -safeD / 2;
  const z1 = safeD / 2;

  const shape = new THREE.Shape();
  // Frente = +X do Shape (= +Y após rotação) — lado do utilizador / face FRENTE
  shape.moveTo(y0, z0);
  shape.lineTo(y1, z0);
  shape.lineTo(y1, z1 - R);
  shape.absarc(y1 - R, z1 - R, R, 0, Math.PI / 2, false);
  shape.lineTo(y0, z1);
  shape.lineTo(y0, z0);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: safeW,
    bevelEnabled: false,
    curveSegments: 12,
  });
  // Extrude: (h, d, w) → BoxGeometry(w, h, d)
  geom.rotateY(-Math.PI / 2);
  geom.rotateX(Math.PI / 2);
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  geom.translate(-cx, -cy, -cz);
  return geom;
}

/** Confirma envelope ≈ w×h×d (tolerância em metros). */
export function assertTampoExtentsApprox(
  geom: THREE.BufferGeometry,
  w: number,
  h: number,
  d: number,
  eps = 0.002
): boolean {
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return false;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  return Math.abs(sx - w) < eps && Math.abs(sy - h) < eps && Math.abs(sz - d) < eps;
}
