/**
 * Persistência de projeto: serialização, revive, leitura/escrita de projetos guardados.
 * Fonte única para autosave e lista de projetos (localStorage).
 */

import type { WorkspaceBox, CutListItemComPreco } from "../core/types";
import type { ProjectState, ProjectSnapshot, RoomSnapshot } from "./projectTypes";
import { defaultState } from "./projectState";
import { getMaterialByIdOrLabel } from "../core/materials/service";
import { createEmptyProjectMeasurements } from "../3d/viewer-engine/measurement/internalRulerTypes";
import { normalizeProjectRoom } from "../3d/viewer-engine/room/RoomEngine";
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import { projectRoomToRoomSnapshot } from "../3d/viewer-engine/room/roomUnitConversion";
import { normalizeOrlaPresets } from "../core/orla/orlaPresets";
import { normalizeDrawerPresets } from "../core/drawers/drawerPresets";
import { normalizeObservacoesList } from "../core/observacoes/ObservacoesService";
import {
  normalizeRematesFromPersistence,
  upgradeRematesAfterLoad,
} from "../core/remate/rematePieceMigration";
import { stabilizeRemateForPersistence } from "../core/remate/remateTransformStability";
import { upgradeRodapesAfterLoad } from "../core/rodape/rodapePieceMigration";
import { stabilizeRodapeForPersistence } from "../core/rodape/rodapeTransformStability";
import type { ProjectHemati } from "../core/hemati/hematiTypes";
import type { ProjectRodape } from "../core/rodape/rodapeTypes";
import {
  EMPTY_ALLOW_UPPER,
  EMPTY_WALL_SELECTION,
  type ProjectAutoFillState,
} from "../core/autoRoomFill/autoRoomFillTypes";
import { normalizeIndustrialDocumentOverrides } from "../core/industrial/onlineAnalysis/industrialDocumentOverridesTypes";
import { normalizeIndustrialDocumentHistory } from "../core/industrial/onlineAnalysis/industrialDocumentHistoryTypes";
import { normalizeFinanceiroOverrides } from "../core/financeiro/financeiroUnificadoTypes";
import { normalizeFinanceiroAdminSettings } from "../core/financeiro/financeiroAdminRules";

export const PROJECTS_STORAGE_KEY = "pimo_saved_projects";
export const MANUAL_BACKUPS_STORAGE_KEY = "pimo_manual_backups";

export type ManualBackupEntry = {
  id: string;
  name: string;
  savedAt: string;
  snapshot: ProjectSnapshot;
};

export type StoredProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: ProjectSnapshot | unknown;
};

export function normalizeExtractedParts(
  byBox: unknown
): Record<string, Record<string, CutListItemComPreco[]>> {
  if (!byBox || typeof byBox !== "object") return {};
  const result: Record<string, Record<string, CutListItemComPreco[]>> = {};
  for (const [boxId, byModel] of Object.entries(byBox as Record<string, unknown>)) {
    if (byModel && typeof byModel === "object") {
      result[boxId] = byModel as Record<string, CutListItemComPreco[]>;
    }
  }
  return result;
}

export function serializeState(state: ProjectState): unknown {
  const stabilized: ProjectState = {
    ...state,
    remates: (state.remates ?? []).map(stabilizeRemateForPersistence),
    rodapes: (state.rodapes ?? []).map(stabilizeRodapeForPersistence),
  };
  return JSON.parse(
    JSON.stringify(stabilized, (_key, value) => {
      if (value instanceof Date) {
        return { __date: value.toISOString() };
      }
      return value;
    })
  );
}

export function serializeStateForAutosave(state: ProjectState): unknown {
  const { lastAutosaveTime: _lastAutosaveTime, ...rest } = state;
  return serializeState(rest as ProjectState);
}

export type ReviveStateOptions = {
  /** Importação de ficheiro: não aplicar upgradeRematesAfterLoad / upgradeRodapesAfterLoad. */
  skipLoadUpgrades?: boolean;
};

