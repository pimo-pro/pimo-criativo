import type { ProjectRoomConfig, RoomWallLabel } from "../../3d/viewer-engine/room/roomEngineTypes";
import type {
  AutoFillAllowUpperByWall,
  AutoFillPlan,
  AutoFillWallAssignment,
  AutoFillWallSelection,
  KitchenLayoutType,
  KitchenLayoutTypeOverride,
  LayoutDetectionResult,
} from "./autoRoomFillTypes";
import { EMPTY_ALLOW_UPPER, EMPTY_WALL_SELECTION } from "./autoRoomFillTypes";
import { analyzeRoomWalls } from "./roomAnalysis";
import { pickPrimaryWallRun } from "./autoFillSettings";
import {
  detectKitchenLayout,
  resolveLayoutType,
  wallLabelsForLayout,
} from "./layoutDetection";
import { buildSpecialsForLayout } from "./layoutSpecials";
import { computeIslandConfig, generateIslandModules } from "./islandGenerator";
import { generateAutoRoomFillPlan } from "./generateAutoRoomFillPlan";
import type { SpecialPlacement } from "./specialPlacement";
import { hoodPlacementForCooktop } from "./specialPlacement";
import { getBaseCabinetById } from "../baseCabinets";
import { SPECIAL_CATALOG } from "./moduleCatalog";
import { runAlongToWorld } from "./roomAnalysis";
import { getEffectiveRoomSpanMm } from "../../pimo-room/mesh/impl/roomDynamicBounds";
import type { AnalyzedWallRun } from "./autoRoomFillTypes";

const UPPER_GAP_MM = 680;
const LOWER_REF_HEIGHT_MM = 720;

function wallSelectionFromLabels(labels: RoomWallLabel[]): AutoFillWallSelection {
  const sel = { ...EMPTY_WALL_SELECTION };
  for (const label of labels) sel[label] = true;
  return sel;
}

function allowUpperForLayout(
  labels: RoomWallLabel[],
  primary: RoomWallLabel
): AutoFillAllowUpperByWall {
  const allow = { ...EMPTY_ALLOW_UPPER };
  allow[primary] = true;
  if (labels.length >= 3) {
    for (const label of labels) allow[label] = true;
  }
  return allow;
}

function buildWallAssignments(
  runs: AnalyzedWallRun[],
  labels: RoomWallLabel[],
  layoutType: KitchenLayoutType
): AutoFillWallAssignment[] {
  const byLabel = new Map(runs.map((r) => [r.label, r]));
  const roles: Array<AutoFillWallAssignment["role"]> =
    layoutType === "U"
      ? ["leg", "primary", "leg"]
      : layoutType === "L"
        ? ["primary", "secondary"]
        : ["primary"];

  return labels.map((label, index) => {
    const run = byLabel.get(label);
    const useful = run?.segments.reduce((s, seg) => s + seg.lengthMm, 0) ?? 0;
    return {
      label,
      wallId: run?.wallId ?? `wall-${label}`,
      role: roles[index] ?? "leg",
      usefulLengthMm: Math.round(useful),
    };
  });
}

