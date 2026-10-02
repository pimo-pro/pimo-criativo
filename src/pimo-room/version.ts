/**
 * pimo-room — versões (M2 fachada).
 * Fonte de verdade continua em pimo-room/domain até M9.
 */
export {
  ROOM_ENGINE_VERSION,
  ROOM_ENGINE_PHASE,
  PIMO_ROOM_PACKAGE,
  PIMO_ALFA_VERSION,
  PIMO_ALFA_EDITION,
  PIMO_ROOM_CAPABILITIES,
} from "./domain/version";

/** Identificador do pacote fachada M2. */
export const PIMO_ROOM_FACADE = "pimo-room" as const;
