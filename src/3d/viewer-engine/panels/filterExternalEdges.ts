import * as THREE from "three";

const WELD_SCALE = 1e5;
const DEGENERATE_AREA_SQ = 1e-16;
const OUTWARD_EPS = 1e-8;

type FaceInfo = {
  normal: THREE.Vector3;
  outward: boolean;
};

type EdgeInfo = {
  a: number;
  b: number;
  faces: number[];
};

function weldKey(x: number, y: number, z: number): string {
  return `${Math.round(x * WELD_SCALE)}:${Math.round(y * WELD_SCALE)}:${Math.round(z * WELD_SCALE)}`;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Contorno só com arestas externas (silhueta).
 * Remove arestas CSG internas: uma face para fora e outra para dentro,
 * ou ambas para dentro (paredes do recorte).
 */
export function createExternalEdgesGeometry(
  geom: THREE.BufferGeometry,
  thresholdAngleDeg = 1
): THREE.BufferGeometry {
  const pos = geom.getAttribute("position");
  if (!pos || pos.count < 3) return new THREE.BufferGeometry();

  geom.computeBoundingBox();
  const origin = new THREE.Vector3();
  geom.boundingBox?.getCenter(origin);

  const index = geom.getIndex();
  const triCount = index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3);

  const vertexKeyToId = new Map<string, number>();
  const unique: number[] = [];

  const weld = (i: number): number => {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = weldKey(x, y, z);
    let id = vertexKeyToId.get(key);
    if (id === undefined) {
      id = unique.length / 3;
      vertexKeyToId.set(key, id);
      unique.push(x, y, z);
    }
    return id;
  };

  const faces: FaceInfo[] = [];
  const edges = new Map<string, EdgeInfo>();
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const toCentroid = new THREE.Vector3();

  for (let t = 0; t < triCount; t += 1) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const a = weld(i0);
    const b = weld(i1);
    const c = weld(i2);
    va.fromArray(unique, a * 3);
    vb.fromArray(unique, b * 3);
    vc.fromArray(unique, c * 3);
    ab.subVectors(vb, va);
    ac.subVectors(vc, va);
    const normal = new THREE.Vector3().crossVectors(ab, ac);
    if (normal.lengthSq() < DEGENERATE_AREA_SQ) continue;
    normal.normalize();
    centroid.copy(va).add(vb).add(vc).multiplyScalar(1 / 3);
    const outward = normal.dot(toCentroid.subVectors(centroid, origin)) >= -OUTWARD_EPS;
    const fi = faces.length;
    faces.push({ normal, outward });
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as Array<[number, number]>) {
      const k = edgeKey(u, v);
      let rec = edges.get(k);
      if (!rec) {
        rec = { a: u, b: v, faces: [] };
        edges.set(k, rec);
      }
      rec.faces.push(fi);
    }
  }

  const outwardCount = faces.reduce((n, f) => n + (f.outward ? 1 : 0), 0);
  if (faces.length > 0 && outwardCount < faces.length / 2) {
    for (const face of faces) face.outward = !face.outward;
  }

  const cosThreshold = Math.cos((Math.max(0, thresholdAngleDeg) * Math.PI) / 180);
  const segs: number[] = [];

  const pushEdge = (rec: EdgeInfo) => {
    const ax = unique[rec.a * 3];
    const ay = unique[rec.a * 3 + 1];
    const az = unique[rec.a * 3 + 2];
    const bx = unique[rec.b * 3];
    const by = unique[rec.b * 3 + 1];
    const bz = unique[rec.b * 3 + 2];
    segs.push(ax, ay, az, bx, by, bz);
  };

  const isSharpPair = (f0: FaceInfo, f1: FaceInfo): boolean => {
    const dot = THREE.MathUtils.clamp(f0.normal.dot(f1.normal), -1, 1);
    return dot <= cosThreshold;
  };

  for (const rec of edges.values()) {
    if (rec.faces.length === 0) continue;

    if (rec.faces.length === 1) {
      if (faces[rec.faces[0]].outward) pushEdge(rec);
      continue;
    }

    const adj = rec.faces.map((fi) => faces[fi]);
    if (!adj.every((f) => f.outward)) continue;

    let sharp = false;
    for (let i = 0; i < adj.length; i += 1) {
      for (let j = i + 1; j < adj.length; j += 1) {
        if (isSharpPair(adj[i], adj[j])) {
          sharp = true;
          break;
        }
      }
      if (sharp) break;
    }
    if (sharp) pushEdge(rec);
  }

  const out = new THREE.BufferGeometry();
  if (segs.length > 0) {
    out.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    out.computeBoundingSphere();
  }
  return out;
}

