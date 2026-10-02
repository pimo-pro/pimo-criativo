/**
 * Smoke tests — mesh builders + RoomMeshEngine (activação vNext).
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  RoomMeshEngine,
  wallMeshBuilder,
  floorMeshBuilder,
  ceilingMeshBuilder,
  openingsMeshBuilder,
  buildRectFloorShape,
  Room,
} from "../../src/pimo-room/mesh";

describe("pimo-room/mesh (activação vNext)", () => {
  it("wallMeshBuilder cria 4 paredes principais", () => {
    const room = new Room(4, 2.5, 2.6, -2, -1.25);
    const walls = wallMeshBuilder(room, 4, 0.2);
    expect(walls).toHaveLength(4);
    walls.forEach((w) => expect(w.userData.isRoomWall).toBe(true));
  });

  it("floorMeshBuilder + ceilingMeshBuilder geram meshes válidos", () => {
    const shape = buildRectFloorShape(-2, 2, -1.25, 1.25, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const { floor } = floorMeshBuilder(
      shape,
      { minX: -2, maxX: 2, minZ: -1.25, maxZ: 1.25, minY: 0 },
      mat
    );
    expect(floor.userData.isRoomFloor).toBe(true);
    const ceiling = ceilingMeshBuilder(
      shape,
      { maxY: 2.6 },
      { color: 0xffffff, roughness: 0.8, metalness: 0, opacity: 0.4 },
      true
    );
    expect(ceiling.userData.isRoomCeiling).toBe(true);
  });

  it("openingsMeshBuilder cria porta e janela", () => {
    const door = openingsMeshBuilder("door", {
      widthMm: 800,
      heightMm: 2100,
      thicknessMm: 40,
    });
    expect(door.kind).toBe("door");
    expect(door.group.userData.elementType).toBe("door");
    const win = openingsMeshBuilder("window", {
      widthMm: 1200,
      heightMm: 1200,
      thicknessMm: 40,
    });
    expect(win.kind).toBe("window");
    expect(win.group.userData.elementType).toBe("window");
  });

  it("RoomMeshEngine createRoom / removeRoom sem lançar", () => {
    const setRoom = vi.fn();
    const clearRoom = vi.fn();
    const engine = new RoomMeshEngine({
      setRoomFromManager: setRoom,
      clearRoomFromManager: clearRoom,
    });
    engine.createRoom(4, 2.5, 2.6, 4, 0.2);
    expect(engine.room).not.toBeNull();
    expect(engine.wallsMain.length).toBe(4);
    expect(setRoom).toHaveBeenCalled();
    engine.removeRoom();
    expect(engine.room).toBeNull();
    expect(clearRoom).toHaveBeenCalled();
  });
});
