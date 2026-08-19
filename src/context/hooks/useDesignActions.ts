import { useMemo } from "react";
import { getCurrentProjectUser } from "../../core/projects/currentUser";
import { saveProject } from "../../core/projects/projectsClient";
import { isValidThumbnailDataUrl } from "../../core/projects/projectThumbnail";
import type { ProjectActions, ProjectSnapshot, ProjectState } from "../projectTypes";
import {
  appendChangelog,
  buildBoxesFromWorkspace,
  buildDesignState,
  createWorkspaceBox,
  getSelectedWorkspaceBox,
} from "../projectState";
import { captureRoomSnapshot, serializeState } from "../projectPersistence";
import { getNextWorkspaceBoxId } from "../projectHelpers";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";

export type DesignActions = Pick<ProjectActions, "gerarDesign" | "gerarESalvarDesign" | "recalculateAllBoxes">;

export function useDesignActions(ctx: ProjectActionsExecutionContext): DesignActions {
  const { updateProject, setProject, viewerSync, applyResultados, projectRef } = ctx;

  return useMemo(() => {
    const buildGeneratedState = (prev: ProjectState): ProjectState => {
      let prevAdjusted = prev;
      if (!prev.workspaceBoxes || prev.workspaceBoxes.length === 0) {
        const { id: newBoxId } = getNextWorkspaceBoxId(prev.workspaceBoxes);
        const newBox = createWorkspaceBox(
          newBoxId,
          "Caixa 1",
          prev.dimensoes,
          prev.material.espessura,
          0,
          []
        );
        prevAdjusted = {
          ...prev,
          workspaceBoxes: [newBox],
          selectedWorkspaceBoxId: newBox.id,
          selectedCaixaId: newBox.id,
          selectedBoxId: newBox.id,
        };
      }
      const boxes = buildBoxesFromWorkspace(prevAdjusted);
      const selectedWorkspace = getSelectedWorkspaceBox(prevAdjusted);
      const selectedBoxId =
        boxes.find((box) => box.id === selectedWorkspace?.id)?.id ?? boxes[0]?.id ?? "";
      const nextState = {
        ...prevAdjusted,
        boxes,
        selectedBoxId,
        dimensoes:
          selectedWorkspace?.dimensoes ??
          boxes.find((box) => box.id === selectedBoxId)?.dimensoes ??
          prevAdjusted.dimensoes,
      };
      return {
        ...nextState,
        ...buildDesignState(nextState),
        changelog: appendChangelog(prev.changelog, {
          timestamp: new Date(),
          type: "calc",
          message: prev.workspaceBoxes?.length
            ? "Caixotes recalculados e projeto guardado"
            : "Nova caixa criada, design gerado e projeto guardado",
        }),
      };
    };

    const a = {} as DesignActions;

    a.gerarDesign = () => {
      updateProject(
        (prev) => {
          try {
            return buildGeneratedState(prev);
          } catch (error) {
            return {
              ...prev,
              design: null,
              cutList: null,
              cutListComPreco: null,
              estrutura3D: null,
              acessorios: null,
              precoTotalPecas: null,
              precoTotalAcessorios: null,
              precoTotalProjeto: null,
              estaCarregando: false,
              erro: error instanceof Error ? error.message : "Erro ao gerar design",
            };
          }
        },
        true
      );
    };

    a.gerarESalvarDesign = async () => {
      let generatedState: ProjectState | null = null;
      updateProject(
        (prev) => {
          try {
            const next = buildGeneratedState(prev);
            generatedState = next;
            return next;
          } catch (error) {
            return {
              ...prev,
              erro: error instanceof Error ? error.message : "Erro ao gerar design",
            };
          }
        },
        true
      );

      if (!generatedState) return;

      let thumbnailDataUrl: string | null = null;
      try {
        const render = await viewerSync.renderScene({
          size: "medium",
          background: "white",
          mode: "pbr",
          preset: "iso1",
          watermark: false,
          shadowIntensity: 1,
          format: "jpg",
          quality: 0.9,
          advancedRealism: true,
        });
        const raw = render?.dataUrl ?? null;
        thumbnailDataUrl = raw && isValidThumbnailDataUrl(raw) ? raw : null;
      } catch {
        thumbnailDataUrl = null;
      }

      const snapshot: ProjectSnapshot = {
        projectState: serializeState(generatedState),
        viewerSnapshot: viewerSync.saveViewerSnapshot(),
        roomSnapshot: captureRoomSnapshot(projectRef.current.room),
      };
      const currentUser = getCurrentProjectUser();
      const currentProjectId = projectRef.current.currentProjectId ?? undefined;
      let saved: Awaited<ReturnType<typeof saveProject>> = null;
      try {
        saved = await saveProject({
          name: generatedState.projectName,
          ownerId: currentUser.ownerId,
          ownerName: currentUser.ownerName,
          snapshot,
          thumbnailDataUrl,
          localProjectId: currentProjectId,
        });
      } catch (err) {
        console.warn("[SYNC] gerarESalvarDesign: saveProject falhou, seguindo fluxo", err);
      }

      setProject((prev) => ({
        ...prev,
        lastAutosaveTime: saved?.updatedAt ?? new Date().toISOString(),
        currentProjectId: saved?.id ?? prev.currentProjectId ?? null,
      }));
    };

    a.recalculateAllBoxes = () => {
      updateProject((prev) => applyResultados(prev), true);
    };

    return a;
  }, [updateProject, setProject, viewerSync, applyResultados, projectRef]);
}
