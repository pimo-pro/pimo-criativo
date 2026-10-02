/**
 * Sync directo ProjectRoomConfig (mm) → meshes Viewer (m) — M7.
 * Usado quando roomEngineVNext está activo; wallStore permanece vista UI.
 */
import type { PimoViewerApi } from "../context/PimoViewerContextCore";
import { getActiveViewerCore } from "../core/viewer/pimoViewerRuntime";
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { WALL_LABEL_TO_INDEX } from "../3d/viewer-engine/room/roomEngineTypes";
import { mmToM } from "../3d/viewer-engine/room/roomUnitConversion";
import { areRoomOpeningsVisualEnabled } from "./roomVisualGate";

function sortedWalls(room: ProjectRoomConfig) {
  return room.walls
    .slice()
    .sort((a, b) => WALL_LABEL_TO_INDEX[a.label] - WALL_LABEL_TO_INDEX[b.label]);
}

export function getProjectRoomMeshFingerprint(room: ProjectRoomConfig | null | undefined): string {
  if (!room || room.walls.length < 3) return "";
  return JSON.stringify({
    widthMm: room.widthMm,
    depthMm: room.depthMm,
    heightMm: room.heightMm,
    wallThicknessMm: room.wallThicknessMm,
    walls: sortedWalls(room).map((w) => ({
      id: w.id,
      label: w.label,
      widthMm: w.widthMm,
      heightMm: w.heightMm,
      thicknessMm: w.thicknessMm,
      position: w.position,
      rotationDeg: w.rotationDeg,
    })),
    openings: room.openings.map((o) => ({
      id: o.id,
      type: o.type,
      kind: o.kind,
      wallId: o.wallId,
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      thicknessMm: o.thicknessMm,
      floorOffsetMm: o.floorOffsetMm,
      xPosMm: o.xPosMm,
    })),
  });
}

export function applyRoomMeshFromProjectRoom(
  viewerApi: Pick<PimoViewerApi, "createRoomWithDimensions" | "removeRoom"> | null | undefined,
  room: ProjectRoomConfig
): void {
  if (!viewerApi?.createRoomWithDimensions) return;
  const walls = sortedWalls(room);
  if (walls.length < 3) {
    viewerApi.removeRoom?.();
    return;
  }
  const widthM = Math.max(0.5, mmToM(room.widthMm));
  const depthM = Math.max(0.5, mmToM(room.depthMm));
  const heightM = Math.max(0.5, mmToM(room.heightMm));
  const thicknessM = Math.max(0.05, mmToM(room.wallThicknessMm));
  const numWalls: 3 | 4 = walls.length >= 4 ? 4 : 3;
  viewerApi.createRoomWithDimensions(widthM, depthM, heightM, numWalls, thicknessM);

  const manager = getActiveViewerCore()?.roomManager;
  if (!manager?.addWallFromConfig) return;

  walls.forEach((wall, index) => {
    const lengthMm = wall.widthMm ?? wall.lengthMm;
    const config = {
      id: index,
      lengthM: Math.max(0.1, mmToM(lengthMm)),
      heightM: Math.max(0.1, mmToM(wall.heightMm)),
      thicknessM: Math.max(0.05, mmToM(wall.thicknessMm)),
      position: {
        x: mmToM(wall.position.x),
        y: mmToM(wall.position.y ?? wall.heightMm / 2),
        z: mmToM(wall.position.z),
      },
      rotationDeg: wall.rotationDeg ?? 0,
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

export function applyRoomOpeningsFromProjectRoom(
  viewerApi: Pick<PimoViewerApi, "addDoorToRoom" | "addWindowToRoom" | "getRoomExists"> | null | undefined,
  room: ProjectRoomConfig
): void {
  if (!areRoomOpeningsVisualEnabled()) return;
  if (!viewerApi?.addDoorToRoom || !viewerApi.addWindowToRoom) return;
  if (!viewerApi.getRoomExists?.()) return;

  const walls = sortedWalls(room);
  const wallIndexById = new Map(walls.map((w, i) => [w.id, i]));

  for (const o of room.openings) {
    const wallIndex = wallIndexById.get(o.wallId);
    if (wallIndex == null) continue;
    const config = {
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      thicknessMm: o.thicknessMm,
      kind: o.kind,
      floorOffsetMm: o.floorOffsetMm ?? o.verticalOffsetMm,
      horizontalOffsetMm: o.xPosMm ?? o.horizontalOffsetMm,
    };
    if (o.type === "door") {
      viewerApi.addDoorToRoom!(wallIndex, config, o.id);
    } else {
      viewerApi.addWindowToRoom!(wallIndex, config, o.id);
    }
  }
}
