import type { CutLayoutTrialConfig, CutPiece, CutPlacement, SheetDefinition, SheetResult } from "../cutLayoutTypes";
import type { PlacementCandidate, RotationScoringConfig } from "../scoring/rotationScoring";
import type { ContextoChapa } from "../scoring/placementScoring";
import type { GlobalScoreMetrics } from "../scoring/solutionMetrics";
import { tryFillResidualRects } from "../solver/residualRects";
import { copyHolesLocalInvariant } from "../utils/holeGeomInvariant";
import { filterHingeHolesLocalBeforeInvariant } from "../../../modules/drilling/hingeOffsetUtils";
import { clampPanelHolesLocalBeforeInvariant } from "../../../modules/drilling/panelDrillingBoundsUtils";
import {
  applyPairVirtualPieces,
  expandPairPlacement,
  isPairVirtualPiece,
} from "../solver/pairPacking";

/** Janela máxima de peças avaliadas por colocação (bestFit). Fase A (A2). */
const MAIN_SEARCH_WINDOW = 128;

type PlacedRect = { x: number; y: number; w: number; h: number };
type ScoreModel = "legacy" | "v32";

type StrategyState = unknown;

function estimateTotalSheets(
  sheetsCount: number,
  remaining: CutPiece[],
  sheet: SheetDefinition
): number {
  const sheetArea = Math.max(1, sheet.largura_mm * sheet.altura_mm);
  const remainingArea = remaining.reduce((acc, p) => acc + p.largura_mm * p.altura_mm, 0);
  const estExtra = Math.ceil(remainingArea / (sheetArea * 0.75));
  return Math.max(sheetsCount + 1, sheetsCount + estExtra);
}

function buildContextoChapa(sheetIndex: number, totalSheetsEstimado: number): ContextoChapa {
  const isLateSheet = totalSheetsEstimado > 1 && sheetIndex / totalSheetsEstimado > 0.4;
  return { sheetIndex, totalSheets: totalSheetsEstimado, isLateSheet };
}

function buildCutPlacement(
  piece: CutPiece,
  placement: PlacementCandidate,
  sheetIndex: number
): CutPlacement {
  const holes = copyHolesLocalInvariant(
    clampPanelHolesLocalBeforeInvariant(
      filterHingeHolesLocalBeforeInvariant(
        piece.drillHoles ?? piece.holes,
        piece.largura_mm,
        piece.altura_mm,
        "trialRunner_buildCutPlacement",
        String(piece.metadata?.v3PieceId ?? piece.partName ?? "")
      ),
      piece.largura_mm,
      piece.altura_mm,
      "trialRunner_buildCutPlacement",
      String(piece.metadata?.v3PieceId ?? piece.partName ?? "")
    ),
    piece.largura_mm,
    piece.altura_mm
  );
  return {
    x_mm: placement.x,
    y_mm: placement.y,
    largura_mm: placement.w,
    altura_mm: placement.h,
    espessura_mm: piece.espessura_mm,
    rotacao: placement.rotation,
    sheetIndex,
    boxId: piece.boxId,
    partName: piece.partName,
    materialId: piece.materialId,
    materialName: piece.materialName,
    drillHoles: holes,
    holes,
    originalDrillHoles: holes?.map((h) => ({ ...h })),
    pieceNumber: piece.pieceNumber,
    shortCode: piece.shortCode,
    metadata: {
      ...(piece.metadata ?? {}),
      holeDesignLarguraMm: piece.largura_mm,
      holeDesignAlturaMm: piece.altura_mm,
    },
  };
}

export type SimulateTrialForGroupResult = {
  sheets: SheetResult[];
  rejectedByLimit: Array<{ partName: string; boxId: string; largura_mm: number; altura_mm: number; reason: string }>;
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
  gapFillAttempts: number;
  rescueAttempts: number;
  usedArea: number;
  usefulLeftoverArea: number;
  score: number;
  advanced: GlobalScoreMetrics["advanced"];
};

