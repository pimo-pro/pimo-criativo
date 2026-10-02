import type { ProjectRoomConfig, RoomWallLabel } from "../../3d/viewer-engine/room/roomEngineTypes";
import { getBaseCabinetById } from "../baseCabinets";
import {
  buildGenerateOptions,
  MIN_ROOM_DEPTH_FOR_UPPER_MM,
  resolveWallsToFill,
  roomDepthAlongWall,
} from "./autoFillSettings";
import type {
  AutoFillFinishSpec,
  AutoFillGenerateOptions,
  AutoFillPlan,
  AutoFillPlacedModule,
  AutoFillSpecialKind,
  AutoFillWallSummary,
} from "./autoRoomFillTypes";
import {
  CORNER_LOWER_ID,
  CORNER_UPPER_ID,
  catalogIdForLowerWidth,
  catalogIdForUpperWidth,
  SPECIAL_CATALOG,
} from "./moduleCatalog";
import { analyzeRoomWalls, detectRoomCorners, runAlongToWorld } from "./roomAnalysis";
import { getEffectiveRoomSpanMm } from "../../pimo-room/mesh/impl/roomDynamicBounds";
import type { AnalyzedWallRun } from "./autoRoomFillTypes";
import { packWallSpan } from "./wallPacking";
import {
  buildSpecialsForWall,
  hoodPlacementForCooktop,
  segmentHasWindow,
  type SpecialPlacement,
} from "./specialPlacement";
import { FILLER_CATALOG_ID, FILLER_PANEL_WIDTH_MM } from "./autoFillSettings";

const CORNER_RESERVE_MM = 900;
const UPPER_GAP_MM = 680;
const LOWER_REF_HEIGHT_MM = 720;

type SegmentFillStats = {
  wastedMm: number;
  trimAppliedMm: number;
  lower: number;
  upper: number;
  special: number;
  filler: number;
  corner: number;
  remate: number;
  hemati: number;
  rodape: number;
  specials: AutoFillSpecialKind[];
};

function lowerCenterY(heightMm: number): number {
  return 100 + heightMm / 2;
}

function upperCenterY(lowerHeightMm: number, upperHeightMm: number): number {
  return lowerHeightMm + UPPER_GAP_MM + upperHeightMm / 2;
}

function placeAlongRun(
  run: AnalyzedWallRun,
  alongStartMm: number,
  moduleWidthMm: number,
  roomWidthMm: number,
  roomDepthMm: number,
  centerY_mm: number
): Pick<AutoFillPlacedModule, "posicaoX_mm" | "posicaoZ_mm" | "posicaoY_mm"> {
  const centerAlong = alongStartMm + moduleWidthMm / 2;
  const world = runAlongToWorld(run, centerAlong, roomWidthMm, roomDepthMm, centerY_mm * 2);
  return {
    posicaoX_mm: world.x,
    posicaoY_mm: centerY_mm,
    posicaoZ_mm: world.z,
  };
}

function countFinishes(f: AutoFillFinishSpec): SegmentFillStats {
  return {
    wastedMm: 0,
    trimAppliedMm: 0,
    lower: 0,
    upper: 0,
    special: 0,
    filler: 0,
    corner: 0,
    remate: (f.remateDir ? 1 : 0) + (f.remateEsq ? 1 : 0) + (f.remateL ? 2 : 0),
    hemati: (f.hematiDir ? 1 : 0) + (f.hematiEsq ? 1 : 0) + (f.hematiCima ? 1 : 0),
    rodape: f.rodapeSimple ? 1 : 0,
    specials: [],
  };
}

function mergeStats(a: SegmentFillStats, b: SegmentFillStats): SegmentFillStats {
  return {
    wastedMm: a.wastedMm + b.wastedMm,
    trimAppliedMm: Math.max(a.trimAppliedMm, b.trimAppliedMm),
    lower: a.lower + b.lower,
    upper: a.upper + b.upper,
    special: a.special + b.special,
    filler: a.filler + b.filler,
    corner: a.corner + b.corner,
    remate: a.remate + b.remate,
    hemati: a.hemati + b.hemati,
    rodape: a.rodape + b.rodape,
    specials: [...a.specials, ...b.specials],
  };
}

