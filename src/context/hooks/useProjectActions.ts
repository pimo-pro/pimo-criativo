/**
 * Hook compositor de ações do projeto.
 * Mantém apenas composição de hooks por domínio.
 */

import { useMemo } from "react";
import type { ProjectActions, ProjectState } from "../projectTypes";
import { applyResultados, appendChangelog, recomputeState } from "../projectState";
import { useHistoryActions } from "./useHistoryActions";
import { useProjectIoActions } from "./useProjectIoActions";
import { useLayerActions } from "./useLayerActions";
import { useDivSepActions } from "./useDivSepActions";
import { useBoxCrudActions } from "./useBoxCrudActions";
import { useBoxTransformActions } from "./useBoxTransformActions";
import { useRulesActions } from "./useRulesActions";
import { useViewerUiActions } from "./useViewerUiActions";
import { useInternalMeasurementActions } from "./useInternalMeasurementActions";
import { useDesignActions } from "./useDesignActions";
import { useRoomActions } from "./useRoomActions";
import { useOrlaActions } from "./useOrlaActions";
import { useObservacoesActions } from "./useObservacoesActions";
import { useIndustrialPieceEditsActions } from "./useIndustrialPieceEditsActions";
import { useIndustrialDocumentOverridesActions } from "./useIndustrialDocumentOverridesActions";
import { useDrawerPresetActions } from "./useDrawerPresetActions";
import { useRemateActions } from "./useRemateActions";
import { useCornerOrientationActions } from "./useCornerOrientationActions";
import { useHematiActions } from "./useHematiActions";
import { useRodapeActions } from "./useRodapeActions";
import { useAutoRoomFillActions } from "./useAutoRoomFillActions";
import { useSelectionTransformActions } from "./useSelectionTransformActions";
import { useGroupActions } from "./useGroupActions";
import { useMeasurementAnchorActions } from "./useMeasurementAnchorActions";
import { commitMaterialSync, refreshViewerAfterMaterialSync } from "../../core/materials/materialSync";
import { normalizeFinanceiroOverrides } from "../../core/financeiro/financeiroUnificadoTypes";
import { normalizeFinanceiroAdminSettings } from "../../core/financeiro/financeiroAdminRules";

export type UseProjectActionsParams = {
  updateProject: (_fn: (_prev: ProjectState) => ProjectState, _pushUndo?: boolean) => void;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  viewerSync: import("../projectTypes").ViewerSync;
  exportActions: ReturnType<typeof import("./useProjectExportActions").useProjectExportActions>;
  undoStackRef: React.MutableRefObject<ProjectState[]>;
  redoStackRef: React.MutableRefObject<ProjectState[]>;
  projectRef: React.MutableRefObject<ProjectState>;
};

