/**
 * Gate de snap/encaixe de caixas nas paredes (M5).
 * Default (flag off): snap activo.
 * roomEngineVNext on: ModelWallSnap / candidatos room-opening desligados (UX only; CNC intacto).
 */
import { isRoomEngineVNextEnabled } from "../core/features";

export function isRoomWallSnapEnabled(): boolean {
  return !isRoomEngineVNextEnabled();
}
