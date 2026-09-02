import { describe, expect, it } from "vitest";
import { createDefaultProjectRoom, applyProjectRoomToWallStore } from "../../../src/3d/viewer-engine/room/RoomEngine";
import { wallStore } from "../../../src/stores/wallStore";
import { RoomManager } from "../../../src/3d/room/RoomManager";
import { RoomBuilder } from "../../../src/3d/room/RoomBuilder";
import { DEFAULT_DOOR_CONFIG } from "../../../src/3d/room/types";
import { PIMO_ROOM_MODULE } from "../../../src/3d/room/pimoRoomSchema";
import type { WorkspaceBox } from "../../../src/core/types";
import * as THREE from "three";

describe("pimo-room verificação final (fase 6)", () => {
  it("identifica pimo-room v4", () => {
    expect(PIMO_ROOM_MODULE.name).toBe("pimo-room");
    expect(PIMO_ROOM_MODULE.version).toBe("4.0.0");
  });

  it("cria sala + abertura CSG e coexiste com WorkspaceBox de armário (dados)", () => {
    wallStore.getState().clearRoom();
    const room = createDefaultProjectRoom();
    applyProjectRoomToWallStore(room);
    expect(wallStore.getState().walls.length).toBe(4);

    const manager = new RoomManager({
      setRoomFromManager: () => {},
      clearRoomFromManager: () => {},
    });
    manager.createRoom(room.widthMm / 1000, room.depthMm / 1000, room.heightMm / 1000, 4, room.wallThicknessMm / 1000);
    const builder = new RoomBuilder(() => manager.wallsMain);
    const doorId = builder.addDoorByIndex(0, { ...DEFAULT_DOOR_CONFIG, horizontalOffsetMm: 500 });
    expect(doorId).toBeTruthy();
    expect(manager.wallsMain[0].material).toBeInstanceOf(THREE.MeshStandardMaterial);

    // Armário existente (contrato WorkspaceBox) — posição dentro do footprint centrado.
    const cabinet: Pick<WorkspaceBox, "id" | "x_mm" | "y_mm" | "z_mm" | "W" | "H" | "D"> = {
      id: "box-test-armario",
      x_mm: 0,
      y_mm: 0,
      z_mm: 0,
      W: 600,
      H: 720,
      D: 560,
    };
    const halfW = room.widthMm / 2;
    const halfD = room.depthMm / 2;
    expect(Math.abs(cabinet.x_mm!) + cabinet.W / 2).toBeLessThanOrEqual(halfW);
    expect(Math.abs(cabinet.z_mm!) + cabinet.D / 2).toBeLessThanOrEqual(halfD);

    manager.removeRoom();
    expect(manager.room).toBeNull();
  });
});
