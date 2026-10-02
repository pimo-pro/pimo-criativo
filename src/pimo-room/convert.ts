/**
 * pimo-room — conversão domínio ↔ ProjectRoomConfig (M2).
 * Usa domínio unificado em ./domain (Bridge / Converter).
 */
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { RoomBridge, RoomConverter, type RoomState } from "./domain";

/**
 * Aceita RoomState, ProjectRoomConfig ou floorplan JSON já suportado pelo RoomBridge.
 * Nome alinhado ao plano M2 — não introduz grafo open-source externo.
 */
export function fromExternalGraph(graph: unknown): RoomState {
  return RoomBridge.jsonToRoomState(graph);
}

/** RoomState (nível activo) → contrato congelado ProjectRoomConfig. */
export function toProjectRoomConfig(state: RoomState): ProjectRoomConfig {
  return RoomConverter.toProjectRoomConfig(state);
}

/** ProjectRoomConfig → RoomState (via converter existente). */
export function fromProjectRoomConfig(room: ProjectRoomConfig): RoomState {
  return RoomConverter.fromProjectRoomConfig(room);
}
