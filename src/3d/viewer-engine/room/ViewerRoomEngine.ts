/**
 * STUB — ViewerRoomEngine no-op (feature/sala-rebuild-opensource).
 * Mantém API importada pelo ViewerCore / engines.ts.
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

  static ensure(
    current: ViewerRoomEngine | null,
    getManager: () => ViewerRoomManagerLike | null | undefined
  ): ViewerRoomEngine {
    return current ?? new ViewerRoomEngine(getManager);
  }

  createRoomWithDimensions(
    _width: number,
    _depth: number,
    _height: number,
    _numWalls?: 3 | 4,
    _wallThicknessM?: number
  ): void {
    void _width;
    void _depth;
    void _height;
    void _numWalls;
    void _wallThicknessM;
  }

  createRoomFromConfig(_config: RoomConfig): boolean {
    void _config;
    return false;
  }

  removeRoom(): boolean {
    this.getManager()?.removeRoom?.();
    return true;
  }

  setRoomDimensions(_width: number, _depth: number, _height: number): void {
    void _width;
    void _depth;
    void _height;
  }

  addExtraWall(): void {}

  setRoomLocked(_locked: boolean): void {
    void _locked;
  }

  getRoomExists(): boolean {
    return false;
  }

  getRoomLocked(): boolean {
    return false;
  }

  getRoomDimensions(): { width: number; depth: number; height: number } | null {
    return null;
  }

  hideRoom(): void {}

  showRoom(): void {}

  getRoomVisible(): boolean {
    return false;
  }
}
