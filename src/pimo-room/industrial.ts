/**
 * pimo-room — fronteira industrial (M2).
 * Reexporta o adapter cutlist-safe; workspaceBoxes permanece [].
 */
export {
  RoomIndustrialAdapter,
  type RoomIndustrialConstraints,
  type RoomFurnitureHint,
  type RoomIndustrialSyncResult,
} from "../pimo-room-v4/RoomIndustrialAdapter";

import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { RoomIndustrialAdapter } from "../pimo-room-v4/RoomIndustrialAdapter";
import type { RoomState } from "../pimo-room-v4/RoomState";

/** Única entrada formal sala → autoRoomFill (ProjectRoomConfig). */
export function toAutoRoomFillInput(state: RoomState): ProjectRoomConfig {
  return RoomIndustrialAdapter.toAutoRoomFillRoom(state);
}
