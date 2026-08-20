import * as THREE from "three";
import type { ViewerBoxEntry } from "../types";
import {
  getMeshEdgeSegmentsLocal,
  getMeshFromRaycastObject,
} from "../raycast/internalRaycastUtils";
import { closestPointOnSegment3D } from "./parametricDimensions";
import { filterTechnicalDrillHolesForViewerMesh } from "../drill/viewerCncDrillFilter";
import { holeCenterLocal, type HolePanelType } from "./panelHoleGeometry";
import type { TechnicalDrillHole } from "../../../core/types";
import {
  surfaceNormalAt,
  surfaceTangentAt,
  type MeasurementSnapGeometry,
  type SnapSurfaceKind,
} from "./measurementGeometry";

/**
 * Serviço único de snapping/picking para medição.
 * Substitui os pickers dispersos (InternalRuler, ViewerMeasurementOverlay, getPointerWorldHit)
 * por um único ponto de verdade. Thresholds em PIXELS de ecrã (estáveis com zoom).
 */

export type MeasurementSnapKind =
  | "vertex"
  | "edgeMid"
  | "edge"
  | "faceCenter"
  | "face"
  | "holeCenter"
  | "pieceCenter"
  | "axis"
  | "free";

export type MeasurementSnapRef = {
  boxId?: string;
  meshUuid?: string;
  /** Coordenada local à raiz da caixa (m), quando o ponto pertence a uma caixa. */
  local?: { x: number; y: number; z: number };
};

export type MeasurementSnapResult = {
  world: THREE.Vector3;
  kind: MeasurementSnapKind;
  ref: MeasurementSnapRef;
  screen: { x: number; y: number };
  geometry?: MeasurementSnapGeometry;
};

export type MeasurementSnapAnchor = {
  world: THREE.Vector3;
  boxId?: string;
  local?: { x: number; y: number; z: number };
};

export type MeasurementSnapDeps = {
  getCamera: () => THREE.Camera;
  getCanvas: () => HTMLCanvasElement;
  getBoxes: () => Map<string, ViewerBoxEntry>;
  getRoomWalls: () => Array<{ mesh: THREE.Object3D }>;
  projectWorldToScreen: (_world: THREE.Vector3) => { x: number; y: number } | null;
};

export type MeasurementSnapConfig = {
  vertexPx: number;
  holeCenterPx: number;
  edgeMidPx: number;
  edgePx: number;
  faceCenterPx: number;
  pieceCenterPx: number;
  axisPx: number;
};

export const DEFAULT_MEASUREMENT_SNAP_CONFIG: MeasurementSnapConfig = {
  vertexPx: 14,
  holeCenterPx: 16,
  edgeMidPx: 12,
  edgePx: 10,
  faceCenterPx: 16,
  pieceCenterPx: 20,
  axisPx: 12,
};

const PRIORITY: Record<MeasurementSnapKind, number> = {
  holeCenter: 0,
  vertex: 1,
  edgeMid: 2,
  edge: 3,
  faceCenter: 4,
  pieceCenter: 5,
  axis: 6,
  face: 7,
  free: 8,
};

type Candidate = {
  kind: MeasurementSnapKind;
  world: THREE.Vector3;
  thresholdPx: number;
  edgeA?: THREE.Vector3;
  edgeB?: THREE.Vector3;
};

const _pointer = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
const _localVertex = new THREE.Vector3();
const _box3 = new THREE.Box3();

function resolveBoxIdFromObject(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const id = current.userData?.boxId;
    if (typeof id === "string" && id.length > 0) return id;
    current = current.parent;
  }
  return null;
}

function isProxyMesh(mesh: THREE.Object3D): boolean {
  const ud = mesh.userData ?? {};
  return (
    ud.viewerLayoutBounds === true ||
    ud.viewerPickBounds === true ||
    ud.isDrillMarker === true ||
    ud.isPanelEdgeOverlay === true ||
    ud.isEdgeOutlineOverlay === true ||
    ud.isIndustrialDesignHoleOverlay === true
  );
}

