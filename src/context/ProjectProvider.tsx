import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { gerarPdfIndustrial } from "../core/export/pdfGenerator";
import type { WorkspaceBox } from "../core/types";
import { ProjectContext } from "./projectContext";
import type {
  ProjectActions,
  ProjectSnapshot,
  ProjectState,
  SavedProjectInfo,
} from "./projectTypes";
import {
  applyResultados,
  appendChangelog,
  buildBoxesFromWorkspace,
  buildDesignState,
  createWorkspaceBox,
  defaultState,
  getModelUrlFromStorage,
  getSelectedWorkspaceBox,
  recomputeState,
} from "./projectState";
import { safeGetItem, safeParseJson, safeSetItem } from "../utils/storage";
import { useViewerSync } from "../hooks/useViewerSync";

const PROJECTS_STORAGE_KEY = "pimo_saved_projects";
const MAX_HISTORY = 40;

type StoredProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: ProjectSnapshot | unknown;
};

const serializeState = (state: ProjectState): unknown => {
  return JSON.parse(
    JSON.stringify(state, (_key, value) => {
      if (value instanceof Date) {
        return { __date: value.toISOString() };
      }
      return value;
    })
  );
};

const reviveState = (snapshot: unknown): ProjectState | null => {
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

  return {
    ...defaultState,
    ...restored,
    material: { ...defaultState.material, ...restored.material },
    dimensoes: { ...defaultState.dimensoes, ...restored.dimensoes },
  };
};

const readStoredProjects = (): StoredProject[] => {
  const raw = safeGetItem(PROJECTS_STORAGE_KEY);
  const parsed = safeParseJson<StoredProject[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item, index) => {
    const now = new Date().toISOString();
    const createdAt = item.createdAt ?? item.updatedAt ?? now;
    const updatedAt = item.updatedAt ?? createdAt;
    return {
      id: item.id ?? `project-${Date.now()}-${index}`,
      name: item.name ?? "Projeto",
      createdAt,
      updatedAt,
      snapshot: item.snapshot ?? {
        projectState: serializeState(defaultState),
        viewerSnapshot: null,
      },
    };
  });
};

