import type { CutPiece, CutPlacement, SheetDefinition, SheetResult } from "../cutLayoutTypes";
import type { RotationScoringConfig } from "../scoring/rotationScoring";
import type { SeededRng } from "../utils/cutLayoutRng";

export type MetaMove = "swapBetweenSheets" | "movePieceAcrossSheets" | "reorderSheet" | "flipRotation";

export type TrialConfig = {
  strategy: "skyline" | "shelf" | "guillotine";
  binHeuristic: "firstFit" | "bestFit";
};

export type ScoreModel = "legacy" | "v32";

export type MetaHeuristicsRuntimeOptions = Required<{
  enabled: boolean;
  iterations: number;
  initialTemperature: number;
  coolingRate: number;
  lnsDestroyRatio: number;
  multiStartCount: number;
  seedBase: number;
}>;

export type SimulateTrialForGroupFn = (
  _pieces: CutPiece[],
  _sheet: SheetDefinition,
  _kerf: number,
  _minUtilizationPercent: number,
  _rotationCfg: RotationScoringConfig,
  _trial: TrialConfig,
  _collectDiagnostics: boolean,
  _forceInputOrder?: boolean,
  _scoreModel?: ScoreModel
) => { sheets: SheetResult[] };

export type MetaheuristicsDeps = {
  randomInt: (_maxExclusive: number) => number;
  createSeededRng: (_seed: number) => SeededRng;
  cloneSheets: (_sheets: SheetResult[]) => SheetResult[];
  flattenPlacements: (_sheets: SheetResult[]) => CutPlacement[];
  layoutFromPlacements: (
    _placements: CutPlacement[],
    _sheet: SheetDefinition
  ) => {
    sheets: SheetResult[];
    rejectedByLimit: Array<{
      partName: string;
      boxId: string;
      largura_mm: number;
      altura_mm: number;
      reason: string;
    }>;
  };
  computeSolutionMetrics: (
    _sheets: SheetResult[],
    _sheet: SheetDefinition,
    _scoreModel: ScoreModel
  ) => { score: number };
  simulateTrialForGroup: SimulateTrialForGroupFn;
};

type RngInt = { int: (_maxExclusive: number) => number };

export function mutatePlacements(
  placements: CutPlacement[],
  move: MetaMove,
  _sheet: SheetDefinition,
  rng: SeededRng | undefined,
  deps: Pick<MetaheuristicsDeps, "randomInt">
): CutPlacement[] {
  const rnd: RngInt = rng ?? { int: deps.randomInt };
  if (placements.length === 0) return placements.map((p) => ({ ...p }));
  const out = placements.map((p) => ({ ...p }));
  const bySheet = new Map<number, number[]>();
  out.forEach((p, idx) => {
    if (!bySheet.has(p.sheetIndex)) bySheet.set(p.sheetIndex, []);
    bySheet.get(p.sheetIndex)!.push(idx);
  });
  const sheetKeys = Array.from(bySheet.keys());
  if (sheetKeys.length === 0) return out;

  if (move === "swapBetweenSheets" && sheetKeys.length >= 2) {
    const sA = sheetKeys[rnd.int(sheetKeys.length)];
    let sB = sheetKeys[rnd.int(sheetKeys.length)];
    if (sA === sB && sheetKeys.length > 1) sB = sheetKeys[(sheetKeys.indexOf(sA) + 1) % sheetKeys.length];
    const idxA = bySheet.get(sA)?.[rnd.int(bySheet.get(sA)!.length)];
    const idxB = bySheet.get(sB)?.[rnd.int(bySheet.get(sB)!.length)];
    if (idxA !== undefined && idxB !== undefined) {
      const tmp = out[idxA];
      out[idxA] = out[idxB];
      out[idxB] = tmp;
    }
    return out;
  }

  if (move === "movePieceAcrossSheets" && sheetKeys.length >= 2) {
    const from = sheetKeys[rnd.int(sheetKeys.length)];
    let to = sheetKeys[rnd.int(sheetKeys.length)];
    if (from === to && sheetKeys.length > 1) to = sheetKeys[(sheetKeys.indexOf(from) + 1) % sheetKeys.length];
    const src = bySheet.get(from) ?? [];
    if (src.length > 0) {
      const idx = src[rnd.int(src.length)];
      const [item] = out.splice(idx, 1);
      const insertionBase = bySheet.get(to) ?? [];
      const insertPos = insertionBase.length > 0 ? insertionBase[rnd.int(insertionBase.length)] : out.length;
      out.splice(Math.min(insertPos, out.length), 0, item);
    }
    return out;
  }

  if (move === "reorderSheet") {
    const targetSheet = sheetKeys[rnd.int(sheetKeys.length)];
    const indices = [...(bySheet.get(targetSheet) ?? [])];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = rnd.int(i + 1);
      const a = indices[i];
      const b = indices[j];
      const tmp = out[a];
      out[a] = out[b];
      out[b] = tmp;
    }
    return out;
  }

  // flipRotation: move piece close to front/back to alter insertion dynamics.
  const idx = rnd.int(out.length);
  const [picked] = out.splice(idx, 1);
  out.splice(rnd.int(2) === 0 ? 0 : out.length, 0, picked);
  return out;
}

