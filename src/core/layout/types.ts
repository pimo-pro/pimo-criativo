/**
 * FASE 3 — Layout Engine
 * Tipos e interfaces principais (placeholders).
 * Nota: layoutWarnings, viewerLayoutAdapter e smartArrange têm os seus próprios tipos; estes são para a API unificada do motor.
 */

/** Dimensões em mm (L×A×P). */
export interface LayoutDimensionsMm {
  largura: number;
  altura: number;
  profundidade: number;
}

/** Posição 2D/3D para colocação. */
export interface LayoutPosition {
  x: number;
  y: number;
  z?: number;
}

/** Uma caixa no contexto do layout engine. */
export interface LayoutBoxInput {
  id: string;
  dimensions: LayoutDimensionsMm;
  /** Posição atual (opcional). */
  position?: LayoutPosition;
  /** Rotação em radianos (eixo Y). */
  rotationY?: number;
}

/** Resultado do cálculo de layout (onde colocar cada caixa). */
export interface LayoutResult {
  placements: Array<{
    boxId: string;
    position: LayoutPosition;
    rotationY?: number;
  }>;
  /** Bounds totais do layout (mm). */
  bounds?: LayoutDimensionsMm;
  /** Avisos (colisões, fora de área). */
  warnings?: string[];
}

/** Opções do motor de layout. */
export interface LayoutEngineOptions {
  /** Espaço entre caixas (mm). */
  gapMm?: number;
  /** Área máxima (mm). */
  maxAreaMm?: LayoutDimensionsMm;
  /** Permitir rotação automática. */
  allowAutoRotate?: boolean;
}