function getMeshBoundingSize(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  const size = new THREE.Vector3(0.001, 0.001, 0.001);
  if (bb) bb.getSize(size);
  size.x = Math.max(0.001, size.x);
  size.y = Math.max(0.001, size.y);
  size.z = Math.max(0.001, size.z);
  return size;
}

/** Mapeia um mesh de painel para (tipo de geometria de furo, lista de furos, dimensões). */
function resolvePanelHoleSource(
  mesh: THREE.Mesh,
  entry: ViewerBoxEntry
): { panelType: HolePanelType; holes: TechnicalDrillHole[]; width: number; height: number; depth: number } | null {
  const name = typeof mesh.name === "string" ? mesh.name : "";
  const drill = entry.drillMarkersByPanel;
  const carcassDepth = entry.carcassDepth ?? entry.depth;

  if (name === "top") return { panelType: "top", holes: drill?.cima ?? [], width: entry.width, height: entry.height, depth: carcassDepth };
  if (name === "bottom") return { panelType: "bottom", holes: drill?.fundo ?? [], width: entry.width, height: entry.height, depth: carcassDepth };
  if (name === "left") return { panelType: "left", holes: drill?.lateral_esquerda ?? [], width: entry.width, height: entry.height, depth: carcassDepth };
  if (name === "right") return { panelType: "right", holes: drill?.lateral_direita ?? [], width: entry.width, height: entry.height, depth: carcassDepth };

  if (name === "frente-fixa") {
    const size = getMeshBoundingSize(mesh);
    return { panelType: "front", holes: drill?.frente_fixa ?? [], width: size.x, height: size.y, depth: size.z };
  }

  const isDoorLikeFront =
    name.startsWith("door-leaf-") ||
    mesh.userData?.doorLayerId != null ||
    mesh.userData?.drawerPart === "front";
  if (isDoorLikeFront) {
    const raw = mesh.userData?.doorHolesEffective;
    const holes = Array.isArray(raw)
      ? (raw.filter((h) => h && Number.isFinite(h.x) && Number.isFinite(h.y)) as TechnicalDrillHole[])
      : [];
    const size = getMeshBoundingSize(mesh);
    return { panelType: "front", holes, width: size.x, height: size.y, depth: size.z };
  }

  return null;
}

/** Recolhe centros de furo (mundo) da caixa atingida — dentro e fora do modo Industrial. */
function collectBoxHoleWorldCenters(boxRoot: THREE.Object3D, entry: ViewerBoxEntry): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  boxRoot.updateMatrixWorld(true);
  boxRoot.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (isProxyMesh(node)) return;
    const source = resolvePanelHoleSource(node, entry);
    if (!source) return;
    const holes = filterTechnicalDrillHolesForViewerMesh(source.holes);
    if (!holes.length) return;
    node.updateMatrixWorld(true);
    for (const hole of holes) {
      if (hole.holeSubtype === "groove") continue;
      const local = holeCenterLocal(source.panelType, source.width, source.height, source.depth, hole);
      const world = _tmpA.set(local.x, local.y, local.z).applyMatrix4(node.matrixWorld).clone();
      out.push(world);
    }
  });
  return out;
}

function pushIfWithinThreshold(
  candidates: Candidate[],
  best: { candidate: Candidate | null; score: number },
  cursor: { x: number; y: number },
  project: (_w: THREE.Vector3) => { x: number; y: number } | null,
  candidate: Candidate
): void {
  const screen = project(candidate.world);
  if (!screen) return;
  const dpx = Math.hypot(screen.x - cursor.x, screen.y - cursor.y);
  if (dpx > candidate.thresholdPx) return;
  candidates.push(candidate);
  // Score: prioridade domina; distância em px desempata.
  const score = PRIORITY[candidate.kind] * 100000 + dpx;
  if (!best.candidate || score < best.score) {
    best.candidate = candidate;
    best.score = score;
  }
}