export function applyLnsRepack(
  placements: CutPlacement[],
  sheet: SheetDefinition,
  kerf: number,
  minUtilizationPercent: number,
  rotationCfg: RotationScoringConfig,
  destroyRatio: number,
  rng: SeededRng | undefined,
  trialPool: TrialConfig[] | undefined,
  scoreModel: ScoreModel,
  deps: Pick<MetaheuristicsDeps, "randomInt" | "simulateTrialForGroup" | "computeSolutionMetrics">
): SheetResult[] {
  const rnd: RngInt = rng ?? { int: deps.randomInt };
  const all = placements.map((p) => ({ ...p }));
  if (all.length === 0) return [];

  // LNS destroy/repair guiado por hotspots de vazio:
  // prioriza remoção em chapas com maior desperdício local.
  const destroyCount = Math.max(1, Math.floor(all.length * destroyRatio));
  const removed: CutPlacement[] = [];
  const bySheet = new Map<number, CutPlacement[]>();
  for (const p of all) {
    if (!bySheet.has(p.sheetIndex)) bySheet.set(p.sheetIndex, []);
    bySheet.get(p.sheetIndex)!.push(p);
  }
  const sheetHotspots = Array.from(bySheet.entries())
    .map(([sheetIndex, list]) => {
      const used = list.reduce((acc, p) => acc + p.largura_mm * p.altura_mm, 0);
      const area = Math.max(1, sheet.largura_mm * sheet.altura_mm);
      const waste = area - used;
      return { sheetIndex, waste };
    })
    .sort((a, b) => b.waste - a.waste);
  const hotspotSet = new Set(sheetHotspots.slice(0, Math.max(1, Math.ceil(sheetHotspots.length / 2))).map((s) => s.sheetIndex));

  for (let i = 0; i < destroyCount && all.length > 0; i++) {
    const hotspotCandidates = all
      .map((p, idx) => ({ idx, p }))
      .filter((x) => hotspotSet.has(x.p.sheetIndex));
    const pool = hotspotCandidates.length > 0 ? hotspotCandidates : all.map((p, idx) => ({ idx, p }));
    const pick = pool[rnd.int(pool.length)];
    removed.push(all[pick.idx]);
    all.splice(pick.idx, 1);
  }
  for (const r of removed) {
    const pos = rnd.int(all.length + 1);
    all.splice(pos, 0, r);
  }

  // Restaura dimensões originais da peça antes do re-pack LNS.
  // Bug crítico sem este fix: se rotacao=90 o motor swapou largura↔altura,
  // e o LNS criava CutPiece com as dims swapped → furos ficavam fora dos bounds
  // e o próximo ciclo de nesting recebia geometria inválida.
  const allPieces: CutPiece[] = all.map((p) => {
    const origW = p.rotacao === 90 ? p.altura_mm : p.largura_mm;
    const origH = p.rotacao === 90 ? p.largura_mm : p.altura_mm;
    // originalDrillHoles = coords pré-rotação = fonte de verdade para coordenadas de furo
    const origHoles = p.originalDrillHoles ?? p.drillHoles ?? p.holes;
    const thick = Number(p.espessura_mm);
    return {
      largura_mm: origW,
      altura_mm: origH,
      espessura_mm: Number.isFinite(thick) && thick > 0 ? thick : sheet.espessura_mm,
      quantidade: 1,
      boxId: p.boxId,
      partName: p.partName,
      materialId: p.materialId,
      materialName: p.materialName,
      drillHoles: origHoles,
      holes: origHoles,
      originalDrillHoles: origHoles,
      pieceNumber: p.pieceNumber,
      metadata: p.metadata,
    };
  });

  const candidateTrials: TrialConfig[] = trialPool && trialPool.length > 0 ? trialPool : [
    { strategy: "skyline", binHeuristic: "firstFit" },
    { strategy: "skyline", binHeuristic: "bestFit" },
    { strategy: "shelf", binHeuristic: "firstFit" },
    { strategy: "guillotine", binHeuristic: "firstFit" },
  ];
  let bestSheets: SheetResult[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < Math.min(4, candidateTrials.length); i++) {
    const trial = candidateTrials[(i + rnd.int(candidateTrials.length)) % candidateTrials.length];
    const packed = deps.simulateTrialForGroup(
      allPieces,
      sheet,
      kerf,
      minUtilizationPercent,
      rotationCfg,
      trial,
      false,
      true,
      scoreModel
    );
    const score = deps.computeSolutionMetrics(packed.sheets, sheet, scoreModel).score;
    if (score < bestScore) {
      bestScore = score;
      bestSheets = packed.sheets;
    }
  }
  bestSheets.forEach((s, idx) => s.placements.forEach((p) => (p.sheetIndex = idx)));
  return bestSheets;
}

