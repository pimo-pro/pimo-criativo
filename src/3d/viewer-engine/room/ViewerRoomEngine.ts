/**
 * ViewerRoomEngine (Z-01.2.7 C) — API 3D da sala sobre RoomManager.
 * `room/RoomEngine.ts` continua a ser o orquestrador Room 2.0 (wallStore); não duplicar.
 */
import type { RoomConfig } from "../../room/types";

export type ViewerRoomManagerLike = {
  createRoom?: (
    _width: number,
    _depth: number,
    _height: number,
    _numWalls?: 3 | 4,
    _wallThicknessM?: number
  ) => void;
  removeRoom?: () => void;
  setDimensions?: (_width: number, _depth: number, _height: number) => void;
  addExtraWall?: () => void;
  setLocked?: (_locked: boolean) => void;
  hideRoom?: () => void;
  showRoom?: () => void;
  room?: { width: number; depth: number; height: number } | null;
  locked?: boolean;
  visible?: boolean;
};

export function roomConfigToDimensions(config: RoomConfig): {
  widthM: number;
  depthM: number;
  heightM: number;
  numWalls: 3 | 4;
} | null {
  const { walls, numWalls } = config;
  if (!walls?.length || walls.length < 3) return null;
  const w0 = walls[0]?.lengthMm ?? 3000;
  const w2 = walls[Math.min(2, walls.length - 1)]?.lengthMm ?? w0;
  const w1 = walls[1]?.lengthMm ?? w0;
  const w3 = walls.length >= 4 ? (walls[3]?.lengthMm ?? w1) : w1;
  const widthM = Math.max(0.1, (w0 + w2) / 2 / 1000);
  const depthM = Math.max(0.1, (w1 + w3) / 2 / 1000);
  const heightM = Math.max(0.1, ...walls.map((w) => (w.heightMm ?? 2800) / 1000), 2.8);
  const n: 3 | 4 = numWalls === 3 || walls.length === 3 ? 3 : walls.length >= 4 ? 4 : 3;
  return { widthM, depthM, heightM, numWalls: n };
}

export class ViewerRoomEngine {
  private readonly getManager: () => ViewerRoomManagerLike | null | undefined;

  constructor(getManager: () => ViewerRoomManagerLike | null | undefined) {
    this.getManager = getManager;
  }

  createRoomWithDimensions(
    width: number,
    depth: number,
    height: number,
    numWalls?: 3 | 4,
    wallThicknessM?: number
  ): void {
    this.getManager()?.createRoom?.(width, depth, height, numWalls ?? 4, wallThicknessM);
  }

  createRoomFromConfig(config: RoomConfig): boolean {
    const dims = roomConfigToDimensions(config);
    if (!dims) return false;
    this.createRoomWithDimensions(dims.widthM, dims.depthM, dims.heightM, dims.numWalls);
    return true;
  }

  removeRoom(): boolean {
    const manager = this.getManager();
    if (manager?.room) {
      manager.removeRoom?.();
      return true;
    }
    return false;
  }

  setRoomDimensions(width: number, depth: number, height: number): void {
    this.getManager()?.setDimensions?.(width, depth, height);
  }

  addExtraWall(): void {
    this.getManager()?.addExtraWall?.();
  }

  setRoomLocked(locked: boolean): void {
    this.getManager()?.setLocked?.(locked);
  }

  getRoomExists(): boolean {
    return Boolean(this.getManager()?.room);
  }

  getRoomLocked(): boolean {
    return this.getManager()?.locked ?? false;
  }

  getRoomDimensions(): { width: number; depth: number; height: number } | null {
    const room = this.getManager()?.room;
    if (!room) return null;
    return { width: room.width, depth: room.depth, height: room.height };
  }

  hideRoom(): void {
    this.getManager()?.hideRoom?.();
  }

  showRoom(): void {
    this.getManager()?.showRoom?.();
  }

  getRoomVisible(): boolean {
    return this.getManager()?.visible ?? false;
  }
}
