import { useMemo } from "react";
import type { ProjectActions } from "../projectTypes";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";
import { LayoutEngine } from "../../3d/viewer-engine/layout/LayoutEngine";
import { detectKitchenLayout } from "../../core/autoRoomFill/layoutDetection";
import {
  EMPTY_ALLOW_UPPER,
  EMPTY_WALL_SELECTION,
} from "../../core/autoRoomFill/autoRoomFillTypes";

export type AutoRoomFillActions = Pick<
  ProjectActions,
  "runAutoRoomFill" | "runKitchenLayout30" | "setAutoFillWallSettings"
>;

function baseAutoFillState(prev: import("../projectTypes").ProjectState) {
  return {
    lastRunAt: prev.autoFill?.lastRunAt ?? "",
    summary: prev.autoFill?.summary ?? "",
    createdBoxIds: prev.autoFill?.createdBoxIds ?? [],
    createdRemateIds: prev.autoFill?.createdRemateIds ?? [],
    createdHematiIds: prev.autoFill?.createdHematiIds ?? [],
    createdRodapeIds: prev.autoFill?.createdRodapeIds ?? [],
    wallSummaries: prev.autoFill?.wallSummaries ?? [],
    specialsPlaced: prev.autoFill?.specialsPlaced ?? [],
    wallSelection: prev.autoFill?.wallSelection ?? EMPTY_WALL_SELECTION,
    allowUpperModules: prev.autoFill?.allowUpperModules ?? EMPTY_ALLOW_UPPER,
    layoutType: prev.autoFill?.layoutType,
    layoutTypeOverride: prev.autoFill?.layoutTypeOverride ?? "auto",
    layoutSummary: prev.autoFill?.layoutSummary,
    islandConfig: prev.autoFill?.islandConfig ?? null,
    wallAssignments: prev.autoFill?.wallAssignments,
    trimAppliedMm: prev.autoFill?.trimAppliedMm,
    detailedSummary: prev.autoFill?.detailedSummary,
  };
}

export function useAutoRoomFillActions(ctx: ProjectActionsExecutionContext): AutoRoomFillActions {
  const { updateProject } = ctx;

  return useMemo(
    () => ({
      setAutoFillWallSettings: (patch) => {
        updateProject(
          (prev) => {
            const detected =
              prev.room && patch.layoutTypeOverride === undefined
                ? detectKitchenLayout(prev.room)?.detectedType
                : prev.autoFill?.layoutType;

            return {
              ...prev,
              autoFill: {
                ...baseAutoFillState(prev),
                wallSelection: {
                  ...(prev.autoFill?.wallSelection ?? EMPTY_WALL_SELECTION),
                  ...(patch.wallSelection ?? {}),
                },
                allowUpperModules: {
                  ...(prev.autoFill?.allowUpperModules ?? EMPTY_ALLOW_UPPER),
                  ...(patch.allowUpperModules ?? {}),
                },
                layoutTypeOverride:
                  patch.layoutTypeOverride ??
                  prev.autoFill?.layoutTypeOverride ??
                  "auto",
                layoutType:
                  patch.layoutTypeOverride && patch.layoutTypeOverride !== "auto"
                    ? patch.layoutTypeOverride
                    : detected ?? prev.autoFill?.layoutType,
              },
            };
          },
          false
        );
      },

      runAutoRoomFill: () => {
        updateProject(
          (prev) => {
            if (!prev.room) return prev;
            const result = LayoutEngine.runProjectAutoRoomFill(prev);
            return result?.state ?? prev;
          },
          true
        );
      },

      runKitchenLayout30: () => {
        updateProject(
          (prev) => {
            if (!prev.room) return prev;
            const result = LayoutEngine.runProjectKitchenLayout(prev);
            return result?.state ?? prev;
          },
          true
        );
      },
    }),
    [updateProject]
  );
}