function nowMsMeta(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function optimizeWithMetaHeuristics(
  initialSheets: SheetResult[],
  sheet: SheetDefinition,
  kerf: number,
  minUtilizationPercent: number,
  rotationCfg: RotationScoringConfig,
  meta: MetaHeuristicsRuntimeOptions,
  seed: number,
  trialPool: TrialConfig[] | undefined,
  scoreModel: ScoreModel,
  deps: MetaheuristicsDeps,
  budgetMs = 2500
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
  const t0 = nowMsMeta();
  const rng = deps.createSeededRng(seed);
  let current = deps.cloneSheets(initialSheets);
  let currentMetrics = deps.computeSolutionMetrics(current, sheet, scoreModel);
  let best = deps.cloneSheets(current);
  let bestMetrics = { ...currentMetrics };
  const initialMetrics = { ...currentMetrics };
  let temp = meta.initialTemperature;
  let acceptedMoves = 0;
  let completedIter = 0;

  const moves: MetaMove[] = ["swapBetweenSheets", "movePieceAcrossSheets", "reorderSheet", "flipRotation"];
  for (let iter = 0; iter < meta.iterations; iter++) {
    if (nowMsMeta() - t0 > budgetMs) break;
    completedIter++;
    const move = moves[rng.int(moves.length)];
    const basePlacements = deps.flattenPlacements(current);
    const mutated = mutatePlacements(basePlacements, move, sheet, rng, deps);
    let candidateSheets: SheetResult[] = applyLnsRepack(
      mutated,
      sheet,
      kerf,
      minUtilizationPercent,
      rotationCfg,
      meta.lnsDestroyRatio,
      rng,
      trialPool,
      scoreModel,
      deps
    );
    candidateSheets = deps.layoutFromPlacements(deps.flattenPlacements(candidateSheets), sheet).sheets;
    if (candidateSheets.length === 0) continue;
    const candidateMetrics = deps.computeSolutionMetrics(candidateSheets, sheet, scoreModel);
    const delta = candidateMetrics.score - currentMetrics.score;
    const normalizedDelta = delta / 100000;
    const accept = normalizedDelta <= 0 || Math.exp(-normalizedDelta / Math.max(0.001, temp)) > rng.next();
    if (accept) {
      current = deps.cloneSheets(candidateSheets);
      currentMetrics = candidateMetrics;
      acceptedMoves++;
      if (candidateMetrics.score < bestMetrics.score) {
        best = deps.cloneSheets(candidateSheets);
        bestMetrics = { ...candidateMetrics };
      }
    }
    temp *= meta.coolingRate;
  }

  const improvementPercent =
    initialMetrics.score > 0
      ? Number((((initialMetrics.score - bestMetrics.score) / initialMetrics.score) * 100).toFixed(3))
      : 0;
  return {
    sheets: bestMetrics.score <= initialMetrics.score ? best : deps.cloneSheets(initialSheets),
    diagnostics: {
      iterations: completedIter,
      bestScore: bestMetrics.score,
      initialScore: initialMetrics.score,
      improvementPercent,
      acceptedMoves,
      totalMoves: completedIter,
    },
  };
}
