/**
 * Gate visual de openings / piso / tecto (M6) — activação vNext.
 * flag ON → visuais ON; flag OFF → legado (visuais ON).
 * Schema ProjectRoomConfig permanece intacto.
 */
export function areRoomOpeningsVisualEnabled(): boolean {
  return true;
}

export function areRoomFloorCeilingEnabled(): boolean {
  return true;
}
