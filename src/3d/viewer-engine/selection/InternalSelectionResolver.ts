import * as THREE from "three";
import type { ViewerBoxEntry } from "../types";
import { distancePointToSegment2DSquared } from "../measurement/parametricDimensions";
import {
  getCavityCenterLocal,
  isPointInsideCavityLocal,
} from "./boxCavityBounds";
import {
  getMeshEdgeSegmentsLocal,
  getMeshFromRaycastObject,
  roundPointIdCoord,
  vec3ToPoint,
} from "../raycast/internalRaycastUtils";
import type { InternalSelectionHit, InternalSelectionPoint } from "./internalSelectionTypes";

const POINT_WORLD_THRESHOLD_M = 0.028;
const EDGE_MIN_WORLD_M = 0.001;
const EDGE_MIN_SCREEN_PX = 4;
const EDGE_MAX_SCREEN_PX_SQ = 12 * 12;
const FACE_NORMAL_DOT_THRESHOLD = 0.15;

const _worldNormal = new THREE.Vector3();
const _localNormal = new THREE.Vector3();
const _localHit = new THREE.Vector3();
const _cavityCenter = new THREE.Vector3();
const _toCavity = new THREE.Vector3();
const _tempA = new THREE.Vector3();
const _tempB = new THREE.Vector3();
const _tempC = new THREE.Vector3();
const _localVertex = new THREE.Vector3();

export type InternalPickContext = {
  getBoxEntry: (boxId: string) => ViewerBoxEntry | undefined;
  projectWorldToScreen: (world: THREE.Vector3) => { x: number; y: number } | null;
};

export function isInternalSelectableMesh(mesh: THREE.Mesh): boolean {
  const ud = mesh.userData ?? {};
  if (ud.viewerLayoutBounds === true) return false;
  if (ud.viewerPickBounds === true) return false;
  if (ud.isOrlaBand === true) return false;
  if (ud.isRematePiece === true || ud.remateId != null) return false;
  if (ud.isHematiPiece === true || ud.hematiId != null) return false;
  if (ud.isRodapePiece === true || ud.rodapeId != null) return false;
  if (ud.isDrillMarker === true) return false;
  if (ud.isPanelEdgeOverlay === true) return false;
  if (ud.isEdgeOutlineOverlay === true) return false;
  if (ud.isRoomElement === true) return false;
  if (ud.isKitchenFeet === true) return false;
  if (typeof ud.boxId !== "string" || ud.boxId.trim().length === 0) return false;

  if (ud.panelType != null) return true;
  if (ud.doorLayerId != null) return true;
  if (ud.drawerPart != null) return true;

  const name = typeof mesh.name === "string" ? mesh.name : "";
  if (name.startsWith("shelf-")) return true;
  if (name.startsWith("door-leaf-")) return true;
  if (name.startsWith("drawer-")) return true;
  return false;
}

export function isInternalFaceHit(
  hit: THREE.Intersection,
  boxRoot: THREE.Object3D,
  entry: ViewerBoxEntry
): boolean {
  const face = hit.face;
  if (!face) return false;
  const mesh = getMeshFromRaycastObject(hit.object);
  if (!mesh || !isInternalSelectableMesh(mesh)) return false;

  _worldNormal.copy(face.normal);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  _worldNormal.applyMatrix3(normalMatrix).normalize();

  _localHit.copy(hit.point);
  boxRoot.worldToLocal(_localHit);
  const cavityCenter = getCavityCenterLocal(entry);
  _cavityCenter.set(cavityCenter.x, cavityCenter.y, cavityCenter.z);
  _toCavity.subVectors(_cavityCenter, _localHit);

  if (_toCavity.lengthSq() < 1e-10) return isPointInsideCavityLocal(entry, _localHit);

  _toCavity.normalize();
  boxRoot.updateMatrixWorld(true);
  _localNormal.copy(_worldNormal);
  boxRoot.worldToLocal(_localNormal);
  if (_localNormal.lengthSq() > 1e-10) _localNormal.normalize();

  const dotWorld = _worldNormal.dot(_toCavity);
  if (dotWorld >= FACE_NORMAL_DOT_THRESHOLD) return true;

  return isPointInsideCavityLocal(entry, _localHit) && dotWorld > -0.05;
}

