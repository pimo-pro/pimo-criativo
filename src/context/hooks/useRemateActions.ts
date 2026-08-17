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
  resolveLRemateGroupCouplingLeadId,
  resolveLRemateTransformLeadId,
  snapLRemateGroupCorners,
} from "../../core/remate/remateLGeometry";
import { getRemateEnvelopeBoundsM } from "../../core/remate/rematePlacement";
import { createOppositeRematePiece, duplicateRematePiece } from "../../core/remate/remateCloneUtils";
import {
  invalidateMaterialCutlistCache,
  refreshViewerAfterMaterialSync,
} from "../../core/materials/materialSync";
import {
  applyTampoIndustrialDefaults,
  shouldApplyTampoRules,
  TAMPO_MATERIAL_ID,
  TAMPO_THICKNESS_MM,
  validateTampoIndustrial,
} from "../../core/remate/tampoCozinhaRules";
import {
  isTampoAngularConfig,
  TAMPO_ANGULAR_LAY_FLAT_X_RAD,
} from "../../core/remate/tampoAngle";

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
  const snapped = snapLRemateGroupCorners(ext, int, bounds);
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
            let materialPresetId =
              input.materialPresetId || box?.material || prev.materialId || prev.material.tipo;
            let material = getMaterialByIdOrLabel(materialPresetId);
            let thicknessMm =
              Number(material?.espessura ?? box?.espessura ?? prev.material.espessura) || 19;
            if (shouldApplyTampoRules({ productType: input.productType, materialPresetId })) {
              materialPresetId = TAMPO_MATERIAL_ID;
              material = getMaterialByIdOrLabel(materialPresetId);
              thicknessMm = Number(material?.espessura) || TAMPO_THICKNESS_MM;
            }
            const created = createRematePieces(
              { ...input, materialPresetId },
              {
                box,
                allBoxes: prev.workspaceBoxes,
                materialPresetId,
                thicknessMm,
                boxDimsM: box ? boxDimsFromWorkspace(box) : undefined,
              }
            );
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
            let materialPresetId = input.materialPresetId || prev.materialId || prev.material.tipo;
            let material = getMaterialByIdOrLabel(materialPresetId);
            let thicknessMm = Number(material?.espessura ?? prev.material.espessura) || 19;
            if (shouldApplyTampoRules({ productType: input.productType, materialPresetId })) {
              materialPresetId = TAMPO_MATERIAL_ID;
              material = getMaterialByIdOrLabel(materialPresetId);
              thicknessMm = Number(material?.espessura) || TAMPO_THICKNESS_MM;
            }
            const created = createRematePieces(
              { ...input, followBox: false, materialPresetId },
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

            const userEditedDimensions =
              patch.width != null || patch.height != null || patch.depth != null;

            let remates = (prev.remates ?? []).map((remate) => {
              if (remate.id !== transformTargetId) return remate;
              const { depth: _depthPatchIgnored, ...patchWithoutDepth } = normalizedPatch;
              void _depthPatchIgnored;
              let nextRemate = applyProductPatch(remate, patchWithoutDepth);
              if (userEditedDimensions) {
                nextRemate = { ...nextRemate, userDimensionsLocked: true };
              }

              if (
                shouldApplyTampoRules({
                  productType: nextRemate.productType ?? patch.productType,
                  materialPresetId: nextRemate.materialPresetId,
                })
              ) {
                const candidate = applyTampoIndustrialDefaults({
                  ...nextRemate,
                  width: patch.width ?? nextRemate.width,
                  height: patch.height ?? nextRemate.height,
                });
                const validation = validateTampoIndustrial({
                  widthMm: candidate.width,
                  heightMm: candidate.height,
                  materialPresetId: candidate.materialPresetId,
                });
                if (!validation.ok && (patch.width != null || patch.height != null)) {
                  // Dims inválidas: manter medidas anteriores, forçar regras TAMPO
                  nextRemate = applyTampoIndustrialDefaults({
                    ...remate,
                    productType: "TAMPO_COZINHA",
                    materialPresetId: TAMPO_MATERIAL_ID,
                  });
                  return nextRemate;
                }
                nextRemate = candidate;
              }

                const box = nextRemate.parentBoxId
                  ? prev.workspaceBoxes.find((b) => b.id === nextRemate.parentBoxId)
                  : null;
                const mat = getMaterialByIdOrLabel(nextRemate.materialPresetId);
                const thicknessMm =
                  Number(mat?.espessura ?? box?.espessura ?? prev.material.espessura) ||
                  (shouldApplyTampoRules({
                    productType: nextRemate.productType,
                    materialPresetId: nextRemate.materialPresetId,
                  })
                    ? TAMPO_THICKNESS_MM
                    : 19);
                const shouldRecalcDims =
                  patch.productOptions != null ||
                  patch.productType != null ||
                  patch.mountSlot != null;
                if (
                  shouldRecalcDims &&
                  !nextRemate.userDimensionsLocked &&
                  !shouldApplyTampoRules({
                    productType: nextRemate.productType,
                    materialPresetId: nextRemate.materialPresetId,
                  })
                ) {
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
                  shouldRecalcDims &&
                  !nextRemate.userDimensionsLocked &&
                  shouldApplyTampoRules({
                    productType: nextRemate.productType,
                    materialPresetId: nextRemate.materialPresetId,
                  })
                ) {
                  const dims = computeDimensionsForProduct({
                    box: box ?? null,
                    productType: "TAMPO_COZINHA",
                    mountSlot: nextRemate.mountSlot ?? "CIMA",
                    thicknessMm: TAMPO_THICKNESS_MM,
                    productOptions: nextRemate.productOptions,
                    partRole: nextRemate.partRole,
                    partIndex: nextRemate.partIndex,
                  });
                  nextRemate = applyTampoIndustrialDefaults({
                    ...nextRemate,
                    ...dims,
                  });
                } else if (
                  patch.width != null ||
                  patch.height != null ||
                  patch.materialPresetId != null
                ) {
                  nextRemate = { ...nextRemate, depth: thicknessMm };
                } else {
                  nextRemate = { ...nextRemate, depth: thicknessMm };
                }
                if (patch.followBox === true) {
                  nextRemate = { ...nextRemate, placementMode: "SNAPPED" };
                } else if (patch.followBox === false) {
                  nextRemate = { ...nextRemate, placementMode: "FREE" };
                }
                if (isTampoAngularConfig(nextRemate.angleConfig, nextRemate.height)) {
                  const rot = nextRemate.rotation;
                  const needsLayFlat =
                    !rot ||
                    (Math.abs(rot.xRad) < 1e-6 &&
                      Math.abs(rot.yRad) < 1e-6 &&
                      Math.abs(rot.zRad) < 1e-6);
                  nextRemate = {
                    ...nextRemate,
                    followBox: false,
                    parentBoxId: undefined,
                    placementMode: "FREE",
                    rotation: needsLayFlat
                      ? { xRad: TAMPO_ANGULAR_LAY_FLAT_X_RAD, yRad: 0, zRad: 0 }
                      : rot,
                  };
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

            let changelog = prev.changelog;
            const updated = remates.find((r) => r.id === transformTargetId);
            if (
              updated &&
              (patch.width != null || patch.height != null) &&
              shouldApplyTampoRules({
                productType: updated.productType,
                materialPresetId: updated.materialPresetId,
              })
            ) {
              const validation = validateTampoIndustrial({
                widthMm: patch.width ?? updated.width,
                heightMm: patch.height ?? updated.height,
                materialPresetId: updated.materialPresetId,
              });
              if (!validation.ok) {
                changelog = appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: validation.errors.join(" "),
                });
              }
            }

            const couplingLeadId = resolveLRemateGroupCouplingLeadId(
              transformTargetId,
              prev.remates ?? [],
              normalizedPatch
            );

            if (
              normalizedPatch.position != null ||
              normalizedPatch.rotation != null ||
              normalizedPatch.height != null ||
              normalizedPatch.width != null
            ) {
              remates = applyLRemateGroupCoupling(remates, couplingLeadId);
            }

            const next = applyResultados({
              ...prev,
              remates,
              changelog,
            });
            projectRef.current = next;
            if (patch.materialPresetId != null) {
              const remate = next.remates?.find((r) => r.id === remateId);
              refreshViewerAfterMaterialSync({
                affectedRemateIds: [remateId],
                affectedRodapeIds: [],
              });
              void remate;
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
