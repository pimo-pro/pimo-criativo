import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("../materials/MaterialEngine", () => ({
  applyMaterialToMesh: vi.fn(),
}));

import {
  assertTampoExtentsApprox,
  createTampoPostformingGeometry,
  TAMPO_POSTFORM_RADIUS_MM,
  TAMPO_POSTFORM_RADIUS_M,
} from "./tampoPostformingGeometry";
import { isTampoVisualPiece, TampoPieceVisualizer } from "./TampoPieceVisualizer";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import { remateGeometryExtentsM } from "../../../core/remate/remateGeometryExtents";

function tampoPiece(partial?: Partial<RematePiece>): RematePiece {
  return {
    id: "tampo-1",
    productType: "TAMPO_COZINHA",
    tipo: "TAMPO",
    mountSlot: "CIMA",
    width: 1200,
    height: 630,
    depth: 30,
    materialPresetId: "mdb_laminado-30",
    position: { xMm: 0, yMm: 0, zMm: 0 },
    rotation: { xRad: 0, yRad: 0, zRad: 0 },
    followBox: false,
    name: "TAMPO_TEST",
    ...partial,
  };
}

describe("TAMPO Fase 2 — geometria Viewer", () => {
  it("raio postforming = 11 mm", () => {
    expect(TAMPO_POSTFORM_RADIUS_MM).toBe(11);
    expect(TAMPO_POSTFORM_RADIUS_M).toBeCloseTo(0.011, 6);
  });

  it("bounding box ≈ w×h×d (1.2 × 0.63 × 0.03)", () => {
    const w = 1.2;
    const h = 0.63;
    const d = 0.03;
    const geom = createTampoPostformingGeometry(w, h, d);
    expect(assertTampoExtentsApprox(geom, w, h, d)).toBe(true);
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(w, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(h, 2);
    expect(bb.max.z - bb.min.z).toBeCloseTo(d, 2);
    geom.dispose();
  });

  it("extents industriais CIMA → 1200×630×30 mm em metros", () => {
    const piece = tampoPiece();
    const { w, h, d } = remateGeometryExtentsM(piece);
    expect(w).toBeCloseTo(1.2, 5);
    expect(h).toBeCloseTo(0.63, 5);
    expect(d).toBeCloseTo(0.03, 5);
  });

  it("raio é clampado a ≤ d/2", () => {
    const geom = createTampoPostformingGeometry(1, 0.63, 0.03, 0.05);
    expect(assertTampoExtentsApprox(geom, 1, 0.63, 0.03)).toBe(true);
    geom.dispose();
  });

  it("isTampoVisualPiece reconhece TAMPO_COZINHA", () => {
    expect(isTampoVisualPiece(tampoPiece())).toBe(true);
    expect(
      isTampoVisualPiece(
        tampoPiece({ productType: "AVISTA", tipo: "FRENTE", height: 100, depth: 19 })
      )
    ).toBe(false);
  });

  it("createMesh / sync marca userData.isRematePiece + remateProductType", () => {
    const viz = new TampoPieceVisualizer();
    const piece = tampoPiece();
    viz.bindBridge({
      listRematePieces: () => [piece],
      getBoxConfig: () => null,
      getBoxWorldMatrix: () => null,
    });
    viz.syncAll();
    const mesh = viz.getMeshByRemateId(piece.id);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh!.userData.isRematePiece).toBe(true);
    expect(mesh!.userData.isTampoPiece).toBe(true);
    expect(mesh!.userData.remateProductType).toBe("TAMPO_COZINHA");
    expect(mesh!.userData.tampoPostformRadiusMm).toBe(11);
    expect(mesh!.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    viz.dispose();
  });
});
