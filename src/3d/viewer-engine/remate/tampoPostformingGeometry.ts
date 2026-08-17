import * as THREE from "three";
import { CSG } from "three-csg-ts";

/** Raio postforming frontal (mm). ∈ [10, 12]. */
export const TAMPO_POSTFORM_RADIUS_MM = 11;
export const TAMPO_POSTFORM_RADIUS_M = TAMPO_POSTFORM_RADIUS_MM / 1000;

/**
 * Geometria centrada como BoxGeometry(w, h, d):
 *  w = comprimento, h = largura 630 mm, d = espessura 30 mm
 * Postforming só na aresta frontal-superior (local +Y / +Z do perfil).
 * Sem cantos laterais arredondados. Sem recortes.
 *
 * Caminho retangular Fase 2 — NÃO alterar (zero regressão).
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

/** Aresta frontal da planta (+Y): o cutter CSG não pode cobrir o envelope traseiro. */
function frontEdgeFromPlanShape(planShape: THREE.Shape): { minX: number; maxX: number; frontY: number } {
  const pts = planShape.getPoints();
  let frontY = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    if (p.y > frontY) frontY = p.y;
  }
  const yEps = 0.002;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    if (Math.abs(p.y - frontY) <= yEps) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
    }
  }
  return { minX, maxX, frontY };
}

/**
 * Extrude planta (Shape XY, metros) + espessura Z.
 * Postforming na aresta frontal (+Y) via CSG (¼ cilindro).
 * Usado quando angleConfig está activo; caminho retangular mantém createTampoPostformingGeometry.
 */
export function createTampoPostformingGeometryFromShape(
  planShape: THREE.Shape,
  thicknessM: number,
  radiusM: number = TAMPO_POSTFORM_RADIUS_M
): THREE.BufferGeometry {
  const safeD = Math.max(0.001, thicknessM);
  const R = Math.min(Math.max(0, radiusM), safeD / 2 - 1e-4);
  const frontEdge = frontEdgeFromPlanShape(planShape);

  let geom: THREE.BufferGeometry = new THREE.ExtrudeGeometry(planShape, {
    depth: safeD,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geom.translate(0, 0, -safeD / 2);
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  if (!bb) return geom;

  const spanX = Number.isFinite(frontEdge.minX) && Number.isFinite(frontEdge.maxX)
    ? Math.max(0.001, frontEdge.maxX - frontEdge.minX)
    : bb.max.x - bb.min.x;
  const midX = Number.isFinite(frontEdge.minX) && Number.isFinite(frontEdge.maxX)
    ? (frontEdge.minX + frontEdge.maxX) / 2
    : (bb.min.x + bb.max.x) / 2;
  const frontY = Number.isFinite(frontEdge.frontY) ? frontEdge.frontY : bb.max.y;
  const topZ = bb.max.z;

  // ¼ cilindro ao longo de X na aresta frente-topo (+Y, +Z)
  const cyl = new THREE.CylinderGeometry(R, R, spanX + 0.004, 16, 1, false, 0, Math.PI / 2);
  cyl.rotateZ(Math.PI / 2);
  const cutter = new THREE.Mesh(cyl, new THREE.MeshStandardMaterial());
  cutter.position.set(midX, frontY - R, topZ - R);
  cutter.updateMatrix();

  const source = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
  source.updateMatrix();

  try {
    const carved = CSG.subtract(source, cutter);
    if (carved?.geometry) {
      carved.geometry.computeBoundingBox();
      const carvedBb = carved.geometry.boundingBox;
      const origX = bb.max.x - bb.min.x;
      const origY = bb.max.y - bb.min.y;
      const carvedX = carvedBb ? carvedBb.max.x - carvedBb.min.x : 0;
      const carvedY = carvedBb ? carvedBb.max.y - carvedBb.min.y : 0;
      const collapsed = carvedX < origX * 0.5 || carvedY < origY * 0.5;
      if (!collapsed) {
        geom.dispose();
        geom = carved.geometry;
        geom.computeVertexNormals();
        if (!geom.attributes.uv2 && geom.attributes.uv) {
          geom.setAttribute("uv2", geom.attributes.uv.clone());
        }
      } else {
        carved.geometry.dispose();
      }
    }
  } finally {
    cyl.dispose();
    if (Array.isArray(cutter.material)) cutter.material.forEach((m) => m.dispose());
    else cutter.material.dispose();
  }

  geom.computeBoundingBox();
  const bb2 = geom.boundingBox!;
  const cx = (bb2.min.x + bb2.max.x) / 2;
  const cy = (bb2.min.y + bb2.max.y) / 2;
  const cz = (bb2.min.z + bb2.max.z) / 2;
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
