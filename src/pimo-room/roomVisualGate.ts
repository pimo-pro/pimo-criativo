/**
 * Gate visual de openings / piso / tecto (M6).
 * Default (flag off): visuais activos.
 * roomEngineVNext on: não sincroniza openings mesh nem rebuild de piso/tecto.
 * Schema ProjectRoomConfig permanece intacto.
 */
import { isRoomEngineVNextEnabled } from "../core/features";

export function areRoomOpeningsVisualEnabled(): boolean {
  return !isRoomEngineVNextEnabled();
}

export function areRoomFloorCeilingEnabled(): boolean {
  return !isRoomEngineVNextEnabled();
}
