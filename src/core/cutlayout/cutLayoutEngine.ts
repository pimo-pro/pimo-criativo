/**
 * Nesting Engine v2:
 * - Multi-heurística: skyline, shelf, guillotine.
 * - Bin-packing: first-fit e best-fit.
 * - Seleção automática da melhor tentativa por score global.
 * - Mantém rotação 0/90, kerf e compatibilidade de saída para CNC.
 */

import type {
  CutPiece,
  CutPlacement,
  CutLayoutEngineOptions,
  SheetDefinition,
  SheetResult,
  CutLayoutResult,
  CutLayoutMetaHeuristicsOptions as MetaHeuristicsOptions,
  CutLayoutScoreModel as ScoreModel,
  CutLayoutTrialConfig as TrialConfig,
} from "./cutLayoutTypes";
import type { LayoutVisualMaterial, OperationResult, IndustrialGrainCode } from "../types";
import { industrialGrainToLayoutAxis } from "../materials/grainDirection";
import {
  resolveNestingLayoutGrainDirection,
} from "../materials/nestingGrainLock";
import { buildCutlistRotationMetadata } from "../manufacturing/cutlistRotationMetadata";
import { copyDrillHolesLocalUnmodified } from "./utils/cutLayoutGeomRotation";
import { traceHolePipeline } from "./utils/holeGeomInvariant";
import { getDefaultOfficialMaterial, resolveMaterial, resolveIndustrialMaterialAtThickness, COSTA_FIXED_THICKNESS_MM, DRAWER_SIDE_THICKNESS_MM } from "../materials/materials.api";
import { getIndustrialMaterial, getMaterialByIdOrLabel } from "../materials/service";
import {
  applyFixedMarginOffset as applyFixedMarginOffsetUtil,
  cloneSheets as cloneSheetsUtil,
  createUsableSheetArea as createUsableSheetAreaUtil,
  estimateUsefulLeftover as estimateUsefulLeftoverUtil,
  expandPieces as expandPiecesUtil,
  flattenPlacements as flattenPlacementsUtil,
  getPieceArea as getPieceAreaUtil,
  groupByMaterialAndThickness as groupByMaterialAndThicknessUtil,
  groupByThicknessOnly as groupByThicknessOnlyUtil,
  isInsideSheet as isInsideSheetUtil,
  isRotatablePiece as isRotatablePieceUtil,
  layoutFromPlacements as layoutFromPlacementsUtil,
  overlaps as overlapsUtil,
  reorderPieces as reorderPiecesUtil,
} from "./utils/cutLayoutUtils";
import {
  createSeededRng as createSeededRngUtil,
  randomInt as randomIntUtil,
  shuffleArray as shuffleArrayUtil,
  type SeededRng,
} from "./utils/cutLayoutRng";
import {
  monotonicHull as monotonicHullUtil,
  polygonArea as polygonAreaUtil,
  rectArea as rectAreaUtil,
  rectIntersectArea as rectIntersectAreaUtil,
} from "./utils/cutLayoutGeometry";
import {
  findPlacementSkyline as findPlacementSkylineSolver,
  getCandidateX as getCandidateXSolver,
  getSkylineYAt as getSkylineYAtSolver,
  mergeSkylineSegments as mergeSkylineSegmentsSolver,
  updateSkyline as updateSkylineSolver,
} from "./solver/strategySkyline";
import { findPlacementShelf as findPlacementShelfSolver } from "./solver/strategyShelf";
import {
  findPlacementGuillotine as findPlacementGuillotineSolver,
  pruneContainedFreeRects as pruneContainedFreeRectsSolver,
} from "./solver/strategyGuillotine";
import {
  initStrategyState as initStrategyStateSolver,
  updateStrategyState as updateStrategyStateSolver,
} from "./solver/strategyState";
import {
  findPlacementForPiece as findPlacementForPieceSelector,
  pickBestPieceForSheet as pickBestPieceForSheetSelector,
} from "./solver/placementSelector";
import {
  buildCandidateCoordinates as buildCandidateCoordinatesScoring,
  computePlacementCompactnessScore as computePlacementCompactnessScoreScoring,
  findBestResidualPlacement as findBestResidualPlacementScoring,
  getSheetBoundingBox as getSheetBoundingBoxScoring,
  scorePlacement as scorePlacementScoring,
} from "./scoring/placementScoring";
import {
  chooseOrientationWithRotationBias as chooseOrientationWithRotationBiasScoring,
  getOrientations as getOrientationsScoring,
  pickBestCandidateByRotation as pickBestCandidateByRotationScoring,
  scoreOrientationFit as scoreOrientationFitScoring,
  type PlacementCandidate,
  type RotationScoringConfig,
} from "./scoring/rotationScoring";
import {
  computeSheetAdvancedMetrics as computeSheetAdvancedMetricsScoring,
  type SheetAdvancedMetrics,
} from "./scoring/advancedMetrics";
import {
  computeSolutionMetrics as computeSolutionMetricsScoring,
  type GlobalScoreMetrics,
} from "./scoring/solutionMetrics";
import type { ContextoChapa } from "./scoring/placementScoring";
import { optimizeLastSheetLocally as optimizeLastSheetLocallyOpt } from "./optimization/lastSheetRefine";
import {
  applyLnsRepack as applyLnsRepackOpt,
  mutatePlacements as mutatePlacementsOpt,
  optimizeWithMetaHeuristics as optimizeWithMetaHeuristicsOpt,
} from "./optimization/metaheuristics";
import {
  simulateTrialForGroup as simulateTrialForGroupPipeline,
  type SimulateTrialForGroupDeps,
  type SimulateTrialForGroupResult,
} from "./pipeline/trialRunner";
import { runCutLayout as runCutLayoutPipeline, type RunCutLayoutDeps } from "./pipeline/layoutPipeline";
import { runCutLayoutResult as runCutLayoutResultPipeline } from "./pipeline/resultWrapper";
import { buildBoxNomeByIdFromBoxes, cutlistItemsWithCutLayoutProNames } from "./cutLayoutProPieceNaming";