type Vec2 = { x: number; y: number };

/** 4 mm: bordo da silhueta vs recorte interno. */
const HOLE_BOUNDARY_EPS_M = 0.004;
const WELD_2D_SCALE = 1e4;

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-16) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToPolygon(p: Vec2, poly: Vec2[]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    min = Math.min(min, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  }
  return min;
}

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-16) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function project2d(x: number, y: number, z: number, axis: 0 | 1 | 2): Vec2 {
  if (axis === 2) return { x, y };
  if (axis === 0) return { x: y, y: z };
  return { x, y: z };
}

function dominantAxis(size: THREE.Vector3): 0 | 1 | 2 {
  if (size.z <= size.x && size.z <= size.y) return 2;
  if (size.x <= size.y) return 0;
  return 1;
}

function allProjectedVertices(geom: THREE.BufferGeometry, axis: 0 | 1 | 2): Vec2[] {
  const pos = geom.getAttribute("position");
  if (!pos) return [];
  const seen = new Set<string>();
  const pts: Vec2[] = [];
  for (let i = 0; i < pos.count; i += 1) {
    const p = project2d(pos.getX(i), pos.getY(i), pos.getZ(i), axis);
    const key = `${Math.round(p.x * WELD_2D_SCALE)}:${Math.round(p.y * WELD_2D_SCALE)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pts.push(p);
  }
  return pts;
}

function buildOuterPolygon(geom: THREE.BufferGeometry): { axis: 0 | 1 | 2; poly: Vec2[] } | null {
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return null;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const axis = dominantAxis(size);
  const poly = convexHull(allProjectedVertices(geom, axis));
  if (poly.length < 3) return null;
  return { axis, poly };
}

/**
 * Remove arestas cujo ponto médio está no interior do polígono exterior (convex hull).
 * O recorte fogão/pia fica de fora da silhueta.
 */
export function filterInteriorHoles(
  edges: THREE.BufferGeometry,
  geom: THREE.BufferGeometry
): THREE.BufferGeometry {
  const pos = edges.getAttribute("position");
  if (!pos || pos.count < 2) return edges;

  const outer = buildOuterPolygon(geom);
  if (!outer) return edges;

  const segs: number[] = [];
  for (let v = 0; v + 1 < pos.count; v += 2) {
    const ax = pos.getX(v);
    const ay = pos.getY(v);
    const az = pos.getZ(v);
    const bx = pos.getX(v + 1);
    const by = pos.getY(v + 1);
    const bz = pos.getZ(v + 1);
    const mid = project2d((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5, outer.axis);
    const dist = distToPolygon(mid, outer.poly);
    if (dist <= HOLE_BOUNDARY_EPS_M) {
      segs.push(ax, ay, az, bx, by, bz);
      continue;
    }
    if (!pointInPolygon(mid, outer.poly)) {
      segs.push(ax, ay, az, bx, by, bz);
    }
  }

  const out = new THREE.BufferGeometry();
  if (segs.length > 0) {
    out.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    out.computeBoundingSphere();
  }
  return out;
}

/** Silhueta: filtro de normals + polígono exterior (TAMPO com recortes). */
export function createSilhouetteEdgesGeometry(
  geom: THREE.BufferGeometry,
  thresholdAngleDeg = 1
): THREE.BufferGeometry {
  const external = createExternalEdgesGeometry(geom, thresholdAngleDeg);
  const silhouette = filterInteriorHoles(external, geom);
  if (silhouette !== external) external.dispose();
  return silhouette;
}

/**
 * Filtra arestas internas de um EdgesGeometry usando as faces da malha fonte.
 * A fonte de verdade é `geom` (adjacência de faces); `edges` só define o threshold já aplicado.
 */
export function filterExternalEdges(
  edges: THREE.BufferGeometry,
  geom: THREE.BufferGeometry,
  thresholdAngleDeg = 1
): THREE.BufferGeometry {
  const filtered = createSilhouetteEdgesGeometry(geom, thresholdAngleDeg);
  edges.dispose();
  return filtered;
}
