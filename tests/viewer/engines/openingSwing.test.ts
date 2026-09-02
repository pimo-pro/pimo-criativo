/**
 * pimo-room v4 — testes swing / animação / materiais de portas e janelas.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DoorElement } from "../../../src/3d/room/elements/DoorElement";
import { WindowElement } from "../../../src/3d/room/elements/WindowElement";
import { DEFAULT_DOOR_CONFIG, DEFAULT_WINDOW_CONFIG } from "../../../src/3d/room/types";
import { createOpeningMaterials } from "../../../src/3d/room/openingMaterials";
import { RoomBuilder } from "../../../src/3d/room/RoomBuilder";
import { Room } from "../../../src/3d/room/Room";
import { createMainWalls } from "../../../src/3d/room/WallFactory";

describe("portas/janelas funcionais", () => {
  it("createOpeningMaterials usa MeshStandardMaterial (WebGL pimo)", () => {
    const mats = createOpeningMaterials();
    expect(mats.leaf).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mats.glass.transparent).toBe(true);
    mats.leaf.dispose();
    mats.frame.dispose();
    mats.glass.dispose();
    mats.hardware.dispose();
  });

  it("DoorElement cria leafPivot e toggleOpen altera isOpen", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(performance.now() + 500);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const door = DoorElement.create(DEFAULT_DOOR_CONFIG, "door-test");
    expect(door.userData.leafPivot).toBeTruthy();
    expect(door.userData.isOpen).toBe(false);
    DoorElement.toggleOpen(door, false);
    expect(door.userData.isOpen).toBe(true);
    expect(Math.abs((door.userData.leafPivot as THREE.Group).rotation.y)).toBeGreaterThan(0.5);
    DoorElement.toggleOpen(door, false);
    expect(door.userData.isOpen).toBe(false);
    door.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        const m = c.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    vi.unstubAllGlobals();
  });

  it("WindowElement correr usa modo slide", () => {
    const win = WindowElement.create({ ...DEFAULT_WINDOW_CONFIG, kind: "correr" }, "win-slide");
    expect(win.userData.animMode).toBe("slide");
    WindowElement.setOpen(win, true, false);
    expect(win.userData.isOpen).toBe(true);
    expect((win.userData.leafPivot as THREE.Group).position.x).not.toBe(0);
    win.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        const m = c.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  });

  it("RoomBuilder.toggleElementOpen funciona após addDoor", () => {
    const room = new Room(4, 4, 2.6);
    const walls = createMainWalls(room, 4, 0.2);
    const builder = new RoomBuilder(() => walls);
    const id = builder.addDoorByIndex(0, { ...DEFAULT_DOOR_CONFIG, horizontalOffsetMm: 500 });
    expect(id).toBeTruthy();
    const open = builder.toggleElementOpen(id, false);
    expect(open).toBe(true);
    walls.forEach((w) => {
      w.geometry.dispose();
      const m = w.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    });
  });
});