export type SimulateTrialForGroupDeps = {
  reorderPieces: (_pieces: CutPiece[], _mode: "production" | "gapFill") => CutPiece[];
  initStrategyState: (_strategy: CutLayoutTrialConfig["strategy"], _sheet: SheetDefinition) => StrategyState;
  pickBestPieceForSheet: (
    _remaining: CutPiece[],
    _sheet: SheetDefinition,
    _strategy: CutLayoutTrialConfig["strategy"],
    _state: StrategyState,
    _placedRects: PlacedRect[],
    _kerf: number,
    _searchWindow: number,
    _rotationCfg: RotationScoringConfig,
    _bin: CutLayoutTrialConfig["binHeuristic"],
    _ctx?: ContextoChapa
  ) => { index: number; placement: PlacementCandidate } | null;
  isInsideSheet: (_x: number, _y: number, _w: number, _h: number, _sheet: SheetDefinition) => boolean;
  updateStrategyState: (
    _strategy: CutLayoutTrialConfig["strategy"],
    _state: StrategyState,
    _placement: PlacementCandidate,
    _kerf: number
  ) => StrategyState;
  findPlacementForPiece: (
    _piece: CutPiece,
    _strategy: CutLayoutTrialConfig["strategy"],
    _sheet: SheetDefinition,
    _placedRects: PlacedRect[],
    _state: StrategyState,
    _kerf: number,
    _rotationCfg: RotationScoringConfig,
    _bin: CutLayoutTrialConfig["binHeuristic"]
  ) => PlacementCandidate | null;
  calculateSheetUtilization: (_placedRects: PlacedRect[], _sheetW: number, _sheetH: number) => number;
  optimizeLastSheetLocally: (_sheets: SheetResult[], _sheet: SheetDefinition, _kerf: number, _scoreModel: ScoreModel) => SheetResult[];
  computeSolutionMetrics: (_sheets: SheetResult[], _sheet: SheetDefinition, _scoreModel: ScoreModel) => GlobalScoreMetrics;
};