function appendHoodForCooktop(
  plan: AutoFillPlan,
  room: ProjectRoomConfig,
  runs: AnalyzedWallRun[],
  specialsByWall: Partial<Record<RoomWallLabel, SpecialPlacement[]>>
): AutoFillPlan {
  for (const run of runs) {
    const specials = specialsByWall[run.label];
    const cooktop = specials?.find((s) => s.kind === "cooktop");
    if (!cooktop) continue;
    const allow = plan.wallSummaries.some((w) => w.wallLabel === run.label);
    if (!allow) continue;

    const hood = hoodPlacementForCooktop(run, cooktop);
    const hoodModel = getBaseCabinetById(SPECIAL_CATALOG.hood.upperId!);
    const w = hoodModel?.widthMm ?? hood.widthMm;
    const h = hoodModel?.heightMm ?? 720;
    const lowerTop = LOWER_REF_HEIGHT_MM + 100;
    const span = getEffectiveRoomSpanMm(room);
    const pos = runAlongToWorld(
      run,
      hood.alongMm + w / 2,
      span.widthMm,
      span.depthMm,
      (lowerTop + UPPER_GAP_MM + h / 2) * 2
    );

    const modules = [...plan.modules];
    const finishes = [...plan.finishes];
    modules.push({
      catalogId: SPECIAL_CATALOG.hood.upperId!,
      role: "special",
      specialKind: "hood",
      wallId: run.wallId,
      wallLabel: run.label,
      rotacaoY_rad: run.rotacaoY_rad,
      posicaoX_mm: pos.x,
      posicaoY_mm: lowerTop + UPPER_GAP_MM + h / 2,
      posicaoZ_mm: pos.z,
    });
    finishes.push({
      boxIndex: modules.length - 1,
      wallId: run.wallId,
      remateDir: false,
      hematiCima: true,
    });

    return {
      ...plan,
      modules,
      finishes,
      specialsPlaced: [...new Set([...plan.specialsPlaced, "hood" as const])],
    };
  }
  return plan;
}

export type KitchenLayoutPlanResult = {
  plan: AutoFillPlan;
  detection: LayoutDetectionResult;
  layoutType: KitchenLayoutType;
  layoutSummary: string;
  wallAssignments: AutoFillWallAssignment[];
  islandConfig: import("./autoRoomFillTypes").AutoFillIslandConfig | null;
};

export function generateKitchenLayoutPlan(
  room: ProjectRoomConfig,
  layoutOverride?: KitchenLayoutTypeOverride
): KitchenLayoutPlanResult | null {
  const detection = detectKitchenLayout(room);
  if (!detection) return null;

  const layoutType = resolveLayoutType(detection, layoutOverride);
  const wallLabels = wallLabelsForLayout(layoutType, detection);
  const allRuns = analyzeRoomWalls(room);
  const primary = pickPrimaryWallRun(allRuns.filter((r) => wallLabels.includes(r.label)));

  const wallSelection = wallSelectionFromLabels(wallLabels);
  const allowUpperModules = allowUpperForLayout(wallLabels, primary.label);
  const specialsByWall = buildSpecialsForLayout(layoutType, room, allRuns, wallLabels, detection);

  let plan = generateAutoRoomFillPlan(
    room,
    { wallSelection, allowUpperModules },
    specialsByWall
  );
  if (!plan) return null;

  plan = appendHoodForCooktop(plan, room, allRuns, specialsByWall);

  let islandConfig = null;
  if (layoutType === "island" && detection.islandEligible) {
    islandConfig = computeIslandConfig(room);
    if (islandConfig) {
      const island = generateIslandModules(islandConfig);
      const offset = plan.modules.length;
      plan = {
        ...plan,
        modules: [...plan.modules, ...island.modules],
        finishes: [
          ...plan.finishes,
          ...island.finishes.map((f) => ({ ...f, boxIndex: f.boxIndex + offset })),
        ],
        summaryLines: [
          ...plan.summaryLines,
          "",
          `Ilha: ${islandConfig.widthMm}×${islandConfig.depthMm} mm @ (${Math.round(islandConfig.centerX_mm)}, ${Math.round(islandConfig.centerZ_mm)})`,
        ],
      };
    }
  }

  const wallAssignments = buildWallAssignments(allRuns, wallLabels, layoutType);
  const layoutSummary = [
    `Layout: ${layoutType} (${layoutOverride === "auto" || !layoutOverride ? "detetado" : "manual"})`,
    `Paredes: ${wallLabels.join(", ")}`,
    `Cantos válidos: ${detection.validCornerCount}`,
    `Espaço central: ${detection.centerFreeWidthMm}×${detection.centerFreeDepthMm} mm`,
    detection.islandEligible ? "Ilha: elegível" : "Ilha: não elegível",
    islandConfig ? `Ilha gerada: ${islandConfig.moduleCatalogIds.length} módulos` : "",
    "",
    ...plan.summaryLines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    plan,
    detection,
    layoutType,
    layoutSummary,
    wallAssignments,
    islandConfig,
  };
}
