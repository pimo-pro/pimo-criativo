/**
 * Tipos para o Room Builder (sistema de paredes e sala).
 * Paredes são apenas para visualização; não entram em cutlist, preços ou produção.
 */

export type WallConfig = {
  lengthMm: number;
  heightMm: number;
};

export type RoomConfig = {
  numWalls: 1 | 2 | 3 | 4;
  walls: WallConfig[];
  /** Espessura fixa em mm (ex: 120). */
  thicknessMm?: number;
};

export const DEFAULT_WALL_THICKNESS_MM = 120;

/** Configuração de porta ou janela na parede. Coordenadas em mm, relativas à parede. */
export type DoorWindowConfig = {
  widthMm: number;
  heightMm: number;
  /** Altura do piso (offset Y em mm, do chão até a base). */
  floorOffsetMm: number;
  /** Posição horizontal na parede (offset em mm ao longo do eixo da parede). */
  horizontalOffsetMm: number;
};

export const DEFAULT_DOOR_THICKNESS_MM = 40;
export const DEFAULT_ELEMENT_COLOR = 0xcbd5e1;

export const DEFAULT_DOOR_CONFIG: DoorWindowConfig = {
  widthMm: 900,
  heightMm: 2100,
  floorOffsetMm: 0,
  horizontalOffsetMm: 0,
};

export const DEFAULT_WINDOW_CONFIG: DoorWindowConfig = {
  widthMm: 1200,
  heightMm: 1200,
  floorOffsetMm: 900,
  horizontalOffsetMm: 0,
};
