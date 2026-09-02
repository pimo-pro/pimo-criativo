/**
 * Limites da sala no plano do projeto (mm), sistema centrado (RoomManager / ViewerCore).
 * Interior da sala: X ∈ [-W/2, W/2], Z ∈ [-D/2, D/2]. O clamp em XZ usa meia-dimensão da caixa.
 */
import type { WorkspaceBox } from "../core/types";
import type { Wall } from "../stores/wallStore";
import { getRoomDimensionsCm } from "../stores/wallStore";
import { wallStoreWallFootprintXZMm } from "../3d/room/roomDynamicBounds";

/** Recuo adicional nas paredes para colisão no estado do projeto (0 = encostar ao limite interior da sala). */
export const ROOM_COLLISION_INSET_MM = 0;

const SPAWN_MARGIN_MM = 100;
const SPAWN_STEP_EXTRA_MM = 80;

export function hasPersistedRoomWalls(walls: Wall[]): boolean {
  return walls.length >= 3;
}

export type FloorBoundsMm = {
  minX_mm: number;
  maxX_mm: number;
  minZ_mm: number;
  maxZ_mm: number;
  minY_mm: number;
  maxY_mm: number;
};

export function getFloorBoundsMmFromWalls(walls: Wall[]): FloorBoundsMm | null {
  const dims = getRoomDimensionsCm(walls);
  if (!dims) return null;
  const widthMm = dims.widthCm * 10;
  const depthMm = dims.depthCm * 10;
  const heightMm = dims.heightCm * 10;
  let minX_mm = -widthMm / 2;
  let maxX_mm = widthMm / 2;
  let minZ_mm = -depthMm / 2;
  let maxZ_mm = depthMm / 2;
  for (const wall of walls) {
    const fp = wallStoreWallFootprintXZMm(wall);
    minX_mm = Math.min(minX_mm, fp.minX);
    maxX_mm = Math.max(maxX_mm, fp.maxX);
    minZ_mm = Math.min(minZ_mm, fp.minZ);
    maxZ_mm = Math.max(maxZ_mm, fp.maxZ);
  }
  return {
    minX_mm,
    maxX_mm,
    minZ_mm,
    maxZ_mm,
    minY_mm: 0,
    maxY_mm: heightMm,
  };
}

export function getInnerBoundsXZMm(
  bounds: FloorBoundsMm,
  applyCollisionInset: boolean
): { minX_mm: number; maxX_mm: number; minZ_mm: number; maxZ_mm: number } {
  const inset = applyCollisionInset ? ROOM_COLLISION_INSET_MM : 0;
  return {
    minX_mm: bounds.minX_mm + inset,
    maxX_mm: bounds.maxX_mm - inset,
    minZ_mm: bounds.minZ_mm + inset,
    maxZ_mm: bounds.maxZ_mm - inset,
  };
}

export function xzHalfExtentsMm(larguraMm: number, profundidadeMm: number, rotacaoY_rad: number): { hx: number; hz: number } {
  const c = Math.abs(Math.cos(rotacaoY_rad));
  const s = Math.abs(Math.sin(rotacaoY_rad));
  const hw = Math.max(1, larguraMm) / 2;
  const hd = Math.max(1, profundidadeMm) / 2;
  return { hx: c * hw + s * hd, hz: s * hw + c * hd };
}

export function clampBoxCenterXZMm(
  centerX_mm: number,
  centerZ_mm: number,
  larguraMm: number,
  profundidadeMm: number,
  rotacaoY_rad: number,
  inner: { minX_mm: number; maxX_mm: number; minZ_mm: number; maxZ_mm: number }
): { x_mm: number; z_mm: number } {
  const { hx, hz } = xzHalfExtentsMm(larguraMm, profundidadeMm, rotacaoY_rad);
  const minCx = inner.minX_mm + hx;
  const maxCx = inner.maxX_mm - hx;
  const minCz = inner.minZ_mm + hz;
  const maxCz = inner.maxZ_mm - hz;
  if (minCx > maxCx || minCz > maxCz) {
    return {
      x_mm: (inner.minX_mm + inner.maxX_mm) / 2,
      z_mm: (inner.minZ_mm + inner.maxZ_mm) / 2,
    };
  }
  return {
    x_mm: Math.min(maxCx, Math.max(minCx, centerX_mm)),
    z_mm: Math.min(maxCz, Math.max(minCz, centerZ_mm)),
  };
}