export function reviveState(snapshot: unknown, options?: ReviveStateOptions): ProjectState | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const restored = JSON.parse(
    JSON.stringify(snapshot),
    (_key, value: unknown) => {
      if (
        value &&
        typeof value === "object" &&
        "__date" in value &&
        typeof (value as { __date?: unknown }).__date === "string"
      ) {
        return new Date((value as { __date: string }).__date);
      }
      return value;
    }
  ) as ProjectState;

  const extractedPartsByBoxId = normalizeExtractedParts(restored.extractedPartsByBoxId);

  const modelPositionsByBoxId: ProjectState["modelPositionsByBoxId"] =
    restored.modelPositionsByBoxId && typeof restored.modelPositionsByBoxId === "object"
      ? { ...(restored.modelPositionsByBoxId as ProjectState["modelPositionsByBoxId"]) }
      : {};

  for (const [boxId, inner] of Object.entries(modelPositionsByBoxId)) {
    if (inner && typeof inner === "object") {
      modelPositionsByBoxId[boxId] = { ...inner };
    }
  }

  const workspaceBoxesRaw = restored.workspaceBoxes ?? [];
  const workspaceBoxes = Array.isArray(workspaceBoxesRaw)
    ? (() => {
        const seenIds = new Set<string>();
        return workspaceBoxesRaw
          .map((box: WorkspaceBox & { modelId?: string | null }) => {
            const models =
              box.models ?? (box.modelId != null ? [{ id: `${box.id}-model-1`, modelId: box.modelId }] : []);
            const { modelId: _modelId, ...rest } = box;
            const next: WorkspaceBox = { ...rest, models, locked: rest.locked === true };
            if (next.costaAtiva === undefined) next.costaAtiva = true;
            if (next.noBackPanel === undefined) next.noBackPanel = next.costaAtiva === false;
            if (next.profundidadeExterna === undefined) {
              next.profundidadeExterna = next.dimensoes?.profundidade ?? 0;
            }
            next.remateIds = Array.isArray(next.remateIds) ? next.remateIds.filter(Boolean) : [];
            return next;
          })
          .filter((box: { id?: string }) => {
            if (!box?.id || typeof box.id !== "string") return false;
            if (seenIds.has(box.id)) return false;
            seenIds.add(box.id);
            return true;
          });
      })()
    : defaultState.workspaceBoxes;

  const materialId =
    restored.materialId !== undefined && restored.materialId !== null
      ? restored.materialId
      : (restored.material?.tipo
          ? getMaterialByIdOrLabel(restored.material.tipo)?.id ?? ""
          : "");

  const remates = Array.isArray(restored.remates)
    ? options?.skipLoadUpgrades
      ? normalizeRematesFromPersistence(restored.remates)
      : upgradeRematesAfterLoad(
          normalizeRematesFromPersistence(restored.remates),
          workspaceBoxes
        )
    : [];

  return {
    ...defaultState,
    ...restored,
    viewerSettings: {
      ...defaultState.viewerSettings,
      ...(restored.viewerSettings ?? {}),
      ultraPerformanceModeOptions: {
        ...defaultState.viewerSettings.ultraPerformanceModeOptions,
        ...(restored.viewerSettings?.ultraPerformanceModeOptions ?? {}),
      },
    },
    workspaceBoxes,
    selectedWorkspaceBoxId: workspaceBoxes.length ? (restored.selectedWorkspaceBoxId ?? workspaceBoxes[0].id) : "",
    selectedCaixaId: workspaceBoxes.length ? (restored.selectedCaixaId ?? workspaceBoxes[0].id) : "",
    selectedBoxId: workspaceBoxes.length ? (restored.selectedBoxId ?? "") : "",
    material: { ...defaultState.material, ...restored.material },
    materialId,
    dimensoes: { ...defaultState.dimensoes, ...restored.dimensoes },
    extractedPartsByBoxId,
    modelPositionsByBoxId,
    selectedModelInstanceId: restored.selectedModelInstanceId ?? null,
    measurements: {
      ...createEmptyProjectMeasurements(),
      ...(restored.measurements && typeof restored.measurements === "object" ? restored.measurements : {}),
      internal: Array.isArray(restored.measurements?.internal)
        ? restored.measurements.internal.filter(
            (e): e is import("./projectTypes").InternalMeasurementEntry =>
              e != null &&
              typeof e === "object" &&
              typeof (e as { id?: unknown }).id === "string" &&
              typeof (e as { boxId?: unknown }).boxId === "string"
          )
        : [],
      anchors: Array.isArray(restored.measurements?.anchors)
        ? restored.measurements.anchors.filter(
            (e): e is import("../core/viewer/measurementAnchors").MeasurementAnchorEntry =>
              e != null &&
              typeof e === "object" &&
              typeof (e as { id?: unknown }).id === "string" &&
              typeof (e as { position?: unknown }).position === "object"
          )
        : [],
      unified: Array.isArray(restored.measurements?.unified)
        ? restored.measurements.unified.filter(
            (e): e is import("./projectTypes").UnifiedMeasurement =>
              e != null &&
              typeof e === "object" &&
              typeof (e as { id?: unknown }).id === "string" &&
              typeof (e as { a?: unknown }).a === "object" &&
              typeof (e as { b?: unknown }).b === "object" &&
              typeof (e as { valueMm?: unknown }).valueMm === "number"
          )
        : [],
    },
    objectGroups:
      restored.objectGroups && typeof restored.objectGroups === "object"
        ? { ...(restored.objectGroups as ProjectState["objectGroups"]) }
        : defaultState.objectGroups,
    room:
      restored.room && typeof restored.room === "object"
        ? normalizeProjectRoom(restored.room as import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomConfig)
        : null,
    orlaPresets: normalizeOrlaPresets(restored.orlaPresets),
    drawerPresets: normalizeDrawerPresets(restored.drawerPresets),
    orlaPieces:
      restored.orlaPieces && typeof restored.orlaPieces === "object"
        ? { ...(restored.orlaPieces as ProjectState["orlaPieces"]) }
        : defaultState.orlaPieces,
    pieceObservacoes:
      restored.pieceObservacoes && typeof restored.pieceObservacoes === "object"
        ? Object.fromEntries(
            Object.entries(restored.pieceObservacoes as Record<string, unknown>).map(([k, v]) => [
              k,
              normalizeObservacoesList(v),
            ])
          )
        : defaultState.pieceObservacoes,
    industrialPieceEdits:
      restored.industrialPieceEdits && typeof restored.industrialPieceEdits === "object"
        ? { ...(restored.industrialPieceEdits as ProjectState["industrialPieceEdits"]) }
        : defaultState.industrialPieceEdits,
    industrialOperacoes:
      restored.industrialOperacoes && typeof restored.industrialOperacoes === "object"
        ? { ...(restored.industrialOperacoes as ProjectState["industrialOperacoes"]) }
        : defaultState.industrialOperacoes,
    industrialDocumentOverrides: normalizeIndustrialDocumentOverrides(
      restored.industrialDocumentOverrides
    ),
    financeiroOverrides: normalizeFinanceiroOverrides(restored.financeiroOverrides),
    financeiroAdminSettings: normalizeFinanceiroAdminSettings(
      restored.financeiroAdminSettings ?? defaultState.financeiroAdminSettings
    ),
    industrialDocumentHistory: normalizeIndustrialDocumentHistory(
      restored.industrialDocumentHistory
    ),
    orlaJuntoPairs: Array.isArray(restored.orlaJuntoPairs)
      ? restored.orlaJuntoPairs
      : defaultState.orlaJuntoPairs,
    ferragemOrla:
      restored.ferragemOrla && typeof restored.ferragemOrla === "object"
        ? {
            linhas: Array.isArray(restored.ferragemOrla.linhas) ? restored.ferragemOrla.linhas : [],
            metrosTotal: Number(restored.ferragemOrla.metrosTotal) || 0,
            custoTotal: Number(restored.ferragemOrla.custoTotal) || 0,
            porBox:
              restored.ferragemOrla.porBox && typeof restored.ferragemOrla.porBox === "object"
                ? restored.ferragemOrla.porBox
                : {},
          }
        : defaultState.ferragemOrla,
    remates,
    hematis: Array.isArray(restored.hematis)
      ? restored.hematis.filter(
          (h): h is ProjectHemati =>
            h != null &&
            typeof h === "object" &&
            typeof (h as ProjectHemati).id === "string" &&
            typeof (h as ProjectHemati).parentBoxId === "string"
        ).map((h) => ({ ...h, visible: h.visible !== false, placementFree: h.placementFree ?? false }))
      : [],
    rodapes: Array.isArray(restored.rodapes)
      ? (() => {
          const filtered = restored.rodapes.filter(
            (r): r is ProjectRodape =>
              r != null &&
              typeof r === "object" &&
              typeof (r as ProjectRodape).id === "string" &&
              typeof (r as ProjectRodape).parentBoxId === "string"
          ).map((r) => ({ ...r, visible: r.visible !== false, placementFree: r.placementFree ?? false }));
          return options?.skipLoadUpgrades
            ? filtered
            : upgradeRodapesAfterLoad(filtered, workspaceBoxes);
        })()
      : [],
    autoFill:
      restored.autoFill && typeof restored.autoFill === "object"
        ? ((): ProjectAutoFillState => {
            const raw = restored.autoFill as Partial<ProjectAutoFillState>;
            return {
              lastRunAt: String(raw.lastRunAt ?? ""),
              summary: String(raw.summary ?? ""),
              detailedSummary:
                typeof raw.detailedSummary === "string" ? raw.detailedSummary : undefined,
              wallSelection: { ...EMPTY_WALL_SELECTION, ...(raw.wallSelection ?? {}) },
              allowUpperModules: { ...EMPTY_ALLOW_UPPER, ...(raw.allowUpperModules ?? {}) },
              createdBoxIds: Array.isArray(raw.createdBoxIds) ? raw.createdBoxIds : [],
              createdRemateIds: Array.isArray(raw.createdRemateIds) ? raw.createdRemateIds : [],
              createdHematiIds: Array.isArray(raw.createdHematiIds) ? raw.createdHematiIds : [],
              createdRodapeIds: Array.isArray(raw.createdRodapeIds) ? raw.createdRodapeIds : [],
              wallSummaries: Array.isArray(raw.wallSummaries) ? raw.wallSummaries : [],
              specialsPlaced: Array.isArray(raw.specialsPlaced) ? raw.specialsPlaced : [],
              trimAppliedMm:
                typeof raw.trimAppliedMm === "number" ? raw.trimAppliedMm : undefined,
              layoutType:
                raw.layoutType === "I" ||
                raw.layoutType === "L" ||
                raw.layoutType === "U" ||
                raw.layoutType === "island"
                  ? raw.layoutType
                  : undefined,
              layoutTypeOverride:
                raw.layoutTypeOverride === "auto" ||
                raw.layoutTypeOverride === "I" ||
                raw.layoutTypeOverride === "L" ||
                raw.layoutTypeOverride === "U" ||
                raw.layoutTypeOverride === "island"
                  ? raw.layoutTypeOverride
                  : "auto",
              layoutSummary:
                typeof raw.layoutSummary === "string" ? raw.layoutSummary : undefined,
              islandConfig:
                raw.islandConfig && typeof raw.islandConfig === "object"
                  ? raw.islandConfig
                  : null,
              wallAssignments: Array.isArray(raw.wallAssignments) ? raw.wallAssignments : [],
            };
          })()
        : null,
    lastAutosaveTime:
      typeof restored.lastAutosaveTime === "string" ? restored.lastAutosaveTime : null,
  };
}

export function captureRoomSnapshot(projectRoom?: ProjectRoomConfig | null): RoomSnapshot | null {
  if (!projectRoom) return null;
  const normalized = normalizeProjectRoom(projectRoom);
  if (!normalized) return null;
  return projectRoomToRoomSnapshot(normalized, {
    selectedWallId: null,
    mainWallIndex: 0,
  });
}

export function readStoredProjects(): StoredProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredProject[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredProjects(items: StoredProject[]): void {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
