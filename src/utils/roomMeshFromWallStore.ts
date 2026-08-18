/**
 * Sincroniza a sala 3D (RoomManager) com o estado persistido em wallStore após loadRoomConfig / clearRoom
 * e recria portas/janelas no RoomBuilder a partir das openings do snapshot.
 */

import type { PimoViewerApi } from "../context/PimoViewerContextCore";
import { getActiveViewerCore } from "../core/viewer/pimoViewerRuntime";
import { getRoomDimensionsCm, wallStore } from "../stores/wallStore";
import { ROOM_20_DEFAULTS } from "../3d/viewer-engine/room/RoomEngine";
import { wallStorePositionToViewerMeters } from "./roomCoordinates";

export function applyRoomMeshFromWallStore(
  viewerApi: Pick<PimoViewerApi, "createRoomWithDimensions" | "removeRoom"> | null | undefined
): void {
  if (!viewerApi?.createRoomWithDimensions) return;
  const { walls } = wallStore.getState();
  if (!walls || walls.length < 3) {
    viewerApi.removeRoom?.();
    return;
  }
  const dims = getRoomDimensionsCm(walls);
  if (!dims) {
    viewerApi.removeRoom?.();
    return;
  }
  const widthM = Math.max(0.5, dims.widthCm / 100);
  const depthM = Math.max(0.5, dims.depthCm / 100);
  const heightM = Math.max(0.5, dims.heightCm / 100);
  const thicknessCm = walls[0]?.thicknessCm ?? ROOM_20_DEFAULTS.wallThicknessMm / 10;
  const thicknessM = Math.max(0.05, thicknessCm / 100);
  const numWalls: 3 | 4 = walls.length >= 4 ? 4 : 3;
  viewerApi.createRoomWithDimensions(widthM, depthM, heightM, numWalls, thicknessM);
  const manager = getActiveViewerCore()?.roomManager;
  if (!manager?.addWallFromConfig) return;
  walls.forEach((wall, index) => {
    const position = wallStorePositionToViewerMeters(wall, walls, dims.widthCm, dims.depthCm);
    const config = {
      id: index,
      lengthM: Math.max(0.1, wall.lengthCm / 100),
      heightM: Math.max(0.1, wall.heightCm / 100),
      thicknessM: Math.max(0.05, wall.thicknessCm / 100),
      position,
      rotationDeg: wall.rotation ?? 0,
    };
    if (index < numWalls) {
      manager.updateWallFromConfig?.(config);
      return;
    }
    manager.addWallFromConfig?.({
      ...config,
      isMainWall: false,
    });
  });
  manager.updateCamera?.();
}

export function getRoomMeshFingerprintFromWallStore(): string {
  const { walls } = wallStore.getState();
  if (!walls || walls.length < 3) return "";
  return JSON.stringify(
    walls.map((wall) => ({
      id: wall.id,
      lengthCm: wall.lengthCm,
      heightCm: wall.heightCm,
      thicknessCm: wall.thicknessCm,
      position: wall.position,
      rotation: wall.rotation,
      openings: (wall.openings ?? []).map((o) => ({
        id: o.id,
        type: o.type,
        kind: o.kind,
        widthMm: o.widthMm,
        heightMm: o.heightMm,
        thicknessMm: o.thicknessMm,
        floorOffsetMm: o.floorOffsetMm,
        horizontalOffsetMm: o.horizontalOffsetMm,
      })),
    }))
  );
}

/** Chamado após applyRoomMeshFromWallStore quando existe sala; preserva ids das openings para UI/sync. */
export function applyRoomOpeningsFromWallStore(
  viewerApi: Pick<PimoViewerApi, "addDoorToRoom" | "addWindowToRoom" | "getRoomExists"> | null | undefined
): void {
  if (!viewerApi?.addDoorToRoom || !viewerApi.addWindowToRoom) return;
  if (!viewerApi.getRoomExists?.()) return;
  const { walls } = wallStore.getState();
  walls.forEach((wall, wallIndex) => {
    for (const o of wall.openings ?? []) {
      const config = {
        widthMm: o.widthMm,
        heightMm: o.heightMm,
        thicknessMm: o.thicknessMm,
        kind: o.kind,
        floorOffsetMm: o.floorOffsetMm,
        horizontalOffsetMm: o.horizontalOffsetMm,
      };
      if (o.type === "door") {
        viewerApi.addDoorToRoom!(wallIndex, config, o.id);
      } else {
        viewerApi.addWindowToRoom!(wallIndex, config, o.id);
      }
    }
  });
}
