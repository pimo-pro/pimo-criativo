/**
 * pimo-room v4 — sincroniza project.room (mm) → wallStore (cm) → RoomManager (m).
 * M7: com roomEngineVNext, meshes vêm directamente de project.room (wallStore = vista UI).
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
import { isRoomEngineVNextEnabled } from "../../core/features";
import {
  areRoomFloorCeilingEnabled,
  areRoomOpeningsVisualEnabled,
} from "../../pimo-room/roomVisualGate";
import {
  applyRoomMeshFromProjectRoom,
  applyRoomOpeningsFromProjectRoom,
  getProjectRoomMeshFingerprint,
} from "../../pimo-room/applyRoomMeshFromProjectRoom";

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
  const useDirectMesh = isRoomEngineVNextEnabled();

  // SSOT mm → vista cm (UI / selecção; mantém-se em ambos os paths)
  useEffect(() => {
    if (room) {
      applyProjectRoomToWallStore(room);
    } else {
      wallStore.getState().clearRoom();
    }
  }, [room]);

  // Meshes: legado wallStore → mesh | M7 directo project.room → mesh
  useEffect(() => {
    if (!viewerApi?.createRoomWithDimensions) return;

    if (!room) {
      lastFingerprintRef.current = "";
      viewerApi.removeRoom?.();
      getActiveViewerCore()?.roomManager?.clearZoneOverlay?.();
      return;
    }

    const fingerprint = useDirectMesh
      ? `${getProjectRoomMeshFingerprint(room)}|${visualGateKey}|direct`
      : `${getRoomMeshFingerprintFromWallStore()}|${visualGateKey}|legacy`;

    if (fingerprint && fingerprint === lastFingerprintRef.current && viewerApi.getRoomExists?.()) {
      applyRoomVisualFlags(viewerApi, room, showCeiling);
      return;
    }
    lastFingerprintRef.current = fingerprint;

    if (useDirectMesh) {
      applyRoomMeshFromProjectRoom(viewerApi, room);
      applyRoomOpeningsFromProjectRoom(viewerApi, room);
    } else {
      applyRoomMeshFromWallStore(viewerApi);
      applyRoomOpeningsFromWallStore(viewerApi);
    }
    applyRoomVisualFlags(viewerApi, room, showCeiling);
  }, [viewerApi, roomMeshSyncToken, room, showCeiling, visualGateKey, useDirectMesh]);
}
