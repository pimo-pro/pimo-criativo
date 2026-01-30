import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { gerarPdfIndustrial } from "../core/export/pdfGenerator";
import type { BoxModelInstance, WorkspaceBox } from "../core/types";
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

  const extractedPartsByBoxId = normalizeExtractedParts(restored.extractedPartsByBoxId);
  const workspaceBoxesRaw = restored.workspaceBoxes ?? [];
  const workspaceBoxes = Array.isArray(workspaceBoxesRaw)
    ? workspaceBoxesRaw.map((box: WorkspaceBox & { modelId?: string | null }) => {
        const models = box.models ?? (box.modelId != null ? [{ id: `${box.id}-model-1`, modelId: box.modelId }] : []);
        const { modelId: _m, ...rest } = box;
        return { ...rest, models };
      })
    : defaultState.workspaceBoxes;

  return {
    ...defaultState,
    ...restored,
    workspaceBoxes,
    selectedWorkspaceBoxId: workspaceBoxes.length ? (restored.selectedWorkspaceBoxId ?? workspaceBoxes[0].id) : "",
    selectedCaixaId: workspaceBoxes.length ? (restored.selectedCaixaId ?? workspaceBoxes[0].id) : "",
    selectedBoxId: workspaceBoxes.length ? (restored.selectedBoxId ?? "") : "",
    material: { ...defaultState.material, ...restored.material },
    dimensoes: { ...defaultState.dimensoes, ...restored.dimensoes },
    extractedPartsByBoxId,
    selectedModelInstanceId: restored.selectedModelInstanceId ?? null,
    ruleViolations: Array.isArray(restored.ruleViolations) ? restored.ruleViolations : [],
    modelPositionsByBoxId:
      restored.modelPositionsByBoxId && typeof restored.modelPositionsByBoxId === "object"
        ? restored.modelPositionsByBoxId
        : {},
    layoutWarnings:
      restored.layoutWarnings &&
      typeof restored.layoutWarnings === "object" &&
      Array.isArray(restored.layoutWarnings.collisions) &&
      Array.isArray(restored.layoutWarnings.outOfBounds)
        ? restored.layoutWarnings
        : { collisions: [], outOfBounds: [] },
  };
};