export type { CutLayoutEngineOptions } from "./cutLayoutTypes";

type PlacementStrategy = "skyline" | "shelf" | "guillotine";
type BinHeuristic = "firstFit" | "bestFit";
type ReorderMode = "production" | "gapFill";

type PlacedRect = { x: number; y: number; w: number; h: number };
type SkylineSegment = { x: number; y: number };
type Shelf = { y: number; height: number; nextX: number };
type FreeRect = { x: number; y: number; w: number; h: number };

type MetaMove = "swapBetweenSheets" | "movePieceAcrossSheets" | "reorderSheet" | "flipRotation";

/** Formato de furo para layout/TCN (normalizado a partir de drillHoles ou legado). */
export type NormalizedHoleForPiece = {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  holeType?: string;
  topDrillable?: boolean;
};

export type CutlistItemForPieces = {
  dimensoes: { largura: number; altura: number; profundidade: number };
  espessura: number;
  quantidade: number;
  boxId?: string;
  nome: string;
  tipo: string;
  material?: string;
  materialId?: string;
  /** Furos reais do painel (fonte única para Layout PRO e TCN). */
  drillHoles?: Array<{ x: number; y: number; diameter: number; depth: number; holeType?: string; face?: string; topDrillable?: boolean }>;
  metadata?: Record<string, unknown>;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  sheetThicknessMm?: number;
  grainDirection?: IndustrialGrainCode;
  visualMaterial?: LayoutVisualMaterial;
  uvScaleOverride?: { x: number; y: number };
  uvRotationOverride?: number;
};

type StateSkyline = { skyline: SkylineSegment[] };
type StateShelf = { shelves: Shelf[] };
type StateGuillotine = { freeRects: FreeRect[] };
type StrategyState = StateSkyline | StateShelf | StateGuillotine;

