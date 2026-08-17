import type { SeededRng } from "../utils/cutLayoutRng";
import { getSheetSafetyMarginMm } from "../layoutCoordinateSystem";
import { comparePiecesForNesting } from "../utils/cutLayoutUtils";
import {
  tryCompactLateSheetsOfRun,
  LATE_SHEET_COMPACT_WINDOW,
  LATE_SHEET_MIN_WASTE_RATIO,
} from "../solver/lateSheetCompactor";
import { finalizeIndustrialLayout } from "../integration/industrialLayoutContract";
import { gerarCenariosLayout, escolherMelhorCenario } from "./layoutSearchLayer";

import type {
  CutPiece,
  CutLayoutEngineOptions,
  CutLayoutProgressEvent,
  CutLayoutMetaHeuristicsOptions,
  CutLayoutResult,
  CutLayoutRotationPreferenceMode,
  CutLayoutScoreModel,
  CutLayoutTrialConfig,
  SheetDefinition,
  SheetResult,
} from "../cutLayoutTypes";
import type { RotationScoringConfig } from "../scoring/rotationScoring";
import type { GlobalScoreMetrics } from "../scoring/solutionMetrics";
import type { SimulateTrialForGroupResult } from "./trialRunner";
import {
  MDB_LAMINADO_SHEET_HF_MM,
  MDB_LAMINADO_SHEET_LF_MM,
  usesOfficialMdbLaminadoSheet,
} from "../../materials/materials.api";

const DEFAULT_KERF_MM = 3;
const MIN_UTILIZATION_PERCENT = 0.8;
const DEFAULT_ROTATION_WEIGHT = 0.35;
const DEFAULT_ROTATION_PENALTY = 0.25;
const DEFAULT_ROTATION_MODE: CutLayoutRotationPreferenceMode = "auto";

export function getDefaultTrials(): CutLayoutTrialConfig[] {
  return [
    { strategy: "skyline", binHeuristic: "bestFit" },
    { strategy: "skyline", binHeuristic: "firstFit" },
    { strategy: "shelf", binHeuristic: "bestFit" },
    { strategy: "shelf", binHeuristic: "firstFit" },
    { strategy: "guillotine", binHeuristic: "bestFit" },
    { strategy: "guillotine", binHeuristic: "firstFit" },
  ];
}

export function getDefaultMetaOptions(
  enabledFromFlag: boolean | undefined,
  raw?: CutLayoutMetaHeuristicsOptions
): Required<CutLayoutMetaHeuristicsOptions> {
  return {
    enabled: raw?.enabled ?? Boolean(enabledFromFlag),
    iterations: Math.max(10, raw?.iterations ?? 180),
    initialTemperature: Math.max(0.001, raw?.initialTemperature ?? 1.0),
    coolingRate: Math.min(0.999, Math.max(0.8, raw?.coolingRate ?? 0.97)),
    lnsDestroyRatio: Math.min(0.6, Math.max(0.05, raw?.lnsDestroyRatio ?? 0.2)),
    multiStartCount: Math.min(50, Math.max(1, raw?.multiStartCount ?? 1)),
    seedBase: Math.max(1, Math.floor(raw?.seedBase ?? 1337)),
  };
}

export function isDevRuntime(): boolean {
  if (typeof process !== "undefined" && process?.env) {
    return process.env.NODE_ENV !== "production";
  }
  return true;
}

function groupUsesOfficialMdbLaminadoSheet(groupPieces: CutPiece[]): boolean {
  return groupPieces.some((piece) => usesOfficialMdbLaminadoSheet(piece.materialId ?? piece.materialName));
}

