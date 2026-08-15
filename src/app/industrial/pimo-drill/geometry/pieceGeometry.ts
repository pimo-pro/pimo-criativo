import type { PieceModel } from '../pimoDrillTypes';

/** mm → metros (padrão PIMO / Three.js). */
export function mmToMeters(mm: number): number {
  return mm / 1000;
}

/** Evita mesh/SVG colapsados. */
export function sanitizeMm(value: number, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function sanitizePiece(piece: PieceModel): PieceModel {
  return {
    id: piece.id || 'piece-main',
    lengthMm: sanitizeMm(piece.lengthMm),
    widthMm: sanitizeMm(piece.widthMm),
    thicknessMm: sanitizeMm(piece.thicknessMm),
  };
}

/**
 * Tamanho da caixa em metros.
 * Convenção F2: L→X, W→Y, T→Z (origem no canto da peça).
 */
export function pieceSizeM(piece: PieceModel): { x: number; y: number; z: number } {
  const p = sanitizePiece(piece);
  return {
    x: mmToMeters(p.lengthMm),
    y: mmToMeters(p.widthMm),
    z: mmToMeters(p.thicknessMm),
  };
}

/**
 * Centro da peça se a origem estiver no canto (0,0,0) da caixa.
 * Não usar para posicionar a mesh no viewer 3D (peça fica em [0,0,0]).
 * Reservado para features locais (F3).
 */
export function pieceCenterOffsetM(piece: PieceModel): { x: number; y: number; z: number } {
  const s = pieceSizeM(piece);
  return { x: s.x / 2, y: s.y / 2, z: s.z / 2 };
}