export function getPieceArea(piece: CutPiece): number {
  return getPieceAreaUtil(piece);
}

function calculateSheetUtilization(placedRects: PlacedRect[], sheetW: number, sheetH: number): number {
  const sheetArea = Math.max(1, sheetW * sheetH);
  const usedArea = placedRects.reduce((acc, r) => acc + r.w * r.h, 0);
  return usedArea / sheetArea;
}

function isInsideSheet(x: number, y: number, w: number, h: number, sheet: SheetDefinition): boolean {
  return isInsideSheetUtil(x, y, w, h, sheet);
}

function createUsableSheetArea(sheet: SheetDefinition, marginMm: number): SheetDefinition {
  return createUsableSheetAreaUtil(sheet, marginMm);
}

function applyFixedMarginOffset(
  sheets: SheetResult[],
  physicalSheet: SheetDefinition,
  marginMm: number
): SheetResult[] {
  return applyFixedMarginOffsetUtil(sheets, physicalSheet, marginMm);
}

function overlaps(x: number, y: number, w: number, h: number, placed: PlacedRect[], kerf: number): boolean {
  return overlapsUtil(x, y, w, h, placed, kerf);
}

function expandPieces(pieces: CutPiece[]): CutPiece[] {
  return expandPiecesUtil(pieces);
}

function groupByMaterialAndThickness(pieces: CutPiece[]): Map<string, CutPiece[]> {
  return groupByMaterialAndThicknessUtil(pieces);
}

function groupByThicknessOnly(pieces: CutPiece[]): Map<string, CutPiece[]> {
  return groupByThicknessOnlyUtil(pieces);
}

const isRotatablePiece = (piece: CutPiece): boolean => isRotatablePieceUtil(piece);

function reorderPieces(pieces: CutPiece[], mode: ReorderMode = "production"): CutPiece[] {
  return reorderPiecesUtil(pieces, mode);
}

export function buildCandidateCoordinates(
  placed: CutPlacement[],
  pieceW: number,
  pieceH: number,
  sheet: SheetDefinition,
  kerf: number
): Array<{ x: number; y: number }> {
  return buildCandidateCoordinatesScoring(placed, pieceW, pieceH, sheet, kerf);
}

function computePlacementCompactnessScore(
  x: number,
  y: number,
  w: number,
  h: number,
  sheet: SheetDefinition
): number {
  return computePlacementCompactnessScoreScoring(x, y, w, h, sheet);
}

function findBestResidualPlacement(
  target: CutPlacement,
  existing: CutPlacement[],
  sheet: SheetDefinition,
  kerf: number
): CutPlacement | null {
  return findBestResidualPlacementScoring(target, existing, sheet, kerf, {
    isInsideSheet,
    overlaps,
  });
}

function getSheetBoundingBox(placements: CutPlacement[]) {
  return getSheetBoundingBoxScoring(placements);
}

function optimizeLastSheetLocally(
  sheets: SheetResult[],
  sheet: SheetDefinition,
  kerf: number,
  scoreModel: ScoreModel
): SheetResult[] {
  return optimizeLastSheetLocallyOpt(sheets, sheet, kerf, scoreModel, {
    getSheetBoundingBox,
    isInsideSheet,
    overlaps,
    findBestResidualPlacement,
    computePlacementCompactnessScore,
    cloneSheets,
    computeSolutionMetrics,
  });
}

function scoreOrientationFit(
  candidate: { x: number; y: number; w: number; h: number },
  sheet: SheetDefinition
): number {
  return scoreOrientationFitScoring(candidate, sheet);
}

function getOrientations(piece: CutPiece, cfg: RotationScoringConfig): Array<{ w: number; h: number; rotation: number }> {
  return getOrientationsScoring(piece, cfg, isRotatablePiece);
}

function chooseOrientationWithRotationBias(
  normal: PlacementCandidate | null,
  rotated: PlacementCandidate | null,
  cfg: RotationScoringConfig
): PlacementCandidate | null {
  return chooseOrientationWithRotationBiasScoring(normal, rotated, cfg);
}

