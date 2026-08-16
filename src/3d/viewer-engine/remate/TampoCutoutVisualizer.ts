import * as THREE from "three";
import { CSG } from "three-csg-ts";
import type { TampoCutout } from "../../../core/remate/tampoCutouts";
import { isCircularTampoCutout, normalizeTampoCutout } from "../../../core/remate/tampoCutouts";

const CSG_EPSILON_M = 0.002;

/**
 * Constrói cutter local (metros), origem = centro do TAMPO.
 * Eixos alinhados a BoxGeometry / postforming: X=comprimento, Y=largura, Z=espessura.
 */
export function createTampoCutoutCutterMesh(cutout: TampoCutout): THREE.Mesh {
  const c = normalizeTampoCutout(cutout);
  const depthM = c.depth / 1000 + CSG_EPSILON_M * 2;
  let geom: THREE.BufferGeometry;
  if (isCircularTampoCutout(c.tipo)) {
    const r = Math.max(0.001, (Number(c.diameter) || 20) / 2000);
    // Cylinder default: eixo Y → rodar para eixo Z (espessura)
    geom = new THREE.CylinderGeometry(r, r, depthM, 32);
    geom.rotateX(Math.PI / 2);
  } else {
    const w = Math.max(0.001, (Number(c.width) || 20) / 1000);
    const h = Math.max(0.001, (Number(c.height) || 20) / 1000);
    geom = new THREE.BoxGeometry(w, h, depthM);
  }
  const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
  mesh.position.set(c.x / 1000, c.y / 1000, 0);
  mesh.updateMatrix();
  return mesh;
}

/**
 * Base postforming − Σ cutouts. Sem cutouts → geometria base (sem clone desnecessário se vazia).
 */
export function buildTampoGeometryWithCutouts(
  baseGeometry: THREE.BufferGeometry,
  cutouts: readonly TampoCutout[] | undefined
): THREE.BufferGeometry {
  if (!cutouts?.length) return baseGeometry;

  let currentGeom = baseGeometry;
  let ownsCurrent = false;

  for (const raw of cutouts) {
    const cutter = createTampoCutoutCutterMesh(raw);
    const sourceMesh = new THREE.Mesh(
      currentGeom,
      new THREE.MeshStandardMaterial()
    );
    sourceMesh.updateMatrix();
    cutter.updateMatrix();

    try {
      const carved = CSG.subtract(sourceMesh, cutter);
      if (!carved?.geometry) continue;
      carved.geometry.computeVertexNormals();
      if (!carved.geometry.attributes.uv2 && carved.geometry.attributes.uv) {
        carved.geometry.setAttribute("uv2", carved.geometry.attributes.uv.clone());
      }
      if (ownsCurrent) currentGeom.dispose();
      currentGeom = carved.geometry;
      ownsCurrent = true;
    } finally {
      cutter.geometry.dispose();
      if (Array.isArray(cutter.material)) cutter.material.forEach((m) => m.dispose());
      else cutter.material.dispose();
    }
  }

  return currentGeom;
}

export class TampoCutoutVisualizer {
  /** Aplica recortes CSG a um mesh base (substitui geometry). */
  static subtractCutouts(
    baseMesh: THREE.Mesh,
    cutouts: readonly TampoCutout[]
  ): THREE.BufferGeometry {
    const next = buildTampoGeometryWithCutouts(baseMesh.geometry, cutouts);
    if (next !== baseMesh.geometry) {
      baseMesh.geometry.dispose();
      baseMesh.geometry = next;
    }
    return baseMesh.geometry;
  }
}
