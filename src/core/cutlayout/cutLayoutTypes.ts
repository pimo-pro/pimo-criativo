/**
 * Tipos para o Layout de Corte (otimização de chapas).
 * FASE 4 Etapa 8 Parte 3: extensão para material visual, UV e grain.
 */

import type { LayoutVisualMaterial, IndustrialGrainCode } from "../types";

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
  /** Dimensões reais da chapa para este material/lote. */
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  sheetThicknessMm?: number;
  quantidade: number;
  boxId: string;
  partName: string;
  materialId?: string;
  materialName?: string;
  /** Alias explícito para manter semântica industrial após nesting/meta. */
  drillHoles?: Array<{
    x: number;
    y: number;
    diameter: number;
    depth: number;
    holeType?: string;
    topDrillable?: boolean;
  }>;
  holes?: Array<{
    x: number;
    y: number;
    diameter: number;
    depth: number;
    holeType?: string;
    topDrillable?: boolean;
  }>;
  /** Furos no espaço original da peça (pré-rotação, pré-espelho). Usado pelo PDF para renderização correta. */
  originalDrillHoles?: Array<{
    x: number;
    y: number;
    diameter: number;
    depth: number;
    holeType?: string;
    topDrillable?: boolean;
  }>;
  /** Comprimento ao longo da fibra (length) = horizontal; width = vertical. Só quando YY. */
  grainDirection?: "length" | "width";
  /** Código industrial YY/XX propagado da cutlist. */
  industrialGrainCode?: IndustrialGrainCode;
  /** Tipo da peça (para eixo de veio fixo). */
  pieceTipo?: string;
  /** Material visual para preview / aplicação no Viewer (MaterialLibrary v2). */
  visualMaterial?: LayoutVisualMaterial;
  /** Override de escala UV por peça. */
  uvScaleOverride?: { x: number; y: number };
  /** Override de rotação UV por peça (graus). */
  uvRotationOverride?: number;
  /** Número sequencial da peça (1-99). */
  pieceNumber?: number;
  /** Metadados industriais adicionais (offsets, flags, regras aplicadas etc.). */
  metadata?: Record<string, unknown>;
  /** Polígono exterior (mm), origem no canto inferior-esquerdo do AABB. Só TAMPO. */
  outerPolygonMm?: Array<{ x: number; y: number }>;
  /** Contornos internos (rasgos, recortes) — coordenadas relativas à peça (x_mm, y_mm). */
  innerContours?: Array<{
    x_mm: number;
    y_mm: number;
    largura_mm: number;
    altura_mm: number;
    innerCircle?: { cx_mm: number; cy_mm: number; diameter_mm: number };
  }>;
};

export type CutPlacement = {
  x_mm: number;
  y_mm: number;
  largura_mm: number;
  altura_mm: number;
  /** Espessura real do painel (mm). Obrigatória para TCN/furos quando difere do stock da chapa. */
  espessura_mm?: number;
  rotacao: number;
  sheetIndex: number;
  boxId: string;
  partName: string;
  materialId?: string;
  materialName?: string;
  /** Alias explícito para manter semântica industrial após nesting/meta. */
  drillHoles?: Array<{
    x: number;
    y: number;
    diameter: number;
    depth: number;
    holeType?: string;
    topDrillable?: boolean;
  }>;
  holes?: Array<{
    x: number;
    y: number;
    diameter: number;
    depth: number;
    holeType?: string;
    topDrillable?: boolean;
  }>;
  /** Furos no espaço original da peça (pré-rotação, pré-espelho). Usado pelo PDF para renderização correta. */
  originalDrillHoles?: Array<{
    x: number;
    y: number;
    diameter: number;
    depth: number;
    holeType?: string;
    topDrillable?: boolean;
  }>;
  /** Número sequencial da peça (1-99). */
  pieceNumber?: number;
  /** Metadados industriais adicionais (offsets, flags, regras aplicadas etc.). */
  metadata?: Record<string, unknown>;
  /** Polígono exterior (mm), origem no canto inferior-esquerdo do AABB. Só TAMPO. */
  outerPolygonMm?: Array<{ x: number; y: number }>;
  /** Contornos internos (rasgos, recortes) — coordenadas relativas à peça (x_mm, y_mm). No TCN são compensados para dentro (-raio da fresa). */
  innerContours?: Array<{
    x_mm: number;
    y_mm: number;
    largura_mm: number;
    altura_mm: number;
    innerCircle?: { cx_mm: number; cy_mm: number; diameter_mm: number };
  }>;
};

