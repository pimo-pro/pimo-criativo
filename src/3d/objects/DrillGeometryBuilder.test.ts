import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildDrillCutGeometries,
  isLateralInteriorDrill,
  lateralDrillEntryXM,
  resolveDrillPanelTypeForMesh,
} from "./DrillGeometryBuilder";
import type { TechnicalDrillHole } from "../../core/types";

function makeLateralPanel(thicknessM = 0.019): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(thicknessM, 0.72, 0.5));
}

function makeDivPanel(thicknessM = 0.019, heightM = 0.72, depthM = 0.5): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thicknessM, heightM, depthM));
  mesh.name = "divsep-div-test";
  mesh.userData.divSepKind = "div";
  mesh.userData.panelType = "left";
  return mesh;
}

describe("DrillGeometryBuilder — lateral_esquerda interior", () => {
  it("isLateralInteriorDrill força interior em left/right", () => {
    const hole = { x: 60, y: 400, diametro: 5, profundidade: 13, tipo: "prateleira" as const, face: "esquerda" as const };
    expect(isLateralInteriorDrill("left", hole)).toBe(true);
    expect(isLateralInteriorDrill("right", { ...hole, face: "direita" })).toBe(true);
  });

  it("lateralDrillEntryXM usa +X (interior) para left", () => {
    expect(lateralDrillEntryXM("left", 0.019)).toBeCloseTo(0.0095, 4);
    expect(lateralDrillEntryXM("left", 0.019)).toBeGreaterThan(0);
  });

  it("buildDrillCutGeometries coloca furo na face interior (+X) mesmo com face exterior no hole", () => {
    const panel = makeLateralPanel();
    const holes: TechnicalDrillHole[] = [
      {
        x: 60,
        y: 400,
        diametro: 5,
        profundidade: 13,
        tipo: "prateleira",
        face: "esquerda",
      },
    ];
    const cuts = buildDrillCutGeometries("left", panel, holes);
    expect(cuts.length).toBeGreaterThan(0);
    cuts[0]!.computeBoundingBox();
    const centerX = cuts[0]!.boundingBox!.getCenter(new THREE.Vector3()).x;
    expect(centerX).toBeGreaterThan(0);
  });

  it("buildDrillCutGeometries left com face direita (interior industrial) mantém +X", () => {
    const panel = makeLateralPanel();
    const holes: TechnicalDrillHole[] = [
      {
        x: 60,
        y: 400,
        diametro: 5,
        profundidade: 13,
        tipo: "dobradica_fixacao",
        face: "direita",
      },
    ];
    const cuts = buildDrillCutGeometries("left", panel, holes);
    cuts[0]!.computeBoundingBox();
    const centerX = cuts[0]!.boundingBox!.getCenter(new THREE.Vector3()).x;
    expect(centerX).toBeGreaterThan(0);
  });
});

describe("DrillGeometryBuilder — DIV nunca top", () => {
  it("resolveDrillPanelTypeForMesh força left quando pedem top no DIV", () => {
    const div = makeDivPanel();
    expect(resolveDrillPanelTypeForMesh(div, "top")).toBe("left");
    expect(resolveDrillPanelTypeForMesh(div, "bottom")).toBe("left");
    expect(resolveDrillPanelTypeForMesh(div, "right")).toBe("right");
  });

  it("furo de prateleira no DIV com left fica no eixo X (espessura), não Y", () => {
    const div = makeDivPanel();
    const holes: TechnicalDrillHole[] = [
      { x: 60, y: 400, diametro: 5, profundidade: 13, tipo: "prateleira", face: "direita" },
    ];
    const cuts = buildDrillCutGeometries("left", div, holes);
    expect(cuts.length).toBeGreaterThan(0);
    cuts[0]!.computeBoundingBox();
    const size = cuts[0]!.boundingBox!.getSize(new THREE.Vector3());
    // Cilindro ao longo de X: extensão em X ≈ profundidade; em Y/Z ≈ diâmetro
    expect(size.x).toBeGreaterThan(size.y);
    expect(size.x).toBeGreaterThan(size.z);
  });

  it("applyDrillHolesToPanelGeometry não altera geometria do DIV", async () => {
    const { applyDrillHolesToPanelGeometry } = await import("./DrillGeometryBuilder");
    const div = makeDivPanel();
    const before = div.geometry.uuid;
    applyDrillHolesToPanelGeometry(div, "left", [
      { x: 60, y: 400, diametro: 5, profundidade: 13, tipo: "prateleira", face: "direita" },
    ]);
    expect(div.geometry.uuid).toBe(before);
    expect(div.userData.hasCsgDrillHoles).not.toBe(true);
  });
});
