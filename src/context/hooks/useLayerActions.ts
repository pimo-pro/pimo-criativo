import { useMemo } from "react";
import type { ProjectActions } from "../projectTypes";
import { appendChangelog, buildBoxesFromWorkspace, buildDesignState, getSelectedWorkspaceBox } from "../projectState";
import { ensureBoxPanelIds, panelIdOptionsFromBox } from "../../core/box/panelIds";
import { getSelectedOrFirstWorkspaceBox } from "../projectHelpers";
import { regenerateLayersForBox, createManualDoor, createManualDrawer } from "../../services/boxLayersService";
import { canBoxHaveDrawers } from "../../core/drawers";
import {
  resolveDrawerVerticalPosition,
  getDrawerUsableInternalHeightMm,
  DRAWER_VERTICAL_GAP_MM,
} from "../../core/drawers/drawerVerticalPosition";
import {
  mergeDoorDimensionUpdate,
  resolveDoorOpeningHeightMm,
} from "../../core/doors/doorLayerGeometry";
import { validateBoxDrawerConfiguration } from "../../core/drawers/drawerUiValidation";
import { getSettings } from "../../core/settings/settingsService";
import { devLogger } from "../../utils/devLogger";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";
import { commitMaterialSync, refreshViewerAfterMaterialSync, syncDrawerFrontMaterialToViewer, syncDoorWoodGrainToViewer } from "../../core/materials/materialSync";

export type LayerActions = Pick<
  ProjectActions,
  | "setPrateleiras"
  | "setGavetas"
  | "setDrawerHeightMode"
  | "setPortaTipo"
  | "setDoorMaterial"
  | "setDoorAllowPieceRotation"
  | "setDoorLockWoodGrain"
  | "setDrawerMaterial"
  | "setDrawerAllowPieceRotation"
  | "setDrawerLockWoodGrain"
  | "addDoorLayerItem"
  | "addDrawerLayerItem"
  | "removeDoorLayerItem"
  | "removeDrawerLayerItem"
  | "updateDoorLayerItem"
  | "updateDrawerLayerItem"
  | "setDoorLayerItemOpen"
  | "setDrawerLayerItemOpen"
  | "setDoorLayerItemMaterial"
  | "setDrawerLayerItemMaterial"
  | "setDoorLayerItemDirection"
  | "regenerateBoxLayersForSelectedBox"
>;

