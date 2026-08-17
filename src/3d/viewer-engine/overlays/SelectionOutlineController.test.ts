import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SelectionOutlineController } from "./SelectionOutlineController";
import { buildTampoAngleShape } from "../remate/tampoAngleGeometry";
import { createTampoPostformingGeometryFromShape } from "../remate/tampoPostformingGeometry";

function makeTampoMesh(geometry: THREE.BufferGeometry, position: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry);
  mesh.userData.isRematePiece = true;
  mesh.userData.isTampoPiece = true;
  mesh.userData.remateId = "tampo-sel";
  mesh.userData.remateOutlineRenderOrder = 13;
  mesh.position.copy(position);
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe("SelectionOutlineController — TAMPO", () => {
  it("contorno do TAMPO fica no mesh (não na origem do mundo)", () => {
    const scene = new THREE.Scene();
    const ctrl = new SelectionOutlineController({
      scene,
      getBoxes: () => new Map(),
    });
    const geom = new THREE.BoxGeometry(1.2, 0.63, 0.03);
    const mesh = makeTampoMesh(geom, new THREE.Vector3(2.4, 0.8, -1.1));

    ctrl.setTarget(mesh, 0.9, 0x38bdf8);
    ctrl.updateFrame();

    const helper = ctrl.getGroup().children.find((c) => c.name === "selection-outline-layout");
    expect(helper).toBeTruthy();
    expect(helper!.matrixAutoUpdate).toBe(false);
    expect(helper!.matrix.elements).toEqual(mesh.matrixWorld.elements);

    ctrl.dispose();
    geom.dispose();
  });

  it("contorno angular segue a geometria do trapézio, não um AABB da caixa", () => {
    const scene = new THREE.Scene();
    const ctrl = new SelectionOutlineController({
      scene,
      getBoxes: () => new Map(),
    });
    const shape = buildTampoAngleShape(
      { frontLengthMm: 900, backLengthMm: 600, angleDeg: 0 },
      900,
      630
    );
    const geom = createTampoPostformingGeometryFromShape(shape, 0.03);
    const mesh = makeTampoMesh(geom, new THREE.Vector3(1.5, 0.9, 0.4));

    ctrl.setTarget(mesh, 0.9, 0x38bdf8);
    ctrl.updateFrame();

    const helper = ctrl.getGroup().children[0] as THREE.LineSegments;
    expect(helper.matrixAutoUpdate).toBe(false);
    expect(helper.geometry).toBeInstanceOf(THREE.EdgesGeometry);
    expect(helper.matrix.elements).toEqual(mesh.matrixWorld.elements);
    const origin = new THREE.Vector3();
    helper.getWorldPosition(origin);
    expect(origin.distanceTo(mesh.position)).toBeLessThan(0.001);

    ctrl.dispose();
    geom.dispose();
  });
});
