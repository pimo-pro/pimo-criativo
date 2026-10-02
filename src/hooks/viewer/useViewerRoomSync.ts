/**
 * Sincroniza project.room (mm) → meshes do viewer (m).
 * M10.b: sem wallStore — SSOT directo via applyRoomMeshFromProjectRoom.
 */
import { useEffect, useRef } from "react";
import type { PimoViewerApi } from "../../context/PimoViewerContextCore";
import type { ProjectRoomConfig } from "../../3d/viewer-engine/room/roomEngineTypes";
import { getActiveViewerCore } from "../../core/viewer/pimoViewerRuntime";
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
  const lastFingerprintRef = useRef("");
  const visualGateKey = `${areRoomOpeningsVisualEnabled()}:${areRoomFloorCeilingEnabled()}`;

  useEffect(() => {
    if (!viewerApi?.createRoomWithDimensions) return;

    if (!room) {
      lastFingerprintRef.current = "";
      viewerApi.removeRoom?.();
      getActiveViewerCore()?.roomManager?.clearZoneOverlay?.();
      return;
    }

    const fingerprint = `${getProjectRoomMeshFingerprint(room)}|${visualGateKey}|direct`;

    if (fingerprint && fingerprint === lastFingerprintRef.current && viewerApi.getRoomExists?.()) {
      applyRoomVisualFlags(viewerApi, room, showCeiling);
      return;
    }
    lastFingerprintRef.current = fingerprint;

    applyRoomMeshFromProjectRoom(viewerApi, room);
    applyRoomOpeningsFromProjectRoom(viewerApi, room);
    applyRoomVisualFlags(viewerApi, room, showCeiling);
  }, [viewerApi, room, showCeiling, visualGateKey]);
}