export function useLayerActions(ctx: ProjectActionsExecutionContext): LayerActions {
  const { updateProject, recomputeState } = ctx;

  return useMemo(
    () => ({
      setPrateleiras: (quantidade) => {
        const valor = Math.max(0, Math.floor(quantidade));
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === prev.selectedWorkspaceBoxId
                ? {
                    ...box,
                    prateleiras: valor,
                    gavetas: valor > 0 ? 0 : box.gavetas,
                    drawersLayer: valor > 0 ? [] : box.drawersLayer,
                    panelIds: ensureBoxPanelIds(box.panelIds, panelIdOptionsFromBox(box, {
                      prateleiras: valor,
                      gavetas: valor > 0 ? 0 : box.gavetas,
                    })),
                  }
                : box
            );
            return recomputeState(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: `Prateleiras ajustadas para ${valor}`,
                }),
              },
              true
            );
          },
          true
        );
      },
      setGavetas: (quantidade) => {
        const valor = Math.max(0, Math.floor(quantidade));
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== prev.selectedWorkspaceBoxId) return box;

              if (valor > 0) {
                const check = canBoxHaveDrawers(
                  box.dimensoes.largura,
                  box.dimensoes.altura,
                  box.dimensoes.profundidade,
                  valor
                );
                if (!check.valid) {
                  return {
                    ...box,
                    drawerConfigError: check.reason ?? "Não é possível adicionar gavetas neste módulo.",
                    drawerConfigWarnings: [],
                  };
                }
              }

              const updatedBox = {
                ...box,
                gavetas: valor,
                portaTipo: valor > 0 ? ("sem_porta" as const) : box.portaTipo,
                prateleiras: valor > 0 ? 0 : box.prateleiras,
                doorsLayer: valor > 0 ? box.doorsLayer : [],
                drawerConfigError: undefined,
                panelIds: ensureBoxPanelIds(box.panelIds, panelIdOptionsFromBox(box, {
                  gavetas: valor,
                  portaTipo: valor > 0 ? "sem_porta" : box.portaTipo,
                  prateleiras: valor > 0 ? 0 : box.prateleiras,
                })),
              };
              const layers = regenerateLayersForBox(updatedBox);
              const merged = { ...updatedBox, ...layers };
              const drawerConfigWarnings = validateBoxDrawerConfiguration(
                merged,
                getSettings().gavetas
              )
                .filter((alert) => alert.level === "warning")
                .map((alert) => alert.message);
              return { ...merged, drawerConfigWarnings };
            });
            return recomputeState(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: `Gavetas ajustadas para ${valor}`,
                }),
              },
              true
            );
          },
          true
        );
      },
      setDrawerHeightMode: (mode) => {
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== prev.selectedWorkspaceBoxId) return box;
              const updatedBox = { ...box, drawerHeightMode: mode, drawerConfigError: undefined };
              const layers = regenerateLayersForBox(updatedBox);
              const merged = { ...updatedBox, ...layers };
              const drawerConfigWarnings = validateBoxDrawerConfiguration(
                merged,
                getSettings().gavetas
              )
                .filter((alert) => alert.level === "warning")
                .map((alert) => alert.message);
              return { ...merged, drawerConfigWarnings };
            });
            return recomputeState(prev, { workspaceBoxes }, true);
          },
          true
        );
      },
      setPortaTipo: (portaTipo) => {
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id === prev.selectedWorkspaceBoxId) {
                const updatedBox = {
                  ...box,
                  portaTipo,
                  gavetas: portaTipo === "sem_porta" ? box.gavetas : 0,
                  drawersLayer: portaTipo === "sem_porta" ? box.drawersLayer : [],
                  doorsLayer: portaTipo === "sem_porta" ? [] : box.doorsLayer,
                  panelIds: ensureBoxPanelIds(box.panelIds, panelIdOptionsFromBox(box, {
                    portaTipo,
                    gavetas: portaTipo === "sem_porta" ? box.gavetas : 0,
                  })),
                };
                const layers = regenerateLayersForBox(updatedBox);
                return { ...updatedBox, ...layers };
              }
              return box;
            });
            return recomputeState(prev, { workspaceBoxes }, true);
          },
          true
        );
      },
      setDoorMaterial: (boxId, doorLayerId, material) => {
        if (import.meta.env.DEV) {
          devLogger.debug("[DOOR-MAT] 3 ProjectProvider.setDoorMaterial ENTRADA", { boxId, doorLayerId, material });
        }
        updateProject(
          (prev) => {
            const { next, sync } = commitMaterialSync(
              prev,
              { kind: "door", boxId, doorLayerId, materialId: material },
              true
            );
            if (import.meta.env.DEV) {
              const box = next.workspaceBoxes.find((b) => b.id === boxId);
              const doorAfter = (box?.doorsLayer ?? []).find((d) => d.id === doorLayerId);
              devLogger.debug(
                "[DOOR-MAT] 5 ProjectProvider.setDoorMaterial door DEPOIS (estado que será commitado)",
                {
                  boxId,
                  doorLayerId,
                  materialEmDoorsLayer: doorAfter?.material ?? doorAfter?.materialId,
                }
              );
            }
            refreshViewerAfterMaterialSync(sync);
            return next;
          },
          true
        );
        if (import.meta.env.DEV) {
          devLogger.debug("[DOOR-MAT] 6 ProjectProvider.setDoorMaterial updateProject callback agendado");
        }
      },
      setDrawerMaterial: (boxId, drawerLayerId, material) => {
        updateProject(
          (prev) => {
            const { next, sync } = commitMaterialSync(
              prev,
              { kind: "drawer", boxId, drawerLayerId, materialId: material },
              true
            );
            refreshViewerAfterMaterialSync(sync);
            return next;
          },
          true
        );
        syncDrawerFrontMaterialToViewer(boxId, drawerLayerId, material);
      },
      setDoorAllowPieceRotation: (boxId, doorLayerId, allow) => {
        let doorMaterialId = "";
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== boxId) return box;
              const doorsLayer = (box.doorsLayer ?? []).map((door) => {
                if (door.id === doorLayerId) {
                  doorMaterialId = door.material ?? door.materialId ?? box.material ?? "";
                  return { ...door, allowPieceRotation: allow };
                }
                return door;
              });
              return { ...box, doorsLayer };
            });
            return { ...prev, workspaceBoxes };
          },
          true
        );
        if (doorMaterialId) {
          syncDoorWoodGrainToViewer(boxId, doorLayerId, doorMaterialId, {
            allowPieceRotation: allow,
            pieceTipo: "porta_simples",
          });
        }
      },
      setDoorLockWoodGrain: (boxId, doorLayerId, lock) => {
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== boxId) return box;
              const doorsLayer = (box.doorsLayer ?? []).map((door) =>
                door.id === doorLayerId ? { ...door, lockWoodGrain: lock } : door
              );
              return { ...box, doorsLayer };
            });
            return { ...prev, workspaceBoxes };
          },
          true
        );
      },
      setDrawerAllowPieceRotation: (boxId, drawerLayerId, allow) => {
        let drawerMaterialId = "";
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== boxId) return box;
              const drawersLayer = (box.drawersLayer ?? []).map((drawer) => {
                if (drawer.id === drawerLayerId) {
                  drawerMaterialId = drawer.material ?? drawer.materialId ?? box.material ?? "";
                  return { ...drawer, allowPieceRotation: allow };
                }
                return drawer;
              });
              return { ...box, drawersLayer };
            });
            return { ...prev, workspaceBoxes };
          },
          true
        );
        if (drawerMaterialId) {
          syncDrawerFrontMaterialToViewer(boxId, drawerLayerId, drawerMaterialId, {
            allowPieceRotation: allow,
          });
        }
      },
      setDrawerLockWoodGrain: (boxId, drawerLayerId, lock) => {
        updateProject(
          (prev) => {
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== boxId) return box;
              const drawersLayer = (box.drawersLayer ?? []).map((drawer) =>
                drawer.id === drawerLayerId ? { ...drawer, lockWoodGrain: lock } : drawer
              );
              return { ...box, drawersLayer };
            });
            return { ...prev, workspaceBoxes };
          },
          true
        );
      },
      addDoorLayerItem: () => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const newDoor = createManualDoor(selected);
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    gavetas: 0,
                    portaTipo: box.portaTipo === "sem_porta" ? "porta_simples" : box.portaTipo,
                    drawersLayer: [],
                    doorsLayer: [...(box.doorsLayer ?? []), newDoor],
                    panelIds: ensureBoxPanelIds(box.panelIds, panelIdOptionsFromBox(box, {
                      gavetas: 0,
                      portaTipo: box.portaTipo === "sem_porta" ? "porta_simples" : box.portaTipo,
                    })),
                  }
                : box
            );
            return {
              ...prev,
              workspaceBoxes,
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: "Porta adicionada",
              }),
            };
          },
          true
        );
      },
      addDrawerLayerItem: () => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const newDrawer = createManualDrawer(selected);
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    portaTipo: "sem_porta" as const,
                    prateleiras: 0,
                    doorsLayer: [],
                    gavetas: (box.drawersLayer?.length ?? 0) + 1,
                    drawersLayer: [...(box.drawersLayer ?? []), newDrawer],
                    panelIds: ensureBoxPanelIds(box.panelIds, panelIdOptionsFromBox(box, {
                      portaTipo: "sem_porta" as const,
                      prateleiras: 0,
                      gavetas: (box.drawersLayer?.length ?? 0) + 1,
                    })),
                  }
                : box
            );
            return recomputeState(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: "Gaveta adicionada",
                }),
              },
              true
            );
          },
          true
        );
      },
      removeDoorLayerItem: (id) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id === selected.id) {
                const newDoorsLayer = (box.doorsLayer ?? []).filter((item) => item.id !== id);
                return {
                  ...box,
                  doorsLayer: newDoorsLayer,
                  portaTipo: newDoorsLayer.length === 0 ? "sem_porta" : box.portaTipo,
                };
              }
              return box;
            });
            return {
              ...prev,
              workspaceBoxes,
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: "Porta removida",
              }),
            };
          },
          true
        );
      },
      removeDrawerLayerItem: (id) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? (() => {
                    const nextDrawers = (box.drawersLayer ?? []).filter((item) => item.id !== id);
                    return {
                      ...box,
                      drawersLayer: nextDrawers,
                      gavetas: nextDrawers.length,
                      panelIds: ensureBoxPanelIds(box.panelIds, panelIdOptionsFromBox(box, {
                        gavetas: nextDrawers.length,
                      })),
                    };
                  })()
                : box
            );
            return recomputeState(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: "Gaveta removida",
                }),
              },
              true
            );
          },
          true
        );
      },
      updateDoorLayerItem: (id, partial) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const calcularAlturaLaterais = prev.rules?.madeira?.calcularAlturaLaterais ?? true;
            const openingHeightMm = resolveDoorOpeningHeightMm(
              selected.dimensoes.altura,
              selected.espessura,
              calcularAlturaLaterais
            );
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    doorsLayer: (box.doorsLayer ?? []).map((item) =>
                      item.id === id
                        ? mergeDoorDimensionUpdate(
                            item,
                            partial as Partial<typeof item> & { applyVerticalAdjustMm?: number },
                            openingHeightMm
                          )
                        : item
                    ),
                  }
                : box
            );
            return recomputeState(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: "Porta atualizada",
                }),
              },
              true
            );
          },
          true
        );
      },
      updateDrawerLayerItem: (id, partial) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== selected.id) return box;

              const updated = (box.drawersLayer ?? []).map((item) =>
                item.id === id ? { ...item, ...partial } : item
              );
              const heightChanged = "height" in partial || "bodyHeight" in partial;
              const mode = box.drawerHeightMode ?? "equal";
              let nextDrawers = updated;
                      if (heightChanged && mode === "custom") {
                        const availableHeight = getDrawerUsableInternalHeightMm(box.dimensoes.altura);
                        const gapTotal = Math.max(0, nextDrawers.length - 1) * DRAWER_VERTICAL_GAP_MM;
                        const distributable = Math.max(1, availableHeight - gapTotal);
                        const heights = nextDrawers.map((item) => {
                          const bodyH = item.bodyHeight ?? item.height;
                          return Number.isFinite(bodyH) && bodyH > 0
                            ? bodyH
                            : distributable / Math.max(1, nextDrawers.length);
                        });
                        nextDrawers = nextDrawers.map((item, index) => {
                          const bodyHeight = heights[index];
                          const frontOverride = item.metadata?.frontHeightMm;
                          const height =
                            frontOverride != null && frontOverride > 0 ? frontOverride : bodyHeight;
                          const posY = resolveDrawerVerticalPosition(
                            index,
                            heights,
                            box.dimensoes.altura
                          );
                          return { ...item, bodyHeight, height, posY };
                        });
                      }

              const mergedBox = { ...box, drawersLayer: nextDrawers };
              return {
                ...mergedBox,
                drawerConfigWarnings: validateBoxDrawerConfiguration(mergedBox, getSettings().gavetas)
                  .filter((alert) => alert.level === "warning")
                  .map((alert) => alert.message),
              };
            });
            return recomputeState(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: "Gaveta atualizada",
                }),
              },
              true
            );
          },
          true
        );
      },
      setDoorLayerItemOpen: (id, isOpen) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const target = (selected.doorsLayer ?? []).find((item) => item.id === id);
            const isDoubleDoor = selected.portaTipo === "porta_dupla" || target?.groupType === "dupla";
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    doorsLayer: (box.doorsLayer ?? []).map((item) =>
                      isDoubleDoor ? { ...item, isOpen } : item.id === id ? { ...item, isOpen } : item
                    ),
                  }
                : box
            );
            return {
              ...prev,
              workspaceBoxes,
            };
          },
          true
        );
      },
      setDrawerLayerItemOpen: (id, isOpen, options) => {
        updateProject(
          (prev) => {
            const ownerBox = prev.workspaceBoxes.find((box) =>
              (box.drawersLayer ?? []).some((item) => item.id === id)
            );
            if (!ownerBox) return prev;

            const drawer = (ownerBox.drawersLayer ?? []).find((item) => item.id === id);
            if (!drawer) return prev;

            const maxPull =
              Number(drawer.bodyDepth) > 0
                ? Number(drawer.bodyDepth)
                : Math.max(
                    0,
                    (Number(drawer.depth) || 0) - (Number(drawer.frontThickness) || 0)
                  );

            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== ownerBox.id) return box;
              const mergedBox = {
                ...box,
                drawerConfigError: undefined,
                drawersLayer: (box.drawersLayer ?? []).map((item) => {
                  if (item.id === id) {
                    return {
                      ...item,
                      isOpen,
                      pullDistanceMm: isOpen ? maxPull : 0,
                    };
                  }
                  if (isOpen && !options?.allowMultipleOpen && item.isOpen) {
                    return { ...item, isOpen: false, pullDistanceMm: 0 };
                  }
                  return item;
                }),
              };
              return {
                ...mergedBox,
                drawerConfigWarnings: validateBoxDrawerConfiguration(mergedBox, getSettings().gavetas)
                  .filter((alert) => alert.level === "warning")
                  .map((alert) => alert.message),
              };
            });
            return {
              ...prev,
              workspaceBoxes,
              selectedWorkspaceBoxId: ownerBox.id,
            };
          },
          true
        );
      },
      setDoorLayerItemMaterial: (id, materialId) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const { next, sync } = commitMaterialSync(
              prev,
              { kind: "doorLayerItem", boxId: selected.id, itemId: id, materialId },
              true
            );
            refreshViewerAfterMaterialSync(sync);
            return {
              ...next,
              selectedWorkspaceBoxId: selected.id,
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: "Material da porta atualizado",
              }),
            };
          },
          true
        );
      },
      setDrawerLayerItemMaterial: (id, materialId) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const { next, sync } = commitMaterialSync(
              prev,
              { kind: "drawerLayerItem", boxId: selected.id, itemId: id, materialId },
              true
            );
            refreshViewerAfterMaterialSync(sync);
            syncDrawerFrontMaterialToViewer(selected.id, id, materialId);
            return {
              ...next,
              selectedWorkspaceBoxId: selected.id,
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: "Material da gaveta atualizado",
              }),
            };
          },
          true
        );
      },
      setDoorLayerItemDirection: (id, direction) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    doorsLayer: (box.doorsLayer ?? []).map((item) =>
                      item.id === id
                        ? (() => {
                            const currentCenterX =
                              item.pivot === "left-edge"
                                ? item.posX + item.width / 2
                                : item.pivot === "right-edge"
                                  ? item.posX - item.width / 2
                                  : item.posX;
                            const currentCenterY =
                              item.pivot === "top-edge"
                                ? item.posY - item.height / 2
                                : item.pivot === "bottom-edge"
                                  ? item.posY + item.height / 2
                                  : item.posY;

                            const nextHingeSide: "left" | "right" | "top" | "bottom" =
                              direction === "left" || direction === "right"
                                ? direction
                                : direction === "up"
                                  ? "top"
                                  : direction === "down"
                                    ? "bottom"
                                    : (item.hingeSide ?? "left");
                            const nextPivot: "left-edge" | "right-edge" | "top-edge" | "bottom-edge" =
                              direction === "left"
                                ? "left-edge"
                                : direction === "right"
                                  ? "right-edge"
                                  : direction === "up"
                                    ? "top-edge"
                                    : "bottom-edge";
                            const nextPosX =
                              direction === "left"
                                ? currentCenterX - item.width / 2
                                : direction === "right"
                                  ? currentCenterX + item.width / 2
                                  : currentCenterX;
                            const nextPosY =
                              direction === "up"
                                ? currentCenterY + item.height / 2
                                : direction === "down"
                                  ? currentCenterY - item.height / 2
                                  : currentCenterY;

                            return {
                              ...item,
                              openDirection: direction,
                              hingeSide: nextHingeSide,
                              pivot: nextPivot,
                              posX: nextPosX,
                              posY: nextPosY,
                            };
                          })()
                        : item
                    ),
                  }
                : box
            );
            const nextPrev = {
              ...prev,
              workspaceBoxes,
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: "Direção de abertura da porta atualizada",
              }),
            };
            const boxes = buildBoxesFromWorkspace(nextPrev);
            const selectedWorkspace = getSelectedWorkspaceBox(nextPrev);
            const selectedBoxId =
              boxes.find((box) => box.id === selectedWorkspace?.id)?.id ?? boxes[0]?.id ?? "";
            const nextState = {
              ...nextPrev,
              boxes,
              selectedBoxId,
              dimensoes:
                selectedWorkspace?.dimensoes ??
                boxes.find((box) => box.id === selectedBoxId)?.dimensoes ??
                nextPrev.dimensoes,
            };
            return {
              ...nextState,
              ...buildDesignState(nextState),
            };
          },
          true
        );
      },
      regenerateBoxLayersForSelectedBox: () => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const normalized = {
              ...selected,
              ...(selected.gavetas > 0
                ? { portaTipo: "sem_porta" as const, prateleiras: 0, doorsLayer: [] }
                : selected.portaTipo !== "sem_porta"
                  ? { gavetas: 0, drawersLayer: [] }
                  : selected.prateleiras > 0
                    ? { gavetas: 0, drawersLayer: [] }
                    : null),
            };
            const layers = regenerateLayersForBox(normalized);
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? { ...box, ...normalized, ...layers }
                : box
            );
            return {
              ...prev,
              workspaceBoxes,
              changelog: appendChangelog(prev.changelog, {
                timestamp: new Date(),
                type: "box",
                message: "Portas e gavetas regeneradas automaticamente",
              }),
            };
          },
          true
        );
      },
    }),
    [updateProject, recomputeState]
  );
}
