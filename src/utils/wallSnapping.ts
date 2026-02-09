export interface Point {
  x: number;
  z: number;
}

export interface WallEndpoints {
  start: Point;
  end: Point;
}

export interface WallForSnapping {
  position?: Point;
  rotation?: number;
  lengthCm?: number;
}

export function computeWallEndpoints(wall: WallForSnapping): WallEndpoints {
  const angleRad = (wall.rotation ?? 0) * (Math.PI / 180);
  const half = (wall.lengthCm ?? 0) / 2;
  const dx = Math.cos(angleRad) * half;
  const dz = Math.sin(angleRad) * half;

  return {
    start: { x: (wall.position?.x ?? 0) - dx, z: (wall.position?.z ?? 0) - dz },
    end: { x: (wall.position?.x ?? 0) + dx, z: (wall.position?.z ?? 0) + dz },
  };
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
