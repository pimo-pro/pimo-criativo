/**
 * pimo-room — conversão domínio ↔ ProjectRoomConfig (M2).
 * Reutiliza RoomConverter / RoomBridge de pimo-room-v4 (sem formatos externos).
 */
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { RoomBridge } from "../pimo-room-v4/RoomBridge";
import { RoomConverter } from "../pimo-room-v4/RoomConverter";
import type { RoomState } from "../pimo-room-v4/RoomState";

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
