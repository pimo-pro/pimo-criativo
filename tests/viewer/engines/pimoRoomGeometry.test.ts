import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Room } from "../../../src/3d/room/Room";
import { createMainWalls } from "../../../src/3d/room/WallFactory";
import { RoomBuilder } from "../../../src/3d/room/RoomBuilder";
import {
  applyOpeningCutoutsToWallMesh,
  buildWallBoxGeometry,
} from "../../../src/3d/room/wallGeometryCsg";
import { DEFAULT_DOOR_CONFIG, DEFAULT_WINDOW_CONFIG } from "../../../src/3d/room/types";

describe("pimo-room geometria CSG (fase 2)", () => {
  it("buildWallBoxGeometry produz BufferGeometry e miters aumentam complexidade", () => {
    const box = buildWallBoxGeometry(4, 2.6, 0.2);
    const mitered = buildWallBoxGeometry(4, 2.6, 0.2, {
      startMiterRad: Math.PI / 4,
      endMiterRad: Math.PI / 4,
    });
    expect(box).toBeInstanceOf(THREE.BufferGeometry);
    expect(mitered).toBeInstanceOf(THREE.BufferGeometry);
    expect(mitered.attributes.position.count).toBeGreaterThan(box.attributes.position.count);
    box.dispose();
    mitered.dispose();
  });

  it("cutout CSG + MeshStandardMaterial é renderizável (atributos válidos)", () => {
    const lengthM = 4;
    const heightM = 2.6;
    const thicknessM = 0.2;
    const geom = buildWallBoxGeometry(lengthM, heightM, thicknessM);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.75 });
    const wall = new THREE.Mesh(geom, mat);
    wall.userData.wallLengthMm = lengthM * 1000;
    wall.userData.wallHeightMm = heightM * 1000;
    wall.userData.wallThicknessM = thicknessM;

    const ok = applyOpeningCutoutsToWallMesh(wall, [
      {
        widthMm: 900,
        heightMm: 2100,
        horizontalOffsetMm: 1200,
        floorOffsetMm: 0,
      },
    ]);
    expect(ok).toBe(true);
    expect(wall.geometry.attributes.position.count).toBeGreaterThan(8);
    expect(wall.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    wall.geometry.computeBoundingBox();
    expect(wall.geometry.boundingBox).toBeTruthy();

    // Smoke WebGL: material + geometry sem NodeMaterial/TSL.
    expect((wall.material as THREE.MeshStandardMaterial).isMeshStandardMaterial).toBe(true);
    expect(wall.geometry.getAttribute("position")).toBeTruthy();
    expect(wall.geometry.getAttribute("normal")).toBeTruthy();

    wall.geometry.dispose();
    mat.dispose();
  });

  it("createMainWalls + RoomBuilder aplica porta/janela com CSG", () => {
    const room = new Room(4, 4, 2.6);
    const walls = createMainWalls(room, 4, 0.2);
    expect(walls).toHaveLength(4);
    expect(walls[0].material).toBeInstanceOf(THREE.MeshStandardMaterial);

    const builder = new RoomBuilder(() => walls);
    const doorId = builder.addDoorByIndex(3, { ...DEFAULT_DOOR_CONFIG, horizontalOffsetMm: 800 });
    const windowId = builder.addWindowByIndex(1, {
      ...DEFAULT_WINDOW_CONFIG,
      horizontalOffsetMm: 1000,
    });
    expect(doorId).toBeTruthy();
    expect(windowId).toBeTruthy();
    expect(builder.getElements()).toHaveLength(2);

    const west = walls[3];
    expect(west.geometry.attributes.position.count).toBeGreaterThan(24);
    expect(west.material).toBeInstanceOf(THREE.MeshStandardMaterial);

    walls.forEach((w) => {
      w.geometry.dispose();
      const m = w.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    });
  });
});