/**
 * Spawn no piso: centro da sala + deslocamento em grelha por índice (número de caixas existentes).
 */
export function getRoomGridSpawnMm(
  existingBoxCount: number,
  larguraMm: number,
  profundidadeMm: number,
  bounds: FloorBoundsMm,
  rotacaoY_rad = 0
): { x_mm: number; z_mm: number; rotacaoY: number } {
  const margin = SPAWN_MARGIN_MM;
  const inner = getInnerBoundsXZMm(bounds, false);
  const usableW = Math.max(0, inner.maxX_mm - inner.minX_mm - 2 * margin);
  const centerX = (inner.minX_mm + inner.maxX_mm) / 2;
  const centerZ = (inner.minZ_mm + inner.maxZ_mm) / 2;
  const stepX = Math.max(larguraMm + SPAWN_STEP_EXTRA_MM, 200);
  const stepZ = Math.max(profundidadeMm + SPAWN_STEP_EXTRA_MM, 200);
  const cols = Math.max(1, Math.floor(usableW / stepX) || 1);
  const col = existingBoxCount % cols;
  const row = Math.floor(existingBoxCount / cols);
  const cx = centerX + (col - (cols - 1) / 2) * stepX;
  const cz = centerZ + row * stepZ;
  const spawnInner = {
    minX_mm: inner.minX_mm + margin,
    maxX_mm: inner.maxX_mm - margin,
    minZ_mm: inner.minZ_mm + margin,
    maxZ_mm: inner.maxZ_mm - margin,
  };
  const clamped = clampBoxCenterXZMm(cx, cz, larguraMm, profundidadeMm, rotacaoY_rad, spawnInner);
  return { x_mm: clamped.x_mm, z_mm: clamped.z_mm, rotacaoY: rotacaoY_rad };
}

export function isBoxCenterOutsideRoomXZ(
  box: WorkspaceBox,
  bounds: FloorBoundsMm,
  applyCollisionInset: boolean
): boolean {
  const w = box.dimensoes?.largura ?? 0;
  const d = box.dimensoes?.profundidade ?? 0;
  const inner = getInnerBoundsXZMm(bounds, applyCollisionInset);
  const { hx, hz } = xzHalfExtentsMm(w, d, box.rotacaoY ?? 0);
  const cx = box.posicaoX_mm ?? 0;
  const cz = box.posicaoZ_mm ?? 0;
  return cx - hx < inner.minX_mm || cx + hx > inner.maxX_mm || cz - hz < inner.minZ_mm || cz + hz > inner.maxZ_mm;
}

const STACK_GAP_MM = 50;
const STACK_MARGIN_MM = 100;

/**
 * Apenas caixas fora dos limites (com inset de colisão) são movidas;
 * empilha a partir do canto minX/minZ com pequeno espaçamento.
 */
export function repositionOutsiderBoxesStackedFromCornerMm(boxes: WorkspaceBox[], bounds: FloorBoundsMm): WorkspaceBox[] {
  const inner = getInnerBoundsXZMm(bounds, true);
  let cursorX = inner.minX_mm + STACK_MARGIN_MM;
  let cursorZ = inner.minZ_mm + STACK_MARGIN_MM;
  let rowMaxDepth = 0;

  return boxes.map((box) => {
    if (!isBoxCenterOutsideRoomXZ(box, bounds, true)) return box;
    const w = Math.max(1, box.dimensoes?.largura ?? 400);
    const d = Math.max(1, box.dimensoes?.profundidade ?? 500);
    const rot = box.rotacaoY ?? 0;
    const { hx } = xzHalfExtentsMm(w, d, rot);

    let cx = cursorX + w / 2;
    let cz = cursorZ + d / 2;
    if (cx + hx > inner.maxX_mm - STACK_MARGIN_MM) {
      cursorX = inner.minX_mm + STACK_MARGIN_MM;
      cursorZ += rowMaxDepth + STACK_GAP_MM;
      rowMaxDepth = 0;
      cx = cursorX + w / 2;
      cz = cursorZ + d / 2;
    }
    const clamped = clampBoxCenterXZMm(cx, cz, w, d, rot, inner);
    cursorX += w + STACK_GAP_MM;
    rowMaxDepth = Math.max(rowMaxDepth, d);
    return { ...box, posicaoX_mm: clamped.x_mm, posicaoZ_mm: clamped.z_mm, manualPosition: true };
  });
}
