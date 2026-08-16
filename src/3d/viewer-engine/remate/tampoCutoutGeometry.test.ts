import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("../materials/MaterialEngine", () => ({
  applyMaterialToMesh: vi.fn(),
}));

import { createTampoCutout } from "../../../core/remate/tampoCutouts";
import { createTampoPostformingGeometry } from "./tampoPostformingGeometry";
import {
  buildTampoGeometryWithCutouts,
  createTampoCutoutCutterMesh,
  TampoCutoutVisualizer,
} from "./TampoCutoutVisualizer";
import { TampoPieceVisualizer } from "./TampoPieceVisualizer";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";

function tampoPiece(partial?: Partial<RematePiece>): RematePiece {
  return {
    id: "tampo-cut-1",
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
    name: "TAMPO_CUT_TEST",
    ...partial,
  };
}

describe("TAMPO Fase 3 — geometria Viewer com recortes", () => {
  it("sem cutouts → geometria = postforming", () => {
    const base = createTampoPostformingGeometry(1.2, 0.63, 0.03);
    const out = buildTampoGeometryWithCutouts(base, []);
    expect(out).toBe(base);
    base.dispose();
  });

  it("cutter retangular e circular criados", () => {
    const rect = createTampoCutoutCutterMesh(
      createTampoCutout("TAMPO_CUTOUT_RETANGULAR", { width: 100, height: 80 })
    );
    expect(rect.geometry).toBeInstanceOf(THREE.BoxGeometry);
    rect.geometry.dispose();

    const circ = createTampoCutoutCutterMesh(
      createTampoCutout("TAMPO_CUTOUT_CIRCULAR", { diameter: 100 })
    );
    expect(circ.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    circ.geometry.dispose();
  });

  it("CSG com 1 recorte retangular produz geometria válida", () => {
    const base = createTampoPostformingGeometry(1.2, 0.63, 0.03);
    const cut = createTampoCutout("TAMPO_CUTOUT_RETANGULAR", {
      width: 100,
      height: 80,
      x: 0,
      y: 0,
    });
    const carved = buildTampoGeometryWithCutouts(base, [cut]);
    expect(carved).toBeTruthy();
    expect(carved.attributes.position.count).toBeGreaterThan(0);
    carved.computeBoundingBox();
    expect(carved.boundingBox).toBeTruthy();
    if (carved !== base) carved.dispose();
    else base.dispose();
  });

  it("CSG com recorte circular", () => {
    const base = createTampoPostformingGeometry(1.2, 0.63, 0.03);
    const cut = createTampoCutout("TAMPO_CUTOUT_CIRCULAR", { diameter: 120 });
    const carved = buildTampoGeometryWithCutouts(base, [cut]);
    expect(carved.attributes.position.count).toBeGreaterThan(0);
    if (carved !== base) carved.dispose();
    else base.dispose();
  });

  it("TampoCutoutVisualizer.subtractCutouts actualiza mesh", () => {
    const mesh = new THREE.Mesh(
      createTampoPostformingGeometry(1.2, 0.63, 0.03),
      new THREE.MeshStandardMaterial()
    );
    const before = mesh.geometry.uuid;
    TampoCutoutVisualizer.subtractCutouts(mesh, [
      createTampoCutout("TAMPO_CUTOUT_FOGAO", { width: 480, height: 480 }),
    ]);
    expect(mesh.geometry.uuid).not.toBe(before);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it("syncAll aplica tampoCutoutCount no userData", () => {
    const viz = new TampoPieceVisualizer();
    const piece = tampoPiece({
      cutouts: [createTampoCutout("TAMPO_CUTOUT_PIA")],
    });
    viz.bindBridge({
      listRematePieces: () => [piece],
      getBoxConfig: () => null,
      getBoxWorldMatrix: () => null,
    });
    viz.syncAll();
    const mesh = viz.getMeshByRemateId(piece.id);
    expect(mesh?.userData.tampoCutoutCount).toBe(1);
    expect(mesh?.userData.isTampoPiece).toBe(true);
    viz.dispose();
  });
});