/** MDB/TAMPO: chapa oficial 3660×630 — as settings globais (2800×2070) não sobrepõem. */
function resolveGroupSheetDefinition(
  groupPieces: CutPiece[],
  options: CutLayoutEngineOptions | undefined,
  sheetDef: SheetDefinition,
  espStr: string,
  materialId: string
): SheetDefinition {
  const perMaterialWidth = Number(groupPieces[0]?.sheetWidthMm);
  const perMaterialHeight = Number(groupPieces[0]?.sheetHeightMm);
  const perMaterialSheetThickness = Number(groupPieces[0]?.sheetThicknessMm);
  const espessura_mm =
    perMaterialSheetThickness > 0 ? perMaterialSheetThickness : Number(espStr) || sheetDef.espessura_mm;
  const mdbGroup = groupUsesOfficialMdbLaminadoSheet(groupPieces);
  return {
    largura_mm: mdbGroup
      ? MDB_LAMINADO_SHEET_LF_MM
      : options?.sheetLargura_mm ?? (perMaterialWidth > 0 ? perMaterialWidth : sheetDef.largura_mm),
    altura_mm: mdbGroup
      ? MDB_LAMINADO_SHEET_HF_MM
      : options?.sheetAltura_mm ?? (perMaterialHeight > 0 ? perMaterialHeight : sheetDef.altura_mm),
    espessura_mm,
    materialId: materialId !== "material" ? materialId : sheetDef.materialId,
    materialName: groupPieces[0]?.materialName ?? sheetDef.materialName,
  };
}

/**
 * Modo de operação do motor de nesting.
 * Detetado automaticamente pela diversidade de boxId nas peças:
 *   - 1 boxId único  → SingleProject (SPM): 1 tentativa + pocket filling agressivo, sem compactor
 *   - múltiplos boxId → MultiProject  (MPM): fluxo completo com meta-heurísticas e compactor
 */
export const NestingMode = {
  SingleProject: "single",
  MultiProject: "multi",
} as const;

export type NestingMode = (typeof NestingMode)[keyof typeof NestingMode];

type PlacementStrategy = "skyline" | "shelf" | "guillotine";
type BinHeuristic = "firstFit" | "bestFit";
type AttemptOrderMode = "area_desc" | "max_side_desc" | "min_side_desc" | "area_desc_soft";

/** Fase 7D: uma tentativa por grupo/espessura (performance). */
const MAX_NESTING_ATTEMPTS = 2;
/** SPM: correr skyline + shelf quando o grupo é pequeno (custo baixo, melhor aproveitamento). */
const SPM_DUAL_TRIAL_MAX_PIECES = 25;
const ATTEMPT_TIMEOUT_MS = 1500;
const META_MAX_MULTI_START = 12;

/**
 * Threshold de peças expandidas acima do qual a Layer 2 é desativada
 * (demasiado lento para grandes projetos multi-módulo).
 */
const LAYER2_MAX_EXPANDED_PIECES = 40;

/**
 * WeakSet usado como guarda de recursão para a Layer 2.
 * Quando `deps` está no set, o pipeline corre diretamente sem Layer 2.
 */
const _layer2InProgress = new WeakSet<object>();
const META_MAX_ITERATIONS = 160;
/** Budget de tempo por grupo de material para a meta-heurística (ms). */
const META_BUDGET_MS = 3500;

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function sortPiecesForAttempt(pieces: CutPiece[], mode: AttemptOrderMode): CutPiece[] {
  const list = pieces.map((p) => ({ ...p }));
  if (mode === "area_desc" || mode === "area_desc_soft") {
    list.sort(comparePiecesForNesting);
    return list;
  }
  const area = (p: CutPiece) => p.largura_mm * p.altura_mm;
  const maxSide = (p: CutPiece) => Math.max(p.largura_mm, p.altura_mm);
  const minSide = (p: CutPiece) => Math.min(p.largura_mm, p.altura_mm);
  list.sort((a, b) => {
    if (mode === "max_side_desc") return maxSide(b) - maxSide(a) || area(b) - area(a);
    if (mode === "min_side_desc") return minSide(b) - minSide(a) || area(b) - area(a);
    return area(b) - area(a) || minSide(a) - minSide(b);
  });
  return list;
}

/**
 * Transforma furos para o formato TCN-ready no espaço TRO.
 * Para rot=0:  x' = plLargura - hx,  y' = plAltura  - hy  (espelho normal)
 * Para rot=90: x' = plLargura - hx,  y' = plLargura - hy  (ambos usam plLargura)
 * Esta fórmula garante que holeLocalToSheetOffsetMm(h.x, h.y, rot, plLargura)
 * no TCN produz o offset TRO correto para qualquer ângulo.
 */
