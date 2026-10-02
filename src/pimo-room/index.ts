/**
 * pimo-room — API pública consolidada (M2 + activação vNext).
 * Domínio unificado em ./domain; mesh em ./mesh; legado pimo-room/domain mantido até M10.
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
  areRoomAdvancedHostsEnabled,
  gatedSyncLevelGhosts,
  gatedSyncCatalogItems,
  gatedSyncIfcPreviewFromRoomState,
  gatedShowAiPreview,
  gatedClearAiPreview,
  gatedAnimateApplyAiLayout,
  gatedStartWalkthrough,
  gatedStopWalkthrough,
} from "./advancedHostsGate";

export { isRoomWallSnapEnabled } from "./wallSnapGate";

export {
  areRoomOpeningsVisualEnabled,
  areRoomFloorCeilingEnabled,
} from "./roomVisualGate";

export {
  applyRoomMeshFromProjectRoom,
  applyRoomOpeningsFromProjectRoom,
  getProjectRoomMeshFingerprint,
} from "./applyRoomMeshFromProjectRoom";

export { PimoRoomRenderer } from "./PimoRoomRenderer";
export { createRoomRenderer, ensureRoomRenderer } from "./createRoomRenderer";

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

export type { RoomState } from "./domain";
export type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";

export { RoomMeshEngine } from "./mesh/RoomMeshEngine";
export {
  wallMeshBuilder,
  floorMeshBuilder,
  ceilingMeshBuilder,
  openingsMeshBuilder,
} from "./mesh";
export {
  RoomBridge,
  RoomConverter,
} from "./domain";