function pickBestCandidateByRotation(candidates: PlacementCandidate[], rotation: 0 | 90): PlacementCandidate | null {
  return pickBestCandidateByRotationScoring(candidates, rotation);
}

export function getSkylineYAt(skyline: SkylineSegment[], x: number): number {
  return getSkylineYAtSolver(skyline, x);
}

export function mergeSkylineSegments(segments: SkylineSegment[]): SkylineSegment[] {
  return mergeSkylineSegmentsSolver(segments);
}

export function updateSkyline(
  skyline: SkylineSegment[],
  x: number,
  y: number,
  w: number,
  h: number,
  kerf: number
): SkylineSegment[] {
  return updateSkylineSolver(skyline, x, y, w, h, kerf);
}

export function getCandidateX(skyline: SkylineSegment[], sheetW: number, pieceW: number): number[] {
  return getCandidateXSolver(skyline, sheetW, pieceW);
}

function findPlacementSkyline(
  piece: CutPiece,
  sheet: SheetDefinition,
  placed: PlacedRect[],
  state: StateSkyline,
  kerf: number,
  cfg: RotationScoringConfig,
  bin: BinHeuristic
): PlacementCandidate | null {
  return findPlacementSkylineSolver(piece, sheet, placed, state, kerf, cfg, bin, {
    getOrientations,
    overlaps,
    scoreOrientationFit,
    pickBestCandidateByRotation,
    chooseOrientationWithRotationBias,
  }) as PlacementCandidate | null;
}

function findPlacementShelf(
  piece: CutPiece,
  sheet: SheetDefinition,
  placed: PlacedRect[],
  state: StateShelf,
  kerf: number,
  cfg: RotationScoringConfig,
  bin: BinHeuristic
): PlacementCandidate | null {
  return findPlacementShelfSolver(piece, sheet, placed, state, kerf, cfg, bin, {
    getOrientations,
    overlaps,
    scoreOrientationFit,
    pickBestCandidateByRotation,
    chooseOrientationWithRotationBias,
  }) as PlacementCandidate | null;
}

export function pruneContainedFreeRects(rects: FreeRect[]): FreeRect[] {
  return pruneContainedFreeRectsSolver(rects);
}

function findPlacementGuillotine(
  piece: CutPiece,
  sheet: SheetDefinition,
  _placed: PlacedRect[],
  state: StateGuillotine,
  _kerf: number,
  cfg: RotationScoringConfig,
  bin: BinHeuristic
): PlacementCandidate | null {
  return findPlacementGuillotineSolver(piece, sheet, _placed, state, _kerf, cfg, bin, {
    getOrientations,
    scoreOrientationFit,
    pickBestCandidateByRotation,
    chooseOrientationWithRotationBias,
  }) as PlacementCandidate | null;
}

function updateStrategyState(
  strategy: PlacementStrategy,
  state: StrategyState,
  placement: PlacementCandidate,
  kerf: number
): StrategyState {
  const solverPlacement = {
    x: placement.x,
    y: placement.y,
    w: placement.w,
    h: placement.h,
    rotation: placement.rotation,
  };
  return updateStrategyStateSolver(strategy, state, solverPlacement, kerf) as StrategyState;
}

function findPlacementForPiece(
  piece: CutPiece,
  strategy: PlacementStrategy,
  sheet: SheetDefinition,
  placedRects: PlacedRect[],
  state: StrategyState,
  kerf: number,
  rotationCfg: RotationScoringConfig,
  bin: BinHeuristic
): PlacementCandidate | null {
  return findPlacementForPieceSelector(piece, strategy, sheet, placedRects, state, kerf, rotationCfg, bin, {
    findPlacementSkyline,
    findPlacementShelf,
    findPlacementGuillotine,
  });
}

function initStrategyState(strategy: PlacementStrategy, sheet: SheetDefinition): StrategyState {
  return initStrategyStateSolver(strategy, sheet) as StrategyState;
}