/**
 * Devolve o melhor ponto de snap para o cursor, ou `null` se nada for atingido.
 * `anchor` (primeiro ponto) activa o snap de eixo relativo.
 */
export function pickMeasurementSnap(
  event: { clientX: number; clientY: number },
  deps: MeasurementSnapDeps,
  anchor?: MeasurementSnapAnchor | null,
  config: MeasurementSnapConfig = DEFAULT_MEASUREMENT_SNAP_CONFIG
): MeasurementSnapResult | null {
  const canvas = deps.getCanvas();
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  _pointer.set((cursor.x / rect.width) * 2 - 1, -(cursor.y / rect.height) * 2 + 1);
  _raycaster.setFromCamera(_pointer, deps.getCamera());
  _raycaster.layers.set(0);

  const roots: THREE.Object3D[] = [];
  deps.getBoxes().forEach((entry) => roots.push(entry.mesh));
  deps.getRoomWalls().forEach((w) => roots.push(w.mesh));
  if (!roots.length) return null;

  const hits = _raycaster.intersectObjects(roots, true);
  const hit = hits.find((h) => {
    const m = getMeshFromRaycastObject(h.object);
    return m != null && !isProxyMesh(m);
  });
  if (!hit) return null;

  const hitMesh = getMeshFromRaycastObject(hit.object);
  if (!hitMesh) return null;
  const facePoint = hit.point.clone();

  const boxId = resolveBoxIdFromObject(hit.object);
  const entry = boxId ? deps.getBoxes().get(boxId) ?? null : null;
  const boxRoot = entry ? entry.mesh : null;

  const candidates: Candidate[] = [];
  const best: { candidate: Candidate | null; score: number } = { candidate: null, score: Infinity };
  const project = deps.projectWorldToScreen;

  hitMesh.updateMatrixWorld(true);
  const geometry = hitMesh.geometry;

  if (geometry instanceof THREE.BufferGeometry) {
    const pos = geometry.getAttribute("position");
    if (pos instanceof THREE.BufferAttribute) {
      for (let i = 0; i < pos.count; i += 1) {
        _localVertex.fromBufferAttribute(pos, i);
        const world = _localVertex.clone().applyMatrix4(hitMesh.matrixWorld);
        pushIfWithinThreshold(candidates, best, cursor, project, { kind: "vertex", world, thresholdPx: config.vertexPx });
      }
    }

    const segments = getMeshEdgeSegmentsLocal(geometry);
    for (const seg of segments) {
      _tmpA.copy(seg.a).applyMatrix4(hitMesh.matrixWorld);
      _tmpB.copy(seg.b).applyMatrix4(hitMesh.matrixWorld);
      const mid = _tmpC.copy(_tmpA).add(_tmpB).multiplyScalar(0.5).clone();
      const edgeA = _tmpA.clone();
      const edgeB = _tmpB.clone();
      pushIfWithinThreshold(candidates, best, cursor, project, {
        kind: "edgeMid",
        world: mid,
        thresholdPx: config.edgeMidPx,
        edgeA,
        edgeB,
      });
      const closest = closestPointOnSegment3D(
        { x: facePoint.x, y: facePoint.y, z: facePoint.z },
        { x: _tmpA.x, y: _tmpA.y, z: _tmpA.z },
        { x: _tmpB.x, y: _tmpB.y, z: _tmpB.z }
      );
      pushIfWithinThreshold(candidates, best, cursor, project, {
        kind: "edge",
        world: new THREE.Vector3(closest.x, closest.y, closest.z),
        thresholdPx: config.edgePx,
        edgeA,
        edgeB,
      });
    }
  }

  // Centro da face atingida
  if (hit.face && geometry instanceof THREE.BufferGeometry) {
    const pos = geometry.getAttribute("position");
    if (pos instanceof THREE.BufferAttribute) {
      const va = _tmpA.fromBufferAttribute(pos, hit.face.a).applyMatrix4(hitMesh.matrixWorld).clone();
      const vb = _tmpB.fromBufferAttribute(pos, hit.face.b).applyMatrix4(hitMesh.matrixWorld).clone();
      const vc = _tmpC.fromBufferAttribute(pos, hit.face.c).applyMatrix4(hitMesh.matrixWorld).clone();
      const center = va.add(vb).add(vc).multiplyScalar(1 / 3);
      pushIfWithinThreshold(candidates, best, cursor, project, { kind: "faceCenter", world: center, thresholdPx: config.faceCenterPx });
    }
  }

  // Centro geométrico da peça atingida
  if (!isProxyMesh(hitMesh)) {
    _box3.setFromObject(hitMesh);
    if (!_box3.isEmpty()) {
      const center = _box3.getCenter(new THREE.Vector3());
      pushIfWithinThreshold(candidates, best, cursor, project, { kind: "pieceCenter", world: center, thresholdPx: config.pieceCenterPx });
    }
  }

  // Centros de furos da caixa atingida
  if (boxRoot && entry) {
    const holeCenters = collectBoxHoleWorldCenters(boxRoot, entry);
    for (const world of holeCenters) {
      pushIfWithinThreshold(candidates, best, cursor, project, { kind: "holeCenter", world, thresholdPx: config.holeCenterPx });
    }
  }

  // Snap de eixo relativo à âncora (primeiro ponto)
  if (anchor) {
    const axisPoints = [
      new THREE.Vector3(facePoint.x, anchor.world.y, anchor.world.z),
      new THREE.Vector3(anchor.world.x, facePoint.y, anchor.world.z),
      new THREE.Vector3(anchor.world.x, anchor.world.y, facePoint.z),
    ];
    for (const world of axisPoints) {
      pushIfWithinThreshold(candidates, best, cursor, project, { kind: "axis", world, thresholdPx: config.axisPx });
    }
  }

  const chosen = best.candidate;
  const world = chosen ? chosen.world.clone() : facePoint.clone();
  const kind: MeasurementSnapKind = chosen ? chosen.kind : "free";

  const ref: MeasurementSnapRef = { meshUuid: hitMesh.uuid };
  if (boxId && boxRoot) {
    ref.boxId = boxId;
    boxRoot.updateMatrixWorld(true);
    ref.local = { ...vec3ToPlain(boxRoot.worldToLocal(world.clone())) };
  }

  const screen = project(world) ?? { x: cursor.x, y: cursor.y };

  const faceNormal = surfaceNormalAt(hitMesh, hit.face);
  const edgeA = chosen?.edgeA ?? null;
  const edgeB = chosen?.edgeB ?? null;
  const tangent = surfaceTangentAt(faceNormal, edgeA, edgeB);
  let surfaceKind: SnapSurfaceKind = "free";
  if (kind === "holeCenter") surfaceKind = "hole";
  else if (kind === "edge" || kind === "edgeMid") surfaceKind = "edge";
  else if (faceNormal) {
    const geo = hitMesh.geometry;
    surfaceKind =
      geo instanceof THREE.CylinderGeometry || geo instanceof THREE.SphereGeometry
        ? "curved"
        : "planar";
  }
  const snapGeometry: MeasurementSnapGeometry = {
    surfaceKind,
    meshUuid: hitMesh.uuid,
    normal: faceNormal ? { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z } : undefined,
    tangent: tangent ? { x: tangent.x, y: tangent.y, z: tangent.z } : undefined,
    edgeA: edgeA ? { x: edgeA.x, y: edgeA.y, z: edgeA.z } : undefined,
    edgeB: edgeB ? { x: edgeB.x, y: edgeB.y, z: edgeB.z } : undefined,
  };

  return { world, kind, ref, screen, geometry: snapGeometry };
}

function vec3ToPlain(v: THREE.Vector3): { x: number; y: number; z: number } {
  return { x: v.x, y: v.y, z: v.z };
}
