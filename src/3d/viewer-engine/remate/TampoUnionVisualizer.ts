import * as THREE from "three";
import { CSG } from "three-csg-ts";
import type { TampoUnion } from "../../../core/remate/tampoUnion";
import { normalizeTampoUnion } from "../../../core/remate/tampoUnion";

const CSG_EPSILON_M = 0.002;

export type TampoExtentsM = { w: number; h: number; d: number };

/**
 * Cutter local (m) na aresta de união do tampo A.
 * X=comprimento, Y=largura(630), Z=espessura(30). FRONT=+Y (postforming).
 */
export function createTampoUnionCutterMesh(
  union: TampoUnion,
  extentsM: TampoExtentsM
): THREE.Mesh {
  const u = normalizeTampoUnion(union);
  const o = Math.max(0.001, u.overlapMm / 1000);
  const { w, h, d } = extentsM;
  const depthZ = d + CSG_EPSILON_M * 2;

  let geom: THREE.BufferGeometry;
  let x = 0;
  let y = 0;

  switch (u.direction) {
    case "LEFT":
      geom = new THREE.BoxGeometry(o, h + CSG_EPSILON_M * 2, depthZ);
      x = -w / 2 + o / 2;
      break;
    case "RIGHT":
      geom = new THREE.BoxGeometry(o, h + CSG_EPSILON_M * 2, depthZ);
      x = w / 2 - o / 2;
      break;
    case "FRONT":
      geom = new THREE.BoxGeometry(w + CSG_EPSILON_M * 2, o, depthZ);
      y = h / 2 - o / 2;
      break;
    case "BACK":
      geom = new THREE.BoxGeometry(w + CSG_EPSILON_M * 2, o, depthZ);
      y = -h / 2 + o / 2;
      break;
    default:
      geom = new THREE.BoxGeometry(o, h, depthZ);
      x = -w / 2 + o / 2;
  }

  const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
  mesh.position.set(x, y, 0);
  mesh.updateMatrix();
  return mesh;
}

/** base − cutter. Sem union → devolve base. */
export function applyTampoUnion(
  baseGeometry: THREE.BufferGeometry,
  union: TampoUnion | null | undefined,
  extentsM: TampoExtentsM
): THREE.BufferGeometry {
  if (!union) return baseGeometry;

  const cutter = createTampoUnionCutterMesh(union, extentsM);
  const sourceMesh = new THREE.Mesh(baseGeometry, new THREE.MeshStandardMaterial());
  sourceMesh.updateMatrix();
  cutter.updateMatrix();

  try {
    const carved = CSG.subtract(sourceMesh, cutter);
    if (!carved?.geometry) return baseGeometry;
    carved.geometry.computeVertexNormals();
    if (!carved.geometry.attributes.uv2 && carved.geometry.attributes.uv) {
      carved.geometry.setAttribute("uv2", carved.geometry.attributes.uv.clone());
    }
    return carved.geometry;
  } finally {
    cutter.geometry.dispose();
    if (Array.isArray(cutter.material)) cutter.material.forEach((m) => m.dispose());
    else cutter.material.dispose();
  }
}

export class TampoUnionVisualizer {
  static subtractUnion(
    baseMesh: THREE.Mesh,
    union: TampoUnion | null | undefined,
    extentsM: TampoExtentsM
  ): THREE.BufferGeometry {
    const next = applyTampoUnion(baseMesh.geometry, union, extentsM);
    if (next !== baseMesh.geometry) {
      baseMesh.geometry.dispose();
      baseMesh.geometry = next;
    }
    return baseMesh.geometry;
  }
}