function scorePlacement(
  sheet: SheetDefinition,
  placement: PlacementCandidate,
  currentUtilization: number,
  rotationCfg: RotationScoringConfig
): number {
  return scorePlacementScoring(sheet, placement, currentUtilization, rotationCfg);
}

function pickBestPieceForSheet(
  remaining: CutPiece[],
  sheet: SheetDefinition,
  strategy: PlacementStrategy,
  state: StrategyState,
  placedRects: PlacedRect[],
  kerf: number,
  searchWindow: number,
  rotationCfg: RotationScoringConfig,
  bin: BinHeuristic,
  ctx?: ContextoChapa
): { index: number; placement: PlacementCandidate } | null {
  return pickBestPieceForSheetSelector(
    remaining,
    sheet,
    strategy,
    state,
    placedRects,
    kerf,
    searchWindow,
    rotationCfg,
    bin,
    {
      findPlacementSkyline,
      findPlacementShelf,
      findPlacementGuillotine,
      calculateSheetUtilization,
      scorePlacement,
    },
    ctx
  );
}

function estimateUsefulLeftover(sheet: SheetDefinition, placed: PlacedRect[]): number {
  return estimateUsefulLeftoverUtil(sheet, placed);
}

function cloneSheets(sheets: SheetResult[]): SheetResult[] {
  return cloneSheetsUtil(sheets);
}

function flattenPlacements(sheets: SheetResult[]): CutPlacement[] {
  return flattenPlacementsUtil(sheets);
}

function layoutFromPlacements(
  placements: CutPlacement[],
  sheet: SheetDefinition
): { sheets: SheetResult[]; rejectedByLimit: Array<{ partName: string; boxId: string; largura_mm: number; altura_mm: number; reason: string }> } {
  return layoutFromPlacementsUtil(placements, sheet);
}

function computeSolutionMetrics(sheets: SheetResult[], sheet: SheetDefinition, scoreModel: ScoreModel = "legacy"): GlobalScoreMetrics {
  return computeSolutionMetricsScoring(sheets, sheet, scoreModel, {
    estimateUsefulLeftover,
    computeSheetAdvancedMetrics,
  });
}

function randomInt(maxExclusive: number): number {
  return randomIntUtil(maxExclusive);
}

function createSeededRng(seed: number): SeededRng {
  return createSeededRngUtil(seed);
}

function shuffleArray<T>(arr: T[], rng: SeededRng): T[] {
  return shuffleArrayUtil(arr, rng);
}

function rectArea(r: PlacedRect): number {
  return rectAreaUtil(r);
}

function rectIntersectArea(a: PlacedRect, b: PlacedRect): number {
  return rectIntersectAreaUtil(a, b);
}

function monotonicHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  return monotonicHullUtil(points);
}

function polygonArea(poly: Array<{ x: number; y: number }>): number {
  return polygonAreaUtil(poly);
}

function computeSheetAdvancedMetrics(sheet: SheetDefinition, placements: CutPlacement[]): SheetAdvancedMetrics {
  return computeSheetAdvancedMetricsScoring(sheet, placements, {
    rectArea,
    rectIntersectArea,
    monotonicHull,
    polygonArea,
  });
}

export function mutatePlacements(
  placements: CutPlacement[],
  move: MetaMove,
  _sheet: SheetDefinition,
  rng?: SeededRng
): CutPlacement[] {
  return mutatePlacementsOpt(placements, move, _sheet, rng, { randomInt });
}

export function applyLnsRepack(
  placements: CutPlacement[],
  sheet: SheetDefinition,
  kerf: number,
  minUtilizationPercent: number,
  rotationCfg: RotationScoringConfig,
  destroyRatio: number,
  rng?: SeededRng,
  trialPool?: TrialConfig[],
  scoreModel: ScoreModel = "legacy"
): SheetResult[] {
  return applyLnsRepackOpt(
    placements,
    sheet,
    kerf,
    minUtilizationPercent,
    rotationCfg,
    destroyRatio,
    rng,
    trialPool,
    scoreModel,
    {
      randomInt,
      simulateTrialForGroup,
      computeSolutionMetrics,
    }
  );
}

