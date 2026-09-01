import type { ProjectState } from "../../context/projectTypes";
import type { ProjectRoomUtility } from "../../3d/viewer-engine/room/roomEngineTypes";
import { appendChangelog, applyResultados, createWorkspaceBox } from "../../context/projectState";
import { getNextWorkspaceBoxId, isLowerCabinet, isUpperCabinet } from "../../context/projectHelpers";
import { getBaseCabinetById, modelToPortaTipo } from "../baseCabinets";
import { isCornerFixedFrontModel } from "../cornerCabinet";
import { isPiBaseCabinetId } from "../../data/moveisUnificados/pi/models";
import { createHematisForBox } from "../hemati/hematiFactory";
import { getMaterialByIdOrLabel } from "../materials/service";
import { HEMATI_DEFAULT_THICKNESS_MM } from "../kitchenFinish/finishTypes";
import type {
  AutoFillApplyResult,
  AutoFillIslandConfig,
  AutoFillPlan,
  AutoFillWallAssignment,
  KitchenLayoutType,
} from "./autoRoomFillTypes";
import { buildGenerateOptions } from "./autoFillSettings";
import { analyzeRoomWalls } from "./roomAnalysis";
import { generateAutoRoomFillPlan } from "./generateAutoRoomFillPlan";
import { generateKitchenLayoutPlan } from "./generateKitchenLayoutPlan";
import {
  EMPTY_ALLOW_UPPER,
  EMPTY_WALL_SELECTION,
  type ProjectAutoFillState,
} from "./autoRoomFillTypes";

function buildBoxFromCatalog(
  prev: ProjectState,
  placed: import("./autoRoomFillTypes").AutoFillPlacedModule,
  boxId: string
) {
  const baseEspessura = prev.material.espessura;

  if (placed.role === "filler") {
    const largura = Math.max(10, placed.fillerWidthMm ?? 20);
    const box = createWorkspaceBox(
      boxId,
      "Enchimento visual",
      { largura, altura: 720, profundidade: 600 },
      baseEspessura,
      placed.posicaoX_mm,
      [],
      "reta",
      "recuado",
      placed.catalogId,
      {
        prateleiras: 0,
        portaTipo: "sem_porta",
        gavetas: 0,
        cabinetType: "lower",
        feetEnabled: false,
        feetHeight: 0,
      }
    );
    box.manualPosition = true;
    box.posicaoX_mm = placed.posicaoX_mm;
    box.posicaoY_mm = placed.posicaoY_mm;
    box.posicaoZ_mm = placed.posicaoZ_mm;
    box.rotacaoY = placed.rotacaoY_rad;
    box.autoRotateEnabled = false;
    return box;
  }

  const baseModel = getBaseCabinetById(placed.catalogId);
  if (!baseModel) return null;

  const isUpperModel =
    baseModel.categoria === "upper" ||
    (placed.role === "special" && placed.specialKind === "hood");
  const isPiModel = isPiBaseCabinetId(baseModel.id) || baseModel.grupoCatalogo === "pi";
  let largura = baseModel.widthMm;
  if (placed.trimWidthMm && placed.trimWidthMm > 0) {
    largura = Math.max(280, largura - placed.trimWidthMm);
  }

  const dimensoes = {
    largura,
    altura: baseModel.heightMm,
    profundidade: baseModel.depthMm,
  };

  const box = createWorkspaceBox(
    boxId,
    baseModel.nome,
    dimensoes,
    baseEspessura,
    placed.posicaoX_mm,
    [],
    "reta",
    "recuado",
    placed.catalogId,
    {
      prateleiras: baseModel.shelves,
      portaTipo: modelToPortaTipo(baseModel.doors),
      gavetas: isPiModel ? 0 : baseModel.drawers,
      cabinetType: isUpperModel ? "upper" : "lower",
      feetEnabled: !isUpperModel,
      feetHeight: 100,
      feetOffsetFront: 100,
      drawerHeightMode: isPiModel ? "custom" : "equal",
      cornerFixedFront: isCornerFixedFrontModel(baseModel.id),
    }
  );

  box.manualPosition = true;
  box.posicaoX_mm = placed.posicaoX_mm;
  box.posicaoY_mm = placed.posicaoY_mm;
  box.posicaoZ_mm = placed.posicaoZ_mm;
  box.rotacaoY = placed.rotacaoY_rad;
  box.autoRotateEnabled = false;
  if (isUpperModel) {
    box.cabinetType = "upper";
    box.feetEnabled = false;
    box.feetHeight = 0;
  }
  return box;
}

