import type { ProjectState } from "../../context/projectTypes";
import { recomputeState } from "../../context/projectState";
import type { CutListItemComPreco, Material, WorkspaceBox } from "../types";
import type { RematePiece } from "../remate/rematePieceTypes";
import type { ProjectRodape } from "../rodape/rodapeTypes";
import {
  clearAllCutlistCache,
  clearCutlistCacheForProject,
} from "../manufacturing/cutlistFromBoxes";
import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import { decodeSelectionId } from "../viewer/selectionIds";
import { getIndustrialMaterial } from "./service";
import { refreshViewerAfterMaterialSync } from "../../industrial/viewerIntegration";
import { isCaixaFornoBox, syncCaixaFornoOnDimensoesChange } from "../moveis/generators/caixaFornoGenerator";

export type MaterialSyncTarget =
  | { kind: "project"; material: Material | null; materialId?: string }
  | { kind: "box"; boxId: string; materialId: string }
  | { kind: "door"; boxId: string; doorLayerId: string; materialId: string }
  | { kind: "drawer"; boxId: string; drawerLayerId: string; materialId: string }
  | { kind: "doorLayerItem"; boxId: string; itemId: string; materialId: string }
  | { kind: "drawerLayerItem"; boxId: string; itemId: string; materialId: string }
  | { kind: "remate"; remateId: string; materialId: string }
  | { kind: "rodape"; rodapeId: string; materialId: string }
  | { kind: "selection"; encodedIds: readonly string[]; materialId: string };

export type MaterialSyncResult = {
  workspaceBoxes: WorkspaceBox[];
  remates: RematePiece[];
  rodapes: ProjectRodape[];
  material?: Material;
  materialId?: string;
  affectedBoxIds: string[];
  affectedRemateIds: string[];
  affectedRodapeIds: string[];
  invalidateGlobalCache: boolean;
};

function resolveProjectId(project: ProjectState): string {
  return project.currentProjectId ?? "project";
}

function emptyMaterialSyncResult(project: ProjectState): MaterialSyncResult {
  return {
    workspaceBoxes: project.workspaceBoxes,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    affectedBoxIds: [],
    affectedRemateIds: [],
    affectedRodapeIds: [],
    invalidateGlobalCache: false,
  };
}

function withDoorMaterial<T extends { material?: string; materialId?: string }>(
  item: T,
  materialId: string
): T {
  return { ...item, material: materialId, materialId };
}

function withDrawerMaterial<T extends { material?: string; materialId?: string; metadata?: { frontMaterial?: string } }>(
  item: T,
  materialId: string
): T {
  return {
    ...item,
    material: materialId,
    materialId,
    metadata: { ...item.metadata, frontMaterial: materialId },
  };
}

function applySelectionMaterialSync(
  project: ProjectState,
  encodedIds: readonly string[],
  materialId: string
): MaterialSyncResult {
  const affectedBoxIds = new Set<string>();
  const affectedRemateIds = new Set<string>();
  const affectedRodapeIds = new Set<string>();

  let workspaceBoxes = project.workspaceBoxes;
  let remates = [...(project.remates ?? [])];
  let rodapes = [...(project.rodapes ?? [])];

  for (const encoded of encodedIds) {
    const decoded = decodeSelectionId(encoded);
    if (!decoded) continue;

    if (decoded.kind === "box") {
      const espessuraMm = getIndustrialMaterial(materialId).espessuraPadrao;
      workspaceBoxes = workspaceBoxes.map((box) =>
        box.id === decoded.id ? { ...box, material: materialId, espessura: espessuraMm } : box
      );
      affectedBoxIds.add(decoded.id);
      continue;
    }

    if (decoded.kind === "door") {
      const doorId = decoded.id;
      workspaceBoxes = workspaceBoxes.map((box) => {
        const doorsLayer = box.doorsLayer ?? [];
        if (!doorsLayer.some((door) => door.id === doorId)) return box;
        affectedBoxIds.add(box.id);
        return {
          ...box,
          doorsLayer: doorsLayer.map((door) =>
            door.id === doorId ? withDoorMaterial(door, materialId) : door
          ),
        };
      });
      continue;
    }

    if (decoded.kind === "drawer") {
      const drawerId = decoded.id;
      workspaceBoxes = workspaceBoxes.map((box) => {
        const drawersLayer = box.drawersLayer ?? [];
        if (!drawersLayer.some((drawer) => drawer.id === drawerId)) return box;
        affectedBoxIds.add(box.id);
        return {
          ...box,
          drawersLayer: drawersLayer.map((drawer) =>
            drawer.id === drawerId ? withDrawerMaterial(drawer, materialId) : drawer
          ),
        };
      });
      continue;
    }

    if (decoded.kind === "remate") {
      remates = remates.map((remate) =>
        remate.id === decoded.id ? { ...remate, materialPresetId: materialId } : remate
      );
      affectedRemateIds.add(decoded.id);
      const remate = remates.find((r) => r.id === decoded.id);
      if (remate?.parentBoxId) affectedBoxIds.add(remate.parentBoxId);
      continue;
    }

    if (decoded.kind === "rodape") {
      rodapes = rodapes.map((rodape) =>
        rodape.id === decoded.id ? { ...rodape, materialId } : rodape
      );
      affectedRodapeIds.add(decoded.id);
      const rodape = rodapes.find((r) => r.id === decoded.id);
      if (rodape?.parentBoxId) affectedBoxIds.add(rodape.parentBoxId);
    }
  }

  return {
    workspaceBoxes,
    remates,
    rodapes,
    affectedBoxIds: [...affectedBoxIds],
    affectedRemateIds: [...affectedRemateIds],
    affectedRodapeIds: [...affectedRodapeIds],
    invalidateGlobalCache: false,
  };
}