function computeTcnReadyHoles(
  rotacao: number,
  plLargura: number,
  plAltura: number,
  holes: Array<{ x: number; y: number; diameter: number; depth: number; holeType?: string; topDrillable?: boolean }> | undefined
): Array<{ x: number; y: number; diameter: number; depth: number; holeType?: string; topDrillable?: boolean }> | undefined {
  if (!holes?.length) return holes;
  const r = ((rotacao ?? 0) % 360 + 360) % 360;
  const mirrorY = r === 90 ? plLargura : plAltura;
  return holes.map((h) => ({
    ...h,
    x: Math.max(0, plLargura - Number(h.x ?? 0)),
    y: Math.max(0, mirrorY - Number(h.y ?? 0)),
  }));
}

function normalizeSheetToTopRightOrigin(sheetResult: SheetResult): SheetResult {
  const W = sheetResult.sheet.largura_mm;
  const H = sheetResult.sheet.altura_mm;
  return {
    ...sheetResult,
    placements: sheetResult.placements.map((pl) => ({
      ...pl,
      x_mm: W - (pl.x_mm + pl.largura_mm),
      y_mm: H - (pl.y_mm + pl.altura_mm),
      holes: computeTcnReadyHoles(pl.rotacao, pl.largura_mm, pl.altura_mm, pl.holes),
      drillHoles: computeTcnReadyHoles(pl.rotacao, pl.largura_mm, pl.altura_mm, pl.drillHoles),
      originalDrillHoles: pl.originalDrillHoles ?? pl.drillHoles,
    })),
  };
}

export type RunCutLayoutDeps = {
  expandPieces: (_pieces: CutPiece[]) => CutPiece[];
  groupByMaterialAndThickness: (_pieces: CutPiece[]) => Map<string, CutPiece[]>;
  groupByThicknessOnly: (_pieces: CutPiece[]) => Map<string, CutPiece[]>;
  createUsableSheetArea: (_sheet: SheetDefinition, _marginMm: number) => SheetDefinition;
  applyFixedMarginOffset: (_sheets: SheetResult[], _physicalSheet: SheetDefinition, _marginMm: number) => SheetResult[];
  simulateTrialForGroup: (
    _pieces: CutPiece[],
    _sheet: SheetDefinition,
    _kerf: number,
    _minUtilizationPercent: number,
    _rotationCfg: RotationScoringConfig,
    _trial: CutLayoutTrialConfig,
    _collectDiagnostics: boolean,
    _forceInputOrder?: boolean,
    _scoreModel?: CutLayoutScoreModel
  ) => SimulateTrialForGroupResult;
  cloneSheets: (_sheets: SheetResult[]) => SheetResult[];
  createSeededRng: (_seed: number) => SeededRng;
  shuffleArray: <T>(_arr: T[], _rng: SeededRng) => T[];
  optimizeWithMetaHeuristics: (
    _initialSheets: SheetResult[],
    _sheet: SheetDefinition,
    _kerf: number,
    _minUtilizationPercent: number,
    _rotationCfg: RotationScoringConfig,
    _meta: Required<CutLayoutMetaHeuristicsOptions>,
    _seed?: number,
    _trialPool?: CutLayoutTrialConfig[],
    _scoreModel?: CutLayoutScoreModel,
    _budgetMs?: number
  ) => {
    sheets: SheetResult[];
    diagnostics: {
      iterations: number;
      bestScore: number;
      initialScore: number;
      improvementPercent: number;
      acceptedMoves: number;
      totalMoves: number;
    };
  };
  computeSolutionMetrics: (
    _sheets: SheetResult[],
    _sheet: SheetDefinition,
    _scoreModel?: CutLayoutScoreModel
  ) => GlobalScoreMetrics;
};

