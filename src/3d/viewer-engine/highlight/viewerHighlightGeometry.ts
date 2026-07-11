/**
 * SSOT visual — contornos de peça e círculos de furo face-aware para o viewer 3D.
 * Alinhado com DrillGeometryBuilder (entrada/eixo de perfuração).
 */

import * as THREE from "three";
import type { TechnicalDrillHole } from "../../../core/types";
import type { PanelType } from "../../objects/PanelFactory";
import {
  getHole2DLocalPosition,
  lateralDrillEntryXM,
} from "../../objects/DrillGeometryBuilder";

export type PanelOutlineKind = PanelType | "front";

export type PanelOutlineDims = {
  width: number;
  height: number;
  thickness: number;
  depth?: number;
};

export const HOLE_CIRCLE_SEGMENTS = 16;
export const OVERLAY_INSET_M = 0.00015;
export const DEFAULT_CARCASS_THICKNESS_M = 0.019;
export const PANEL_BACK_THICKNESS_M = 0.01;

export type HoleDrillFrame = {
  entry: THREE.Vector3;
  axisInward: THREE.Vector3;
};

/** Resolve ponto de entrada e eixo de perfuração (espelha DrillGeometryBuilder). */
export function resolveHoleDrillEntryFrame(
  panelType: PanelOutlineKind,
  dims: PanelOutlineDims,
  hole: TechnicalDrillHole
): HoleDrillFrame | null {
  const { width, height, thickness } = dims;
  if (width <= 0 || height <= 0 || thickness <= 0) return null;

  const { a, b } = getHole2DLocalPosition(panelType as PanelType, width, height, hole);
  const entryOffset = thickness / 2;
  const entry = new THREE.Vector3();
  let axisInward: THREE.Vector3;

  if (panelType === "top" || panelType === "bottom") {
    if (hole.face === "esquerda" || hole.face === "direita") {
      const fromLeft = hole.face === "esquerda";
      entry.set(fromLeft ? -width / 2 : width / 2, 0, b);
      axisInward = fromLeft ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-1, 0, 0);
    } else if (hole.face === "fundo") {
      entry.set(a, -entryOffset, b);
      axisInward = new THREE.Vector3(0, 1, 0);
    } else if (hole.face === "cima") {
      entry.set(a, entryOffset, b);
      axisInward = new THREE.Vector3(0, -1, 0);
    } else if (panelType === "top") {
      entry.set(a, -entryOffset, b);
      axisInward = new THREE.Vector3(0, 1, 0);
    } else {
      entry.set(a, entryOffset, b);
      axisInward = new THREE.Vector3(0, -1, 0);
    }
  } else if (panelType === "front") {
    const depth = dims.depth ?? height;
    const drillFromFront = hole.face === "frente";
    if (drillFromFront) {
      entry.set(a, b, depth / 2);
      axisInward = new THREE.Vector3(0, 0, -1);
    } else {
      entry.set(a, b, -depth / 2);
      axisInward = new THREE.Vector3(0, 0, 1);
    }
  } else if (panelType === "left" || panelType === "right") {
    const entryX = lateralDrillEntryXM(panelType, thickness);
    entry.set(entryX, b, a);
    axisInward = new THREE.Vector3(Math.sign(-entryX) || 1, 0, 0);
  } else {
    entry.set(a, b, entryOffset);
    axisInward = new THREE.Vector3(0, 0, -1);
  }

  return { entry, axisInward: axisInward.normalize() };
}

function pushSegment(
  segs: number[],
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
): void {
  segs.push(x1, y1, z1, x2, y2, z2);
}