function pushModule(
  run: AnalyzedWallRun,
  modules: AutoFillPlacedModule[],
  finishes: AutoFillFinishSpec[],
  stats: SegmentFillStats,
  mod: Omit<AutoFillPlacedModule, "wallId" | "wallLabel" | "rotacaoY_rad">,
  finish: Omit<AutoFillFinishSpec, "boxIndex" | "wallId">
): void {
  modules.push({
    ...mod,
    wallId: run.wallId,
    wallLabel: run.label,
    rotacaoY_rad: run.rotacaoY_rad,
  });
  const idx = modules.length - 1;
  finishes.push({ ...finish, boxIndex: idx, wallId: run.wallId });
  if (mod.role === "lower") stats.lower += 1;
  else if (mod.role === "upper") stats.upper += 1;
  else if (mod.role === "special") {
    stats.special += 1;
    if (mod.specialKind) stats.specials.push(mod.specialKind);
  } else if (mod.role === "filler") stats.filler += 1;
  else if (mod.role === "corner") stats.corner += 1;
  const fc = countFinishes({ ...finish, boxIndex: idx, wallId: run.wallId });
  stats.remate += fc.remate;
  stats.hemati += fc.hemati;
  stats.rodape += fc.rodape;
}

function emitPackedWidths(
  run: AnalyzedWallRun,
  cursor: number,
  packed: ReturnType<typeof packWallSpan>,
  tier: "lower" | "upper",
  stats: SegmentFillStats,
  modules: AutoFillPlacedModule[],
  finishes: AutoFillFinishSpec[],
  _cornerAtStart: boolean,
  roomWidthMm: number,
  roomDepthMm: number
): number {
  for (let i = 0; i < packed.widthsMm.length; i++) {
    const width = packed.widthsMm[i];
    const trim =
      i === packed.widthsMm.length - 1 && packed.trimLastMm ? packed.trimLastMm : undefined;
    if (trim) stats.trimAppliedMm = Math.max(stats.trimAppliedMm, trim);
    const catalogId = tier === "upper" ? catalogIdForUpperWidth(width) : catalogIdForLowerWidth(width);
    const model = getBaseCabinetById(catalogId);
    const h = model?.heightMm ?? 720;
    const pos = placeAlongRun(
      run,
      cursor,
      width,
      roomWidthMm,
      roomDepthMm,
      tier === "upper" ? upperCenterY(LOWER_REF_HEIGHT_MM, h) : lowerCenterY(h)
    );
    pushModule(
      run,
      modules,
      finishes,
      stats,
      {
        catalogId,
        role: tier,
        trimWidthMm: trim,
        ...pos,
      },
      {
        remateDir: false,
        remateEsq: false,
        hematiDir: tier === "lower",
        hematiEsq: tier === "lower",
        hematiCima: tier === "upper",
        rodapeSimple: false,
      }
    );
    cursor += width;
  }

  if (packed.fillerMm && packed.fillerMm > 0) {
    const fillerW = Math.max(10, Math.min(packed.fillerMm, FILLER_PANEL_WIDTH_MM + 10));
    const pos = placeAlongRun(
      run,
      cursor,
      fillerW,
      roomWidthMm,
      roomDepthMm,
      lowerCenterY(LOWER_REF_HEIGHT_MM)
    );
    pushModule(
      run,
      modules,
      finishes,
      stats,
      {
        catalogId: FILLER_CATALOG_ID,
        role: "filler",
        fillerWidthMm: fillerW,
        ...pos,
      },
      { remateDir: false, rodapeSimple: false }
    );
    stats.wastedMm += Math.max(0, packed.fillerMm - fillerW);
    cursor += fillerW;
  }

  return cursor;
}

