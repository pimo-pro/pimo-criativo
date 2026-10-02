/**
 * Dual-path SSOT sala (M3): flag off → pimo-room-v4; flag on → fachada pimo-room.
 * Ambos os ramos usam a mesma lógica de conversão hoje → paridade com default off.
 */
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { isRoomEngineVNextEnabled } from "../core/features";
import { RoomConverter } from "../pimo-room-v4/RoomConverter";
import type { RoomState } from "../pimo-room-v4/RoomState";
import {
  fromProjectRoomConfig as facadeFromProjectRoom,
  toProjectRoomConfig as facadeToProjectRoom,
} from "./convert";

export function roomStateFromProjectRoom(room: ProjectRoomConfig): RoomState {
  if (isRoomEngineVNextEnabled()) {
    return facadeFromProjectRoom(room);
  }
  return RoomConverter.fromProjectRoomConfig(room);
}

export function projectRoomFromRoomState(state: RoomState): ProjectRoomConfig {
  if (isRoomEngineVNextEnabled()) {
    return facadeToProjectRoom(state);
  }
  return RoomConverter.toProjectRoomConfig(state);
}
