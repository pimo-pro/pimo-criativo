import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { isTampoPickObject, ViewerRaycastSystem, type ViewerRaycastSystemDeps } from "./ViewerRaycastSystem";
import type { ViewerBoxEntry } from "../types";

function stubRaycast(boxes: Map<string, ViewerBoxEntry>): ViewerRaycastSystem {
  const deps: ViewerRaycastSystemDeps = {
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    camera: new THREE.PerspectiveCamera(),
    getBoxes: () => boxes,
    getRoomBoxWalls: () => [],
    getRoomBuilderGroup: () => new THREE.Group(),
    getScene: () => new THREE.Scene(),
    getCanvas: () => document.createElement("canvas"),
    getRoomBounds: () => null,
    getTransformControlsHelper: () => null,
    getDebugMode: () => false,
  };
  return new ViewerRaycastSystem(deps);
}

describe("TAMPO — picking não herda a caixa", () => {
  it("isTampoPickObject reconhece o mesh e o pai", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.userData.isTampoPiece = true;
    const root = new THREE.Group();
    root.add(mesh);
    expect(isTampoPickObject(mesh)).toBe(true);
    expect(isTampoPickObject(root)).toBe(false);
    expect(isTampoPickObject(new THREE.Mesh())).toBe(false);
  });

  it("getBoxIdByMesh ignora boxId do TAMPO (não selecciona o módulo)", () => {
    const boxMesh = new THREE.Group();
    boxMesh.name = "box-1";
    const boxes = new Map<string, ViewerBoxEntry>([
      ["box-1", { mesh: boxMesh } as ViewerBoxEntry],
    ]);
    const sys = stubRaycast(boxes);

    const tampo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.63, 0.03));
    tampo.userData.isTampoPiece = true;
    tampo.userData.isRematePiece = true;
    tampo.userData.boxId = "box-1";
    tampo.userData.remateId = "tampo-1";

    expect(sys.getBoxIdByMesh(tampo)).toBeNull();
    expect(sys.getBoxIdByMesh(boxMesh)).toBe("box-1");
  });
});