function segmentsToGeometry(segs: number[]): THREE.BufferGeometry | null {
  if (!segs.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
  geo.computeBoundingSphere();
  return geo;
}

function buildCircleSegmentsOnPlane(
  center: THREE.Vector3,
  axisInward: THREE.Vector3,
  radius: number,
  segments: number
): number[] {
  const axis = axisInward.clone().normalize();
  let u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(axis.dot(u)) > 0.9) u.set(0, 1, 0);
  u.sub(axis.clone().multiplyScalar(u.dot(axis))).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();

  const outward = axis.clone().multiplyScalar(-OVERLAY_INSET_M);
  const c = center.clone().add(outward);
  const out: number[] = [];

  for (let i = 0; i < segments; i += 1) {
    const t0 = (i * 2 * Math.PI) / segments;
    const t1 = ((i + 1) * 2 * Math.PI) / segments;
    const p0 = c
      .clone()
      .add(u.clone().multiplyScalar(radius * Math.cos(t0)))
      .add(v.clone().multiplyScalar(radius * Math.sin(t0)));
    const p1 = c
      .clone()
      .add(u.clone().multiplyScalar(radius * Math.cos(t1)))
      .add(v.clone().multiplyScalar(radius * Math.sin(t1)));
    pushSegment(out, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
  }
  return out;
}

/** Contorno da peça — sem furos (cada furo é um LineSegments separado). */
export function createPanelContourGeometry(
  panelType: PanelOutlineKind,
  dims: PanelOutlineDims
): THREE.BufferGeometry | null {
  const t = dims.thickness;
  const bt = PANEL_BACK_THICKNESS_M;
  const width = dims.width;
  const height = dims.height;
  const depth = dims.depth ?? height;
  const sideH = Math.max(0.001, height - 2 * DEFAULT_CARCASS_THICKNESS_M);
  const segs: number[] = [];

  if (panelType === "top") {
    const w2 = width / 2;
    const d2 = height / 2;
    const y0 = -t / 2 - OVERLAY_INSET_M;
    pushSegment(segs, -w2, y0, -d2, w2, y0, -d2);
    pushSegment(segs, w2, y0, -d2, w2, y0, d2);
    pushSegment(segs, w2, y0, d2, -w2, y0, d2);
    pushSegment(segs, -w2, y0, d2, -w2, y0, -d2);
  } else if (panelType === "bottom") {
    const w2 = width / 2;
    const d2 = height / 2;
    const y0 = t / 2 + OVERLAY_INSET_M;
    pushSegment(segs, -w2, y0, -d2, w2, y0, -d2);
    pushSegment(segs, w2, y0, -d2, w2, y0, d2);
    pushSegment(segs, w2, y0, d2, -w2, y0, d2);
    pushSegment(segs, -w2, y0, d2, -w2, y0, -d2);
  } else if (panelType === "left") {
    const sh2 = sideH / 2;
    const d2 = height / 2;
    const xExterior = -(t / 2 + OVERLAY_INSET_M);
    pushSegment(segs, xExterior, -sh2, -d2, xExterior, sh2, -d2);
    pushSegment(segs, xExterior, sh2, -d2, xExterior, sh2, d2);
    pushSegment(segs, xExterior, sh2, d2, xExterior, -sh2, d2);
    pushSegment(segs, xExterior, -sh2, d2, xExterior, -sh2, -d2);
  } else if (panelType === "right") {
    const sh2 = sideH / 2;
    const d2 = height / 2;
    const x0 = t / 2 + OVERLAY_INSET_M;
    pushSegment(segs, x0, -sh2, -d2, x0, sh2, -d2);
    pushSegment(segs, x0, sh2, -d2, x0, sh2, d2);
    pushSegment(segs, x0, sh2, d2, x0, -sh2, d2);
    pushSegment(segs, x0, -sh2, d2, x0, -sh2, -d2);
  } else if (panelType === "front") {
    const w2 = width / 2;
    const h2 = height / 2;
    const zInside = -depth / 2 - OVERLAY_INSET_M;
    const zOutside = depth / 2 + OVERLAY_INSET_M;
    pushSegment(segs, -w2, -h2, zInside, w2, -h2, zInside);
    pushSegment(segs, w2, -h2, zInside, w2, h2, zInside);
    pushSegment(segs, w2, h2, zInside, -w2, h2, zInside);
    pushSegment(segs, -w2, h2, zInside, -w2, -h2, zInside);
    pushSegment(segs, -w2, -h2, zOutside, w2, -h2, zOutside);
    pushSegment(segs, w2, -h2, zOutside, w2, h2, zOutside);
    pushSegment(segs, w2, h2, zOutside, -w2, h2, zOutside);
    pushSegment(segs, -w2, h2, zOutside, -w2, -h2, zOutside);
  } else {
    const w2 = width / 2;
    const h2 = height / 2;
    const z0 = bt / 2 + OVERLAY_INSET_M;
    pushSegment(segs, -w2, -h2, z0, w2, -h2, z0);
    pushSegment(segs, w2, -h2, z0, w2, h2, z0);
    pushSegment(segs, w2, h2, z0, -w2, h2, z0);
    pushSegment(segs, -w2, h2, z0, -w2, -h2, z0);
  }

  return segmentsToGeometry(segs);
}

/** Um círculo de furo face-aware — geometria isolada (sem ligar a outros segmentos). */
export function createHoleCircleGeometry(
  panelType: PanelOutlineKind,
  dims: PanelOutlineDims,
  hole: TechnicalDrillHole
): THREE.BufferGeometry | null {
  const frame = resolveHoleDrillEntryFrame(panelType, dims, hole);
  if (!frame) return null;

  const radius = Math.max(0.0005, hole.diametro / 2000);
  const segs = buildCircleSegmentsOnPlane(
    frame.entry,
    frame.axisInward,
    radius,
    HOLE_CIRCLE_SEGMENTS
  );
  return segmentsToGeometry(segs);
}

/** Contorno caixa alinhado ao BoxGeometry (prateleiras, gavetas, SEP fino). */
export function createBoxWireframeContourGeometry(
  width: number,
  height: number,
  depth: number
): THREE.BufferGeometry {
  const inset = OVERLAY_INSET_M;
  const w2 = Math.max(0.0005, width / 2);
  const h2 = Math.max(0.0005, height / 2);
  const d2 = Math.max(0.0005, depth / 2);
  const segs: number[] = [];

  const ring = (y: number, xs: number[], zs: number[]) => {
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      pushSegment(segs, xs[i], y, zs[i], xs[j], y, zs[j]);
    }
  };

  ring(-h2 - inset, [-w2, w2, w2, -w2], [-d2, -d2, d2, d2]);
  ring(h2 + inset, [-w2, w2, w2, -w2], [-d2, -d2, d2, d2]);

  const corners: Array<[number, number]> = [
    [-w2, -d2],
    [w2, -d2],
    [w2, d2],
    [-w2, d2],
  ];
  for (const [x, z] of corners) {
    pushSegment(segs, x, -h2 - inset, z, x, h2 + inset, z);
  }

  return segmentsToGeometry(segs)!;
}

/** Centro do furo em coords locais do mesh (m) — para pairing lines e invariantes. */
export function holeMmToLocalMeters(
  panelType: PanelOutlineKind,
  dims: PanelOutlineDims,
  hole: TechnicalDrillHole
): { x: number; y: number; z: number } | null {
  const frame = resolveHoleDrillEntryFrame(panelType, dims, hole);
  if (!frame) return null;
  const outward = frame.axisInward.clone().multiplyScalar(-OVERLAY_INSET_M);
  const c = frame.entry.clone().add(outward);
  return { x: c.x, y: c.y, z: c.z };
}

/** Dimensões de outline a partir do bounding box do mesh. */
export function outlineDimsFromMeshSize(
  size: THREE.Vector3,
  panelType: PanelOutlineKind
): PanelOutlineDims {
  if (panelType === "left" || panelType === "right") {
    return { width: size.z, height: size.y, thickness: size.x };
  }
  if (panelType === "top" || panelType === "bottom") {
    return { width: size.x, height: size.z, thickness: size.y };
  }
  if (panelType === "front") {
    return { width: size.x, height: size.y, thickness: size.z, depth: size.z };
  }
  return { width: size.x, height: size.y, thickness: size.z, depth: size.z };
}
