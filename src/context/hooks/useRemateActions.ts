import { useMemo } from "react";
import type { ProjectActions } from "../projectTypes";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";
import { applyResultados, appendChangelog } from "../projectState";
import { createRematePieces, refreshRemateMountSnap } from "../../core/remate/rematePieceFactory";
import { createRematesForBox } from "../../core/remate/remateFactory";
import { getMaterialByIdOrLabel } from "../../core/materials/service";
import type { CreateRematePieceInput, RemateMountSlot, RematePiece } from "../../core/remate/rematePieceTypes";
import { resolveMountSlot } from "../../core/remate/remateMountFrame";
import { applyProductPatch, computeDimensionsForProduct, inferProductTypeFromLegacy, normalizeProductOptions } from "../../core/remate/remateProductRules";
import {
  applyLRemateGroupCoupling,
  isLRematePiece,
  normalizeLRemateTransformPatch,
  resolveLRemateTransformLeadId,
  snapLRemateGroupCorners,
} from "../../core/remate/remateLGeometry";
import { getRemateEnvelopeBoundsM } from "../../core/remate/rematePlacement";
import { createOppositeRematePiece, duplicateRematePiece } from "../../core/remate/remateCloneUtils";
import {
  invalidateMaterialCutlistCache,
  refreshViewerAfterMaterialSync,
} from "../../core/materials/materialSync";

export type RemateActions = Pick<
  ProjectActions,
  | "createRematePiece"
  | "createStandaloneRematePiece"
  | "createBoxRemate"
  | "updateRemate"
  | "removeRemate"
  | "selectRematePiece"
  | "resnapRemateToFace"
  | "resetRemateSnap"
  | "duplicateRemate"
  | "createOppositeRemate"
>;

function boxDimsFromWorkspace(box: import("../../core/types").WorkspaceBox) {
  return {
    widthM: Math.max(0.001, (box.dimensoes?.largura ?? 600) / 1000),
    heightM: Math.max(0.001, (box.dimensoes?.altura ?? 720) / 1000),
    depthM: Math.max(0.001, (box.dimensoes?.profundidade ?? 600) / 1000),
  };
}

function refreshLRemateGroupSnap(
  remates: RematePiece[],
  groupId: string,
  box: import("../../core/types").WorkspaceBox,
  boxDimsM: ReturnType<typeof boxDimsFromWorkspace>
): RematePiece[] {
  const group = remates.filter((r) => r.parentGroupId === groupId && isLRematePiece(r));
  const ext = group.find((r) => r.partIndex === 1);
  const int = group.find((r) => r.partIndex === 2);
  if (!ext || !int) return remates;
  const bounds = getRemateEnvelopeBoundsM(boxDimsM.widthM, boxDimsM.heightM, boxDimsM.depthM, box);
  const snapped = snapLRemateGroupCorners(ext, int, bounds, {
    boxLarguraMm: box.dimensoes?.largura ?? 600,
    boxAlturaMm: box.dimensoes?.altura ?? 720,
    thicknessMm: Number(box.espessura) || 19,
  });
  return remates.map((r) => {
    if (r.id === snapped.ext.id) return snapped.ext;
    if (r.id === snapped.int.id) return snapped.int;
    return r;
  });
}

