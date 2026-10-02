/**
 * IRoomRenderer — superfície estável do renderer de sala (M1).
 * Implementação actual: ViewerRoomEngine → RoomManager (legado).
 * Novas implementações devem cumprir este contrato sem alterar PimoViewerApi.
 */
import type { RoomConfig } from "../../room/types";

export interface IRoomRenderer {
  createRoomWithDimensions(
    width: number,
    depth: number,
    height: number,
    numWalls?: 3 | 4,
    wallThicknessM?: number
  ): void;
  createRoomFromConfig(config: RoomConfig): boolean;
  removeRoom(): boolean;
  setRoomDimensions(width: number, depth: number, height: number): void;
  addExtraWall(): void;
  setRoomLocked(locked: boolean): void;
  getRoomExists(): boolean;
  getRoomLocked(): boolean;
  getRoomDimensions(): { width: number; depth: number; height: number } | null;
  hideRoom(): void;
  showRoom(): void;
  getRoomVisible(): boolean;
}