export type SheetResult = {
  sheet: SheetDefinition;
  placements: CutPlacement[];
};

export type CutLayoutResult = {
  sheets: SheetResult[];
  diagnostics?: {
    flow: {
      skylineEnabled: boolean;
      shelfEnabled?: boolean;
      guillotineEnabled?: boolean;
      reorderEnabled: boolean;
      gapFillEnabled: boolean;
      gapFillAttempts: number;
      rescueAttempts: number;
      rotationPreferenceMode: "auto" | "aggressive" | "disabled";
      selectedStrategy?: "skyline" | "shelf" | "guillotine";
      selectedBinHeuristic?: "firstFit" | "bestFit";
    };
    trialRuns?: Array<{
      strategy: "skyline" | "shelf" | "guillotine";
      binHeuristic: "firstFit" | "bestFit";
      sheetCount: number;
      usedArea: number;
      wasteArea: number;
      usefulLeftoverArea: number;
      score: number;
    }>;
    metaHeuristics?: {
      iterations: number;
      bestScore: number;
      initialScore: number;
      improvementPercent: number;
      acceptedMoves: number;
      totalMoves: number;
      initialSolutions?: number;
      winningSeed?: number;
      winningStrategy?: "skyline" | "shelf" | "guillotine";
      winningBinHeuristic?: "firstFit" | "bestFit";
      convexHullWasteBySheet?: number[];
      fragmentationScore?: number;
      pocketsCount?: number;
      linearGapScore?: number;
      compactnessScore?: number;
    };
    rejectedByLimit: Array<{
      partName: string;
      boxId: string;
      largura_mm: number;
      altura_mm: number;
      reason: string;
    }>;
    gapFillPlacements: Array<{
      partName: string;
      boxId: string;
      sheetIndex: number;
      rotacao: number;
      x_mm: number;
      y_mm: number;
      largura_mm: number;
      altura_mm: number;
    }>;
  };
};

/** Opções públicas do motor de nesting (runCutLayout / runCutLayoutResult). */
export type CutLayoutRotationPreferenceMode = "auto" | "aggressive" | "disabled";

export type CutLayoutTrialConfig = {
  strategy: "skyline" | "shelf" | "guillotine";
  binHeuristic: "firstFit" | "bestFit";
};

export type CutLayoutMetaHeuristicsOptions = {
  enabled?: boolean;
  iterations?: number;
  initialTemperature?: number;
  coolingRate?: number;
  lnsDestroyRatio?: number;
  multiStartCount?: number;
  seedBase?: number;
};

export type CutLayoutScoreModel = "legacy" | "v32";

export type CutLayoutProgressEvent = {
  phase: "prepare" | "trial" | "meta" | "finalize";
  groupIndex: number;
  groupCount: number;
  stepIndex: number;
  stepCount: number;
  percent: number;
};

export type CutLayoutEngineOptions = {
  sheetLargura_mm?: number;
  sheetAltura_mm?: number;
  kerf_mm?: number;
  minUtilizationPercent?: number;
  rotationWeight?: number;
  rotationPenalty?: number;
  rotationPreferenceMode?: CutLayoutRotationPreferenceMode;
  collectDiagnostics?: boolean;
  groupByThicknessOnly?: boolean;
  strategyTrials?: CutLayoutTrialConfig[];
  useMetaHeuristics?: boolean;
  metaHeuristics?: CutLayoutMetaHeuristicsOptions;
  scoreModel?: CutLayoutScoreModel;
  /** Quando true, normaliza placements para origem top-right após o packing. */
  originTopRight?: boolean;
  onProgress?: (_event: CutLayoutProgressEvent) => void;
  shouldAbort?: () => boolean;
};
