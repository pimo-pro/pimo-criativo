/**
 * Dual-path SSOT sala (M3): flag off → legado directo; flag on → fachada pimo-room/domain.
 * Ambos os ramos usam a mesma lógica de conversão → paridade.
 */
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { isRoomEngineVNextEnabled } from "../core/features";
import { RoomConverter, type RoomState } from "./domain";
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