function resolvePanelId(mesh: THREE.Mesh, boxId: string): string | undefined {
  const panelId = mesh.userData?.panelId;
  if (typeof panelId === "string" && panelId.length > 0) return panelId;
  const panelType = mesh.userData?.panelType;
  if (typeof panelType === "string" && panelType.length > 0) return `${boxId}:${panelType}`;
  return undefined;
}

function buildFaceId(boxId: string, panelId: string | undefined, faceIndex: number): string {
  const base = panelId && panelId.length > 0 ? panelId : boxId;
  return `${boxId}:${base}:f${faceIndex}`;
}

function buildEdgeId(boxId: string, panelId: string | undefined, segmentIndex: number): string {
  const base = panelId && panelId.length > 0 ? panelId : boxId;
  return `${boxId}:${base}:e${segmentIndex}`;
}

function buildPointId(boxId: string, panelId: string | undefined, local: InternalSelectionPoint): string {
  const base = panelId && panelId.length > 0 ? panelId : boxId;
  return `${boxId}:${base}:p${roundPointIdCoord(local.x)},${roundPointIdCoord(local.y)},${roundPointIdCoord(local.z)}`;
}

type PointCandidate = {
  distanceM: number;
  world: THREE.Vector3;
  local: THREE.Vector3;
  mesh: THREE.Mesh;
  vertexIndex: number;
};

type EdgeCandidate = {
  distancePxSq: number;
  worldA: THREE.Vector3;
  worldB: THREE.Vector3;
  localA: THREE.Vector3;
  mesh: THREE.Mesh;
  segmentIndex: number;
};

function collectVertexCandidates(
  mesh: THREE.Mesh,
  boxRoot: THREE.Object3D,
  refWorld: THREE.Vector3,
  out: PointCandidate[]
): void {
  const geometry = mesh.geometry;
  if (!(geometry instanceof THREE.BufferGeometry)) return;
  const pos = geometry.getAttribute("position");
  if (!(pos instanceof THREE.BufferAttribute)) return;

  mesh.updateMatrixWorld(true);
  const threshold = POINT_WORLD_THRESHOLD_M;
  for (let i = 0; i < pos.count; i += 1) {
    _localVertex.fromBufferAttribute(pos, i);
    _tempA.copy(_localVertex).applyMatrix4(mesh.matrixWorld);
    if (_tempA.distanceTo(refWorld) > threshold) continue;
    _tempB.copy(_tempA);
    boxRoot.worldToLocal(_tempB);
    out.push({
      distanceM: _tempA.distanceTo(refWorld),
      world: _tempA.clone(),
      local: _tempB.clone(),
      mesh,
      vertexIndex: i,
    });
  }
}

function collectEdgeCandidates(
  mesh: THREE.Mesh,
  boxRoot: THREE.Object3D,
  entry: ViewerBoxEntry,
  event: { clientX: number; clientY: number },
  canvasRect: DOMRect,
  ctx: InternalPickContext,
  out: EdgeCandidate[]
): void {
  const geometry = mesh.geometry;
  if (!(geometry instanceof THREE.BufferGeometry)) return;
  if (!isInternalSelectableMesh(mesh)) return;

  const segments = getMeshEdgeSegmentsLocal(geometry);
  if (!segments.length) return;

  mesh.updateMatrixWorld(true);
  const cursorX = event.clientX - canvasRect.left;
  const cursorY = event.clientY - canvasRect.top;

  for (let i = 0; i < segments.length; i += 1) {
    _tempA.copy(segments[i].a).applyMatrix4(mesh.matrixWorld);
    _tempB.copy(segments[i].b).applyMatrix4(mesh.matrixWorld);
    const worldLen = _tempA.distanceTo(_tempB);
    if (worldLen < EDGE_MIN_WORLD_M) continue;

    const screenA = ctx.projectWorldToScreen(_tempA);
    const screenB = ctx.projectWorldToScreen(_tempB);
    if (!screenA || !screenB) continue;

    const segScreenLen = Math.hypot(screenA.x - screenB.x, screenA.y - screenB.y);
    if (segScreenLen < EDGE_MIN_SCREEN_PX) continue;

    const mid = _tempC.copy(_tempA).add(_tempB).multiplyScalar(0.5);
    boxRoot.worldToLocal(mid);
    if (!isPointInsideCavityLocal(entry, mid)) continue;

    const distancePxSq = distancePointToSegment2DSquared(
      cursorX,
      cursorY,
      screenA.x,
      screenA.y,
      screenB.x,
      screenB.y
    );
    if (distancePxSq > EDGE_MAX_SCREEN_PX_SQ) continue;

    out.push({
      distancePxSq,
      worldA: _tempA.clone(),
      worldB: _tempB.clone(),
      localA: boxRoot.worldToLocal(_tempA.clone()),
      mesh,
      segmentIndex: i,
    });
  }
}

