/**
 * FASE 4 — Etapa 8 (Parte 3): Ponto de extensão para aplicar material visual por peça no preview do layout.
 * Não implementa a aplicação; apenas define o contrato para que o Viewer ou Layout Preview possam,
 * no futuro, registar uma função que aplique visualMaterial, grainDirection e UV a um mesh/alvo.
 */

import type { CutListItemComPreco, LayoutVisualMaterial } from "../types";

export interface PieceMaterialPayload {
  visualMaterial?: LayoutVisualMaterial;
  grainDirection?: string;
  uvScaleOverride?: { x: number; y: number };
  uvRotationOverride?: number;
  /** Peça completa quando disponível (ex.: para faceMaterials). */
  piece?: CutListItemComPreco;
}

/**
 * Função de extensão: aplica material visual por peça ao alvo (ex.: THREE.Mesh no preview).
 * Registar via setApplyPieceMaterialToPreview() para ativar no futuro.
 */
export type ApplyPieceMaterialToPreviewFn = (
  payload: PieceMaterialPayload,
  target: unknown
) => void;

let applyPieceMaterialToPreview: ApplyPieceMaterialToPreviewFn | null = null;

export function setApplyPieceMaterialToPreview(fn: ApplyPieceMaterialToPreviewFn | null): void {
  applyPieceMaterialToPreview = fn;
}

export function getApplyPieceMaterialToPreview(): ApplyPieceMaterialToPreviewFn | null {
  return applyPieceMaterialToPreview;
}
