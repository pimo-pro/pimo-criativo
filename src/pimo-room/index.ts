/**
 * pimo-room — API pública consolidada (M2).
 * Fachada sobre o domínio existente em `pimo-room-v4`.
 * Default da app permanece em pimo-room-v4 até activação (flag / fases seguintes).
 */

export {
  fromExternalGraph,
  toProjectRoomConfig,
  fromProjectRoomConfig,
} from "./convert";

export {
  roomStateFromProjectRoom,
  projectRoomFromRoomState,
} from "./dualPath";

export {
  RoomIndustrialAdapter,
  toAutoRoomFillInput,
  type RoomIndustrialConstraints,
  type RoomFurnitureHint,
  type RoomIndustrialSyncResult,
} from "./industrial";

export {
  ROOM_ENGINE_VERSION,
  ROOM_ENGINE_PHASE,
  PIMO_ROOM_PACKAGE,
  PIMO_ALFA_VERSION,
  PIMO_ALFA_EDITION,
  PIMO_ROOM_CAPABILITIES,
  PIMO_ROOM_FACADE,
} from "./version";

export type { RoomState } from "../pimo-room-v4/RoomState";
export type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