/**
 * Resolve o melhor hit interno a partir de intersecções Three.js (caixas apenas).
 * Prioridade: ponto → aresta → face interna.
 */
export function resolveInternalSelectionHit(
  hits: THREE.Intersection[],
  event: { clientX: number; clientY: number },
  canvasRect: DOMRect,
  getBoxMesh: (boxId: string) => THREE.Object3D | null,
  ctx: InternalPickContext
): InternalSelectionHit | null {
  if (!hits.length || canvasRect.width <= 0 || canvasRect.height <= 0) return null;

  const pointCandidates: PointCandidate[] = [];
  const edgeCandidates: EdgeCandidate[] = [];
  const seenMeshes = new Set<string>();

  for (const hit of hits) {
    const mesh = getMeshFromRaycastObject(hit.object);
    if (!mesh || !isInternalSelectableMesh(mesh)) continue;

    const boxId = mesh.userData?.boxId as string | undefined;
    if (!boxId) continue;
    const boxRoot = getBoxMesh(boxId);
    const entry = ctx.getBoxEntry(boxId);
    if (!boxRoot || !entry) continue;

    collectVertexCandidates(mesh, boxRoot, hit.point, pointCandidates);

    const meshKey = mesh.uuid;
    if (!seenMeshes.has(meshKey)) {
      seenMeshes.add(meshKey);
      collectEdgeCandidates(mesh, boxRoot, entry, event, canvasRect, ctx, edgeCandidates);
    }
  }

  if (pointCandidates.length) {
    pointCandidates.sort((a, b) => a.distanceM - b.distanceM);
    const best = pointCandidates[0];
    const boxId = best.mesh.userData.boxId as string;
    const boxRoot = getBoxMesh(boxId);
    if (!boxRoot) return null;
    const panelId = resolvePanelId(best.mesh, boxId);
    const local = vec3ToPoint(best.local);
    return {
      type: "internal-point",
      boxId,
      panelId,
      pointId: buildPointId(boxId, panelId, local),
      worldPoint: vec3ToPoint(best.world),
      localPoint: local,
    };
  }

  if (edgeCandidates.length) {
    edgeCandidates.sort((a, b) => a.distancePxSq - b.distancePxSq);
    const best = edgeCandidates[0];
    const boxId = best.mesh.userData.boxId as string;
    const boxRoot = getBoxMesh(boxId);
    if (!boxRoot) return null;
    const panelId = resolvePanelId(best.mesh, boxId);
    const local = vec3ToPoint(boxRoot.worldToLocal(best.worldA.clone()));
    return {
      type: "internal-edge",
      boxId,
      panelId,
      edgeId: buildEdgeId(boxId, panelId, best.segmentIndex),
      worldPoint: vec3ToPoint(new THREE.Vector3().addVectors(best.worldA, best.worldB).multiplyScalar(0.5)),
      localPoint: local,
      worldEdgeStart: vec3ToPoint(best.worldA),
      worldEdgeEnd: vec3ToPoint(best.worldB),
    };
  }

  for (const hit of hits) {
    const mesh = getMeshFromRaycastObject(hit.object);
    if (!mesh || !isInternalSelectableMesh(mesh)) continue;
    const boxId = mesh.userData?.boxId as string | undefined;
    if (!boxId) continue;
    const boxRoot = getBoxMesh(boxId);
    const entry = ctx.getBoxEntry(boxId);
    if (!boxRoot || !entry) continue;
    if (!isInternalFaceHit(hit, boxRoot, entry)) continue;

    const panelId = resolvePanelId(mesh, boxId);
    const faceIndex = hit.faceIndex ?? 0;
    const local = vec3ToPoint(boxRoot.worldToLocal(hit.point.clone()));
    return {
      type: "internal-face",
      boxId,
      panelId,
      faceId: buildFaceId(boxId, panelId, faceIndex),
      worldPoint: vec3ToPoint(hit.point),
      localPoint: local,
    };
  }

  return null;
}
