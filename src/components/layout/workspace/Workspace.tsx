import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "../../../context/useProject";
import { useToast } from "../../../context/ToastContext";
import { usePimoViewer } from "../../../hooks/usePimoViewer";
import { createViewerApiAdapter } from "../../../core/viewer/viewerApiAdapter";
import { useMultiBoxManager } from "../../../core/multibox";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import UnifiedTopToolbar from "../unified-toolbar/UnifiedTopToolbar";
import ViewerToolbar from "../viewer-toolbar/ViewerToolbar";
import { useToolbarModal } from "../../../context/ToolbarModalContext";
import { defaultState } from "../../../context/projectState";
import { loadViewerCore } from "../../../core/viewer/viewerEngineLoader";
import { isViewerApiReady } from "../../../core/viewer/viewerReadiness";
import { setActiveViewerCore, type ViewerCoreRuntime } from "../../../core/viewer/pimoViewerRuntime";
import { mToMm } from "../../../utils/units";
import { useWallStore, wallStore } from "../../../stores/wallStore";
import { applyRoomMeshFromWallStore, applyRoomOpeningsFromWallStore, getRoomMeshFingerprintFromWallStore } from "../../../utils/roomMeshFromWallStore";
import { uiStore, useUiStore } from "../../../stores/uiStore";
import { groupStore, resolveActiveGroupMembers } from "../../../stores/groupStore";
import { serializeState, reviveState } from "../../../context/projectPersistence";
import { clampOpeningNoOverlap } from "../../../utils/openingConstraints";
import BoxInfoOverlay from "./BoxInfoOverlay";
import InternalMeasurementsPanel from "./InternalMeasurementsPanel";
import IndustrialDesignPanel from "./IndustrialDesignPanel";
import ContextMenu from "./ContextMenu";
import SelectionMarquee from "./SelectionMarquee";
import { devLogger } from "../../../utils/devLogger";
import {
  boxSelectionId,
  decodeSelectionId,
} from "../../../core/viewer/selectionIds";
import { useWorkspaceUndoRedoRegistry } from "../../../context/WorkspaceUndoRedoRegistryContext";
import { useProjectInvariants } from "../../../hooks/useProjectInvariants";
import { runProjectRedo, runProjectUndo } from "./workspaceUndoRedoHandlers";
import { buildBoxesWithCutList } from "../../../context/projectState";
import { resolvePieceOrlaConfig } from "../../../core/orla/orlaCalculator";
import { normalizeOrlaPresets } from "../../../core/orla/orlaPresets";
import { ORLA_VIEWER_RENDERING_ENABLED } from "../../../3d/viewer-engine/orla/orlaViewerFlags";
import { useSettings } from "../../../context/SettingsContext";
import type { MouseMenuTarget } from "../../../ui/context-menu/ContextMenuEngine";
import { LEFT_TOOLBAR_IDS } from "../left-toolbar/LeftToolbar";
import { Matrix4, Vector3 } from "three";
import {
  toggleAllDrawersSequential,
  toggleDrawer,
} from "../../../core/drawers/DrawerController";
import { shouldEnableShowcaseForQualitySettings } from "../topbar/displayQualityPresets";

type WorkspaceProps = {
  viewerBackground?: string;
  viewerHeight?: number | string;
  viewerOptions?: Record<string, unknown>;
};

