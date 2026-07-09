/**
 * Nesting V3 — Tipos independentes.
 * Módulo totalmente separado do motor industrial.
 * Lê tipos existentes (read-only), nunca os modifica.
 */

import type { NestingV3Settings } from "./nestingV3Settings";

// ── Furo associado a uma peça ─────────────────────────────────────────────────

export interface V3Hole {
  /** X relativo ao canto inf-esq da peça (mm). */
  x: number;
  /** Y relativo ao canto inf-esq da peça (mm). */
  y: number;
  diameter: number;
  depth: number;
  holeType?: string;
}

// ── Peça (piece) ──────────────────────────────────────────────────────────────

export interface V3Piece {
  /** ID único dentro desta sessão Nesting V3. */
  id: string;
  name: string;
  /** Largura em mm (dimensão X no estado actual, antes de rotação). */
  widthMm: number;
  /** Altura em mm (dimensão Y no estado actual, antes de rotação). */
  heightMm: number;
  thicknessMm: number;
  materialId?: string;
  materialName?: string;
  /** Furos originais (antes de qualquer rotação). Nunca se alteram. */
  originalHoles: V3Hole[];
  /** Rotação atual: 0, 90, 180, 270. */
  rotation: 0 | 90 | 180 | 270;
  /** YY = veio fixo (sem rotação); XX = livre; omitido = peça livre (ex.: rodapé). */
  industrialGrainCode?: "YY" | "XX";
  /**
   * Override por peça: false = veio fixo no nesting; true = permite rodar (ignorado em madeira).
   * Omitido → regra automática (materialMadeira + código industrial).
   */
  allowPieceRotation?: boolean;
  /** true = manter veio (proibir rotação). Auto em material de madeira. */
  lockWoodGrain?: boolean;
  /** Tipo industrial da peça (ex.: rodape, remate, lateral_esquerda). */
  pieceTipo?: string;
  /** Cor de fundo para display 2D. Calculada a partir do material. */
  color: string;
  /** ID da origem (boxId do projeto). Opcional para peças adicionadas manualmente. */
  sourceBoxId?: string;
  sourceProjectId?: string;
  /** Metadata remate propagada da cutlist industrial (viewer → nesting). */
  remateId?: string;
  partIndex?: 1 | 2;
  remateKind?: string;
  followBox?: boolean;
  placementMode?: "SNAPPED" | "FREE";
  rotationSnapIndex?: 0 | 1 | 2 | 3;
  faceOffsets?: {
    offsetAlongNormalMm: number;
    offsetTangentUMm: number;
    offsetTangentVMm: number;
    rotationSnapIndex?: 0 | 1 | 2 | 3;
  };
}

// ── Placement de uma peça num sheet ──────────────────────────────────────────

export interface V3Placement {
  pieceId: string;
  sheetIndex: number;
  /** X do canto sup-esq no sheet (mm). */
  xMm: number;
  /** Y do canto sup-esq no sheet (mm). */
  yMm: number;
  rotated?: boolean;
}

// ── Sheet (folha de madeira) ───────────────────────────────────────────────────

export interface V3Sheet {
  index: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  materialId?: string;
  materialName?: string;
}

// ── Estado completo da sessão V3 ──────────────────────────────────────────────

export interface NestingV3State {
  sheets: V3Sheet[];
  pieces: V3Piece[];
  /** Peças que estão colocadas num sheet. */
  placements: V3Placement[];
  /** Peças na lista lateral (não colocadas em nenhum sheet). */
  unplacedPieceIds: string[];
  /** Configurações de nesting da sessão (folha, margens, kerf, rotação). */
  settings: NestingV3Settings;
  /** @deprecated usar settings.kerfMm */
  kerfMm: number;
  /** Sheet atualmente visível na área central. */
  activeSheetIndex: number;
}

export type V3PiecesByProject = Record<string, V3Piece[]>;

// ── Resultado de auto-layout ──────────────────────────────────────────────────

export interface V3AutoLayoutResult {
  placements: V3Placement[];
  unplacedPieceIds: string[];
  sheetsUsed: number;
  /** Folhas resultantes (motor industrial). */
  sheets?: V3Sheet[];
  /** Peças com rotações actualizadas. */
  pieces?: V3Piece[];
  /** Estratégia vencedora (motor industrial). */
  selectedStrategy?: string;
  selectedBinHeuristic?: string;
}

// ── Dados de drag activo ──────────────────────────────────────────────────────

export interface V3DragState {
  pieceId: string;
  /** Offset do cursor dentro da peça (px). */
  offsetX: number;
  offsetY: number;
  /** Posição actual do cursor na viewport (px). */
  cursorX: number;
  cursorY: number;
  /** De onde vem a peça: "sheet" | "sidebar". */
  source: "sheet" | "sidebar";
  sourcePlacement?: V3Placement;
}