export function applyMaterialSync(
  project: ProjectState,
  target: MaterialSyncTarget
): MaterialSyncResult {
  switch (target.kind) {
    case "project": {
      if (!target.material) {
        return { ...emptyMaterialSyncResult(project), material: undefined, invalidateGlobalCache: true };
      }
      const tipo = target.material.tipo?.trim();
      const espFromIndustrial =
        tipo && tipo.length > 0
          ? getIndustrialMaterial(tipo).espessuraPadrao
          : target.material.espessura;
      const materialNext =
        tipo && tipo.length > 0
          ? { ...target.material, espessura: espFromIndustrial }
          : target.material;
      const materialId =
        target.materialId ??
        ("id" in target.material && target.material.id
          ? String(target.material.id)
          : tipo || project.materialId);
      return {
        ...emptyMaterialSyncResult(project),
        material: materialNext,
        materialId,
        affectedBoxIds: project.workspaceBoxes.map((box) => box.id),
        invalidateGlobalCache: true,
      };
    }

    case "box": {
      const espessuraMm = getIndustrialMaterial(target.materialId).espessuraPadrao;
      return {
        ...emptyMaterialSyncResult(project),
        workspaceBoxes: project.workspaceBoxes.map((box) => {
          if (box.id !== target.boxId) return box;
          let updated = { ...box, material: target.materialId, espessura: espessuraMm };
          if (isCaixaFornoBox(updated)) {
            updated = syncCaixaFornoOnDimensoesChange(updated);
          }
          return updated;
        }),
        affectedBoxIds: [target.boxId],
      };
    }

    case "door": {
      const box = project.workspaceBoxes.find((b) => b.id === target.boxId);
      if (!box) return emptyMaterialSyncResult(project);
      const doorsLayer = (box.doorsLayer ?? []).map((door) =>
        door.id === target.doorLayerId ? withDoorMaterial(door, target.materialId) : door
      );
      return {
        ...emptyMaterialSyncResult(project),
        workspaceBoxes: project.workspaceBoxes.map((b) =>
          b.id === target.boxId ? { ...b, doorsLayer } : b
        ),
        affectedBoxIds: [target.boxId],
      };
    }

    case "drawer": {
      const box = project.workspaceBoxes.find((b) => b.id === target.boxId);
      if (!box) return emptyMaterialSyncResult(project);
      const drawersLayer = (box.drawersLayer ?? []).map((drawer) =>
        drawer.id === target.drawerLayerId
          ? withDrawerMaterial(drawer, target.materialId)
          : drawer
      );
      return {
        ...emptyMaterialSyncResult(project),
        workspaceBoxes: project.workspaceBoxes.map((b) =>
          b.id === target.boxId ? { ...b, drawersLayer } : b
        ),
        affectedBoxIds: [target.boxId],
      };
    }

    case "doorLayerItem": {
      const box = project.workspaceBoxes.find((b) => b.id === target.boxId);
      if (!box) return emptyMaterialSyncResult(project);
      const doorsLayer = (box.doorsLayer ?? []).map((item) =>
        item.id === target.itemId ? withDoorMaterial(item, target.materialId) : item
      );
      return {
        ...emptyMaterialSyncResult(project),
        workspaceBoxes: project.workspaceBoxes.map((b) =>
          b.id === target.boxId ? { ...b, doorsLayer } : b
        ),
        affectedBoxIds: [target.boxId],
      };
    }

    case "drawerLayerItem": {
      const box = project.workspaceBoxes.find((b) => b.id === target.boxId);
      if (!box) return emptyMaterialSyncResult(project);
      const drawersLayer = (box.drawersLayer ?? []).map((item) =>
        item.id === target.itemId ? withDrawerMaterial(item, target.materialId) : item
      );
      return {
        ...emptyMaterialSyncResult(project),
        workspaceBoxes: project.workspaceBoxes.map((b) =>
          b.id === target.boxId ? { ...b, drawersLayer } : b
        ),
        affectedBoxIds: [target.boxId],
      };
    }

    case "remate": {
      const remates = (project.remates ?? []).map((remate) =>
        remate.id === target.remateId
          ? { ...remate, materialPresetId: target.materialId }
          : remate
      );
      const remate = remates.find((r) => r.id === target.remateId);
      return {
        ...emptyMaterialSyncResult(project),
        remates,
        affectedRemateIds: [target.remateId],
        affectedBoxIds: remate?.parentBoxId ? [remate.parentBoxId] : [],
      };
    }

    case "rodape": {
      const rodapes = (project.rodapes ?? []).map((rodape) =>
        rodape.id === target.rodapeId ? { ...rodape, materialId: target.materialId } : rodape
      );
      const rodape = rodapes.find((r) => r.id === target.rodapeId);
      return {
        ...emptyMaterialSyncResult(project),
        rodapes,
        affectedRodapeIds: [target.rodapeId],
        affectedBoxIds: rodape?.parentBoxId ? [rodape.parentBoxId] : [],
      };
    }

    case "selection":
      return applySelectionMaterialSync(project, target.encodedIds, target.materialId);
  }
}