export default function Workspace({
  viewerBackground,
  viewerHeight: _viewerHeight = "100%",
  viewerOptions,
}: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const { project, actions, viewerSync } = useProject();
  useProjectInvariants();
  const { settings } = useSettings();
  const { registerWorkspaceUndoRedo } = useWorkspaceUndoRedoRegistry();
  const { openModal } = useToolbarModal();
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const actionsRef = useRef(actions);
  // eslint-disable-next-line react-hooks/refs -- intencional: espelho em ref com o `actions` mais recente para listeners/efeitos sem re-inscrever em cada mudança de identidade.
  actionsRef.current = actions;
  const { showToast } = useToast();
  const viewerOptionsStable = useMemo(
    () => ({
      background: viewerBackground,
      ...viewerOptions,
      skipInitialBox: true as const,
    }),
    [viewerBackground, viewerOptions]
  );
  const viewerApi = usePimoViewer();
  const viewerReady = isViewerApiReady(viewerApi);
  const { registerViewerApi } = usePimoViewerContext();
  const isRoomOpen = useWallStore((state) => state.isOpen);
  const walls = useWallStore((state) => state.walls);

  const projectHasNonDefaultState = useMemo(() => {
    if (project.workspaceBoxes.length > 0) return true;
    if ((project.projectName?.trim() || "") !== defaultState.projectName) return true;
    if (walls.length >= 3) return true;
    return false;
  }, [project.workspaceBoxes.length, project.projectName, walls.length]);

  const handleTopToolbarNovo = useCallback(() => {
    if (projectHasNonDefaultState) setConfirmNewOpen(true);
    else void actions.createNewProject();
  }, [projectHasNonDefaultState, actions]);

  const handleTopToolbarProjetos = useCallback(() => {
    openModal("projects");
  }, [openModal]);

  const handleUndo = useCallback(() => {
    runProjectUndo(actions);
  }, [actions]);

  const handleRedo = useCallback(() => {
    runProjectRedo(actions);
  }, [actions]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") ctrlKeyActiveRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") ctrlKeyActiveRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    registerWorkspaceUndoRedo({ handleUndo, handleRedo });
    return () => {
      registerWorkspaceUndoRedo(null);
    };
  }, [handleUndo, handleRedo, registerWorkspaceUndoRedo]);

  const roomMeshSyncToken = useWallStore((state) => state.roomMeshSyncToken);
  const selectedWallId = useWallStore((state) => state.selectedWallId);
  const selectedObject = useUiStore((state) => state.selectedObject);
  const setSelectedObject = useUiStore((state) => state.setSelectedObject);
  const setSelectedObjects = useUiStore((state) => state.setSelectedObjects);
  const toggleSelectedObject = useUiStore((state) => state.toggleSelectedObject);
  const selectedObjects = useUiStore((state) => state.selectedObjects);
  const clearUiSelection = useUiStore((state) => state.clearSelection);
  const setSelectedTool = useUiStore((state) => state.setSelectedTool);
  const photoModePanelOpen = useUiStore((state) => state.photoModePanelOpen);

  const [contextSelectedBoxIds, setContextSelectedBoxIds] = useState<string[]>([]);
  const viewerCoreInstanceRef = useRef<{ dispose: () => void } | null>(null);
  const lastRoomMeshFingerprintRef = useRef("");
  const projectRef = useRef(project);
  const ctrlOrMetaPressedRef = useRef(false);
  const pointerToggleSelectionRef = useRef(false);
  const ctrlKeyActiveRef = useRef(false);
  const multiSelectedBoxIdsRef = useRef<string[]>([]);
  const dragPreStateRef = useRef<typeof project | null>(null);
  const keyboardMoveRef = useRef<{
    activeKey: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | null;
    accelTimeoutId: number | null;
    repeatIntervalId: number | null;
  }>({
    activeKey: null,
    accelTimeoutId: null,
    repeatIntervalId: null,
  });
  const [showKeyboardShortcutsHelp, setShowKeyboardShortcutsHelp] = useState(false);
  const [, setViewerMounted] = useState(false);

  // Montar ViewerCore via import dinâmico.
  // Runtime canónico: setActiveViewerCore. window.viewerCore fica só como ponte (HMR / dispose).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setViewerMounted(false);
    let mounted = true;
    loadViewerCore()
      .then((ViewerCore) => {
        if (!mounted) return;
        const core = new ViewerCore(container, viewerOptionsStable as Record<string, unknown>);
        viewerCoreInstanceRef.current = core;
        window.setOnViewerReady = (callback) => core.setOnViewerReady(callback);
        core.setOnViewerReady(() => {
          if (!mounted) return;
          setActiveViewerCore(core as unknown as ViewerCoreRuntime);
          window.viewerCore = core as unknown as typeof window.viewerCore;
          setViewerMounted(true);
        });
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.error("[Workspace] Falha ao carregar viewer-engine:", err);
        }
      });
    return () => {
      mounted = false;
      const core = viewerCoreInstanceRef.current;
      viewerCoreInstanceRef.current = null;
      if (core?.dispose) {
        core.dispose();
      }
      setActiveViewerCore(null);
      (window as Window & { viewerCore?: unknown }).viewerCore = undefined;
      delete window.setOnViewerReady;
      setViewerMounted(false);
    };
  }, [viewerOptionsStable]);

  // Registrar no PimoViewerContext apenas quando viewerApi muda (não quando viewerSync muda, para evitar loop ao rotacionar/atualizar projeto).
  useEffect(() => {
    registerViewerApi(viewerApi);
    return () => {
      registerViewerApi(null);
    };
  }, [registerViewerApi, viewerApi]);

  // Manter viewerSync com o adapter atual; roda quando viewerApi ou viewerSync mudam, sem chamar setState no contexto.
  useEffect(() => {
    const adapter = createViewerApiAdapter(viewerApi);
    viewerSync.registerViewerApi(adapter);
    return () => {
      viewerSync.registerViewerApi(null);
    };
  }, [viewerApi, viewerSync]);

  // Fluxo da sala é controlado exclusivamente pelo PainelSala (RoomManager).
  // Evita remoção/criação implícita da sala em mudanças de seleção do wallStore.

  /** Após alterações Room 2.0: rebuild só se geometria/aberturas mudaram; locked/visible sem rebuild. */
  useEffect(() => {
    const fingerprint = getRoomMeshFingerprintFromWallStore();
    const room = projectRef.current.room;
    if (
      fingerprint &&
      fingerprint === lastRoomMeshFingerprintRef.current &&
      viewerApi.getRoomExists?.()
    ) {
      if (room) {
        viewerApi.setRoomLocked?.(room.locked);
        viewerApi.setRoomFloorMode?.(room.floorMode);
        viewerApi.setRoomCeilingVisible?.(room.ceilingVisible && projectRef.current.viewerSettings.showCeiling);
        viewerApi.setRoomHiddenWalls?.(room.hiddenWalls ?? []);
        viewerApi.setRoomUtilities?.(room.utilities ?? []);
        if (room.visible !== false) viewerApi.showRoom?.();
        else viewerApi.hideRoom?.();
      }
      return;
    }
    lastRoomMeshFingerprintRef.current = fingerprint;
    applyRoomMeshFromWallStore(viewerApi);
    applyRoomOpeningsFromWallStore(viewerApi);
    if (room) {
      viewerApi.setRoomLocked?.(room.locked);
      viewerApi.setRoomFloorMode?.(room.floorMode);
      viewerApi.setRoomCeilingVisible?.(room.ceilingVisible && projectRef.current.viewerSettings.showCeiling);
      viewerApi.setRoomHiddenWalls?.(room.hiddenWalls ?? []);
      viewerApi.setRoomUtilities?.(room.utilities ?? []);
      if (room.visible !== false) viewerApi.showRoom?.();
      else viewerApi.hideRoom?.();
    }
  }, [viewerApi, roomMeshSyncToken, project.room]);

  // MultiBoxManager: sincroniza workspaceBoxes ↔ viewer; addBox/removeBox delegam a actions
  useMultiBoxManager({
    viewerApi: viewerApi as import("../../../core/multibox/types").MultiBoxViewerApi,
    project,
    actions,
  });

  useEffect(() => {
    viewerApi.setOnBoxSelected((boxId) => {
      if (import.meta.env.DEV) {
        const beforeUi = uiStore.getState();
        devLogger.debug("[SELECTION][Workspace] onBoxSelected:entrada", {
          boxId,
          selectedObjectBefore: beforeUi.selectedObject,
          selectedToolBefore: beforeUi.selectedTool,
          projectSelectedWorkspaceBoxIdBefore: project.selectedWorkspaceBoxId,
        });
      }
      if (boxId) {
        const isMultiSelect =
          pointerToggleSelectionRef.current ||
          ctrlKeyActiveRef.current ||
          ctrlOrMetaPressedRef.current;
        const encodedId = boxSelectionId(boxId);
        if (!isMultiSelect) {
          multiSelectedBoxIdsRef.current = [boxId];
          setSelectedObjects([encodedId]);
          groupStore.getState().clearGroupSelection();
        } else {
          multiSelectedBoxIdsRef.current = uiStore
            .getState()
            .selectedObjects.filter((id) => id.startsWith("box:"))
            .map((id) => id.replace(/^box:/, ""));
        }
        if (import.meta.env.DEV) {
          devLogger.debug("[SELECTION][Workspace] onBoxSelected:actions.selectBox", {
            boxId,
            isMultiSelect,
          });
        }
        actions.selectBox(boxId);
        setSelectedObject({ type: "box", id: boxId });
        if (import.meta.env.DEV) {
          devLogger.debug("[SELECTION][Workspace] selectedObject:set box", {
            boxId,
          });
        }
        pointerToggleSelectionRef.current = false;
        return;
      }
      if (project.selectedWorkspaceBoxId != null && project.selectedWorkspaceBoxId !== "") {
        multiSelectedBoxIdsRef.current = [];
        setSelectedObjects([]);
        if (import.meta.env.DEV) {
          devLogger.debug("[SELECTION][Workspace] onBoxSelected:null -> clearSelection", {
            projectSelectedWorkspaceBoxIdBeforeClear: project.selectedWorkspaceBoxId,
          });
        }
        actions.clearSelection();
        clearUiSelection();
        if (import.meta.env.DEV) {
          const afterUi = uiStore.getState();
          devLogger.debug("[SELECTION][Workspace] after clearSelection", {
            selectedObjectAfterClear: afterUi.selectedObject,
            selectedToolAfterClear: afterUi.selectedTool,
          });
        }
      }
      pointerToggleSelectionRef.current = false;
    });
  }, [actions, viewerApi, clearUiSelection, project.selectedWorkspaceBoxId, setSelectedObject, setSelectedObjects, toggleSelectedObject]);

  useEffect(() => {
    viewerApi.setOnBoxDoubleClick?.((boxId) => {
      const box = project.workspaceBoxes.find((workspaceBox) => workspaceBox.id === boxId);
      if (!box || (box.drawersLayer?.length ?? 0) === 0) return;

      actions.selectBox(boxId);
      setSelectedObject({ type: "box", id: boxId });
      setSelectedTool(LEFT_TOOLBAR_IDS.HOME);

      toggleAllDrawersSequential(box, {
        getBox: () => projectRef.current.workspaceBoxes.find((workspaceBox) => workspaceBox.id === boxId),
        setDrawerOpen: (drawerId, isOpen, options) =>
          actionsRef.current.setDrawerLayerItemOpen(drawerId, isOpen, options),
      });
    });
    return () => {
      viewerApi.setOnBoxDoubleClick?.(null);
    };
  }, [actions, project.workspaceBoxes, viewerApi, setSelectedObject, setSelectedTool]);

  useEffect(() => {
    viewerApi.setOnDrawerLayerClick?.((boxId, drawerLayerId) => {
      const box = projectRef.current.workspaceBoxes.find((workspaceBox) => workspaceBox.id === boxId);
      if (!box) return;

      if (project.selectedWorkspaceBoxId !== boxId) {
        actions.selectBox(boxId);
      }

      toggleDrawer(box, drawerLayerId, {
        getBox: () => projectRef.current.workspaceBoxes.find((workspaceBox) => workspaceBox.id === boxId),
        setDrawerOpen: (drawerId, isOpen, options) =>
          actionsRef.current.setDrawerLayerItemOpen(drawerId, isOpen, options),
      });
    });
    return () => {
      viewerApi.setOnDrawerLayerClick?.(null);
    };
  }, [actions, project.selectedWorkspaceBoxId, viewerApi]);

  /** GLB/CAD: ViewerCore chama após `addModelToBox` concluir o load (ver ViewerCore.addModelToBox). */
  useEffect(() => {
    viewerApi.setOnModelLoaded((boxId, modelId, _object) => {
      if (import.meta.env.DEV) {
        devLogger.debug("[Workspace] Modelo carregado no viewer", { boxId, modelId });
      }
    });
    return () => {
      viewerApi.setOnModelLoaded(null);
    };
  }, [viewerApi]);

  useEffect(() => {
    const selectedBoxId = project.selectedWorkspaceBoxId;
    const validIds = new Set(project.workspaceBoxes.map((box) => box.id));
    const fromUi = selectedObjects
      .filter((id) => id.startsWith("box:"))
      .map((id) => id.replace(/^box:/, ""))
      .filter((id) => validIds.has(id));
    if (fromUi.length >= 2) {
      multiSelectedBoxIdsRef.current = fromUi;
      return;
    }
    const filteredSelection = multiSelectedBoxIdsRef.current.filter((id) => validIds.has(id));
    if (!selectedBoxId) {
      multiSelectedBoxIdsRef.current = filteredSelection;
      return;
    }
    if (filteredSelection.length <= 1 || !filteredSelection.includes(selectedBoxId)) {
      multiSelectedBoxIdsRef.current = [selectedBoxId];
      return;
    }
    multiSelectedBoxIdsRef.current = filteredSelection;
  }, [project.selectedWorkspaceBoxId, project.workspaceBoxes, selectedObjects]);

  useEffect(() => {
    viewerApi.setMultiSelectionOutlines?.(selectedObjects);
  }, [selectedObjects, viewerReady, viewerApi]);

  useEffect(() => {
    if (!viewerReady) return;
    const { activeGroupId, ephemeralMemberIds } = groupStore.getState();
    const members = resolveActiveGroupMembers(project.objectGroups, activeGroupId, ephemeralMemberIds);
    const fallback = selectedObjects.length >= 2 ? selectedObjects : members;
    if (fallback.length >= 2) {
      viewerApi.setGroupTransformMembers?.(fallback);
      groupStore.getState().setEphemeralMemberIds(fallback);
    } else {
      viewerApi.clearGroupTransformMembers?.();
    }
  }, [selectedObjects, project.objectGroups, viewerReady, viewerApi]);

  useEffect(() => {
    if (!viewerReady) return;
    viewerApi.syncMeasurementAnchors?.(project.measurements.anchors ?? [], null);
  }, [project.measurements.anchors, viewerReady, project.selectedWorkspaceBoxId, viewerApi]);

  useEffect(() => {
    if (!viewerReady) return;
    viewerApi.setOnTransformDragStart?.(() => {
      dragPreStateRef.current =
        reviveState(serializeState(projectRef.current) as import("../../../context/projectTypes").ProjectState) ??
        projectRef.current;
    });
    viewerApi.setOnTransformDragEnd?.(() => {
      const pre = dragPreStateRef.current;
      if (pre && "recordDragUndo" in actionsRef.current) {
        (actionsRef.current as { recordDragUndo: (s: typeof project) => void }).recordDragUndo(pre);
        dragPreStateRef.current = null;
      }
    });
    return () => {
      viewerApi.setOnTransformDragStart?.(null);
      viewerApi.setOnTransformDragEnd?.(null);
    };
  }, [viewerReady, viewerApi]);

  useEffect(() => {
    viewerApi.setOnDoorLayerDoubleClick((boxId, doorLayerId) => {
      const box = project.workspaceBoxes.find((workspaceBox) => workspaceBox.id === boxId);
      const door = box?.doorsLayer?.find((item) => item.id === doorLayerId);
      if (!box || !door) return;

      const nextIsOpen = !door.isOpen;
      if (project.selectedWorkspaceBoxId === boxId) {
        actions.setDoorLayerItemOpen(doorLayerId, nextIsOpen);
        return;
      }

      actions.selectBox(boxId);
      requestAnimationFrame(() => {
        actionsRef.current.setDoorLayerItemOpen(doorLayerId, nextIsOpen);
      });
    });
  }, [actions, project.workspaceBoxes, project.selectedWorkspaceBoxId, viewerApi]);

  useEffect(() => {
    viewerApi.setOnWallSelected?.((wallIndex) => {
      if (wallIndex == null) {
        wallStore.getState().selectWall(null);
        return;
      }
      const wall = walls[wallIndex];
      if (!wall) return;
      actions.clearSelection();
      wallStore.getState().setOpen(true);
      wallStore.getState().selectWall(wall.id);
      setSelectedTool("layout");
      setSelectedObject({ type: "wall", id: wall.id });
    });
  }, [actions, viewerApi, walls, setSelectedObject, setSelectedTool]);

  useEffect(() => {
    if (!isRoomOpen || !viewerApi.selectWallByIndex) return;
    const index = selectedWallId ? walls.findIndex((w) => w.id === selectedWallId) : -1;
    viewerApi.selectWallByIndex(index >= 0 ? index : null);
  }, [viewerApi, isRoomOpen, selectedWallId, walls]);

  useEffect(() => {
    if (selectedObject?.type === "roomElement" && selectedObject?.id) {
      viewerApi.selectRoomElementById?.(selectedObject.id);
    } else if (selectedObject?.type === "roomUtility" && selectedObject?.id) {
      viewerApi.selectRoomUtilityById?.(selectedObject.id);
    }
  }, [viewerApi, selectedObject]);

  useEffect(() => {
    viewerApi.setOnWallTransform?.((wallIndex, position, rotation) => {
      const wall = walls[wallIndex];
      if (!wall) return;
      wallStore.getState().updateWall(wall.id, {
        position: {
          x: position.x * 100,
          y: wall.position?.y,
          z: position.z * 100,
        },
        rotation,
      }, { skipSnap: true });
      const room = projectRef.current.room;
      if (!room) return;
      actionsRef.current.updateProjectRoom({
        walls: room.walls.map((roomWall) =>
          roomWall.id === wall.id
            ? {
                ...roomWall,
                position: {
                  ...roomWall.position,
                  x: position.x * 1000,
                  z: position.z * 1000,
                },
                rotationDeg: rotation,
              }
            : roomWall
        ),
      });
    });
  }, [viewerApi, walls]);

  useEffect(() => {
    viewerApi.setOnRoomElementSelected?.((roomElement) => {
      if (roomElement == null) {
        const currentSelectedObject = uiStore.getState().selectedObject;
        if (import.meta.env.DEV) {
          devLogger.debug("[SELECTION][Workspace] onRoomElementSelected:null", {
            selectedObjectBefore: currentSelectedObject,
          });
        }
        if (currentSelectedObject.type === "roomElement" || currentSelectedObject.type === "wall") {
          if (import.meta.env.DEV) {
            devLogger.debug("[SELECTION][Workspace] onRoomElementSelected:null -> clearUiSelection", {
              reason: "current selection is room/wall",
            });
          }
          clearUiSelection();
        }
        return;
      }
      actions.clearSelection();
      const wall = walls[roomElement.wallId];
      if (wall) {
        wallStore.getState().setOpen(true);
        wallStore.getState().selectWall(wall.id);
      }
      setSelectedTool("layout");
      setSelectedObject({ type: "roomElement", id: roomElement.elementId });
    });
  }, [actions, viewerApi, walls, clearUiSelection, setSelectedObject, setSelectedTool]);

  useEffect(() => {
    viewerApi.setOnRoomUtilitySelected?.((roomUtility) => {
      if (roomUtility == null) {
        const currentSelectedObject = uiStore.getState().selectedObject;
        if (currentSelectedObject.type === "roomUtility") clearUiSelection();
        return;
      }
      actions.clearSelection();
      const wall = walls[roomUtility.wallId];
      if (wall) {
        wallStore.getState().setOpen(true);
        wallStore.getState().selectWall(wall.id);
      }
      setSelectedTool("layout");
      setSelectedObject({ type: "roomUtility", id: roomUtility.utilityId });
    });
  }, [actions, viewerApi, walls, clearUiSelection, setSelectedObject, setSelectedTool]);

  useEffect(() => {
    viewerApi.setOnRoomElementTransform?.((elementId, config) => {
      const wall = walls.find((w) => (w.openings ?? []).some((o) => o.id === elementId));
      if (!wall) return;
      const wallLengthMm = wall.lengthCm * 10;
      const wallHeightMm = wall.heightCm * 10;
      const { horizontalOffsetMm, floorOffsetMm } = clampOpeningNoOverlap(
        config,
        elementId,
        wall.openings ?? [],
        wallLengthMm,
        wallHeightMm
      );
      const finalConfig = {
        ...config,
        horizontalOffsetMm,
        floorOffsetMm,
      };
      const currentOpening = wall.openings?.find((o) => o.id === elementId);
      wallStore.getState().updateWall(wall.id, {
        openings: (wall.openings ?? []).map((o) =>
          o.id === elementId
            ? {
                ...o,
                widthMm: finalConfig.widthMm,
                heightMm: finalConfig.heightMm,
                floorOffsetMm: finalConfig.floorOffsetMm,
                horizontalOffsetMm: finalConfig.horizontalOffsetMm,
              }
            : o
        ),
      });
      const room = projectRef.current.room;
      if (room) {
        actionsRef.current.updateProjectRoom({
          openings: room.openings.map((opening) =>
            opening.id === elementId
              ? {
                  ...opening,
                  widthMm: finalConfig.widthMm,
                  heightMm: finalConfig.heightMm,
                  thicknessMm: currentOpening?.thicknessMm ?? opening.thicknessMm,
                  kind: currentOpening?.kind ?? opening.kind,
                  floorOffsetMm: finalConfig.floorOffsetMm,
                  verticalOffsetMm: finalConfig.floorOffsetMm,
                  xPosMm: finalConfig.horizontalOffsetMm,
                  horizontalOffsetMm: finalConfig.horizontalOffsetMm,
                }
              : opening
          ),
        });
      }
      viewerApi.updateRoomElementConfig?.(elementId, finalConfig);
    });
  }, [viewerApi, walls]);

  useEffect(() => {
    viewerApi.setOnRoomUtilityTransform?.((utilityId, patch) => {
      const room = projectRef.current.room;
      if (!room) return;
      actionsRef.current.updateProjectRoom({
        utilities: (room.utilities ?? []).map((utility) =>
          utility.id === utilityId
            ? {
                ...utility,
                positionAlongWall: patch.positionAlongWall,
                heightMm: patch.heightMm,
              }
            : utility
        ),
      });
    });
  }, [viewerApi]);

  useEffect(() => {
    if (project.selectedWorkspaceBoxId) {
      viewerApi.selectBox(project.selectedWorkspaceBoxId);
    } else {
      viewerApi.selectBox(null);
    }
  }, [project.selectedWorkspaceBoxId, viewerApi]);

  useEffect(() => {
    if (!viewerApi.highlightBox) return;
    if (!project.viewerSettings.highlightEnabled) return;
    if (!project.selectedWorkspaceBoxId) return;
    viewerApi.highlightBox(project.selectedWorkspaceBoxId);
  }, [project.viewerSettings.highlightEnabled, project.selectedWorkspaceBoxId, viewerApi]);

  useEffect(() => {
    viewerApi.setOnBoxTransform((boxId, position, rotation) => {
      const project = projectRef.current;
      const box = project.workspaceBoxes.find((b) => b.id === boxId);
      if (box?.locked) return;
      actionsRef.current.updateWorkspaceBoxTransform(boxId, {
        x_mm: mToMm(position.x),
        y_mm: mToMm(position.y),
        z_mm: mToMm(position.z),
        rotacaoX_rad: rotation.x,
        rotacaoY_rad: rotation.y,
        rotacaoZ_rad: rotation.z,
        manualPosition: true,
      });
    });
  }, [viewerApi]);

  // Aplicar ferramenta 3D ativa ao Viewer (select/move/rotate). Só depender de activeViewerTool para não reaplicar a cada mudança de viewerSync (ex.: após rotacionar) e permitir que o gizmo desapareça ao clicar em "Selecionar".
  const viewerSyncRef = useRef(viewerSync);
  // eslint-disable-next-line react-hooks/refs -- intencional: espelho em ref com o `viewerSync` mais recente; o efeito abaixo depende só de activeViewerTool (ver comentário).
  viewerSyncRef.current = viewerSync;
  useEffect(() => {
    const mode = project.activeViewerTool ?? "select";
    viewerSyncRef.current.setActiveTool(mode);
  }, [project.activeViewerTool]);

  const [lockEnabled, setLockEnabledState] = useState(true);
  const [mouseMenuPosition, setMouseMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuLayerTarget, setContextMenuLayerTarget] = useState<MouseMenuTarget | null>(null);
  const handleToolSelect = useCallback((toolId: string) => {
    if (toolId === "select" || toolId === "move" || toolId === "rotate" || toolId === "scale") {
      actions.setActiveTool(toolId);
    }
  }, [actions]);
  const toggleLock = useCallback(() => {
    const next = !lockEnabled;
    setLockEnabledState(next);
    viewerSync.setLockEnabled(next);
    if (!next && project.selectedWorkspaceBoxId) {
      actions.updateWorkspaceBoxTransform(project.selectedWorkspaceBoxId, { manualPosition: true });
    }
  }, [lockEnabled, viewerSync, project.selectedWorkspaceBoxId, actions]);