function fillSegmentOnWall(
  run: AnalyzedWallRun,
  segmentStart: number,
  segmentLength: number,
  tier: "lower" | "upper",
  cornerAtStart: boolean,
  specials: SpecialPlacement[],
  roomWidthMm: number,
  roomDepthMm: number
): {
  modules: AutoFillPlacedModule[];
  finishes: AutoFillFinishSpec[];
  stats: SegmentFillStats;
} {
  const modules: AutoFillPlacedModule[] = [];
  const finishes: AutoFillFinishSpec[] = [];
  const stats: SegmentFillStats = {
    wastedMm: 0,
    trimAppliedMm: 0,
    lower: 0,
    upper: 0,
    special: 0,
    filler: 0,
    corner: 0,
    remate: 0,
    hemati: 0,
    rodape: 0,
    specials: [],
  };
  let cursor = segmentStart;
  const isUpper = tier === "upper";

  if (cornerAtStart && segmentLength >= CORNER_RESERVE_MM + 400) {
    const cornerId = isUpper ? CORNER_UPPER_ID : CORNER_LOWER_ID;
    const model = getBaseCabinetById(cornerId);
    const w = model?.widthMm ?? CORNER_RESERVE_MM;
    const h = model?.heightMm ?? 720;
    const pos = placeAlongRun(
      run,
      cursor,
      w,
      roomWidthMm,
      roomDepthMm,
      isUpper ? upperCenterY(LOWER_REF_HEIGHT_MM, h) : lowerCenterY(h)
    );
    pushModule(
      run,
      modules,
      finishes,
      stats,
      { catalogId: cornerId, role: "corner", ...pos },
      {
        remateL: false,
        hematiDir: !isUpper,
        hematiEsq: !isUpper,
        hematiCima: isUpper,
        rodapeSimple: false,
      }
    );
    cursor += w;
  }

  const specialsHere = specials
    .filter((s) => s.alongMm >= segmentStart && s.alongMm < segmentStart + segmentLength)
    .sort((a, b) => a.alongMm - b.alongMm);

  for (const special of specialsHere) {
    if (special.alongMm > cursor + 50) {
      const gap = special.alongMm - cursor;
      const packed = packWallSpan(gap, tier);
      cursor = emitPackedWidths(
        run,
        cursor,
        packed,
        tier,
        stats,
        modules,
        finishes,
        cornerAtStart,
        roomWidthMm,
        roomDepthMm
      );
      stats.wastedMm += Math.max(0, gap - packed.widthsMm.reduce((a, w) => a + w, 0));
    }
    const spec = SPECIAL_CATALOG[special.kind];
    const catalogId = isUpper && spec.upperId ? spec.upperId : spec.lowerId;
    const model = getBaseCabinetById(catalogId);
    const w = model?.widthMm ?? special.widthMm;
    const h = model?.heightMm ?? 720;
    const pos = placeAlongRun(
      run,
      special.alongMm,
      w,
      roomWidthMm,
      roomDepthMm,
      isUpper ? upperCenterY(LOWER_REF_HEIGHT_MM, h) : lowerCenterY(h)
    );
    pushModule(
      run,
      modules,
      finishes,
      stats,
      {
        catalogId,
        role: "special",
        specialKind: special.kind,
        ...pos,
      },
      {
        remateDir: false,
        hematiDir: !isUpper,
        hematiEsq: !isUpper,
        hematiCima: isUpper,
        rodapeSimple: false,
      }
    );
    cursor = special.alongMm + w;
  }

  const remaining = segmentStart + segmentLength - cursor;
  const packed = packWallSpan(remaining, tier);
  const before = cursor;
  cursor = emitPackedWidths(
    run,
    cursor,
    packed,
    tier,
    stats,
    modules,
    finishes,
    cornerAtStart,
    roomWidthMm,
    roomDepthMm
  );
  const used = cursor - before;
  stats.wastedMm += Math.max(0, remaining - used - (packed.trimLastMm ?? 0));

  return { modules, finishes, stats };
}

function canPlaceUpperOnWall(
  run: AnalyzedWallRun,
  room: ProjectRoomConfig,
  options: AutoFillGenerateOptions
): boolean {
  if (!options.allowUpperModules[run.label]) return false;
  const depth = roomDepthAlongWall(run.label, room.widthMm, room.depthMm);
  return depth >= MIN_ROOM_DEPTH_FOR_UPPER_MM;
}

