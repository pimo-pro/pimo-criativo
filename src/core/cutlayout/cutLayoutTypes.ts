/**
 * Tipos para o Layout de Corte (otimização de chapas).
 * FASE 4 Etapa 8 Parte 3: extensão para material visual, UV e grain.
 */

import type { LayoutVisualMaterial } from "../types";

export type SheetDefinition = {
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  materialId?: string;
  materialName?: string;
};

export type CutPiece = {
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  quantidade: number;
  boxId: string;
  partName: string;
  materialId?: string;
  materialName?: string;
  /** Comprimento ao longo da fibra (length) = horizontal; width = vertical. */
  grainDirection?: "length" | "width";
  /** Material visual para preview / aplicação no Viewer (MaterialLibrary v2). */
  visualMaterial?: LayoutVisualMaterial;
  /** Override de escala UV por peça. */
  uvScaleOverride?: { x: number; y: number };
  /** Override de rotação UV por peça (graus). */
  uvRotationOverride?: number;
};

export type CutPlacement = {
  x_mm: number;
  y_mm: number;
  largura_mm: number;
  altura_mm: number;
  rotacao: number;
  sheetIndex: number;
  boxId: string;
  partName: string;
  materialId?: string;
  materialName?: string;
};

export type SheetResult = {
  sheet: SheetDefinition;
  placements: CutPlacement[];
};

export type CutLayoutResult = {
  sheets: SheetResult[];
};
