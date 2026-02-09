/**
 * Tipos para o Room Builder (sistema de paredes e sala).
 * Paredes e aberturas são apenas para visualização; não entram em cutlist, preços ou produção.
 *
 * Estrutura preparada para expansão futura sem reescrever a base:
 * - RoomConfig: numWalls, walls[], selectedWallId; pode ser estendido com materiais, cor chão, etc.
 * - WallConfig: position, rotation, lengthMm, heightMm, thicknessMm, color?, openings[]; campos opcionais para novos atributos.
 * - OpeningConfig: modelId? para biblioteca de portas/janelas; tipo "door"|"window" extensível.
 */

/** IDs de modelos de porta/janela (para futura biblioteca). Por agora só o padrão. */
export const DEFAULT_DOOR_MODEL_ID = "default";
export const DEFAULT_WINDOW_MODEL_ID = "default";

export type DoorWindowModelId = typeof DEFAULT_DOOR_MODEL_ID | string;
export type DoorWindowModelCatalog = {
  doors: Array<{ id: DoorWindowModelId; name: string }>;
  windows: Array<{ id: DoorWindowModelId; name: string }>;
};

/** Configuração de uma abertura (porta ou janela) na parede. */
export type OpeningConfig = {
  id: string;
  type: "door" | "window";
  widthMm: number;
  heightMm: number;
  /** Altura do piso (offset Y em mm, do chão até a base). */
  floorOffsetMm: number;
  /** Posição horizontal na parede (offset em mm ao longo do eixo da parede). */
  horizontalOffsetMm: number;
  /** ID do modelo de porta/janela (para futura biblioteca; default = "default"). */
  modelId?: string;
};

/** Configuração de uma parede independente. position/rotation em metros e graus. */
export type WallConfig = {
  id: string;
  /** Posição do centro da parede no mundo (metros). */
  position: { x: number; z: number };
  /** Rotação em graus (eixo Y). */
  rotation: number;
  lengthMm: number;
  heightMm: number;
  thicknessMm: number;
  color?: string;
  openings: OpeningConfig[];
};

export type RoomConfig = {
  /** Número de paredes (3 ou 4). Array walls deve ter esse tamanho. */
  numWalls: 3 | 4;
  walls: WallConfig[];
  /** ID da parede selecionada (para outline). */
  selectedWallId?: string | null;
};

export const DEFAULT_WALL_THICKNESS_MM = 120;

/** Configuração de porta ou janela (formato interno para DoorElement/WindowElement). */
export type DoorWindowConfig = {
  widthMm: number;
  heightMm: number;
  floorOffsetMm: number;
  horizontalOffsetMm: number;
};

export const DEFAULT_DOOR_THICKNESS_MM = 40;
/** Cor das aberturas (portas/janelas) no viewer — distinta das paredes. */
export const DEFAULT_ELEMENT_COLOR = 0x94a3b8;

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