export function simulateTrialForGroup(
  pieces: CutPiece[],
  sheet: SheetDefinition,
  kerf: number,
  minUtilizationPercent: number,
  rotationCfg: RotationScoringConfig,
  trial: CutLayoutTrialConfig,
  collectDiagnostics: boolean,
  forceInputOrder: boolean,
  scoreModel: ScoreModel,
  deps: SimulateTrialForGroupDeps
): SimulateTrialForGroupResult {
  const remaining = forceInputOrder ? pieces.map((p) => ({ ...p })) : deps.reorderPieces(pieces, "production");
  const sheets: SheetResult[] = [];
  const rejectedByLimit: Array<{ partName: string; boxId: string; largura_mm: number; altura_mm: number; reason: string }> = [];
  const gapFillPlacements: Array<{
    partName: string;
    boxId: string;
    sheetIndex: number;
    rotacao: number;
    x_mm: number;
    y_mm: number;
    largura_mm: number;
    altura_mm: number;
  }> = [];
  let gapFillAttempts = 0;
  let rescueAttempts = 0;

  const commitPick = (
    pick: { index: number; placement: PlacementCandidate },
    placements: CutPlacement[],
    placedRects: PlacedRect[],
    state: StrategyState,
    sheetIndex: number
  ): StrategyState => {
    const piece = remaining[pick.index]!;
    const expanded = isPairVirtualPiece(piece)
      ? expandPairPlacement(piece, pick.placement, kerf)
      : [{ piece, placement: pick.placement }];

    for (const ep of expanded) {
      if (!deps.isInsideSheet(ep.placement.x, ep.placement.y, ep.placement.w, ep.placement.h, sheet)) {
        rejectedByLimit.push({
          partName: ep.piece.partName,
          boxId: ep.piece.boxId,
          largura_mm: ep.piece.largura_mm,
          altura_mm: ep.piece.altura_mm,
          reason: "invalid-placement-outside-sheet",
        });
        continue;
      }
      placements.push(buildCutPlacement(ep.piece, ep.placement, sheetIndex));
      placedRects.push({ x: ep.placement.x, y: ep.placement.y, w: ep.placement.w, h: ep.placement.h });
      state = deps.updateStrategyState(trial.strategy, state, ep.placement, kerf);
    }
    remaining.splice(pick.index, 1);
    return state;
  };

  while (remaining.length > 0) {
    const placements: CutPlacement[] = [];
    const placedRects: PlacedRect[] = [];
    let state = deps.initStrategyState(trial.strategy, sheet);
    const sheetIndex = sheets.length;
    let pairMergedThisSheet = false;

    while (remaining.length > 0) {
      if (!pairMergedThisSheet && placedRects.length === 0) {
        const paired = applyPairVirtualPieces(remaining, sheet.largura_mm, kerf);
        remaining.splice(0, remaining.length, ...paired);
        pairMergedThisSheet = true;
      }

      const totalSheetsEstimado = estimateTotalSheets(sheets.length, remaining, sheet);
      const ctx = buildContextoChapa(sheetIndex, totalSheetsEstimado);

      // B1: preenchimento prioritário em rects residuais antes da peça grande.
      const residualHit = tryFillResidualRects(remaining, sheet, placedRects, kerf, rotationCfg);
      const best =
        residualHit ??
        deps.pickBestPieceForSheet(
          remaining,
          sheet,
          trial.strategy,
          state,
          placedRects,
          kerf,
          MAIN_SEARCH_WINDOW,
          rotationCfg,
          trial.binHeuristic,
          ctx
        );
      if (!best) break;

      const pieceBefore = remaining[best.index]!;
      if (
        !isPairVirtualPiece(pieceBefore) &&
        !deps.isInsideSheet(best.placement.x, best.placement.y, best.placement.w, best.placement.h, sheet)
      ) {
        rejectedByLimit.push({
          partName: pieceBefore.partName,
          boxId: pieceBefore.boxId,
          largura_mm: pieceBefore.largura_mm,
          altura_mm: pieceBefore.altura_mm,
          reason: "invalid-placement-outside-sheet",
        });
        remaining.splice(best.index, 1);
        continue;
      }

      state = commitPick(best, placements, placedRects, state, sheetIndex);
    }

    if (remaining.length > 0 && placements.length === 0) {
      rejectedByLimit.push({
        partName: remaining[0].partName,
        boxId: remaining[0].boxId,
        largura_mm: remaining[0].largura_mm,
        altura_mm: remaining[0].altura_mm,
        reason: "piece-does-not-fit-empty-sheet",
      });
      remaining.shift();
      continue;
    }

    if (remaining.length > 0) {
      gapFillAttempts += 1;
      const gapOrdered = deps.reorderPieces(remaining, "gapFill");
      for (let i = 0; i < gapOrdered.length; i++) {
        const target = gapOrdered[i];
        const originalIndex = remaining.findIndex((r) => r === target);
        if (originalIndex < 0) continue;
        const fit = deps.findPlacementForPiece(
          target,
          trial.strategy,
          sheet,
          placedRects,
          state,
          kerf,
          rotationCfg,
          "bestFit"
        );
        if (!fit) continue;
        state = commitPick({ index: originalIndex, placement: fit }, placements, placedRects, state, sheetIndex);
        gapFillPlacements.push({
          partName: target.partName,
          boxId: target.boxId,
          sheetIndex,
          rotacao: fit.rotation,
          x_mm: fit.x,
          y_mm: fit.y,
          largura_mm: fit.w,
          altura_mm: fit.h,
        });
      }
    }

    if (remaining.length > 0) {
      const util = deps.calculateSheetUtilization(placedRects, sheet.largura_mm, sheet.altura_mm);
      if (util < minUtilizationPercent) {
        rescueAttempts += 1;
        let moreToRescue = true;
        while (moreToRescue && remaining.length > 0) {
          moreToRescue = false;
          const rescueCtx = buildContextoChapa(
            sheetIndex,
            estimateTotalSheets(sheets.length, remaining, sheet)
          );
          const residualRescue = tryFillResidualRects(remaining, sheet, placedRects, kerf, rotationCfg);
          const rescue =
            residualRescue ??
            deps.pickBestPieceForSheet(
              remaining,
              sheet,
              trial.strategy,
              state,
              placedRects,
              kerf,
              remaining.length,
              rotationCfg,
              "bestFit",
              rescueCtx
            );
          if (rescue) {
            state = commitPick(rescue, placements, placedRects, state, sheetIndex);
            moreToRescue = true;
          }
        }
      }
    }

    sheets.push({
      sheet: { ...sheet },
      placements,
    });
  }

  const optimizedSheets = deps.optimizeLastSheetLocally(sheets, sheet, kerf, scoreModel);
  const metrics = deps.computeSolutionMetrics(optimizedSheets, sheet, scoreModel);

  return {
    sheets: optimizedSheets,
    rejectedByLimit: collectDiagnostics ? rejectedByLimit : [],
    gapFillPlacements: collectDiagnostics ? gapFillPlacements : [],
    gapFillAttempts,
    rescueAttempts,
    usedArea: metrics.usedArea,
    usefulLeftoverArea: metrics.usefulLeftoverArea,
    score: metrics.score,
    advanced: metrics.advanced,
  };
}

