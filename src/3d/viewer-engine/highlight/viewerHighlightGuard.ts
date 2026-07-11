/**
 * Camada de proteção visual — audita overlays após sync e bloqueia caminhos legados.
 */

import type * as THREE from "three";
import {
  HOLE_HIGHLIGHT_OVERLAY_FLAG,
  isAuthorizedHighlightOverlay,
  isLegacyOutlineOverlay,
  LEGACY_EDGE_OUTLINE_FLAG,
  PANEL_EDGE_OVERLAY_FLAG,
} from "./viewerHighlightConstants";
import type { ViewerHighlightInvariantViolation } from "./viewerHighlightInvariant";
import {
  findSpuriousSegmentsInGeometry,
  isViewerHighlightInvariantEnabled,
  logViewerHighlightViolations,
} from "./viewerHighlightInvariant";

export type ViewerHighlightGuardViolation = ViewerHighlightInvariantViolation;

const FORBIDDEN_LEGACY_PATTERNS = [
  "EdgeOutlineSystem",
  "syncEdgeOutlines",
  "createContourEdgesGeometry",
] as const;

/** Padrões proibidos no viewer-engine — regressões arquitecturais. */
export function findForbiddenHighlightPatterns(source: string): string[] {
  return FORBIDDEN_LEGACY_PATTERNS.filter((pattern) => source.includes(pattern));
}

export function assertNoLegacyOutlineOverlays(
  meshId: string,
  children: Array<{ userData?: Record<string, unknown> }>
): ViewerHighlightGuardViolation[] {
  const violations: ViewerHighlightGuardViolation[] = [];
  for (const child of children) {
    if (isLegacyOutlineOverlay(child.userData)) {
      violations.push({
        code: "HIGHLIGHT_ORPHAN_OVERLAY",
        meshId,
        detail: `overlay legado ${LEGACY_EDGE_OUTLINE_FLAG} detectado — usar ViewerHighlightController`,
      });
    }
  }
  return violations;
}

export function assertAuthorizedHighlightOverlays(
  meshId: string,
  lineChildren: Array<{
    userData?: Record<string, unknown>;
    geometry?: { getAttribute?: (name: string) => { array?: ArrayLike<number> } | undefined };
  }>
): ViewerHighlightGuardViolation[] {
  const violations: ViewerHighlightGuardViolation[] = [];

  for (const child of lineChildren) {
    if (!isAuthorizedHighlightOverlay(child.userData)) {
      violations.push({
        code: "HIGHLIGHT_ORPHAN_OVERLAY",
        meshId,
        detail: "LineSegments sem flag SSOT de highlight autorizado",
      });
      continue;
    }

    const positions = child.geometry?.getAttribute?.("position")?.array;
    if (!(positions instanceof Float32Array) && !Array.isArray(positions)) continue;

    const isHole = child.userData?.[HOLE_HIGHLIGHT_OVERLAY_FLAG] === true;
    const maxLen = isHole ? 0.08 : 2;
    const bad = findSpuriousSegmentsInGeometry(
      positions instanceof Float32Array ? positions : new Float32Array(positions),
      maxLen
    );
    if (bad.length > 0) {
      violations.push({
        code: "HIGHLIGHT_SPURIOUS_SEGMENT",
        meshId,
        detail: `segmento espúrio em overlay ${isHole ? "furo" : "contorno"}: índices ${bad.join(",")}`,
      });
    }
  }

  return violations;
}

export function assertNoHoleOverlaysWithoutData(
  meshId: string,
  holeOverlayCount: number,
  holeCount: number
): ViewerHighlightGuardViolation[] {
  if (holeCount === 0 && holeOverlayCount > 0) {
    return [
      {
        code: "HIGHLIGHT_WITHOUT_HOLES",
        meshId,
        detail: `${holeOverlayCount} overlay(s) de furo sem dados SSOT`,
      },
    ];
  }
  return [];
}

export function auditMeshHighlightOverlays(
  mesh: THREE.Mesh,
  holeCount: number
): ViewerHighlightGuardViolation[] {
  const meshId =
    (mesh.userData?.pieceId as string | undefined) ??
    (mesh.userData?.panelId as string | undefined) ??
    mesh.name ??
    mesh.uuid;

  const lineChildren = mesh.children.filter(
    (c) => c.type === "Line" || c.type === "LineSegments"
  );

  const holeOverlayCount = lineChildren.filter(
    (c) => c.userData?.[HOLE_HIGHLIGHT_OVERLAY_FLAG] === true
  ).length;

  return [
    ...assertNoLegacyOutlineOverlays(meshId, mesh.children),
    ...assertAuthorizedHighlightOverlays(meshId, lineChildren),
    ...assertNoHoleOverlaysWithoutData(meshId, holeOverlayCount, holeCount),
  ];
}

export function auditMeshHighlightOverlaysIfEnabled(
  mesh: THREE.Mesh,
  holeCount: number
): void {
  if (!isViewerHighlightInvariantEnabled()) return;
  const violations = auditMeshHighlightOverlays(mesh, holeCount);
  logViewerHighlightViolations(violations);
}

/** Marca overlay de contorno com flags SSOT. */
export function stampPanelContourOverlay(
  overlay: THREE.Object3D,
  mesh: THREE.Mesh
): void {
  overlay.userData[PANEL_EDGE_OVERLAY_FLAG] = true;
  overlay.userData.isIndustrialDesignHoleOverlay = false;
  overlay.userData.pieceId = mesh.userData.pieceId ?? mesh.userData.panelId ?? mesh.userData.remateId;
  overlay.userData.parentPieceUuid = mesh.uuid;
}

/** Marca overlay de furo com flags SSOT. */
export function stampHoleHighlightOverlay(
  overlay: THREE.Object3D,
  mesh: THREE.Mesh,
  holeType: string | undefined
): void {
  overlay.userData[HOLE_HIGHLIGHT_OVERLAY_FLAG] = true;
  overlay.userData[PANEL_EDGE_OVERLAY_FLAG] = false;
  overlay.userData.holeType = holeType;
  overlay.userData.parentPieceUuid = mesh.uuid;
}