function formatDetailedSummary(summaries: AutoFillWallSummary[]): string {
  return summaries
    .map((w) => {
      const lines = [
        `▸ ${w.wallLabel.toUpperCase()} (${w.usefulLengthMm} mm úteis)`,
        `  Inferiores: ${w.lowerCount} · Superiores: ${w.upperCount} · Especiais: ${w.specialCount}`,
        `  Cantos: ${w.cornerCount} · Enchimento: ${w.fillerCount}`,
        `  Remates: ${w.remateCount} · Remate módulo: ${w.hematiCount} · Roda pé: ${w.rodapeCount}`,
        `  Perda: ${w.wastedMm} mm · Trim: ${w.trimAppliedMm} mm`,
      ];
      if (w.specialsPlaced.length) {
        lines.push(`  Especiais: ${w.specialsPlaced.join(", ")}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function generateAutoRoomFillPlan(
  room: ProjectRoomConfig | null,
  options?: Partial<AutoFillGenerateOptions>,
  specialsByWallLabel?: Partial<Record<RoomWallLabel, SpecialPlacement[]>>
): AutoFillPlan | null {
  if (!room?.walls?.length) return null;

  const roomSpan = getEffectiveRoomSpanMm(room);
  const allRuns = analyzeRoomWalls(room);
  if (!allRuns.length) return null;

  const genOpts = buildGenerateOptions(
    options?.wallSelection,
    options?.allowUpperModules,
    allRuns
  );
  const { runs: wallRuns, primary } = resolveWallsToFill(allRuns, genOpts.wallSelection);
  if (!wallRuns.length) return null;

  const corners = detectRoomCorners(room);
  const openings = room.openings ?? [];

  const allModules: AutoFillPlacedModule[] = [];
  const allFinishes: AutoFillFinishSpec[] = [];
  const wallSummaries: AutoFillWallSummary[] = [];
  let finishOffset = 0;
  const allSpecialsPlaced: AutoFillSpecialKind[] = [];
  let totalTrim = 0;

  for (const run of wallRuns) {
    const isPrimary = run.wallId === primary.wallId;
    const specials =
      specialsByWallLabel?.[run.label] ??
      buildSpecialsForWall(run, room, isPrimary);
    const allowUpper = canPlaceUpperOnWall(run, room, genOpts);
    let wallStats: SegmentFillStats = {
      wastedMm: 0,
      trimAppliedMm: 0,
      lower: 0,
      upper: 0,
      special: 0,
      filler: 0,
      corner: 0,
      remate: 0,
      hemati: 0,
      rodape: 0,
      specials: [],
    };
    let usefulTotal = 0;

    for (const segment of run.segments) {
      usefulTotal += segment.lengthMm;
      const hasWindow = segmentHasWindow(run.wallId, segment, openings);
      const upperAllowed = allowUpper && !hasWindow;

      const lower = fillSegmentOnWall(
        run,
        segment.startMm,
        segment.lengthMm,
        "lower",
        run.cornerAtStart,
        specials,
        roomSpan.widthMm,
        roomSpan.depthMm
      );
      lower.finishes.forEach((f) =>
        allFinishes.push({ ...f, boxIndex: f.boxIndex + finishOffset })
      );
      finishOffset += lower.modules.length;
      allModules.push(...lower.modules);
      wallStats = mergeStats(wallStats, lower.stats);

      if (upperAllowed) {
        const upper = fillSegmentOnWall(
          run,
          segment.startMm,
          segment.lengthMm,
          "upper",
          run.cornerAtStart,
          [],
          roomSpan.widthMm,
          roomSpan.depthMm
        );
        upper.finishes.forEach((f) =>
          allFinishes.push({ ...f, boxIndex: f.boxIndex + finishOffset })
        );
        finishOffset += upper.modules.length;
        allModules.push(...upper.modules);
        wallStats = mergeStats(wallStats, upper.stats);
      }
    }

    const hasCooktop = specials.some((s) => s.kind === "cooktop");
    if (hasCooktop && genOpts.allowUpperModules[run.label]) {
      const cooktop = specials.find((s) => s.kind === "cooktop");
      if (cooktop) {
        const hood = hoodPlacementForCooktop(run, cooktop);
        const hoodModel = getBaseCabinetById(SPECIAL_CATALOG.hood.upperId!);
        const w = hoodModel?.widthMm ?? hood.widthMm;
        const h = hoodModel?.heightMm ?? 720;
        const lowerTop = LOWER_REF_HEIGHT_MM + 100;
        const pos = placeAlongRun(
          run,
          hood.alongMm,
          w,
          roomSpan.widthMm,
          roomSpan.depthMm,
          lowerTop + UPPER_GAP_MM + h / 2
        );
        const mod: AutoFillPlacedModule = {
          catalogId: SPECIAL_CATALOG.hood.upperId!,
          role: "special",
          specialKind: "hood",
          wallId: run.wallId,
          wallLabel: run.label,
          rotacaoY_rad: run.rotacaoY_rad,
          ...pos,
        };
        allModules.push(mod);
        allFinishes.push({
          boxIndex: allModules.length - 1,
          wallId: run.wallId,
          remateDir: false,
          hematiCima: true,
        });
        wallStats.special += 1;
        wallStats.specials.push("hood");
        wallStats.hemati += 1;
      }
    }

    totalTrim = Math.max(totalTrim, wallStats.trimAppliedMm);
    allSpecialsPlaced.push(...wallStats.specials);

    wallSummaries.push({
      wallId: run.wallId,
      wallLabel: run.label,
      usefulLengthMm: Math.round(usefulTotal),
      wastedMm: Math.round(wallStats.wastedMm),
      trimAppliedMm: Math.round(wallStats.trimAppliedMm),
      lowerCount: wallStats.lower,
      upperCount: wallStats.upper,
      specialCount: wallStats.special,
      fillerCount: wallStats.filler,
      cornerCount: wallStats.corner,
      remateCount: wallStats.remate,
      hematiCount: wallStats.hemati,
      rodapeCount: wallStats.rodape,
      specialsPlaced: [...new Set(wallStats.specials)],
      moduleCount:
        wallStats.lower +
        wallStats.upper +
        wallStats.special +
        wallStats.filler +
        wallStats.corner,
    });
  }

  const detailed = formatDetailedSummary(wallSummaries);
  const summaryLines = [
    `Paredes: ${wallSummaries.map((w) => w.wallLabel).join(", ")}`,
    `Módulos totais: ${allModules.length}`,
    `Cantos válidos: ${corners.filter((c) => c.valid).length}`,
    "",
    detailed,
  ];

  return {
    modules: allModules,
    finishes: allFinishes,
    wallSummaries,
    corners,
    summaryLines,
    specialsPlaced: [...new Set(allSpecialsPlaced)],
  };
}