/** Converte formato antigo (boxId → items[]) para boxId → modelInstanceId → items[]. */
function normalizeExtractedParts(
  raw: unknown
): Record<string, Record<string, import("../core/types").CutListItemComPreco[]>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Record<string, import("../core/types").CutListItemComPreco[]>> = {};
  for (const [boxId, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      out[boxId] = { default: value };
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[boxId] = value as Record<string, import("../core/types").CutListItemComPreco[]>;
    }
  }
  return out;
}

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
  const projectRef = useRef<ProjectState>(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
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
          []
        );
        const nextWorkspaceBoxes = [...prev.workspaceBoxes, newBox];
        const nextPrev = { ...prev, workspaceBoxes: nextWorkspaceBoxes };
        const boxes = buildBoxesFromWorkspace(nextPrev);
        return recomputeState(
          prev,
          {
            workspaceBoxes: nextWorkspaceBoxes,
            boxes,
            selectedWorkspaceBoxId: newBox.id,
            selectedCaixaId: newBox.id,
            selectedCaixaModelUrl: null,
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "box",
              message: `Caixote criado: ${newBox.nome}`,
            }),
            selectedModelInstanceId: null,
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
          models: (selected.models ?? []).map((m, i) => ({ ...m, id: `box-${nextIndex}-model-${Date.now()}-${i}` })),
        };
        const nextWorkspaceBoxes = [...prev.workspaceBoxes, newBox];
        const nextPrev = { ...prev, workspaceBoxes: nextWorkspaceBoxes };
        const boxes = buildBoxesFromWorkspace(nextPrev);
        return recomputeState(
          prev,
          {
            workspaceBoxes: nextWorkspaceBoxes,
            boxes,
            selectedWorkspaceBoxId: newBox.id,
            selectedCaixaId: newBox.id,
            selectedCaixaModelUrl: null,
            selectedModelInstanceId: null,
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
        const removed = getSelectedWorkspaceBox(prev);
        if (!removed) return prev;
        const filtered = prev.workspaceBoxes.filter(
          (box) => box.id !== prev.selectedWorkspaceBoxId
        );
        const nextSelected = filtered[0];
        const nextPrev = { ...prev, workspaceBoxes: filtered };
        const boxes = buildBoxesFromWorkspace(nextPrev);
        return recomputeState(
          prev,
          {
            workspaceBoxes: filtered,
            boxes,
            selectedWorkspaceBoxId: nextSelected?.id ?? "",
            selectedCaixaId: nextSelected?.id ?? "",
            selectedBoxId: nextSelected?.id ?? prev.selectedBoxId ?? "",
            selectedCaixaModelUrl: null,
            selectedModelInstanceId: null,
            dimensoes: nextSelected?.dimensoes ?? prev.dimensoes,
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "box",
              message: `Caixote removido: ${removed.nome}`,
            }),
          },
          true
        );
      });
    },

    removeWorkspaceBox: () => {
      actions.removeBox();
    },

    removeWorkspaceBoxById: (boxId) => {
      updateProject((prev) => {
        const filtered = prev.workspaceBoxes.filter((box) => box.id !== boxId);
        if (filtered.length === prev.workspaceBoxes.length) return prev;
        const nextSelected = filtered[0];
        const nextPrev = { ...prev, workspaceBoxes: filtered };
        const boxes = buildBoxesFromWorkspace(nextPrev);
        const { [boxId]: _, ...extractedRest } = prev.extractedPartsByBoxId ?? {};
        const removed = prev.workspaceBoxes.find((b) => b.id === boxId);
        return recomputeState(
          prev,
          {
            workspaceBoxes: filtered,
            boxes,
            extractedPartsByBoxId: extractedRest,
            selectedWorkspaceBoxId: nextSelected?.id ?? "",
            selectedCaixaId: nextSelected?.id ?? "",
            selectedBoxId: nextSelected ? (prev.selectedBoxId === boxId ? nextSelected.id : prev.selectedBoxId) : "",
            selectedCaixaModelUrl: null,
            selectedModelInstanceId: null,
            dimensoes: nextSelected?.dimensoes ?? prev.dimensoes,
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
            selectedCaixaModelUrl: null,
            selectedModelInstanceId: null,
            dimensoes: selected.dimensoes,
          },
          true
        );
      });
    },

    addModelToBox: (caixaId, cadModelId) => {
      updateProject((prev) => {
        const box = prev.workspaceBoxes.find((b) => b.id === caixaId);
        if (!box) return prev;
        const instanceId = `${caixaId}-model-${Date.now()}`;
        const instance: BoxModelInstance = { id: instanceId, modelId: cadModelId };
        const models = [...(box.models ?? []), instance];
        const workspaceBoxes = prev.workspaceBoxes.map((b) =>
          b.id === caixaId ? { ...b, models } : b
        );
        return recomputeState(prev, { workspaceBoxes }, true);
      });
    },

    /** Cria uma nova caixa no workspace contendo apenas o modelo CAD (cada modelo CAD = uma caixa completa). Dimensões placeholder até o GLB carregar. */
    addCadModelAsNewBox: (cadModelId) => {
      updateProject((prev) => {
        const nextIndex = prev.workspaceBoxes.length + 1;
        const newBoxId = `box-${nextIndex}`;
        const instanceId = `${newBoxId}-model-${Date.now()}`;
        const instance: BoxModelInstance = { id: instanceId, modelId: cadModelId };
        const baseEspessura =
          prev.workspaceBoxes[0]?.espessura ?? prev.material.espessura;
        const placeholderDimensoes = { largura: 100, altura: 100, profundidade: 100 };
        const newBox = createWorkspaceBox(
          newBoxId,
          `Módulo ${nextIndex}`,
          placeholderDimensoes,
          baseEspessura,
          0,
          [instance]
        );
        const nextWorkspaceBoxes = [...prev.workspaceBoxes, newBox];
        const nextPrev = { ...prev, workspaceBoxes: nextWorkspaceBoxes };
        const boxes = buildBoxesFromWorkspace(nextPrev);
        return recomputeState(
          prev,
          {
            workspaceBoxes: nextWorkspaceBoxes,
            boxes,
            selectedWorkspaceBoxId: newBox.id,
            selectedCaixaId: newBox.id,
            selectedBoxId: newBox.id,
            selectedCaixaModelUrl: null,
            selectedModelInstanceId: null,
            changelog: appendChangelog(prev.changelog, {
              timestamp: new Date(),
              type: "box",
              message: `Módulo CAD adicionado: ${newBox.nome}`,
            }),
          },
          true
        );
      });
    },

    removeModelFromBox: (caixaId, modelInstanceId) => {
      updateProject((prev) => {
        const box = prev.workspaceBoxes.find((b) => b.id === caixaId);
        if (!box) return prev;
        const models = (box.models ?? []).filter((m) => m.id !== modelInstanceId);
        const workspaceBoxes = prev.workspaceBoxes.map((b) =>
          b.id === caixaId ? { ...b, models } : b
        );
        const extractedByBox = { ...prev.extractedPartsByBoxId };
        if (extractedByBox[caixaId]) {
          const { [modelInstanceId]: _, ...rest } = extractedByBox[caixaId];
          if (Object.keys(rest).length > 0) extractedByBox[caixaId] = rest;
          else delete extractedByBox[caixaId];
        }
        const next = { ...prev, workspaceBoxes, extractedPartsByBoxId: extractedByBox };
        return { ...next, ...buildDesignState(next) };
      });
    },

    updateModelInBox: (caixaId, modelInstanceId, updates) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) => {
          if (box.id !== caixaId) return box;
          const models = (box.models ?? []).map((m) =>
            m.id === modelInstanceId ? { ...m, ...updates } : m
          );
          return { ...box, models };
        });
        return recomputeState(prev, { workspaceBoxes }, true);
      });
    },

    updateCaixaModelId: (caixaId, modelId) => {
      if (modelId) {
        actions.addModelToBox(caixaId, modelId);
      } else {
        updateProject((prev) => {
          const box = prev.workspaceBoxes.find((b) => b.id === caixaId);
          if (!box) return prev;
          const workspaceBoxes = prev.workspaceBoxes.map((b) =>
            b.id === caixaId ? { ...b, models: [] } : b
          );
          const extractedByBox = { ...prev.extractedPartsByBoxId };
          delete extractedByBox[caixaId];
          const next = { ...prev, workspaceBoxes, extractedPartsByBoxId: extractedByBox };
          return { ...next, ...buildDesignState(next) };
        });
      }
    },

    selectModelInstance: (boxId, modelInstanceId) => {
      updateProject((prev) => ({
        ...prev,
        selectedModelInstanceId: modelInstanceId ?? null,
        selectedCaixaModelUrl: modelInstanceId
          ? getModelUrlFromStorage(
              prev.workspaceBoxes.find((b) => b.id === boxId)?.models?.find((m) => m.id === modelInstanceId)?.modelId
            ) ?? null
          : null,
      }));
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

    setTipoBorda: (tipoBorda) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === prev.selectedWorkspaceBoxId ? { ...box, tipoBorda } : box
        );
        return recomputeState(prev, { workspaceBoxes }, true);
      });
    },

    setTipoFundo: (tipoFundo) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === prev.selectedWorkspaceBoxId ? { ...box, tipoFundo } : box
        );
        return recomputeState(prev, { workspaceBoxes }, true);
      });
    },

    setExtractedPartsForBox: (boxId, modelInstanceId, parts) => {
      updateProject((prev) => {
        const byBox = { ...prev.extractedPartsByBoxId };
        const byModel = { ...(byBox[boxId] ?? {}), [modelInstanceId]: parts };
        byBox[boxId] = byModel;
        const next = { ...prev, extractedPartsByBoxId: byBox };
        return { ...next, ...buildDesignState(next) };
      });
    },

    clearExtractedPartsForBox: (boxId, modelInstanceId) => {
      updateProject((prev) => {
        const byBox = { ...prev.extractedPartsByBoxId };
        if (modelInstanceId != null) {
          const byModel = { ...byBox[boxId] };
          delete byModel[modelInstanceId];
          if (Object.keys(byModel).length > 0) byBox[boxId] = byModel;
          else delete byBox[boxId];
        } else {
          delete byBox[boxId];
        }
        const next = { ...prev, extractedPartsByBoxId: byBox };
        return { ...next, ...buildDesignState(next) };
      });
    },

    setModelPositionInBox: (boxId, modelInstanceId, position) => {
      updateProject((prev) => {
        const byBox = { ...(prev.modelPositionsByBoxId ?? {}) };
        const byModel = { ...(byBox[boxId] ?? {}), [modelInstanceId]: position };
        byBox[boxId] = byModel;
        const next = { ...prev, modelPositionsByBoxId: byBox };
        return { ...next, ...buildDesignState(next) };
      });
    },

    setLayoutWarnings: (warnings) => {
      updateProject((prev) => ({ ...prev, layoutWarnings: warnings }));
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

    updateWorkspaceBoxTransform: (boxId, partial) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) => {
          if (box.id !== boxId) return box;
          const next = { ...box };
          if (partial.x_mm !== undefined) next.posicaoX_mm = partial.x_mm;
          if (partial.y_mm !== undefined) next.posicaoY_mm = partial.y_mm;
          if (partial.z_mm !== undefined) next.posicaoZ_mm = partial.z_mm ?? 0;
          if (partial.rotacaoY_rad !== undefined) next.rotacaoY = partial.rotacaoY_rad;
          if (partial.manualPosition !== undefined) next.manualPosition = partial.manualPosition;
          return next;
        });
        return { ...prev, workspaceBoxes };
      }, false);
    },

    setWorkspaceBoxDimensoes: (boxId, dimensoes) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === boxId ? { ...box, dimensoes: { ...box.dimensoes, ...dimensoes } } : box
        );
        return recomputeState(prev, { workspaceBoxes }, true);
      });
    },

    setWorkspaceBoxNome: (boxId, nome) => {
      updateProject((prev) => {
        const workspaceBoxes = prev.workspaceBoxes.map((box) =>
          box.id === boxId ? { ...box, nome } : box
        );
        return { ...prev, workspaceBoxes };
      });
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
          let prevAdjusted = prev;
          // Se não há caixas, criar uma nova antes de gerar o design
          if (!prev.workspaceBoxes || prev.workspaceBoxes.length === 0) {
            const newBox = createWorkspaceBox(
              "box-1",
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
              message: prev.workspaceBoxes?.length ? "Caixotes recalculados" : "Nova caixa criada e design gerado",
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
      const currentProject = projectRef.current;
      const boxesToExport = currentProject.boxes ?? [];
      if (boxesToExport.length === 0) {
        alert("Nenhuma cut list disponível para exportar.");
        return;
      }
      const doc = gerarPdfIndustrial(boxesToExport);
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