export function useRemateActions(ctx: ProjectActionsExecutionContext): RemateActions {
  const { updateProject, projectRef } = ctx;

  return useMemo(
    () => ({
      createRematePiece: (input) => {
        updateProject(
          (prev) => {
            const box = input.parentBoxId
              ? prev.workspaceBoxes.find((b) => b.id === input.parentBoxId)
              : null;
            const materialPresetId =
              input.materialPresetId || box?.material || prev.materialId || prev.material.tipo;
            const material = getMaterialByIdOrLabel(materialPresetId);
            const thicknessMm =
              Number(material?.espessura ?? box?.espessura ?? prev.material.espessura) || 19;
            const created = createRematePieces(input, {
              box,
              allBoxes: prev.workspaceBoxes,
              materialPresetId,
              thicknessMm,
              boxDimsM: box ? boxDimsFromWorkspace(box) : undefined,
            });
            return applyResultados({
              ...prev,
              remates: [...(prev.remates ?? []), ...created],
              selectedWorkspaceBoxId: input.parentBoxId ?? prev.selectedWorkspaceBoxId,
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: `Remate criado: ${created.map((r) => r.name).join(", ")}`,
              }),
            });
          },
          true
        );
      },

      createStandaloneRematePiece: (input: CreateRematePieceInput) => {
        updateProject(
          (prev) => {
            const materialPresetId = prev.materialId || prev.material.tipo;
            const material = getMaterialByIdOrLabel(materialPresetId);
            const thicknessMm = Number(material?.espessura ?? prev.material.espessura) || 19;
            const created = createRematePieces(
              { ...input, followBox: false },
              {
                allBoxes: prev.workspaceBoxes,
                materialPresetId,
                thicknessMm,
              }
            );
            return applyResultados({
              ...prev,
              remates: [...(prev.remates ?? []), ...created],
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: `Remate standalone: ${created.map((r) => r.name).join(", ")}`,
              }),
            });
          },
          true
        );
      },

      createBoxRemate: (input) => {
        updateProject(
          (prev) => {
            const targetBoxId = input.parentBoxId ?? prev.selectedWorkspaceBoxId;
            const box = prev.workspaceBoxes.find((b) => b.id === targetBoxId);
            if (!box) return prev;
            const materialId = input.materialId || box.material || prev.materialId || prev.material.tipo;
            const material = getMaterialByIdOrLabel(materialId);
            const thicknessMm = Number(material?.espessura ?? box.espessura ?? prev.material.espessura) || 19;
            const existingCount = (prev.remates ?? []).filter((r) => r.parentBoxId === box.id).length;
            const created = createRematesForBox({
              box,
              input,
              materialId,
              thicknessMm,
              existingCount,
            });
            return applyResultados({
              ...prev,
              remates: [...(prev.remates ?? []), ...created],
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: `Remate criado: ${created.map((r) => r.name).join(", ")}`,
              }),
            });
          },
          true
        );
      },

      updateRemate: (remateId, patch) => {
        updateProject(
          (prev) => {
            if (patch.materialPresetId != null) {
              invalidateMaterialCutlistCache(prev, {
                affectedBoxIds: (() => {
                  const remate = prev.remates?.find((r) => r.id === remateId);
                  return remate?.parentBoxId ? [remate.parentBoxId] : [];
                })(),
                invalidateGlobalCache: false,
              });
            }
            const transformTargetId = resolveLRemateTransformLeadId(
              remateId,
              prev.remates ?? [],
              patch
            );
            const source = prev.remates?.find((r) => r.id === transformTargetId);
            const normalizedPatch = source
              ? normalizeLRemateTransformPatch(source, patch)
              : patch;

            let remates = (prev.remates ?? []).map((remate) => {
              if (remate.id !== transformTargetId) return remate;
              const { depth: _depthPatchIgnored, ...patchWithoutDepth } = normalizedPatch;
              void _depthPatchIgnored;
              let nextRemate = applyProductPatch(remate, patchWithoutDepth);
                const box = nextRemate.parentBoxId
                  ? prev.workspaceBoxes.find((b) => b.id === nextRemate.parentBoxId)
                  : null;
                const mat = getMaterialByIdOrLabel(nextRemate.materialPresetId);
                const thicknessMm =
                  Number(mat?.espessura ?? box?.espessura ?? prev.material.espessura) || 19;
                const shouldRecalcDims =
                  patch.productOptions != null ||
                  patch.productType != null ||
                  patch.mountSlot != null;
                if (shouldRecalcDims) {
                  const productType = nextRemate.productType ?? inferProductTypeFromLegacy(nextRemate);
                  const opts = normalizeProductOptions(productType, nextRemate.productOptions);
                  const dims = computeDimensionsForProduct({
                    box: box ?? null,
                    productType,
                    mountSlot: nextRemate.mountSlot ?? "FRENTE",
                    thicknessMm,
                    productOptions: opts,
                    partRole: nextRemate.partRole,
                    partIndex: nextRemate.partIndex,
                  });
                  nextRemate = { ...nextRemate, ...dims, depth: thicknessMm };
                } else if (
                  patch.width != null ||
                  patch.height != null ||
                  patch.materialPresetId != null
                ) {
                  nextRemate = { ...nextRemate, depth: thicknessMm };
                } else {
                  nextRemate = { ...nextRemate, depth: thicknessMm };
                }
                if (patch.placementMode === "FREE" || patch.placementMode === "SNAPPED") {
                  nextRemate = { ...nextRemate, placementMode: patch.placementMode };
                }
                if (patch.followBox === true) {
                  nextRemate = { ...nextRemate, placementMode: "SNAPPED" };
                } else if (patch.followBox === false) {
                  nextRemate = { ...nextRemate, placementMode: "FREE" };
                }
                const shouldResnap =
                  nextRemate.followBox &&
                  nextRemate.placementMode !== "FREE" &&
                  (patch.tipo != null ||
                    patch.mountSlot != null ||
                    patch.productType != null ||
                    patch.productOptions != null ||
                    patch.followBox === true);
                if (shouldResnap && nextRemate.parentBoxId) {
                  const parentBox = prev.workspaceBoxes.find((b) => b.id === nextRemate.parentBoxId);
                  if (parentBox) {
                    nextRemate = refreshRemateMountSnap(nextRemate, parentBox, boxDimsFromWorkspace(parentBox));
                  }
                }
                return nextRemate;
              });

            if (
              normalizedPatch.position != null ||
              normalizedPatch.rotation != null ||
              normalizedPatch.height != null ||
              normalizedPatch.width != null
            ) {
              remates = applyLRemateGroupCoupling(remates, transformTargetId);
            }

            if (patch.materialPresetId != null) {
              const materialTarget = remates.find((r) => r.id === remateId);
              if (
                materialTarget &&
                isLRematePiece(materialTarget) &&
                materialTarget.parentGroupId
              ) {
                const mat = getMaterialByIdOrLabel(patch.materialPresetId);
                const thicknessMm =
                  Number(mat?.espessura ?? prev.material.espessura) || 19;
                const groupId = materialTarget.parentGroupId;
                remates = remates.map((r) =>
                  r.parentGroupId === groupId && isLRematePiece(r)
                    ? { ...r, materialPresetId: patch.materialPresetId!, depth: thicknessMm }
                    : r
                );
              }
            }

            const next = applyResultados({
              ...prev,
              remates,
            });
            projectRef.current = next;
            if (patch.materialPresetId != null) {
              const materialTarget = next.remates?.find((r) => r.id === remateId);
              const affectedRemateIds =
                materialTarget &&
                isLRematePiece(materialTarget) &&
                materialTarget.parentGroupId
                  ? (next.remates ?? [])
                      .filter(
                        (r) =>
                          r.parentGroupId === materialTarget.parentGroupId && isLRematePiece(r)
                      )
                      .map((r) => r.id)
                  : [remateId];
              refreshViewerAfterMaterialSync({
                affectedRemateIds,
                affectedRodapeIds: [],
              });
            }
            return next;
          },
          true
        );
      },

      resnapRemateToFace: (remateId) => {
        updateProject(
          (prev) => {
            const remate = prev.remates?.find((r) => r.id === remateId);
            if (!remate?.parentBoxId) return prev;
            const box = prev.workspaceBoxes.find((b) => b.id === remate.parentBoxId);
            if (!box) return prev;
            const groupId = remate.parentGroupId;
            const dimsM = boxDimsFromWorkspace(box);
            if (groupId && isLRematePiece(remate)) {
              return applyResultados({
                ...prev,
                remates: refreshLRemateGroupSnap(prev.remates ?? [], groupId, box, dimsM),
              });
            }
            const idsToSnap = groupId
              ? (prev.remates ?? []).filter((r) => r.parentGroupId === groupId).map((r) => r.id)
              : [remateId];
            return applyResultados({
              ...prev,
              remates: (prev.remates ?? []).map((r) => {
                if (!idsToSnap.includes(r.id)) return r;
                return refreshRemateMountSnap(r, box, dimsM);
              }),
            });
          },
          true
        );
      },

      resetRemateSnap: (remateId, slot: RemateMountSlot) => {
        updateProject(
          (prev) => {
            const source = prev.remates?.find((r) => r.id === remateId);
            if (!source?.parentBoxId) return prev;
            const box = prev.workspaceBoxes.find((b) => b.id === source.parentBoxId);
            if (!box) return prev;
            const parentBoxId = source.parentBoxId;
            const dimsM = boxDimsFromWorkspace(box);
            return applyResultados({
              ...prev,
              remates: (prev.remates ?? []).map((r) => {
                if (r.parentBoxId !== parentBoxId) return r;
                if (resolveMountSlot(r) !== slot) return r;
                return refreshRemateMountSnap(r, box, dimsM);
              }),
            });
          },
          true
        );
      },

      removeRemate: (remateId) => {
        updateProject(
          (prev) => {
            const removed = prev.remates?.find((remate) => remate.id === remateId);
            const groupId = removed?.parentGroupId;
            return applyResultados({
              ...prev,
              remates: (prev.remates ?? []).filter(
                (remate) =>
                  remate.id !== remateId && (groupId ? remate.parentGroupId !== groupId : true)
              ),
              changelog: removed
                ? appendChangelog(prev.changelog, {
                    timestamp: new Date(),
                    type: "box",
                    message: `Remate removido: ${removed.name}`,
                  })
                : prev.changelog,
            });
          },
          true
        );
      },

      selectRematePiece: () => {
        // Seleção UI via viewer; noop no estado persistido.
      },

      duplicateRemate: (remateId) => {
        let newId: string | null = null;
        updateProject(
          (prev) => {
            const source = prev.remates?.find((r) => r.id === remateId);
            if (!source) return prev;
            const copy = duplicateRematePiece(source);
            newId = copy.id;
            return applyResultados({
              ...prev,
              remates: [...(prev.remates ?? []), copy],
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: `Remate duplicado: ${copy.name}`,
              }),
            });
          },
          true
        );
        return newId;
      },

      createOppositeRemate: (remateId) => {
        let newId: string | null = null;
        updateProject(
          (prev) => {
            const source = prev.remates?.find((r) => r.id === remateId);
            if (!source) return prev;
            let opposite = createOppositeRematePiece(source);
            if (!opposite) return prev;

            if (opposite.followBox && opposite.placementMode !== "FREE" && opposite.parentBoxId) {
              const box = prev.workspaceBoxes.find((b) => b.id === opposite!.parentBoxId);
              if (box) {
                opposite = refreshRemateMountSnap(opposite, box, boxDimsFromWorkspace(box));
              }
            }

            newId = opposite.id;
            return applyResultados({
              ...prev,
              remates: [...(prev.remates ?? []), opposite],
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: `Remate oposto: ${opposite.name}`,
              }),
            });
          },
          true
        );
        return newId;
      },
    }),
    [updateProject]
  );
}
