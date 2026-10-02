/**
 * pimo-room v4 — sincroniza project.room (mm) → wallStore (cm) → RoomManager (m).
 * Padrão semelhante a useViewerSync para WorkspaceBox.
 */
import { useEffect, useRef } from "react";
import type { PimoViewerApi } from "../../context/PimoViewerContextCore";
import type { ProjectRoomConfig } from "../../3d/viewer-engine/room/roomEngineTypes";
import { applyProjectRoomToWallStore } from "../../3d/viewer-engine/room/RoomEngine";
import { useWallStore, wallStore } from "../../stores/wallStore";
import {
  applyRoomMeshFromWallStore,
  applyRoomOpeningsFromWallStore,
  getRoomMeshFingerprintFromWallStore,
} from "../../utils/roomMeshFromWallStore";
import { getActiveViewerCore } from "../../core/viewer/pimoViewerRuntime";
import {
  areRoomFloorCeilingEnabled,
  areRoomOpeningsVisualEnabled,
} from "../../pimo-room/roomVisualGate";

function applyRoomVisualFlags(
  viewerApi: PimoViewerApi,
  room: ProjectRoomConfig,
  showCeiling: boolean
): void {
  viewerApi.setRoomLocked?.(room.locked);
  if (areRoomFloorCeilingEnabled()) {
    viewerApi.setRoomFloorMode?.(room.floorMode);
    viewerApi.setRoomCeilingVisible?.(room.ceilingVisible && showCeiling);
  } else {
    viewerApi.setRoomCeilingVisible?.(false);
    // Força rebuild limpo (gate limpa piso/tecto em ViewerCoreRoomGeometry).
    viewerApi.setRoomFloorMode?.(room.floorMode);
  }
  viewerApi.setRoomHiddenWalls?.(room.hiddenWalls ?? []);
  viewerApi.setRoomUtilities?.(room.utilities ?? []);
  getActiveViewerCore()?.roomManager?.setZones?.(room.zones ?? null);
  if (room.visible !== false) viewerApi.showRoom?.();
  else viewerApi.hideRoom?.();
}

export function useViewerRoomSync(
  viewerApi: PimoViewerApi,
  room: ProjectRoomConfig | null | undefined,
  showCeiling: boolean
): void {
  const roomMeshSyncToken = useWallStore((s) => s.roomMeshSyncToken);
  const lastFingerprintRef = useRef("");
  const visualGateKey = `${areRoomOpeningsVisualEnabled()}:${areRoomFloorCeilingEnabled()}`;

  // SSOT mm → vista cm
  useEffect(() => {
    if (room) {
      applyProjectRoomToWallStore(room);
    } else {
      wallStore.getState().clearRoom();
    }
  }, [room]);

  // wallStore → meshes RoomManager / RoomBuilder
  useEffect(() => {
    if (!viewerApi?.createRoomWithDimensions) return;
    const fingerprint = `${getRoomMeshFingerprintFromWallStore()}|${visualGateKey}`;
    if (fingerprint && fingerprint === lastFingerprintRef.current && viewerApi.getRoomExists?.()) {
      if (room) {
        applyRoomVisualFlags(viewerApi, room, showCeiling);
      }
      return;
    }
    lastFingerprintRef.current = fingerprint;
    applyRoomMeshFromWallStore(viewerApi);
    applyRoomOpeningsFromWallStore(viewerApi);
    if (room) {
      applyRoomVisualFlags(viewerApi, room, showCeiling);
    } else {
      getActiveViewerCore()?.roomManager?.clearZoneOverlay?.();
    }
  }, [viewerApi, roomMeshSyncToken, room, showCeiling, visualGateKey]);
}
