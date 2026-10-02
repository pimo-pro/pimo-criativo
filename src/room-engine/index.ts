/**
 * @deprecated Use `src/pimo-room` (fachada M2+) ou `src/pimo-room/domain` (domínio).
 * Shim de compatibilidade — não adicionar lógica nova aqui.
 */
export * from "../pimo-room/domain";
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
} from "../pimo-room/domain";
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