const hasShownViewerReadyToastRef = useRef(false);

  useEffect(() => {
    const settings = project.viewerSettings;
    viewerApi.setPanelEdgesVisible?.(settings.showPanelEdges);
    viewerApi.setAllPanelsHidden?.(settings.hideAllPanels);
    if (viewerApi.setHiddenPanels) {
      viewerApi.setHiddenPanels(settings.hiddenPanels);
    } else {
      const panels: Array<"left" | "right" | "top" | "bottom" | "back"> = ["left", "right", "top", "bottom", "back"];
      panels.forEach((panel) => {
        viewerApi.setPanelHidden?.(panel, settings.hiddenPanels.includes(panel));
      });
    }
    viewerApi.setRoomCeilingVisible?.(settings.showCeiling);
    viewerApi.setWallEditMode?.(settings.wallEditMode);
    viewerApi.setMousePreset?.(settings.mousePreset);
    if (!photoModePanelOpen) {
      viewerApi.setBackgroundMode?.(settings.backgroundMode);
      // Ultra só no Photo Mode: desligar primeiro para não sobrescrever o preset com o restore do Ultra.
      viewerApi.setUltraPerformanceModeOptions?.({
        ...settings.ultraPerformanceModeOptions,
        enabled: false,
      });
      viewerApi.setUltraPerformanceMode?.(false);
      viewerApi.setMaterialQuality?.(settings.materialQuality);
      viewerApi.setReflectionsEnabled?.(settings.enableReflections);
      viewerApi.setShowcaseMode?.(
        shouldEnableShowcaseForQualitySettings({
          materialQuality: settings.materialQuality,
          enableReflections: settings.enableReflections,
        })
      );
      viewerApi.setGlobalLightIntensity?.(settings.globalLightIntensity);
      viewerApi.setShadowIntensity?.(settings.shadowIntensity);
      viewerApi.setGlossIntensity?.(settings.glossIntensity);
      viewerApi.setMatteMode?.(settings.matteMode);
    }
    viewerApi.setPhotoModeEnabled?.(settings.photoModeEnabled);
    viewerApi.setExplodedViewEnabled?.(settings.explodedViewEnabled);
    viewerApi.setExplodedViewIntensity?.(settings.explodedViewIntensity);
    viewerApi.setHighlightEnabled?.(settings.highlightEnabled);
    // Régua unificada: um único modo canónico (`rulerEnabled` → MeasurementEngine.setEnabled).
    viewerApi.setMeasurementMode?.(settings.rulerEnabled);
    viewerApi.setPanelRenderingEnabled?.(settings.panelRenderingEnabled);
  }, [project.viewerSettings, viewerApi, photoModePanelOpen]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    if (!viewerReady) return;
    const core = viewerApi;
    core?.bindInternalMeasurementBridge?.(
      () => projectRef.current.measurements?.unified ?? [],
      (entry) => actionsRef.current.addUnifiedMeasurement(entry)
    );
    core?.bindAutoLayoutBridge?.({
      getWorkspaceBoxes: () => projectRef.current.workspaceBoxes,
      applyPlan: (plan) => actionsRef.current.applyAutoLayoutPlan(plan),
      runProjectRoomFill: () => {
        actionsRef.current.runKitchenLayout30();
        return true;
      },
      getRoomLabelHint: () =>
        projectRef.current.autoFill?.layoutSummary ??
        projectRef.current.projectName ??
        undefined,
    });
    if (ORLA_VIEWER_RENDERING_ENABLED) {
      core?.bindOrlaBridge?.({
        getBoxOrlaConfig: (boxId) => {
          const state = projectRef.current;
          const wsBox = state.workspaceBoxes.find((b) => b.id === boxId);
          const boxesWithCut = buildBoxesWithCutList(state);
          const box = boxesWithCut.find((b) => b.id === boxId);
          if (!box) return null;
          const presets = normalizeOrlaPresets(state.orlaPresets);
          const pieces = (box.cutList ?? []).map((item) => {
            const panelId =
              typeof item.metadata?.panelId === "string" && item.metadata.panelId.trim().length > 0
                ? item.metadata.panelId
                : item.id;
            return {
              pieceId: panelId,
              panelType: item.tipo,
              config: resolvePieceOrlaConfig(
                panelId,
                state.orlaPieces,
                wsBox?.orlaPresetId,
                presets
              ),
            };
          });
          return { boxId, pieces, presets };
        },
      });
    } else {
      // Limpa meshes de orla de projetos antigos; sem criar novos.
      core?.bindOrlaBridge?.(null);
      core?.syncOrlaVisuals?.();
    }
    const buildFinishBoxDims = (boxId: string) => {
      const state = projectRef.current;
      const wsBox = state.workspaceBoxes.find((b) => b.id === boxId);
      if (!wsBox) return null;
      const dimsRaw = core?.getBoxDimensions?.(boxId);
      const dims =
        dimsRaw &&
        typeof dimsRaw === "object" &&
        "width" in dimsRaw &&
        "height" in dimsRaw &&
        "depth" in dimsRaw
          ? (dimsRaw as { width: number; height: number; depth: number })
          : null;
      return {
        boxId,
        widthM: dims?.width ?? Math.max(0.001, (wsBox.dimensoes?.largura ?? 600) / 1000),
        heightM: dims?.height ?? Math.max(0.001, (wsBox.dimensoes?.altura ?? 720) / 1000),
        depthM: dims?.depth ?? Math.max(0.001, (wsBox.dimensoes?.profundidade ?? 600) / 1000),
      };
    };

    const getBoxWorldMatrix = (boxId: string) => core?.getBoxWorldMatrix?.(boxId) ?? null;

    core?.bindRemateBridge?.({
      listRematePieces: () => projectRef.current.remates ?? [],
      getBoxConfig: (boxId) => {
        const dims = buildFinishBoxDims(boxId);
        if (!dims) return null;
        const wsBox = projectRef.current.workspaceBoxes.find((b) => b.id === boxId);
        return {
          ...dims,
          box: wsBox
            ? {
                cabinetType: wsBox.cabinetType,
                feetEnabled: wsBox.feetEnabled,
                feetHeight: wsBox.feetHeight,
                pe_cm: wsBox.pe_cm,
              }
            : undefined,
        };
      },
      getBoxWorldMatrix,
    });

    core?.setOnMultiSelectToggle?.((encodedId) => {
      const decoded = decodeSelectionId(encodedId);
      if (!decoded) return;
      toggleSelectedObject(encodedId);
      const selected = uiStore.getState().selectedObjects;
      if (decoded.kind === "box") {
        const boxId = decoded.id;
        multiSelectedBoxIdsRef.current = selected
          .filter((id) => id.startsWith("box:"))
          .map((id) => id.replace(/^box:/, ""));
        if (selected.includes(encodedId)) {
          actionsRef.current.selectBox(boxId);
          setSelectedObject({ type: "box", id: boxId });
        } else {
          const fallback = multiSelectedBoxIdsRef.current[multiSelectedBoxIdsRef.current.length - 1];
          if (fallback) {
            actionsRef.current.selectBox(fallback);
            setSelectedObject({ type: "box", id: fallback });
          } else {
            actionsRef.current.clearSelection();
            clearUiSelection();
          }
        }
        return;
      }
      if (decoded.kind === "remate") {
        multiSelectedBoxIdsRef.current = selected
          .filter((id) => id.startsWith("box:"))
          .map((id) => id.replace(/^box:/, ""));
        if (selected.includes(encodedId)) {
          if (projectRef.current.selectedWorkspaceBoxId) {
            actionsRef.current.clearSelection();
          }
          setSelectedObject({ type: "remate", id: decoded.id });
        } else {
          const current = uiStore.getState().selectedObject;
          if (current.type === "remate" && current.id === decoded.id) {
            clearUiSelection();
          }
        }
        return;
      }
      if (decoded.kind === "rodape") {
        if (selected.includes(encodedId)) {
          if (projectRef.current.selectedWorkspaceBoxId) {
            actionsRef.current.clearSelection();
          }
          setSelectedObject({ type: "rodape", id: decoded.id });
        } else {
          const current = uiStore.getState().selectedObject;
          if (current.type === "rodape" && current.id === decoded.id) {
            clearUiSelection();
          }
        }
        return;
      }
      if (decoded.kind === "door" || decoded.kind === "drawer") {
        const layerId = decoded.id;
        const box = projectRef.current.workspaceBoxes.find((b) => {
          if (decoded.kind === "door") {
            return (b.doorsLayer ?? []).some((d) => d.id === layerId);
          }
          return (b.drawersLayer ?? []).some((d) => d.id === layerId);
        });
        if (box && selected.includes(encodedId)) {
          actionsRef.current.selectBox(box.id);
          setSelectedObject({ type: "box", id: box.id });
        }
      }
    });

    core?.setOnRemateSelected?.((remateId) => {
      if (remateId) {
        if (projectRef.current.selectedWorkspaceBoxId) {
          actionsRef.current.clearSelection();
        }
        setSelectedObject({ type: "remate", id: remateId });
        setSelectedTool("home");
        return;
      }
      if (uiStore.getState().selectedObject.type === "remate") {
        clearUiSelection();
      }
    });

    core?.setOnRodapeSelected?.((rodapeId) => {
      if (rodapeId) {
        if (projectRef.current.selectedWorkspaceBoxId) {
          actionsRef.current.clearSelection();
        }
        setSelectedObject({ type: "rodape", id: rodapeId });
        setSelectedTool("home");
        return;
      }
      if (uiStore.getState().selectedObject.type === "rodape") {
        clearUiSelection();
      }
    });

    const buildHematiBoxConfig = (boxId: string) => {
      const dims = buildFinishBoxDims(boxId);
      if (!dims) return null;
      const hematis = (projectRef.current.hematis ?? []).filter((h) => h.parentBoxId === boxId);
      return { ...dims, hematis };
    };

    const buildRodapeBoxConfig = (boxId: string) => {
      const dims = buildFinishBoxDims(boxId);
      if (!dims) return null;
      const rodapes = (projectRef.current.rodapes ?? []).filter((r) => r.parentBoxId === boxId);
      return { ...dims, rodapes };
    };

    core?.bindHematiBridge?.({
      getBoxHematiConfig: (boxId) => buildHematiBoxConfig(boxId),
      listBoxHematiConfigs: () =>
        projectRef.current.workspaceBoxes
          .map((box) => buildHematiBoxConfig(box.id))
          .filter((cfg): cfg is NonNullable<typeof cfg> => cfg != null && cfg.hematis.length > 0),
      getBoxWorldMatrix,
    });

    core?.bindRodapeBridge?.({
      getBoxRodapeConfig: (boxId) => buildRodapeBoxConfig(boxId),
      listBoxRodapeConfigs: () =>
        projectRef.current.workspaceBoxes
          .map((box) => buildRodapeBoxConfig(box.id))
          .filter((cfg): cfg is NonNullable<typeof cfg> => cfg != null && cfg.rodapes.length > 0),
      getBoxWorldMatrix,
    });

    core?.bindDivSepBridge?.({
      getDivSepDragContext: (boxId, kind, itemId) => {
        const ws = projectRef.current.workspaceBoxes.find((b) => b.id === boxId);
        if (!ws) return null;
        const box = {
          dimensoes: ws.dimensoes,
          espessura: ws.espessura,
          profundidadeExterna: ws.profundidadeExterna ?? ws.dimensoes.profundidade,
          portaTipo: ws.portaTipo,
          doorsLayer: ws.doorsLayer,
          costaAtiva: ws.costaAtiva,
          divisores: ws.divisores,
          separadores: ws.separadores,
        };
        if (kind === "div") {
          const item = (ws.divisores ?? []).find((d) => d.id === itemId);
          return item ? { box, item } : null;
        }
        const item = (ws.separadores ?? []).find((s) => s.id === itemId);
        return item ? { box, item } : null;
      },
    });

    core?.setOnRemateTransform?.((remateId, patch) => {
      actionsRef.current.updateRemate(remateId, patch);
    });
    core?.setOnHematiTransform?.((hematiId, patch) => {
      actionsRef.current.updateHemati(hematiId, patch);
    });
    core?.setOnRodapeTransform?.((rodapeId, patch) => {
      actionsRef.current.updateRodape(rodapeId, patch);
    });
    core?.setOnDivSepTransform?.(({ boxId, kind, itemId, positionMm }) => {
      actionsRef.current.selectBox(boxId);
      if (kind === "div") {
        actionsRef.current.updateDivisor(itemId, { positionMm });
      } else {
        actionsRef.current.updateSeparador(itemId, { positionMm });
      }
    });
  }, [viewerReady, setSelectedObject, setSelectedTool, clearUiSelection, viewerApi]);

  useEffect(() => {
    if (!viewerReady) return;
    viewerApi.syncOrlaVisuals?.();
    viewerApi.syncRemateVisuals?.();
    viewerApi.syncHematiVisuals?.();
    viewerApi.syncRodapeVisuals?.();
    if (viewerApi.getTransformControlsDragging?.()) return;
    viewerApi.refreshTransformControlsAttachment?.();
  }, [
    project.orlaPieces,
    project.orlaPresets,
    project.remates,
    project.hematis,
    project.rodapes,
    project.room,
    project.workspaceBoxes,
    project.boxes,
    settings.orlaRules,
    viewerReady,
    viewerApi,
  ]);

  useEffect(() => {
    if (!viewerReady) return;
    viewerApi.internalRuler?.syncFromProject?.(project.measurements?.unified ?? []);
  }, [project.measurements?.unified, viewerReady, viewerApi.internalRuler]);

  useEffect(() => {
    const clearKeyboardMoveTimers = () => {
      const state = keyboardMoveRef.current;
      if (state.accelTimeoutId != null) {
        window.clearTimeout(state.accelTimeoutId);
        state.accelTimeoutId = null;
      }
      if (state.repeatIntervalId != null) {
        window.clearInterval(state.repeatIntervalId);
        state.repeatIntervalId = null;
      }
      state.activeKey = null;
    };

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || target.isContentEditable;
    };

    const performRemateMoveStep = (
      remateId: string,
      key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
      stepMm: number,
      shiftKey = false
    ) => {
      viewerApi.applyRemateKeyboardTransform?.(remateId, key, { stepMm, shiftKey });
    };

    const performRodapeMoveStep = (
      rodapeId: string,
      key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
      stepMm: number
    ) => {
      const rodape = projectRef.current.rodapes?.find((r) => r.id === rodapeId);
      if (!rodape) return;

      const stepM = stepMm / 1000;
      let localU = 0;
      let localV = 0;
      if (key === "ArrowUp") localV = stepM;
      else if (key === "ArrowDown") localV = -stepM;
      else if (key === "ArrowLeft") localU = -stepM;
      else localU = stepM;

      const transform = rodape.transform ?? {
        xMm: 0,
        yMm: 0,
        zMm: 0,
        rotacaoXRad: 0,
        rotacaoYRad: 0,
        rotacaoZRad: 0,
      };
      const yaw = transform.rotacaoYRad ?? 0;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const delta = new Vector3(
        localU * cos - localV * sin,
        localV,
        localU * sin + localV * cos
      );

      let nextTransform = { ...transform };

      if (rodape.parentBoxId) {
        const worldMatrix = viewerApi.getBoxWorldMatrix?.(rodape.parentBoxId) as Matrix4 | undefined;
        if (worldMatrix) {
          const inv = new Matrix4().copy(worldMatrix).invert();
          const deltaLocal = delta.clone().applyMatrix4(inv);
          nextTransform = {
            ...transform,
            xMm: transform.xMm + deltaLocal.x * 1000,
            yMm: transform.yMm + deltaLocal.y * 1000,
            zMm: transform.zMm + deltaLocal.z * 1000,
          };
        }
      } else {
        nextTransform = {
          ...transform,
          xMm: transform.xMm + delta.x * 1000,
          yMm: transform.yMm + delta.y * 1000,
          zMm: transform.zMm + delta.z * 1000,
        };
      }

      const current = projectRef.current;
      const nextPatch = { transform: nextTransform, placementFree: true as const };
      projectRef.current = {
        ...current,
        rodapes: (current.rodapes ?? []).map((r) =>
          r.id === rodapeId ? { ...r, ...nextPatch } : r
        ),
      };
      actionsRef.current.updateRodape(rodapeId, nextPatch);
      viewerApi.syncRodapeVisuals?.();
      viewerApi.resolveFinishCollisionAfterSync?.({ rodapeId });
    };

    const performMoveStep = (key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight", stepMm: number) => {
      const currentProject = projectRef.current;
      const boxId = currentProject.selectedWorkspaceBoxId;
      if (!boxId) return;
      const box = currentProject.workspaceBoxes.find((b) => b.id === boxId);
      if (!box || box.locked) return;
      const delta =
        key === "ArrowUp"
          ? { x: 0, y: stepMm }
          : key === "ArrowDown"
            ? { x: 0, y: -stepMm }
            : key === "ArrowLeft"
              ? { x: -stepMm, y: 0 }
              : { x: stepMm, y: 0 };
      actionsRef.current.updateWorkspaceBoxTransform(boxId, {
        x_mm: (box.posicaoX_mm ?? 0) + delta.x,
        y_mm: (box.posicaoY_mm ?? 0) + delta.y,
        manualPosition: true,
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      ctrlOrMetaPressedRef.current = event.ctrlKey || event.metaKey;
      const keyLower = event.key.toLowerCase();
      if (event.key === "Alt" && !event.repeat) {
        event.preventDefault();
        setShowKeyboardShortcutsHelp((prev) => !prev);
        return;
      }
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (ctrlOrMeta && !event.altKey && keyLower === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          actionsRef.current.redo();
        } else {
          actionsRef.current.undo();
        }
        return;
      }
      if (ctrlOrMeta && !event.altKey && keyLower === "y") {
        event.preventDefault();
        actionsRef.current.redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const uiSelection = uiStore.getState().selectedObject;
        if (uiSelection.type === "remate") {
          actionsRef.current.removeRemate(uiSelection.id);
          clearUiSelection();
          return;
        }
        const currentProject = projectRef.current;
        const validIds = new Set(currentProject.workspaceBoxes.map((box) => box.id));
        const multiSelectionIds = selectedObjects.length > 0
          ? selectedObjects
          : multiSelectedBoxIdsRef.current
              .filter((id) => validIds.has(id))
              .map((id) => boxSelectionId(id));
        const boxIdsToDelete = multiSelectionIds
          .map((encoded) => encoded.replace(/^box:/, ""))
          .filter((id) => validIds.has(id));
        const selectedId = currentProject.selectedWorkspaceBoxId;
        const idsToDelete = boxIdsToDelete.length > 0
          ? Array.from(new Set(boxIdsToDelete))
          : selectedId
            ? [selectedId]
            : [];
        if (idsToDelete.length === 0) {
          if (multiSelectionIds.some((id) => id.startsWith("remate:"))) {
            for (const encoded of multiSelectionIds.filter((id) => id.startsWith("remate:"))) {
              actionsRef.current.removeRemate(encoded.replace(/^remate:/, ""));
            }
            clearUiSelection();
            setSelectedObjects([]);
          }
          return;
        }
        for (const boxId of idsToDelete) {
          actionsRef.current.removeWorkspaceBoxById(boxId);
        }
        multiSelectedBoxIdsRef.current = [];
        setSelectedObjects([]);
        return;
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const key = event.key;
      const state = keyboardMoveRef.current;
      if (state.activeKey === key) return;
      clearKeyboardMoveTimers();
      state.activeKey = key;

      const uiSelection = uiStore.getState().selectedObject;
      const finishStepMm = 1;
      if (uiSelection.type === "remate") {
        performRemateMoveStep(uiSelection.id, key, finishStepMm, event.shiftKey);
        state.accelTimeoutId = window.setTimeout(() => {
          state.repeatIntervalId = window.setInterval(() => {
            if (keyboardMoveRef.current.activeKey !== key) return;
            performRemateMoveStep(uiSelection.id, key, finishStepMm, event.shiftKey);
          }, 40);
        }, 200);
        return;
      }
      if (uiSelection.type === "rodape") {
        performRodapeMoveStep(uiSelection.id, key, finishStepMm);
        state.accelTimeoutId = window.setTimeout(() => {
          state.repeatIntervalId = window.setInterval(() => {
            if (keyboardMoveRef.current.activeKey !== key) return;
            performRodapeMoveStep(uiSelection.id, key, finishStepMm);
          }, 40);
        }, 200);
        return;
      }

      performMoveStep(key, 1);
      state.accelTimeoutId = window.setTimeout(() => {
        state.repeatIntervalId = window.setInterval(() => {
          if (keyboardMoveRef.current.activeKey !== key) return;
          performMoveStep(key, 10);
        }, 40);
      }, 200);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      ctrlOrMetaPressedRef.current = event.ctrlKey || event.metaKey;
      const state = keyboardMoveRef.current;
      if (state.activeKey == null) return;
      if (event.key !== state.activeKey) return;
      clearKeyboardMoveTimers();
    };

    const handleWindowBlur = () => {
      ctrlOrMetaPressedRef.current = false;
      clearKeyboardMoveTimers();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      clearKeyboardMoveTimers();
    };
  }, [viewerApi]);

  const workspacePositionKey = useMemo(
    () => JSON.stringify(project.workspaceBoxes.map((b) => [b.id, b.posicaoX_mm, b.posicaoY_mm, b.posicaoZ_mm])),
    [project.workspaceBoxes]
  );

  const prevBoxesRef = useRef<string>("");
  useEffect(() => {
    const key = workspacePositionKey;
    if (project.estaCarregando) {
      prevBoxesRef.current = key;
      return;
    }
    prevBoxesRef.current = key;
  }, [workspacePositionKey, project.estaCarregando]);

  useEffect(() => {
    if (viewerReady) {
      if (!hasShownViewerReadyToastRef.current) {
        hasShownViewerReadyToastRef.current = true;
        showToast("Viewer pronto.", "info", 1400);
      }
    } else {
      hasShownViewerReadyToastRef.current = false;
    }
  }, [viewerReady, showToast]);

return (
    <>
    <main
      className="workspace-root"
      style={{ position: "relative", zIndex: 0 }}
      aria-label="Área de design 3D"
      onPointerDown={() => {
        if (mouseMenuPosition) setMouseMenuPosition(null);
        setContextMenuLayerTarget(null);
        setContextSelectedBoxIds([]);
      }}
    >
      <div className="workspace-canvas">
        <div className="workspace-toolbars" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <UnifiedTopToolbar
            onNovo={handleTopToolbarNovo}
            onProjetos={handleTopToolbarProjetos}
            activeTool={project.activeViewerTool ?? "select"}
            onToolSelect={(toolId, _eventKey) => handleToolSelect(toolId)}
            lockEnabled={lockEnabled}
            onToggleLock={toggleLock}
          />
          <ViewerToolbar confirmNewOpen={confirmNewOpen} setConfirmNewOpen={setConfirmNewOpen} />
        </div>
<div className="workspace-viewer" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
          <div
            ref={viewerSurfaceRef}
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              ref={containerRef}
              onPointerDownCapture={(event) => {
                ctrlOrMetaPressedRef.current = event.ctrlKey || event.metaKey;
                pointerToggleSelectionRef.current = event.ctrlKey || event.metaKey;
              }}
              onMouseDownCapture={(event) => {
                pointerToggleSelectionRef.current = event.ctrlKey || event.metaKey;
              }}
              onClickCapture={(event) => {
                pointerToggleSelectionRef.current = event.ctrlKey || event.metaKey;
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                const hit = viewerApi.getContextMenuLayerHit?.(event) ?? null;
                if (import.meta.env.DEV && hit?.type === "door" && hit.doorLayerId) {
                  devLogger.debug("[DOOR-MAT] Workspace onContextMenu — hit recebido (será usado no menu)", {
                    boxId: hit.boxId,
                    doorLayerId: hit.doorLayerId,
                    type: hit.type,
                  });
                }
                setContextMenuLayerTarget(hit);
                setContextSelectedBoxIds([...multiSelectedBoxIdsRef.current]);
                setMouseMenuPosition({ x: event.clientX, y: event.clientY });
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                overflow: "hidden",
              }}
            />
            <SelectionMarquee
              containerRef={containerRef}
              enabled={(project.activeViewerTool ?? "select") === "select" && viewerReady}
              canStartAtPointer={(event) => {
                return viewerApi.isPointerOnSelectableObject?.({
                  clientX: event.clientX,
                  clientY: event.clientY,
                }) !== true;
              }}
              getIdsInRect={(rect) => {
                const canvas = containerRef.current?.querySelector("canvas");
                if (!canvas || !viewerApi.getSelectionIdsInScreenRect) return [];
                return viewerApi.getSelectionIdsInScreenRect(rect, canvas);
              }}
              onSelectionComplete={(ids) => {
                setSelectedObjects(ids);
                multiSelectedBoxIdsRef.current = ids
                  .map((encoded) => encoded.replace(/^box:/, ""))
                  .filter((id) => projectRef.current.workspaceBoxes.some((b) => b.id === id));
                const lastBox = multiSelectedBoxIdsRef.current[multiSelectedBoxIdsRef.current.length - 1];
                if (lastBox) {
                  actions.selectBox(lastBox);
                  setSelectedObject({ type: "box", id: lastBox });
                }
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <BoxInfoOverlay />
              <InternalMeasurementsPanel />
              <IndustrialDesignPanel />
            </div>
          </div>
          {!viewerReady && (
            <div className="workspace-loading-overlay" aria-live="polite">
              <span className="workspace-loading-spinner" aria-hidden="true" />
              <span>A carregar viewer 3D...</span>
            </div>
          )}
          {mouseMenuPosition && (
            <ContextMenu
              position={mouseMenuPosition}
              onClose={() => {
                setMouseMenuPosition(null);
                setContextMenuLayerTarget(null);
                setContextSelectedBoxIds([]);
              }}
              contextMenuLayerTarget={contextMenuLayerTarget}
              onDoorMaterialChange={(boxId, doorLayerId, materialId) => {
                if (import.meta.env.DEV) {
                  devLogger.debug("[DOOR-MAT] 1 Workspace.onDoorMaterialChange", { boxId, doorLayerId, materialId, when: "before setState" });
                }
                actions.setDoorMaterial(boxId, doorLayerId, materialId);
                viewerApi.updateDoorMaterial?.(boxId, doorLayerId, materialId);
                if (import.meta.env.DEV) {
                  devLogger.debug("[DOOR-MAT] 2 Workspace.onDoorMaterialChange done (viewer updated)", { boxId, doorLayerId, materialId });
                }
              }}
              onDrawerMaterialChange={(boxId, drawerLayerId, materialId) => {
                actions.setDrawerMaterial(boxId, drawerLayerId, materialId);
                viewerApi.updateDrawerMaterial?.(boxId, drawerLayerId, materialId);
              }}
              selectedBoxIds={contextSelectedBoxIds}
              selectedObjectIds={selectedObjects}
            />
          )}
          {showKeyboardShortcutsHelp && (
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 120,
                minWidth: 260,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(8, 12, 26, 0.92)",
                color: "var(--text-main)",
                fontSize: 12,
                lineHeight: 1.45,
                pointerEvents: "none",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Atalhos do teclado</div>
              <div>Ctrl+Z: Desfazer</div>
              <div>Ctrl+Y: Refazer</div>
              <div>Delete/Backspace: Excluir seleção</div>
              <div>Ctrl+Click: Adicionar/remover da seleção</div>
              <div>Setas: Mover caixa selecionada</div>
              <div>Alt: Mostrar/ocultar esta ajuda</div>
            </div>
          )}
        </div>
      </div>
    </main>
    </>
  );
}