function optimizeWithMetaHeuristics(
  initialSheets: SheetResult[],
  sheet: SheetDefinition,
  kerf: number,
  minUtilizationPercent: number,
  rotationCfg: RotationScoringConfig,
  meta: Required<MetaHeuristicsOptions>,
  seed: number = 1,
  trialPool?: TrialConfig[],
  scoreModel: ScoreModel = "legacy",
  budgetMs?: number
): {
  sheets: SheetResult[];
  diagnostics: {
    iterations: number;
    bestScore: number;
    initialScore: number;
    improvementPercent: number;
    acceptedMoves: number;
    totalMoves: number;
  };
} {
  return optimizeWithMetaHeuristicsOpt(
    initialSheets,
    sheet,
    kerf,
    minUtilizationPercent,
    rotationCfg,
    meta,
    seed,
    trialPool,
    scoreModel,
    {
      randomInt,
      createSeededRng,
      cloneSheets,
      flattenPlacements,
      layoutFromPlacements,
      computeSolutionMetrics,
      simulateTrialForGroup,
    },
    budgetMs
  );
}

const SIMULATE_TRIAL_GROUP_DEPS: SimulateTrialForGroupDeps = {
  reorderPieces,
  initStrategyState,
  pickBestPieceForSheet,
  isInsideSheet,
  updateStrategyState,
  findPlacementForPiece,
  calculateSheetUtilization,
  optimizeLastSheetLocally,
  computeSolutionMetrics,
};

function simulateTrialForGroup(
  pieces: CutPiece[],
  sheet: SheetDefinition,
  kerf: number,
  minUtilizationPercent: number,
  rotationCfg: RotationScoringConfig,
  trial: TrialConfig,
  collectDiagnostics: boolean,
  forceInputOrder: boolean = false,
  scoreModel: ScoreModel = "legacy"
): SimulateTrialForGroupResult {
  return simulateTrialForGroupPipeline(
    pieces,
    sheet,
    kerf,
    minUtilizationPercent,
    rotationCfg,
    trial,
    collectDiagnostics,
    forceInputOrder,
    scoreModel,
    SIMULATE_TRIAL_GROUP_DEPS
  );
}

const RUN_CUT_LAYOUT_DEPS: RunCutLayoutDeps = {
  expandPieces,
  groupByMaterialAndThickness,
  groupByThicknessOnly,
  createUsableSheetArea,
  applyFixedMarginOffset,
  simulateTrialForGroup,
  cloneSheets,
  createSeededRng,
  shuffleArray,
  optimizeWithMetaHeuristics,
  computeSolutionMetrics,
};

export type CutlistToPiecesLayoutProNaming = {
  projectName: string;
  boxes: ReadonlyArray<{ id: string; nome?: string }>;
};

