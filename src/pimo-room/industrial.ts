/**
 * pimo-room — fronteira industrial (M2).
 * Reexporta o adapter cutlist-safe via domínio unificado; workspaceBoxes permanece [].
 */
export {
  RoomIndustrialAdapter,
  type RoomIndustrialConstraints,
  type RoomFurnitureHint,
  type RoomIndustrialSyncResult,
} from "./domain";

import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { RoomIndustrialAdapter, type RoomState } from "./domain";

/** Única entrada formal sala → autoRoomFill (ProjectRoomConfig). */
export function toAutoRoomFillInput(state: RoomState): ProjectRoomConfig {
  return RoomIndustrialAdapter.toAutoRoomFillRoom(state);
}
