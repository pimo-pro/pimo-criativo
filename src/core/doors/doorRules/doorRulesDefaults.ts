/**
 * Constantes de referência do sistema de portas (não persistidas em Fase 0/1).
 * Valores alinhados com boxManufacturing.gerarPortas, doorLayerGeometry e DoorFactory.
 */

/** Folga overlay na cutlist industrial de portas (boxManufacturing). */
export const DOOR_OVERLAY_FABRICO_MM = 2;

/** Fase B — folga lateral/topo da porta parcial (mm). */
export const GAVETA_PORTA_SEP_DOOR_GAP_MM = DOOR_OVERLAY_FABRICO_MM;

/** Dimensão mínima editável manualmente (doorLayerGeometry). */
export const DOOR_MIN_HEIGHT_MM = 80;

export const DOOR_MIN_WIDTH_MM = 40;

/** Duração da animação de abertura no viewer (DoorFactory). */
export const DOOR_ANIMATION_DURATION_MS = 2000;