const writeStoredProjects = (items: StoredProject[]) => {
  safeSetItem(PROJECTS_STORAGE_KEY, JSON.stringify(items));
};

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectState>(() => applyResultados(defaultState));
  const viewerSync = useViewerSync(project);
  const undoStackRef = useRef<ProjectState[]>([]);
  const redoStackRef = useRef<ProjectState[]>([]);

  const pushState = (state: ProjectState) => {
    const snapshot = reviveState(serializeState(state));
    if (!snapshot) return;
    undoStackRef.current = [snapshot, ...undoStackRef.current].slice(0, MAX_HISTORY);
    redoStackRef.current = [];
  };

  const updateProject = (
    updater: (prev: ProjectState) => ProjectState,
    trackHistory = true
  ) => {
    setProject((prev) => {
      if (trackHistory) {
        pushState(prev);
      }
      return updater(prev);
    });
  };

  const recalcular = (newState: Partial<ProjectState>, withLoading: boolean) => {
    updateProject((prev) => recomputeState(prev, newState, withLoading));
  };

  const actions: ProjectActions = {
    setProjectName: (name) => {
      recalcular({ projectName: name }, true);
    },
    setTipoProjeto: (tipo) => {
      recalcular({ tipoProjeto: tipo }, true);
    },

    setMaterial: (material) => {
      recalcular({ material }, true);
    },

    setEspessura: (espessura) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === prev.selectedWorkspaceBoxId ? { ...box, espessura } : box
        );
        return recomputeState(prev, { workspaceBoxes }, true);
      });
    },

    setDimensoes: (dimensoes) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === prev.selectedWorkspaceBoxId
            ? { ...box, dimensoes: { ...box.dimensoes, ...dimensoes } }
            : box
        );
        return recomputeState(
          prev,
          {
            dimensoes: { ...prev.dimensoes, ...dimensoes },
            workspaceBoxes,
          },
          true
        );
      });
    },

    setQuantidade: (quantidade) => {
      if (quantidade < 1) return;
      recalcular({ quantidade }, true);
    },

    addBox: () => {
      updateProject((prev) => {
        const nextIndex = prev.workspaceBoxes.length + 1;
        const baseEspessura =
          prev.workspaceBoxes.find((box) => box.id === prev.selectedWorkspaceBoxId)
            ?.espessura ?? prev.material.espessura;
        const dimensoes = prev.dimensoes;
        const newBox = createWorkspaceBox(
          `box-${nextIndex}`,
          `Caixa ${nextIndex}`,
          dimensoes,
          baseEspessura,
          0,
          null
        );
        return recomputeState(
          prev,
          {
            workspaceBoxes: [...prev.workspaceBoxes, newBox],
            selectedWorkspaceBoxId: newBox.id,
            selectedCaixaId: newBox.id,
            selectedCaixaModelUrl: null,
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "box",
              message: `Caixote criado: ${newBox.nome}`,
            }),
          },
          true
        );
      });
    },

    addWorkspaceBox: () => {
      actions.addBox();
    },

    duplicateBox: () => {
      updateProject((prev) => {
        const selected = getSelectedWorkspaceBox(prev);
        if (!selected) return prev;
        const nextIndex = prev.workspaceBoxes.length + 1;
        const newBox: WorkspaceBox = {
          ...selected,
          id: `box-${nextIndex}`,
          nome: `${selected.nome} (cópia)`,
          posicaoX_mm: 0,
          modelId: selected.modelId ?? null,
        };
        return recomputeState(
          prev,
          {
            workspaceBoxes: [...prev.workspaceBoxes, newBox],
            selectedWorkspaceBoxId: newBox.id,
            selectedCaixaId: newBox.id,
            selectedCaixaModelUrl: null,
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "box",
              message: `Caixote duplicado: ${selected.nome} → ${newBox.nome}`,
            }),
          },
          true
        );
      });
    },

    duplicateWorkspaceBox: () => {
      actions.duplicateBox();
    },

    removeBox: () => {
      updateProject((prev) => {
        if (prev.workspaceBoxes.length <= 1) {
          return prev;
        }
        const removed = getSelectedWorkspaceBox(prev);
        const filtered = prev.workspaceBoxes.filter(
          (box) => box.id !== prev.selectedWorkspaceBoxId
        );
        const nextSelected = filtered[0];
        return recomputeState(
          prev,
          {
            workspaceBoxes: filtered,
            selectedWorkspaceBoxId: nextSelected.id,
            selectedCaixaId: nextSelected.id,
            selectedCaixaModelUrl: getModelUrlFromStorage(nextSelected.modelId),
            dimensoes: nextSelected.dimensoes,
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "box",
              message: `Caixote removido: ${removed?.nome ?? "Caixa"}`,
            }),
          },
          true
        );
      });
    },

    removeWorkspaceBox: () => {
      actions.removeBox();
    },

    selectBox: (boxId) => {
      updateProject((prev) => {
        const selected = prev.workspaceBoxes.find((box) => box.id === boxId);
        if (!selected) return prev;
        return recomputeState(
          prev,
          {
            selectedWorkspaceBoxId: boxId,
            selectedBoxId: prev.boxes.find((box) => box.id === boxId)
              ? boxId
              : prev.selectedBoxId,
            selectedCaixaId: boxId,
            selectedCaixaModelUrl: getModelUrlFromStorage(selected.modelId),
            dimensoes: selected.dimensoes,
          },
          true
        );
      });
    },

    updateCaixaModelId: (caixaId, modelId) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === caixaId ? { ...box, modelId } : box
        );
        const boxes = prev.boxes.map((box) =>
          box.id === caixaId ? { ...box, modelId } : box
        );
        const selectedCaixaModelUrl = getModelUrlFromStorage(modelId);
        return {
          ...prev,
          workspaceBoxes,
          boxes,
          selectedCaixaId: caixaId,
          selectedCaixaModelUrl,
        };
      });
    },

    renameBox: (nome) => {
      updateProject((prev) => {
        const selected = getSelectedWorkspaceBox(prev);
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === prev.selectedWorkspaceBoxId ? { ...box, nome } : box
        );
        return recomputeState(
          prev,
          {
            workspaceBoxes,
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "box",
              message: `Caixote renomeado: ${selected?.nome ?? "Caixa"} → ${nome}`,
            }),
          },
          true
        );
      });
    },

    setPrateleiras: (quantidade) => {
      const valor = Math.max(0, Math.floor(quantidade));
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === prev.selectedWorkspaceBoxId ? { ...box, prateleiras: valor } : box
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
      });
    },

    setPortaTipo: (portaTipo) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === prev.selectedWorkspaceBoxId ? { ...box, portaTipo } : box
        );
        return recomputeState(prev, { workspaceBoxes }, true);
      });
    },

    updateWorkspacePosition: (boxId, posicaoX_mm) => {
      updateProject(
        (prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === boxId ? { ...box, posicaoX_mm } : box
        );
        return { ...prev, workspaceBoxes };
        },
        false
      );
    },

    updateWorkspaceBoxPosition: (boxId, posicaoX_mm) => {
      actions.updateWorkspacePosition(boxId, posicaoX_mm);
    },

    toggleWorkspaceRotation: (boxId) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === boxId ? { ...box, rotacaoY_90: !box.rotacaoY_90 } : box
        );
        return { ...prev, workspaceBoxes };
      });
    },

    rotateWorkspaceBox: (boxId) => {
      actions.toggleWorkspaceRotation(boxId);
    },

    gerarDesign: () => {
      updateProject((prev) => {
        try {
          if (!prev.workspaceBoxes || prev.workspaceBoxes.length === 0) {
            return {
              ...prev,
              erro: "Nenhum caixote disponível para cálculo",
              estaCarregando: false,
            };
          }
          const boxes = buildBoxesFromWorkspace(prev);
          const selectedWorkspace = getSelectedWorkspaceBox(prev);
          const selectedBoxId =
            boxes.find((box) => box.id === selectedWorkspace?.id)?.id ?? boxes[0].id;
          const nextState = {
            ...prev,
            boxes,
            selectedBoxId,
            dimensoes:
              selectedWorkspace?.dimensoes ??
              boxes.find((box) => box.id === selectedBoxId)?.dimensoes ??
              prev.dimensoes,
          };
          return {
            ...nextState,
            ...buildDesignState(nextState),
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "calc",
              message: "Caixotes recalculados",
            }),
          };
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
      });
    },

    exportarPDF: () => {
      if (!project.boxes || project.boxes.length === 0) {
        alert("Nenhuma cut list disponível para exportar.");
        return;
      }

      const doc = gerarPdfIndustrial(project.boxes);
      doc.save("cutlist-industrial.pdf");
    },

    logChangelog: (message) => {
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
    },
    undo: () => {
      updateProject(
        (prev) => {
          if (undoStackRef.current.length === 0) return prev;
          const [next, ...rest] = undoStackRef.current;
          undoStackRef.current = rest;
          const currentSnapshot = reviveState(serializeState(prev)) ?? prev;
          redoStackRef.current = [currentSnapshot, ...redoStackRef.current].slice(0, MAX_HISTORY);
          viewerSync.restoreViewerSnapshot(null);
          return applyResultados(next);
        },
        false
      );
    },
    redo: () => {
      updateProject(
        (prev) => {
          if (redoStackRef.current.length === 0) return prev;
          const [next, ...rest] = redoStackRef.current;
          redoStackRef.current = rest;
          const currentSnapshot = reviveState(serializeState(prev)) ?? prev;
          undoStackRef.current = [currentSnapshot, ...undoStackRef.current].slice(0, MAX_HISTORY);
          viewerSync.restoreViewerSnapshot(null);
          return applyResultados(next);
        },
        false
      );
    },
    saveProjectSnapshot: () => {
      const snapshot: ProjectSnapshot = {
        projectState: serializeState(project),
        viewerSnapshot: viewerSync.saveViewerSnapshot(),
      };
      const name = project.projectName?.trim() || "Projeto";
      const timestamp = new Date().toISOString();
      const entry: StoredProject = {
        id: `project-${Date.now()}`,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
        snapshot,
      };
      const existing = readStoredProjects();
      writeStoredProjects([entry, ...existing].slice(0, 50));
    },
    loadProjectSnapshot: (id) => {
      const stored = readStoredProjects();
      const entryIndex = stored.findIndex((item) => item.id === id);
      const entry = stored[entryIndex];
      if (!entry) return;
      const snapshot = entry.snapshot as ProjectSnapshot | ProjectState | unknown;
      const projectState = snapshot && typeof snapshot === "object" && "projectState" in snapshot
        ? (snapshot as ProjectSnapshot).projectState
        : snapshot;
      const viewerSnapshot =
        snapshot && typeof snapshot === "object" && "viewerSnapshot" in snapshot
          ? (snapshot as ProjectSnapshot).viewerSnapshot
          : null;
      const updatedEntry = {
        ...entry,
        updatedAt: new Date().toISOString(),
      };
      if (entryIndex >= 0) {
        const nextStored = [...stored];
        nextStored[entryIndex] = updatedEntry;
        writeStoredProjects(nextStored);
      }
      viewerSync.restoreViewerSnapshot(viewerSnapshot ?? null);
      const restored = reviveState(projectState);
      if (!restored) return;
      updateProject(() => applyResultados(restored));
    },
    listSavedProjects: (): SavedProjectInfo[] => {
      return readStoredProjects().map(({ id, name, createdAt, updatedAt }) => ({
        id,
        name,
        createdAt,
        updatedAt,
      }));
    },
    createNewProject: () => {
      const freshState = applyResultados(defaultState);
      const timestamp = new Date().toISOString();
      const entry: StoredProject = {
        id: `project-${Date.now()}`,
        name: freshState.projectName,
        createdAt: timestamp,
        updatedAt: timestamp,
        snapshot: {
          projectState: serializeState(freshState),
          viewerSnapshot: null,
        },
      };
      viewerSync.restoreViewerSnapshot(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
      const existing = readStoredProjects();
      writeStoredProjects([entry, ...existing].slice(0, 50));
      updateProject(() => freshState, false);
    },
    renameProject: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const stored = readStoredProjects();
      const nextStored = stored.map((item) =>
        item.id === id
          ? { ...item, name: trimmed, updatedAt: new Date().toISOString() }
          : item
      );
      writeStoredProjects(nextStored);
    },
    deleteProject: (id) => {
      const stored = readStoredProjects();
      const nextStored = stored.filter((item) => item.id !== id);
      writeStoredProjects(nextStored);
    },
  };

  return (
    <ProjectContext.Provider value={{ project, actions, viewerSync }}>
      {children}
    </ProjectContext.Provider>
  );
}