export type AutoFillApplyExtras = {
  layoutType?: KitchenLayoutType;
  layoutSummary?: string;
  islandConfig?: AutoFillIslandConfig | null;
  wallAssignments?: AutoFillWallAssignment[];
};

export function applyAutoRoomFillPlan(
  prev: ProjectState,
  plan: AutoFillPlan,
  extras?: AutoFillApplyExtras
): AutoFillApplyResult {
  const materialId = prev.materialId || prev.material.tipo;
  const material = getMaterialByIdOrLabel(materialId);
  const thicknessMm =
    Number(material?.espessura ?? prev.material.espessura ?? HEMATI_DEFAULT_THICKNESS_MM) || 19;

  let workspaceBoxes = [...prev.workspaceBoxes];
  const remates = [...(prev.remates ?? [])];
  let hematis = [...(prev.hematis ?? [])];
  const rodapes = [...(prev.rodapes ?? [])];
  let room = prev.room;

  const createdBoxIds: string[] = [];
  const createdRemateIds: string[] = [];
  const createdHematiIds: string[] = [];
  const createdRodapeIds: string[] = [];

  const boxesByIndex: import("../types").WorkspaceBox[] = [];

  for (const placed of plan.modules) {
    const { id: newBoxId } = getNextWorkspaceBoxId(workspaceBoxes);
    const box = buildBoxFromCatalog(prev, placed, newBoxId);
    if (!box) continue;
    workspaceBoxes = [...workspaceBoxes, box];
    boxesByIndex.push(box);
    createdBoxIds.push(box.id);
  }

  if (room) {
    const generatedUtilities: ProjectRoomUtility[] = [];
    for (const placed of plan.modules) {
      if (placed.role !== "special" || !placed.specialKind) continue;
      const positionAlongWall =
        placed.wallLabel === "este" || placed.wallLabel === "oeste"
          ? Math.max(0, placed.posicaoZ_mm)
          : Math.max(0, placed.posicaoX_mm);
      const base = {
        wallId: placed.wallId,
        positionAlongWall,
      };
      if (placed.specialKind === "sink") {
        generatedUtilities.push(
          {
            id: `auto-water-${placed.wallId}-${Math.round(positionAlongWall)}`,
            type: "WaterPoint",
            heightMm: 550,
            ...base,
          },
          {
            id: `auto-drain-${placed.wallId}-${Math.round(positionAlongWall)}`,
            type: "DrainPoint",
            heightMm: 250,
            ...base,
          }
        );
      }
      if (placed.specialKind === "oven" || placed.specialKind === "fridge") {
        generatedUtilities.push({
          id: `auto-electric-${placed.specialKind}-${placed.wallId}-${Math.round(positionAlongWall)}`,
          type: "ElectricalOutlet",
          heightMm: placed.specialKind === "fridge" ? 1200 : 300,
          ...base,
        });
      }
    }
    const existingIds = new Set((room.utilities ?? []).map((utility) => utility.id));
    room = {
      ...room,
      utilities: [
        ...(room.utilities ?? []),
        ...generatedUtilities.filter((utility) => !existingIds.has(utility.id)),
      ],
    };
  }

  for (const finish of plan.finishes) {
    const box = boxesByIndex[finish.boxIndex];
    if (!box) continue;
    // Remates / rodapés: Auto-Room-Fill não cria por defeito (flags false no plano).
    const hematiCount = hematis.filter((h) => h.parentBoxId === box.id).length;

    if (finish.hematiDir && isLowerCabinet(box)) {
      const created = createHematisForBox({
        box,
        allBoxes: workspaceBoxes,
        room: prev.room,
        roomBoundsM: null,
        input: { kind: "DIR", parentBoxId: box.id, materialId },
        materialId,
        thicknessMm,
        existingCount: hematiCount,
      });
      hematis = [...hematis, ...created];
      createdHematiIds.push(...created.map((h) => h.id));
    }
    if (finish.hematiEsq && isLowerCabinet(box)) {
      const created = createHematisForBox({
        box,
        allBoxes: workspaceBoxes,
        room: prev.room,
        roomBoundsM: null,
        input: { kind: "ESQ", parentBoxId: box.id, materialId },
        materialId,
        thicknessMm,
        existingCount: hematiCount + 1,
      });
      hematis = [...hematis, ...created];
      createdHematiIds.push(...created.map((h) => h.id));
    }
    if (finish.hematiCima && isUpperCabinet(box)) {
      const created = createHematisForBox({
        box,
        allBoxes: workspaceBoxes,
        room: prev.room,
        roomBoundsM: null,
        input: { kind: "CIMA", parentBoxId: box.id, materialId },
        materialId,
        thicknessMm,
        existingCount: hematiCount,
      });
      hematis = [...hematis, ...created];
      createdHematiIds.push(...created.map((h) => h.id));
    }
  }

  const summary = extras?.layoutSummary ?? plan.summaryLines.join("\n");
  const detailedSummary =
    extras?.layoutSummary ?? (plan.summaryLines.slice(3).join("\n") || summary);
  const trimAppliedMm = Math.max(0, ...plan.wallSummaries.map((w) => w.trimAppliedMm));
  const lastRun: ProjectAutoFillState = {
    lastRunAt: new Date().toISOString(),
    summary,
    detailedSummary,
    wallSelection: prev.autoFill?.wallSelection ?? EMPTY_WALL_SELECTION,
    allowUpperModules: prev.autoFill?.allowUpperModules ?? EMPTY_ALLOW_UPPER,
    layoutType: extras?.layoutType,
    layoutTypeOverride: prev.autoFill?.layoutTypeOverride ?? "auto",
    layoutSummary: extras?.layoutSummary,
    islandConfig: extras?.islandConfig ?? null,
    wallAssignments: extras?.wallAssignments,
    createdBoxIds,
    createdRemateIds,
    createdHematiIds,
    createdRodapeIds,
    wallSummaries: plan.wallSummaries,
    specialsPlaced: plan.specialsPlaced,
    trimAppliedMm,
  };

  const next = applyResultados({
    ...prev,
    workspaceBoxes,
    room,
    remates,
    hematis,
    rodapes,
    autoFill: lastRun,
    selectedWorkspaceBoxId: createdBoxIds[0] ?? prev.selectedWorkspaceBoxId,
    changelog: appendChangelog(prev.changelog, {
      timestamp: new Date(),
      type: "box",
      message: `Auto-Room-Fill: ${createdBoxIds.length} módulos`,
    }),
  });

  return {
    state: next,
    createdBoxIds,
    createdRemateIds,
    createdHematiIds,
    createdRodapeIds,
    summary,
    detailedSummary,
  };
}

export function runAutoRoomFillOnState(prev: ProjectState): AutoFillApplyResult | null {
  if (!prev.room) return null;
  const runs = analyzeRoomWalls(prev.room);
  const opts = buildGenerateOptions(
    prev.autoFill?.wallSelection,
    prev.autoFill?.allowUpperModules,
    runs
  );
  const plan = generateAutoRoomFillPlan(prev.room, opts);
  if (!plan || plan.modules.length === 0) return null;
  return applyAutoRoomFillPlan(prev, plan);
}

export function runKitchenLayout30OnState(prev: ProjectState): AutoFillApplyResult | null {
  if (!prev.room) return null;
  const layoutResult = generateKitchenLayoutPlan(
    prev.room,
    prev.autoFill?.layoutTypeOverride ?? "auto"
  );
  if (!layoutResult || layoutResult.plan.modules.length === 0) return null;
  return applyAutoRoomFillPlan(prev, layoutResult.plan, {
    layoutType: layoutResult.layoutType,
    layoutSummary: layoutResult.layoutSummary,
    islandConfig: layoutResult.islandConfig,
    wallAssignments: layoutResult.wallAssignments,
  });
}
