import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  assertAuthorizedHighlightOverlays,
  assertNoHoleOverlaysWithoutData,
  assertNoLegacyOutlineOverlays,
  auditMeshHighlightOverlays,
  findForbiddenHighlightPatterns,
  stampHoleHighlightOverlay,
  stampPanelContourOverlay,
} from "./viewerHighlightGuard";
import {
  HOLE_HIGHLIGHT_OVERLAY_FLAG,
  LEGACY_EDGE_OUTLINE_FLAG,
  PANEL_EDGE_OVERLAY_FLAG,
} from "./viewerHighlightConstants";

describe("viewerHighlightGuard — bloqueio de caminhos legados", () => {
  it("detecta padrões proibidos no código fonte", () => {
    const bad = findForbiddenHighlightPatterns(
      "class EdgeOutlineSystem { syncEdgeOutlines() { new THREE.EdgesGeometry() } }"
    );
    expect(bad).toContain("EdgeOutlineSystem");
    expect(bad).toContain("syncEdgeOutlines");
    expect(bad).not.toContain("HighlightManager");
  });

  it("rejeita overlay legado isEdgeOutlineOverlay", () => {
    const violations = assertNoLegacyOutlineOverlays("mesh-1", [
      { userData: { [LEGACY_EDGE_OUTLINE_FLAG]: true } },
    ]);
    expect(violations).toHaveLength(1);
  });

  it("rejeita LineSegments sem flag SSOT autorizada", () => {
    const violations = assertAuthorizedHighlightOverlays("mesh-1", [
      { userData: {}, geometry: { getAttribute: () => ({ array: new Float32Array(6) }) } },
    ]);
    expect(violations.some((v) => v.code === "HIGHLIGHT_ORPHAN_OVERLAY")).toBe(true);
  });

  it("rejeita overlays de furo sem dados SSOT", () => {
    const violations = assertNoHoleOverlaysWithoutData("mesh-1", 2, 0);
    expect(violations[0]?.code).toBe("HIGHLIGHT_WITHOUT_HOLES");
  });

  it("stamps SSOT aplicam flags correctas", () => {
    const mesh = new THREE.Mesh();
    mesh.uuid = "parent-uuid";
    mesh.userData.pieceId = "piece-1";

    const contour = new THREE.LineSegments();
    stampPanelContourOverlay(contour, mesh);
    expect(contour.userData[PANEL_EDGE_OVERLAY_FLAG]).toBe(true);

    const hole = new THREE.LineSegments();
    stampHoleHighlightOverlay(hole, mesh, "cavilha");
    expect(hole.userData[HOLE_HIGHLIGHT_OVERLAY_FLAG]).toBe(true);
    expect(hole.userData.parentPieceUuid).toBe("parent-uuid");
  });

  it("auditMeshHighlightOverlays valida mesh completa", () => {
    const mesh = new THREE.Mesh();
    mesh.userData.pieceId = "sep-1";
    const holeLine = new THREE.LineSegments();
    stampHoleHighlightOverlay(holeLine, mesh, "cavilha");
    const positions = new Float32Array(16 * 6);
    for (let i = 0; i < positions.length; i += 6) {
      positions[i] = 0;
      positions[i + 1] = 0;
      positions[i + 2] = 0;
      positions[i + 3] = 0.01;
      positions[i + 4] = 0;
      positions[i + 5] = 0;
    }
    holeLine.geometry = new THREE.BufferGeometry();
    holeLine.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    mesh.add(holeLine);

    const violations = auditMeshHighlightOverlays(mesh, 1);
    expect(violations.filter((v) => v.code === "HIGHLIGHT_WITHOUT_HOLES")).toEqual([]);
  });
});
