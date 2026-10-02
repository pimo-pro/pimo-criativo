/**
 * @deprecated Use `src/pimo-room` (fachada M2+) ou `src/pimo-room-v4` (domínio).
 * Shim de compatibilidade — não adicionar lógica nova aqui.
 */
export * from "../pimo-room-v4";
export {
  PimoRoom,
  loadRoom,
  importIfc,
  importGlb,
  exportGlb,
  applyAiPreset,
  autoArrange,
  autoDesign,
  getRoomState,
  setRoomState,
} from "../pimo-room-v4";
export {
  fromExternalGraph,
  toProjectRoomConfig,
  fromProjectRoomConfig,
  roomStateFromProjectRoom,
  projectRoomFromRoomState,
  toAutoRoomFillInput,
  PimoRoomRenderer,
  createRoomRenderer,
  PIMO_ROOM_FACADE,
} from "../pimo-room";
