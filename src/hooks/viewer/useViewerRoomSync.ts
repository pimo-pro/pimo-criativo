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

export function useViewerRoomSync(
  viewerApi: PimoViewerApi,
  room: ProjectRoomConfig | null | undefined,
  showCeiling: boolean
): void {
  const roomMeshSyncToken = useWallStore((s) => s.roomMeshSyncToken);
  const lastFingerprintRef = useRef("");

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
    const fingerprint = getRoomMeshFingerprintFromWallStore();
    if (fingerprint && fingerprint === lastFingerprintRef.current && viewerApi.getRoomExists?.()) {
      if (room) {
        viewerApi.setRoomLocked?.(room.locked);
        viewerApi.setRoomFloorMode?.(room.floorMode);
        viewerApi.setRoomCeilingVisible?.(room.ceilingVisible && showCeiling);
        viewerApi.setRoomHiddenWalls?.(room.hiddenWalls ?? []);
        viewerApi.setRoomUtilities?.(room.utilities ?? []);
        if (room.visible !== false) viewerApi.showRoom?.();
        else viewerApi.hideRoom?.();
      }
      return;
    }
    lastFingerprintRef.current = fingerprint;
    applyRoomMeshFromWallStore(viewerApi);
    applyRoomOpeningsFromWallStore(viewerApi);
    if (room) {
      viewerApi.setRoomLocked?.(room.locked);
      viewerApi.setRoomFloorMode?.(room.floorMode);
      viewerApi.setRoomCeilingVisible?.(room.ceilingVisible && showCeiling);
      viewerApi.setRoomHiddenWalls?.(room.hiddenWalls ?? []);
      viewerApi.setRoomUtilities?.(room.utilities ?? []);
      if (room.visible !== false) viewerApi.showRoom?.();
      else viewerApi.hideRoom?.();
    }
  }, [viewerApi, roomMeshSyncToken, room, showCeiling]);
}