export function useProjectActions(params: UseProjectActionsParams): ProjectActions {
  const { updateProject, setProject, viewerSync, exportActions, undoStackRef, redoStackRef, projectRef } =
    params;

  const executionContext = useMemo(
    () => ({
      updateProject,
      setProject,
      viewerSync,
      undoStackRef,
      redoStackRef,
      projectRef,
      recomputeState,
      applyResultados,
      appendChangelog,
    }),
    [updateProject, setProject, viewerSync, undoStackRef, redoStackRef, projectRef]
  );

  const historyActions = useHistoryActions(executionContext);
  const projectIoActions = useProjectIoActions(executionContext);
  const layerActions = useLayerActions(executionContext);
  const divSepActions = useDivSepActions(executionContext);
  const boxCrudActions = useBoxCrudActions(executionContext);
  const boxTransformActions = useBoxTransformActions(executionContext);
  const rulesActions = useRulesActions(executionContext);
  const viewerUiActions = useViewerUiActions(executionContext);
  const internalMeasurementActions = useInternalMeasurementActions(executionContext);
  const designActions = useDesignActions(executionContext);
  const roomActions = useRoomActions(executionContext);
  const orlaActions = useOrlaActions(executionContext);
  const observacoesActions = useObservacoesActions(executionContext);
  const industrialPieceEditsActions = useIndustrialPieceEditsActions(executionContext);
  const industrialDocumentOverridesActions = useIndustrialDocumentOverridesActions(executionContext);
  const drawerPresetActions = useDrawerPresetActions(executionContext);
  const remateActions = useRemateActions(executionContext);
  const cornerOrientationActions = useCornerOrientationActions(executionContext);
  const hematiActions = useHematiActions(executionContext);
  const rodapeActions = useRodapeActions(executionContext);
  const autoRoomFillActions = useAutoRoomFillActions(executionContext);
  const selectionTransformActions = useSelectionTransformActions(executionContext);
  const groupActions = useGroupActions(executionContext);
  const measurementAnchorActions = useMeasurementAnchorActions(executionContext);

  const coreActions = useMemo(() => {
    const a = {} as ProjectActions;
    a.exportarPDF = exportActions.exportarPDF;
    a.exportarPdfTecnico = exportActions.exportarPdfTecnico;
    a.exportarPdfUnificado = exportActions.exportarPdfUnificado;
    a.logChangelog = (message) => {
      updateProject(
        (prev) => ({
          ...prev,
          changelog: appendChangelog(prev.changelog, {
            timestamp: new Date(),
            type: "doc",
            message,
          }),
        }),
        false
      );
    };
    a.setReadyForProduction = (ready) => {
      updateProject((prev) => ({ ...prev, readyForProduction: ready }), false);
    };
    a.setFinanceiroOverrides = (overrides) => {
      updateProject(
        (prev) => ({
          ...prev,
          financeiroOverrides: normalizeFinanceiroOverrides(overrides),
        }),
        true
      );
    };
    a.setFinanceiroAdminSettings = (settings) => {
      updateProject(
        (prev) => ({
          ...prev,
          financeiroAdminSettings: normalizeFinanceiroAdminSettings(settings),
        }),
        true
      );
    };

    // --- setTipoProjeto ---
    a.setTipoProjeto = (tipo) => {
      updateProject((prev) => ({ ...prev, tipoProjeto: tipo }), false);
    };

    // --- setMaterial ---
    // Atualiza o Material completo + sincroniza materialId se o objeto tiver id
    a.setMaterial = (material) => {
      updateProject(
        (prev) => {
          const { next, sync } = commitMaterialSync(
            prev,
            {
              kind: "project",
              material,
              ...(material && "id" in material && material.id
                ? { materialId: material.id as string }
                : {}),
            },
            true
          );
          refreshViewerAfterMaterialSync(sync);
          return next;
        },
        true
      );
    };

    // --- setEspessura ---
    // Atualiza material.espessura (fonte principal no domínio)
    // A WorkspaceBox.espessura é por caixa — não alterar aqui
    a.setEspessura = (espessura) => {
      updateProject(
        (prev) => ({
          ...prev,
          material: { ...prev.material, espessura },
        }),
        false
      );
    };

    return a;
  }, [exportActions, updateProject]);

  return useMemo(() => {
    const actions = Object.assign(
      {} as ProjectActions,
      coreActions,
      historyActions,
      projectIoActions,
      layerActions,
      divSepActions,
      boxCrudActions,
      boxTransformActions,
      rulesActions,
      viewerUiActions,
      internalMeasurementActions,
      designActions,
      roomActions,
      orlaActions,
      observacoesActions,
      industrialPieceEditsActions,
      industrialDocumentOverridesActions,
      drawerPresetActions,
      remateActions,
      cornerOrientationActions,
      hematiActions,
      rodapeActions,
      autoRoomFillActions,
      selectionTransformActions,
      groupActions,
      measurementAnchorActions
    );

    // @PIMO-KEEP — Runtime validation
    if (import.meta.env.DEV) {
      const requiredActions: (keyof ProjectActions)[] = [
        "createNewProject",
        "selectBox",
        "clearSelection",
        "setActiveTool",
        "setTipoProjeto",
        "setMaterial",
        "setEspessura",
        "setDimensoes",
        "setReadyForProduction",
        "setFinanceiroOverrides",
        "setFinanceiroAdminSettings",
        "setProjectName",
        "setProjectDesigner",
        "setEmpresaExecutora",
        "setMateriaisProjeto",
        "addBox",
        "addWorkspaceBox",
        "addWorkspaceBoxFromCatalog",
        "addWorkspaceBoxFromMoveis",
        "duplicateBox",
        "duplicateWorkspaceBox",
        "duplicateWorkspaceBoxAtOffset",
        "applyAutoLayoutPlan",
        "removeBox",
        "removeWorkspaceBox",
        "removeWorkspaceBoxById",
        "setPortaTipo",
        "setTipoBorda",
        "setTipoFundo",
        "setPrateleiras",
        "setShelfOptions",
        "setGavetas",
        "setEuropeanDrawerConfig",
        "addDoorLayerItem",
        "addDrawerLayerItem",
        "removeDoorLayerItem",
        "removeDrawerLayerItem",
        "updateDoorLayerItem",
        "updateDrawerLayerItem",
        "setDoorLayerItemOpen",
        "setDrawerLayerItemOpen",
        "setDoorMaterial",
        "setDoorAllowPieceRotation",
        "setDoorLockWoodGrain",
        "setDrawerMaterial",
        "setDrawerAllowPieceRotation",
        "setDrawerLockWoodGrain",
        "updateWorkspaceBoxTransform",
        "updateWorkspacePosition",
        "repositionWorkspaceBoxesInsideRoom",
        "setWorkspaceBoxMaterial",
        "setWorkspaceBoxAllowPieceRotation",
        "setWorkspaceBoxLockWoodGrain",
        "setWorkspaceBoxLocked",
        "setWorkspaceBoxCostaMaterial",
        "setWorkspaceBoxSeparadorMaterial",
        "setWorkspaceBoxFrenteFixaMaterial",
        "setWorkspaceBoxNoBackPanel",
        "alignFrontWithNeighbor",
        "alignBottomSelectedBoxes",
        "addInternalMeasurement",
        "removeInternalMeasurement",
        "toggleInternalMeasurementVisibility",
        "showAllInternalMeasurements",
        "hideAllInternalMeasurements",
        "clearInternalMeasurements",
        "addUnifiedMeasurement",
        "removeUnifiedMeasurement",
        "toggleUnifiedMeasurementVisibility",
        "showAllUnifiedMeasurements",
        "hideAllUnifiedMeasurements",
        "clearUnifiedMeasurements",
        "toggleWorkspaceRotation",
        "rotateWorkspaceBox",
        "gerarESalvarDesign",
        "exportarPDF",
        "exportarPdfTecnico",
        "exportarPdfUnificado",
        "listSavedProjects",
        "loadProjectSnapshot",
        "renameProject",
        "deleteProject",
        "mergeSnapshots",
        "undo",
        "redo",
        "goToHistory",
        "updateRulesInProfile",
        "setActiveRulesProfile",
        "addRulesProfile",
        "removeRulesProfile",
        "setRulesProfilesConfig",
        "setViewerSettings",
        "toggleHighlight",
        "toggleRuler",
        "toggleInternalRuler",
        "logChangelog",
        "createBoxRemate",
        "updateRemate",
        "removeRemate",
        "createBoxHemati",
        "updateHemati",
        "removeHemati",
        "createBoxRodape",
        "updateRodape",
        "removeRodape",
        "runAutoRoomFill",
        "runKitchenLayout30",
        "setAutoFillWallSettings",
        "scaleSelectedObjects",
        "duplicateSelectedObjects",
        "deleteSelectedObjects",
        "rotateSelectedObjects",
        "setSelectedObjectsMaterial",
        "createObjectGroup",
        "ungroupObject",
        "addMeasurementAnchor",
        "removeMeasurementAnchor",
      ];

      requiredActions.forEach((key) => {
        if (typeof (actions as Record<string, unknown>)[key] !== "function") {
          console.error(
            `[PIMO] actions.${key} is not a function — runtime crash expected when called from UI`
          );
        }
      });
    }

    return actions;
  }, [
    coreActions,
    historyActions,
    projectIoActions,
    layerActions,
    boxCrudActions,
    boxTransformActions,
    rulesActions,
    viewerUiActions,
    internalMeasurementActions,
    designActions,
    roomActions,
    orlaActions,
    observacoesActions,
    industrialPieceEditsActions,
    industrialDocumentOverridesActions,
    drawerPresetActions,
    remateActions,
    cornerOrientationActions,
    hematiActions,
    rodapeActions,
    autoRoomFillActions,
    selectionTransformActions,
    groupActions,
    measurementAnchorActions,
  ]);
}