import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("../materials/MaterialEngine", () => ({
  applyMaterialToMesh: vi.fn(),
}));

import { createTampoUnion } from "../../../core/remate/tampoUnion";
import { createTampoPostformingGeometry } from "./tampoPostformingGeometry";
import {
  applyTampoUnion,
  createTampoUnionCutterMesh,
  TampoUnionVisualizer,
} from "./TampoUnionVisualizer";
import { TampoPieceVisualizer } from "./TampoPieceVisualizer";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";

const EXTENTS = { w: 1.2, h: 0.63, d: 0.03 };

function tampoPiece(partial?: Partial<RematePiece>): RematePiece {
  return {
    id: "tampo-a",
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
    name: "TAMPO_A",
    ...partial,
  };
}

describe("TAMPO Fase 4 — geometria Viewer união", () => {
  it("sem union → geometria inalterada", () => {
    const base = createTampoPostformingGeometry(EXTENTS.w, EXTENTS.h, EXTENTS.d);
    const out = applyTampoUnion(base, null, EXTENTS);
    expect(out).toBe(base);
    base.dispose();
  });

  it("cutter LEFT tem BoxGeometry", () => {
    const u = createTampoUnion({
      targetTampoId: "b",
      direction: "LEFT",
      overlapMm: 8,
    });
    const cutter = createTampoUnionCutterMesh(u, EXTENTS);
    expect(cutter.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(cutter.position.x).toBeLessThan(0);
    cutter.geometry.dispose();
  });

  it("união 8 mm LEFT → CSG válida", () => {
    const base = createTampoPostformingGeometry(EXTENTS.w, EXTENTS.h, EXTENTS.d);
    const u = createTampoUnion({
      targetTampoId: "b",
      direction: "LEFT",
      overlapMm: 8,
    });
    const carved = applyTampoUnion(base, u, EXTENTS);
    expect(carved.attributes.position.count).toBeGreaterThan(0);
    carved.computeBoundingBox();
    expect(carved.boundingBox).toBeTruthy();
    if (carved !== base) carved.dispose();
    else base.dispose();
  });

  it("união FRONT remove faixa no +Y (postforming)", () => {
    const base = createTampoPostformingGeometry(EXTENTS.w, EXTENTS.h, EXTENTS.d);
    const u = createTampoUnion({
      targetTampoId: "b",
      direction: "FRONT",
      overlapMm: 8,
    });
    const cutter = createTampoUnionCutterMesh(u, EXTENTS);
    expect(cutter.position.y).toBeGreaterThan(0);
    const carved = applyTampoUnion(base, u, EXTENTS);
    expect(carved.attributes.position.count).toBeGreaterThan(0);
    cutter.geometry.dispose();
    if (carved !== base) carved.dispose();
    else base.dispose();
  });

  it("TampoUnionVisualizer.subtractUnion actualiza mesh", () => {
    const mesh = new THREE.Mesh(
      createTampoPostformingGeometry(EXTENTS.w, EXTENTS.h, EXTENTS.d),
      new THREE.MeshStandardMaterial()
    );
    const before = mesh.geometry.uuid;
    TampoUnionVisualizer.subtractUnion(
      mesh,
      createTampoUnion({ targetTampoId: "b", direction: "RIGHT", overlapMm: 8 }),
      EXTENTS
    );
    expect(mesh.geometry.uuid).not.toBe(before);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it("syncAll: userData tampoUnionOverlapMm === 8", () => {
    const viz = new TampoPieceVisualizer();
    const piece = tampoPiece({
      union: createTampoUnion({
        targetTampoId: "tampo-b",
        direction: "LEFT",
        overlapMm: 8,
      }),
    });
    viz.bindBridge({
      listRematePieces: () => [piece],
      getBoxConfig: () => null,
      getBoxWorldMatrix: () => null,
    });
    viz.syncAll();
    const mesh = viz.getMeshByRemateId(piece.id);
    expect(mesh?.userData.tampoUnionOverlapMm).toBe(8);
    expect(mesh?.userData.tampoUnionDirection).toBe("LEFT");
    viz.dispose();
  });
});
