/**
 * Representa uma sala com dimensões em metros (pimo-room v4).
 * Usado pelo RoomManager para criar e posicionar paredes e piso.
 * Por omissão a origem fica no canto; para sistema centrado use originX=-width/2.
 */
export class Room {
  /** Largura (eixo X) em metros. */
  width: number;
  /** Profundidade (eixo Z) em metros. */
  depth: number;
  /** Altura (eixo Y) em metros. */
  height: number;
  /** Origem X da sala no mundo (metros). Centro da sala em X = originX + width/2. */
  originX: number;
  /** Origem Z da sala no mundo (metros). Centro da sala em Z = originZ + depth/2. */
  originZ: number;

  constructor(
    width: number,
    depth: number,
    height: number,
    originX = 0,
    originZ = 0
  ) {
    this.width = Math.max(0.1, width);
    this.depth = Math.max(0.1, depth);
    this.height = Math.max(0.1, height);
    this.originX = originX;
    this.originZ = originZ;
  }

  get minX(): number {
    return this.originX;
  }
  get maxX(): number {
    return this.originX + this.width;
  }
  get minZ(): number {
    return this.originZ;
  }
  get maxZ(): number {
    return this.originZ + this.depth;
  }
  get minY(): number {
    return 0;
  }
  get maxY(): number {
    return this.height;
  }
  get centerX(): number {
    return this.originX + this.width / 2;
  }
  get centerZ(): number {
    return this.originZ + this.depth / 2;
  }
}

/** Dimensões padrão Room 2.0: 4m × 2.5m × 2.6m */
export const DEFAULT_ROOM_WIDTH = 4;
export const DEFAULT_ROOM_DEPTH = 2.5;
export const DEFAULT_ROOM_HEIGHT = 2.6;