export function cutlistToPieces(
  items: CutlistItemForPieces[],
  layoutProPieceNaming?: CutlistToPiecesLayoutProNaming
): CutPiece[] {
  const sourceItems =
    layoutProPieceNaming != null
      ? cutlistItemsWithCutLayoutProNames(
          items,
          layoutProPieceNaming.projectName.trim() || "Projeto",
          buildBoxNomeByIdFromBoxes(layoutProPieceNaming.boxes)
        )
      : items;
  return sourceItems.flatMap((item) => {
    const raw = [
      Number(item.dimensoes?.largura) || 0,
      Number(item.dimensoes?.altura) || 0,
      Number(item.dimensoes?.profundidade) || 0,
    ].filter((n) => Number.isFinite(n) && n > 0);
    const dims = raw.length >= 2 ? [...raw].sort((a, b) => b - a) : [Math.max(raw[0] ?? 1, 1), 1];
    const tipoToken = String((item as { tipo?: unknown }).tipo ?? "").trim().toLowerCase();
    const nomeToken = String(item.nome ?? "").trim().toLowerCase();
    const isCosta = tipoToken === "costa" || nomeToken === "costa";
    const isDrawerSideOrBack =
      tipoToken === "gaveta_lat_esq" ||
      tipoToken === "gaveta_lat_dir" ||
      tipoToken === "gaveta_traseira";
    const rawEsp = Number(item.espessura ?? item.dimensoes?.profundidade);
    const materialKey = item.materialId ?? item.material;
    const espIndustrialFallback =
      materialKey && String(materialKey).trim()
        ? getIndustrialMaterial(String(materialKey).trim()).espessuraPadrao
        : getDefaultOfficialMaterial().industrialDefaults!.espessuraPadrao;
    const costaMatRef = isCosta
      ? String(item.materialId ?? item.material ?? "").trim()
      : "";
    const costaOfficial = isCosta && costaMatRef ? resolveMaterial(costaMatRef) : null;
    const drawerSideMatRef = isDrawerSideOrBack
      ? String(item.materialId ?? item.material ?? "").trim()
      : "";
    const drawerSideOfficial =
      isDrawerSideOrBack && drawerSideMatRef ? resolveMaterial(drawerSideMatRef) : null;
    const esp = isCosta
      ? Number.isFinite(rawEsp) && rawEsp > 0
        ? rawEsp
        : COSTA_FIXED_THICKNESS_MM
      : isDrawerSideOrBack
        ? Number.isFinite(rawEsp) && rawEsp > 0
          ? rawEsp
          : DRAWER_SIDE_THICKNESS_MM
        : Number.isFinite(rawEsp) && rawEsp > 0
          ? rawEsp
          : espIndustrialFallback;
    const pieceMaterialId = isCosta
      ? (costaOfficial?.canonicalId ?? (costaMatRef || undefined))
      : isDrawerSideOrBack
        ? (drawerSideOfficial?.canonicalId ?? (drawerSideMatRef || undefined))
        : (() => {
            const bodyMatRef = String(item.materialId ?? item.material ?? "").trim();
            if (!bodyMatRef) return item.materialId ?? item.material;
            const atThickness = resolveIndustrialMaterialAtThickness(
              bodyMatRef,
              esp,
              getDefaultOfficialMaterial().canonicalId
            );
            return atThickness.materialId;
          })();
    const pieceMaterialName = isCosta
      ? (costaOfficial?.label ?? item.material ?? costaMatRef)
      : isDrawerSideOrBack
        ? (drawerSideOfficial?.label ?? item.material ?? drawerSideMatRef)
        : (() => {
            const bodyMatRef = String(item.materialId ?? item.material ?? "").trim();
            if (!bodyMatRef) return item.material;
            const atThickness = resolveIndustrialMaterialAtThickness(
              bodyMatRef,
              esp,
              getDefaultOfficialMaterial().canonicalId
            );
            return atThickness.label;
          })();
    const materialRef = isCosta
      ? pieceMaterialId
      : isDrawerSideOrBack
        ? pieceMaterialId
        : (item.materialId ?? item.material);
    const materialRecord = materialRef ? getMaterialByIdOrLabel(String(materialRef)) : null;
    const sheetWidthMm = Number(item.sheetWidthMm ?? materialRecord?.sheetWidthMm);
    const sheetHeightMm = Number(item.sheetHeightMm ?? materialRecord?.sheetHeightMm);
    // A espessura da peça deve ser a fonte principal para o pipeline CNC.
    // Só respeitar sheetThicknessMm quando vier explicitamente no item.
    const explicitSheetThickness = Number(item.sheetThicknessMm);
    const sheetThicknessMm = Number.isFinite(explicitSheetThickness) && explicitSheetThickness > 0
      ? explicitSheetThickness
      : esp;
    const industrialCode = item.grainDirection;
    const itemMeta = (item as { metadata?: Record<string, unknown> }).metadata;
    const metaAllow = itemMeta?.allowPieceRotation;
    const metaLock = itemMeta?.lockWoodGrain;
    const rotationMeta = buildCutlistRotationMetadata({
      allowPieceRotation:
        metaAllow === true ? true : metaAllow === false ? false : undefined,
      lockWoodGrain:
        metaLock === true ? true : metaLock === false ? false : undefined,
      materialId: pieceMaterialId,
    });
    const origL = Number(item.dimensoes?.largura) || 0;
    const origA = Number(item.dimensoes?.altura) || 0;
    const largura = Math.round(Math.max(origL > 0 ? origL : dims[0] ?? 1, 1));
    const altura = Math.round(Math.max(origA > 0 ? origA : dims[1] ?? 1, 1));
    const normalizedHoles = copyDrillHolesLocalUnmodified(item.drillHoles as never, largura, altura);
    const nestingGrain = resolveNestingLayoutGrainDirection({
      materialId: pieceMaterialId,
      industrialGrainCode: industrialCode,
      pieceTipo: item.tipo,
      allowPieceRotation: rotationMeta.allowPieceRotation,
      lockWoodGrain: rotationMeta.lockWoodGrain,
    });
    const grainDirection =
      nestingGrain ??
      (industrialCode === "YY" ? industrialGrainToLayoutAxis("YY", item.tipo) : undefined);
    const pieces: CutPiece[] = [];
    const itemWithMeta = item as typeof item & { pieceNumber?: number; shortCode?: string };
    const qty = Math.max(1, Number(item.quantidade) || 1);
    for (let i = 0; i < qty; i++) {
      pieces.push({
        largura_mm: largura,
        altura_mm: altura,
        espessura_mm: esp,
        sheetWidthMm: Number.isFinite(sheetWidthMm) && sheetWidthMm > 0 ? sheetWidthMm : undefined,
        sheetHeightMm: Number.isFinite(sheetHeightMm) && sheetHeightMm > 0 ? sheetHeightMm : undefined,
        sheetThicknessMm: Number.isFinite(sheetThicknessMm) && sheetThicknessMm > 0 ? sheetThicknessMm : undefined,
        quantidade: 1,
        boxId: item.boxId ?? "",
        partName: item.nome,
        materialId: pieceMaterialId,
        materialName: pieceMaterialName,
        drillHoles: normalizedHoles,
        holes: normalizedHoles,
        grainDirection,
        industrialGrainCode: industrialCode,
        pieceTipo: item.tipo,
        visualMaterial: item.visualMaterial,
        uvScaleOverride: item.uvScaleOverride,
        uvRotationOverride: item.uvRotationOverride,
        pieceNumber: itemWithMeta.pieceNumber,
        shortCode: itemWithMeta.shortCode,
        metadata: {
          ...(itemMeta ?? {}),
          ...rotationMeta,
          holeDesignLarguraMm: largura,
          holeDesignAlturaMm: altura,
        },
      });
      if (normalizedHoles?.length) {
        traceHolePipeline({
          stage: "B_cutlistToPieces",
          pieceId: String((item as { id?: string }).id ?? item.nome ?? `piece-${i}`),
          width: largura,
          height: altura,
          holes: normalizedHoles.map((h) => ({
            xLocal: h.x,
            yLocal: h.y,
            tipo: h.holeType,
          })),
          flags: { dimensionsSwapped: false, implicitRotation: false, holesTransformed: false },
        });
      }
    }
    return pieces;
  });
}

export function runCutLayout(
  pieces: CutPiece[],
  sheetDef: SheetDefinition,
  options?: CutLayoutEngineOptions
): CutLayoutResult {
  return runCutLayoutPipeline(pieces, sheetDef, options, RUN_CUT_LAYOUT_DEPS);
}

export function runCutLayoutResult(
  pieces: CutPiece[],
  sheetDef: SheetDefinition,
  options?: CutLayoutEngineOptions
): OperationResult<CutLayoutResult> {
  return runCutLayoutResultPipeline(pieces, sheetDef, options, runCutLayout);
}