export function materialSyncPatch(result: MaterialSyncResult): Partial<ProjectState> {
  const patch: Partial<ProjectState> = {
    workspaceBoxes: result.workspaceBoxes,
    remates: result.remates,
    rodapes: result.rodapes,
  };
  if (result.material !== undefined) patch.material = result.material;
  if (result.materialId !== undefined) patch.materialId = result.materialId;
  return patch;
}

export function invalidateMaterialCutlistCache(
  project: ProjectState,
  result: Pick<MaterialSyncResult, "affectedBoxIds" | "invalidateGlobalCache">
): void {
  if (result.invalidateGlobalCache) {
    clearAllCutlistCache();
    return;
  }
  clearCutlistCacheForProject(
    resolveProjectId(project),
    result.affectedBoxIds.length ? result.affectedBoxIds : undefined
  );
}

export function commitMaterialSync(
  prev: ProjectState,
  target: MaterialSyncTarget,
  withLoading = true
): { next: ProjectState; sync: MaterialSyncResult } {
  const sync = applyMaterialSync(prev, target);
  invalidateMaterialCutlistCache(prev, sync);
  const next = recomputeState(prev, materialSyncPatch(sync), withLoading);
  return { next, sync };
}

export function buildIndustrialCutlistAfterMaterialSync(
  project: ProjectState
): CutListItemComPreco[] {
  return buildCutlistItemsForIndustrialExport({
    rules: project.rules,
    materialId: project.materialId,
    projectName: project.tipoProjeto,
    boxes: project.boxes,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
  });
}

/** Propaga invalidação de cache e refresh do viewer após alterações de material já commitadas. */
export function propagateMaterialSyncEffects(
  project: ProjectState,
  sync: Pick<
    MaterialSyncResult,
    "affectedBoxIds" | "affectedRemateIds" | "affectedRodapeIds" | "invalidateGlobalCache"
  >
): void {
  invalidateMaterialCutlistCache(project, sync);
  refreshViewerAfterMaterialSync(sync);
}

export { refreshViewerAfterMaterialSync, syncDrawerFrontMaterialToViewer, syncDoorWoodGrainToViewer } from "../../industrial/viewerIntegration";