export function runCutLayout(
  pieces: CutPiece[],
  sheetDef: SheetDefinition,
  options: CutLayoutEngineOptions | undefined,
  deps: RunCutLayoutDeps
): CutLayoutResult {
  // ── Layer 2 Search (apenas MPM) ────────────────────────────────────────────
  // Fase 7E: SPM (1 boxId) NUNCA corre Layer2 — evita baseline + runs extra sem ganho.
  // Para MPM, em projetos ≤ LAYER2_MAX_EXPANDED_PIECES peças expandidas, testa ordenações
  // e escolhe a melhor por métricas. _layer2InProgress evita recursão na 2.ª entrada.
  const layer2IsSpm = new Set(pieces.map((p) => p.boxId)).size <= 1;
  if (!_layer2InProgress.has(deps) && !layer2IsSpm) {
    const expandedCount = pieces.reduce((acc, p) => acc + Math.max(1, p.quantidade), 0);
    if (expandedCount > 0 && expandedCount <= LAYER2_MAX_EXPANDED_PIECES) {
      _layer2InProgress.add(deps);
      try {
        // Fase de pesquisa: sem meta-heurísticas para manter velocidade
        const searchOpts: CutLayoutEngineOptions = { ...options, useMetaHeuristics: false };
        const runner = (ps: CutPiece[]) => runCutLayout(ps, sheetDef, searchOpts, deps);
        const cenarios = gerarCenariosLayout(pieces, runner);
        if (cenarios.length > 0) {
          const best = escolherMelhorCenario(cenarios);
          // Fase final: ordenação vencedora + opções completas (com meta-heurísticas)
          return runCutLayout(best.pieces, sheetDef, options, deps);
        }
      } catch {
        // Fallback silencioso: continua com o pipeline normal
      } finally {
        _layer2InProgress.delete(deps);
      }
    }
  }
  // ── Pipeline Normal ─────────────────────────────────────────────────────────

  const throwIfAbort = () => {
    if (options?.shouldAbort?.()) {
      const err = new Error("CutLayout aborted");
      err.name = "CutLayoutAbortedError";
      throw err;
    }
  };
  const emitProgress = (event: CutLayoutProgressEvent) => {
    options?.onProgress?.(event);
  };

  throwIfAbort();
  const kerf = options?.kerf_mm ?? DEFAULT_KERF_MM;
  const minUtilizationPercent = options?.minUtilizationPercent ?? MIN_UTILIZATION_PERCENT;
  const rotationCfg: RotationScoringConfig = {
    rotationWeight: options?.rotationWeight ?? DEFAULT_ROTATION_WEIGHT,
    rotationPenalty: options?.rotationPenalty ?? DEFAULT_ROTATION_PENALTY,
    rotationPreferenceMode: options?.rotationPreferenceMode ?? DEFAULT_ROTATION_MODE,
  };

  // Deteção automática de modo: 1 boxId único = projeto simples (SPM), vários = multi (MPM).
  const nestingMode =
    new Set(pieces.map((p) => p.boxId)).size <= 1 ? NestingMode.SingleProject : NestingMode.MultiProject;

  const grouped = (options?.groupByThicknessOnly ? deps.groupByThicknessOnly : deps.groupByMaterialAndThickness)(
    deps.expandPieces(pieces)
  );
  const rawMetaCfg = getDefaultMetaOptions(options?.useMetaHeuristics, options?.metaHeuristics);
  const metaCfg: Required<CutLayoutMetaHeuristicsOptions> = {
    ...rawMetaCfg,
    enabled: rawMetaCfg.enabled,
    multiStartCount: Math.min(rawMetaCfg.multiStartCount, META_MAX_MULTI_START),
    iterations: Math.min(rawMetaCfg.iterations, META_MAX_ITERATIONS),
  };
  const scoreModel: CutLayoutScoreModel = options?.scoreModel ?? "legacy";

  const finalSheets: SheetResult[] = [];
  const diagnostics: CutLayoutResult["diagnostics"] | undefined = options?.collectDiagnostics
    ? {
        flow: {
          skylineEnabled: true,
          shelfEnabled: true,
          guillotineEnabled: true,
          reorderEnabled: true,
          gapFillEnabled: true,
          gapFillAttempts: 0,
          rescueAttempts: 0,
          rotationPreferenceMode: rotationCfg.rotationPreferenceMode,
          selectedStrategy: "skyline" as PlacementStrategy,
          selectedBinHeuristic: "bestFit" as BinHeuristic,
        },
        trialRuns: [] as Array<{
          strategy: PlacementStrategy;
          binHeuristic: BinHeuristic;
          sheetCount: number;
          usedArea: number;
          wasteArea: number;
          usefulLeftoverArea: number;
          score: number;
        }>,
        metaHeuristics: isDevRuntime()
          ? {
              iterations: 0,
              bestScore: 0,
              initialScore: 0,
              improvementPercent: 0,
              acceptedMoves: 0,
              totalMoves: 0,
              initialSolutions: 0,
              winningSeed: 0,
              winningStrategy: "skyline",
              winningBinHeuristic: "bestFit",
              convexHullWasteBySheet: [] as number[],
              fragmentationScore: 0,
              pocketsCount: 0,
              linearGapScore: 0,
              compactnessScore: 0,
            }
          : undefined,
        rejectedByLimit: [] as Array<{
          partName: string;
          boxId: string;
          largura_mm: number;
          altura_mm: number;
          reason: string;
        }>,
        gapFillPlacements: [] as Array<{
          partName: string;
          boxId: string;
          sheetIndex: number;
          rotacao: number;
          x_mm: number;
          y_mm: number;
          largura_mm: number;
          altura_mm: number;
        }>,
      }
    : undefined;

  const groupedEntries = Array.from(grouped.entries());
  const groupCount = Math.max(1, groupedEntries.length);
  emitProgress({ phase: "prepare", groupIndex: 0, groupCount, stepIndex: 0, stepCount: 1, percent: 1 });

  for (let groupIndex = 0; groupIndex < groupedEntries.length; groupIndex++) {
    throwIfAbort();
    const [key, groupPieces] = groupedEntries[groupIndex];
    const espStr = options?.groupByThicknessOnly ? key : key.split("|")[1];
    const materialId = options?.groupByThicknessOnly
      ? (sheetDef.materialId ?? groupPieces[0]?.materialId ?? "material")
      : key.split("|")[0];
    const sheet: SheetDefinition = resolveGroupSheetDefinition(
      groupPieces,
      options,
      sheetDef,
      espStr,
      materialId
    );
    const marginMm = getSheetSafetyMarginMm();
    const placementSheet = deps.createUsableSheetArea(sheet, marginMm);
    const sheetArea = Math.max(1, sheet.largura_mm * sheet.altura_mm);

    // ── SPM PATH ────────────────────────────────────────────────────────────
    // Projeto único: 1 variante (performance) sem meta-heurísticas.
    // Depois pocket filling + compactação translacional. Compactor não corre no SPM.
    if (nestingMode === NestingMode.SingleProject) {
      const spmTrialVariants: Array<{
        trial: CutLayoutTrialConfig;
        rotationMode: CutLayoutRotationPreferenceMode;
      }> = [
        { trial: { strategy: "skyline", binHeuristic: "bestFit" }, rotationMode: "aggressive" },
        { trial: { strategy: "shelf", binHeuristic: "bestFit" }, rotationMode: "auto" },
      ];
      const spmTrialVariantsToRun =
        groupPieces.length <= SPM_DUAL_TRIAL_MAX_PIECES ? spmTrialVariants : spmTrialVariants.slice(0, 1);
      let spmBestRun: SimulateTrialForGroupResult | null = null;
      let spmBestTrial: CutLayoutTrialConfig = { strategy: "skyline", binHeuristic: "bestFit" };

      // ── SPM Door-Priority Ordering (nome + dimensões) ──────────────────────
      // Uma peça é tratada como "porta/complemento" se:
      //   a) o nome corresponde a DOOR_PATTERN, OU
      //   b) largura_mm > 800 E altura_mm > 800 E nome NÃO corresponde a BODY_PATTERN
      // O grupo "corpo" (não-portas) fica sempre primeiro na lista, garantindo
      // que enche a chapa 1 antes de qualquer porta/complemento ser considerado.
      const DOOR_PATTERN = /\b(porta|door|fr|porte)\b/i;
      const BODY_PATTERN = /\b(lateral|cima|fundo|costa|prateleira|shelf|top|bottom|back|side)\b/i;
      const isDoorPiece = (p: (typeof groupPieces)[0]): boolean => {
        if (DOOR_PATTERN.test(p.partName ?? "")) return true;
        const w = Math.max(p.largura_mm, p.altura_mm);
        const h = Math.min(p.largura_mm, p.altura_mm);
        return w > 800 && h > 800 && !BODY_PATTERN.test(p.partName ?? "");
      };
      const spmBaseSorted = sortPiecesForAttempt(groupPieces, "area_desc");
      const nonDoorPieces = spmBaseSorted.filter((p) => !isDoorPiece(p));
      const doorPieces    = spmBaseSorted.filter((p) =>  isDoorPiece(p));
      const spmOrderedPieces =
        nonDoorPieces.length > 0 && doorPieces.length > 0
          ? [...nonDoorPieces, ...doorPieces]
          : spmBaseSorted;
      // ──────────────────────────────────────────────────────────────────────

      for (const { trial: spmTrial, rotationMode } of spmTrialVariantsToRun) {
        const spmRotCfg: RotationScoringConfig = { ...rotationCfg, rotationPreferenceMode: rotationMode };
        const run = deps.simulateTrialForGroup(
          spmOrderedPieces,
          placementSheet,
          kerf,
          minUtilizationPercent,
          spmRotCfg,
          spmTrial,
          false,
          true,
          scoreModel
        );
        if (run.sheets.length > 0 && (!spmBestRun || run.score < spmBestRun.score)) {
          spmBestRun = run;
          spmBestTrial = spmTrial;
        }
      }

      const spmRun = spmBestRun;
      if (spmRun && spmRun.sheets.length > 0) {
        if (diagnostics) {
          diagnostics.flow.selectedStrategy = spmBestTrial.strategy;
          diagnostics.flow.selectedBinHeuristic = spmBestTrial.binHeuristic;
          diagnostics.flow.gapFillAttempts += spmRun.gapFillAttempts;
          diagnostics.flow.rescueAttempts += spmRun.rescueAttempts;
        }
        diagnostics?.rejectedByLimit.push(...spmRun.rejectedByLimit);
        diagnostics?.gapFillPlacements.push(...spmRun.gapFillPlacements);
        const spmFinalized = finalizeIndustrialLayout(
          { sheets: spmRun.sheets },
          {
            mode: "full",
            kerfMm: kerf,
            marginMm,
            physicalSheet: sheet,
            usableSheet: placementSheet,
            originTopRight: options?.originTopRight,
            pocketFilling: "spm",
            spmDoorBodyGuard: true,
          },
          {
            normalizeTopRightOrigin: options?.originTopRight ? normalizeSheetToTopRightOrigin : undefined,
          }
        );
        finalSheets.push(...spmFinalized.sheets);
      }
      continue; // Salta todo o fluxo MPM
    }
    // ── MPM PATH ────────────────────────────────────────────────────────────

    let bestRun:
      | (SimulateTrialForGroupResult & {
          strategy: PlacementStrategy;
          binHeuristic: BinHeuristic;
        })
      | null = null;

    // Fase 7D: variantes limitadas por MAX_NESTING_ATTEMPTS.
    const attemptVariants: Array<{
      orderMode: AttemptOrderMode;
      trial: CutLayoutTrialConfig;
      rotationMode: CutLayoutRotationPreferenceMode;
    }> = [
      { orderMode: "area_desc", trial: { strategy: "skyline", binHeuristic: "bestFit" }, rotationMode: "aggressive" },
      { orderMode: "area_desc", trial: { strategy: "shelf", binHeuristic: "bestFit" }, rotationMode: "auto" },
    ];
    const attempts = attemptVariants.slice(0, MAX_NESTING_ATTEMPTS);

    for (let ti = 0; ti < attempts.length; ti++) {
      throwIfAbort();
      const attempt = attempts[ti];
      const trial = attempt.trial;
      const trialPercent = ((groupIndex + (ti + 1) / Math.max(1, attempts.length)) / groupCount) * 60;
      emitProgress({
        phase: "trial",
        groupIndex: groupIndex + 1,
        groupCount,
        stepIndex: ti + 1,
        stepCount: attempts.length,
        percent: Math.min(60, Math.max(1, trialPercent)),
      });
      const attemptStartedAt = nowMs();
      const piecesForAttempt = sortPiecesForAttempt(groupPieces, attempt.orderMode);
      const attemptRotationCfg: RotationScoringConfig = {
        ...rotationCfg,
        rotationPreferenceMode: attempt.rotationMode,
      };
      const run = deps.simulateTrialForGroup(
        piecesForAttempt,
        placementSheet,
        kerf,
        minUtilizationPercent,
        attemptRotationCfg,
        trial,
        Boolean(options?.collectDiagnostics),
        true,
        scoreModel
      );
      const elapsedMs = nowMs() - attemptStartedAt;
      if (elapsedMs > ATTEMPT_TIMEOUT_MS) {
        continue;
      }
      const wasteArea = run.sheets.length * sheetArea - run.usedArea;
      const totalPlacements = run.sheets.reduce((acc, s) => acc + s.placements.length, 0);
      const isValidRun = run.sheets.length > 0 && totalPlacements > 0;
      if (!isValidRun) {
        continue;
      }
      diagnostics?.trialRuns?.push({
        strategy: trial.strategy,
        binHeuristic: trial.binHeuristic,
        sheetCount: run.sheets.length,
        usedArea: run.usedArea,
        wasteArea,
        usefulLeftoverArea: run.usefulLeftoverArea,
        score: run.score,
      });
      if (!bestRun || run.score < bestRun.score) {
        bestRun = { ...run, strategy: trial.strategy, binHeuristic: trial.binHeuristic };
      }
    }

    if (!bestRun) {
      const fallbackTrial: CutLayoutTrialConfig = { strategy: "skyline", binHeuristic: "firstFit" };
      const fallbackRun = deps.simulateTrialForGroup(
        groupPieces,
        placementSheet,
        kerf,
        minUtilizationPercent,
        rotationCfg,
        fallbackTrial,
        Boolean(options?.collectDiagnostics),
        false,
        scoreModel
      );
      const fallbackPlacements = fallbackRun.sheets.reduce((acc, s) => acc + s.placements.length, 0);
      if (fallbackRun.sheets.length > 0 && fallbackPlacements > 0) {
        bestRun = {
          ...fallbackRun,
          strategy: fallbackTrial.strategy,
          binHeuristic: fallbackTrial.binHeuristic,
        };
      } else {
        continue;
      }
    }

    if (metaCfg.enabled && bestRun.sheets.length > 0) {
      // MOD 1: iterações dinâmicas — grupos grandes (> 30 peças) usam 420; outros 160.
      const groupMetaCfg: Required<CutLayoutMetaHeuristicsOptions> = {
        ...metaCfg,
        iterations: Math.min(
          rawMetaCfg.iterations,
          groupPieces.length > 30 ? 420 : META_MAX_ITERATIONS
        ),
      };
      // MOD 2: budget dinâmico — grupos grandes (> 30 peças) usam 8000ms; outros 3500ms.
      const groupBudgetMs = groupPieces.length > 30 ? 8000 : META_BUDGET_MS;
      const baselineRefScore = bestRun.score;
      const startCount = metaCfg.multiStartCount;
      let globalBestSheets = deps.cloneSheets(bestRun.sheets);
      let globalBestScore = bestRun.score;
      let globalAcceptedMoves = 0;
      let winningSeed = metaCfg.seedBase;
      let winningStrategy: PlacementStrategy = bestRun.strategy;
      let winningBin: BinHeuristic = bestRun.binHeuristic;

      const strategyPool: CutLayoutTrialConfig[] = [
        { strategy: "skyline", binHeuristic: "firstFit" },
        { strategy: "skyline", binHeuristic: "bestFit" },
        { strategy: "shelf", binHeuristic: "firstFit" },
        { strategy: "shelf", binHeuristic: "bestFit" },
        { strategy: "guillotine", binHeuristic: "firstFit" },
        { strategy: "guillotine", binHeuristic: "bestFit" },
      ];

      const metaGroupStartMs = nowMs();
      for (let si = 0; si < startCount; si++) {
        throwIfAbort();
        if (nowMs() - metaGroupStartMs > groupBudgetMs) break;
        const metaPercent =
          60 + (((groupIndex + (si + 1) / Math.max(1, startCount)) / groupCount) * 35);
        emitProgress({
          phase: "meta",
          groupIndex: groupIndex + 1,
          groupCount,
          stepIndex: si + 1,
          stepCount: startCount,
          percent: Math.min(95, Math.max(60, metaPercent)),
        });
        const seed = metaCfg.seedBase + si;
        const rng = deps.createSeededRng(seed);
        const initialTrial = strategyPool[rng.int(strategyPool.length)];
        const shuffledPieces = deps.shuffleArray(groupPieces, rng);
        const rotationModes: CutLayoutRotationPreferenceMode[] = ["aggressive", "auto", "disabled"];
        const seededRotationCfg: RotationScoringConfig = {
          ...rotationCfg,
          rotationPreferenceMode: rotationModes[rng.int(rotationModes.length)],
        };

        const seededRun = deps.simulateTrialForGroup(
          shuffledPieces,
          placementSheet,
          kerf,
          minUtilizationPercent,
          seededRotationCfg,
          initialTrial,
          false,
          true,
          scoreModel
        );
        const startSheets = seededRun.sheets.length > 0 ? seededRun.sheets : bestRun.sheets;
        const remainingBudget = Math.max(200, groupBudgetMs - (nowMs() - metaGroupStartMs));
        const local = deps.optimizeWithMetaHeuristics(
          startSheets,
          placementSheet,
          kerf,
          minUtilizationPercent,
          seededRotationCfg,
          groupMetaCfg,
          seed,
          strategyPool,
          scoreModel,
          remainingBudget
        );
        const localScore = deps.computeSolutionMetrics(local.sheets, placementSheet, scoreModel).score;
        globalAcceptedMoves += local.diagnostics.acceptedMoves;
        if (localScore < globalBestScore) {
          globalBestScore = localScore;
          globalBestSheets = deps.cloneSheets(local.sheets);
          winningSeed = seed;
          winningStrategy = initialTrial.strategy;
          winningBin = initialTrial.binHeuristic;
        }
      }

      if (globalBestScore <= baselineRefScore) {
        bestRun.sheets = globalBestSheets;
        bestRun.score = globalBestScore;
        bestRun.strategy = winningStrategy;
        bestRun.binHeuristic = winningBin;
      }
      if (diagnostics && isDevRuntime()) {
        const advanced = deps.computeSolutionMetrics(globalBestSheets, placementSheet, scoreModel).advanced;
        diagnostics.metaHeuristics = {
          iterations: metaCfg.iterations * startCount,
          bestScore: Math.min(baselineRefScore, globalBestScore),
          initialScore: baselineRefScore,
          improvementPercent:
            baselineRefScore > 0
              ? Number(
                  (
                    ((baselineRefScore - Math.min(baselineRefScore, globalBestScore)) / baselineRefScore) *
                    100
                  ).toFixed(3)
                )
              : 0,
          acceptedMoves: globalAcceptedMoves,
          totalMoves: metaCfg.iterations * startCount,
          initialSolutions: startCount,
          winningSeed,
          winningStrategy,
          winningBinHeuristic: winningBin,
          convexHullWasteBySheet: advanced.perSheet.map((p) => p.convexHullWaste),
          fragmentationScore: advanced.fragmentationScoreTotal,
          pocketsCount: advanced.pocketsCountTotal,
          linearGapScore: advanced.linearGapScoreTotal,
          compactnessScore: advanced.compactnessScoreTotal,
        };
      }
    }

    // Late-Sheet Compactor: tenta recompactar as chapas tardias com desperdício elevado.
    // Só ativa se o grupo tiver mais de LATE_SHEET_COMPACT_WINDOW chapas e desperdício médio
    // nas últimas chapas acima de LATE_SHEET_MIN_WASTE_RATIO. Resultado só é usado se melhorar.
    const compactResult = tryCompactLateSheetsOfRun(bestRun.sheets, placementSheet, kerf, {
      kerf,
      lateSheetWindow: LATE_SHEET_COMPACT_WINDOW,
      minWasteRatioToTrigger: LATE_SHEET_MIN_WASTE_RATIO,
    });
    if (compactResult?.improved) {
      bestRun.sheets = [...compactResult.earlySheets, ...compactResult.lateSheets];
    }

    // Pocket filling MPM + compactação + margem → industrialLayoutContract
    const mpmFinalized = finalizeIndustrialLayout(
      { sheets: bestRun.sheets },
      {
        mode: "full",
        kerfMm: kerf,
        marginMm,
        physicalSheet: sheet,
        usableSheet: placementSheet,
        originTopRight: options?.originTopRight,
        pocketFilling: bestRun.sheets.length > 2 ? "mpm" : "none",
      },
      {
        normalizeTopRightOrigin: options?.originTopRight ? normalizeSheetToTopRightOrigin : undefined,
      }
    );

    if (diagnostics) {
      diagnostics.flow.selectedStrategy = bestRun.strategy;
      diagnostics.flow.selectedBinHeuristic = bestRun.binHeuristic;
      diagnostics.flow.gapFillAttempts += bestRun.gapFillAttempts;
      diagnostics.flow.rescueAttempts += bestRun.rescueAttempts;
    }
    diagnostics?.rejectedByLimit.push(...bestRun.rejectedByLimit);
    diagnostics?.gapFillPlacements.push(...bestRun.gapFillPlacements);
    finalSheets.push(...mpmFinalized.sheets);
  }

  emitProgress({ phase: "finalize", groupIndex: groupCount, groupCount, stepIndex: 1, stepCount: 1, percent: 100 });
  return diagnostics ? { sheets: finalSheets, diagnostics } : { sheets: finalSheets };
}
