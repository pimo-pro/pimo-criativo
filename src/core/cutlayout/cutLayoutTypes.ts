/**
 * Tipos para o Layout de Corte (otimização de chapas).
 */

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
  grainDirection?: "length" | "width";
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
