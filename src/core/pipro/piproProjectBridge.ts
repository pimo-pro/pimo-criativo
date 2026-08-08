/**
 * Bridge PiproDesignWorkspace ↔ WorkspaceBox (ProjectState).
 * Não altera o motor unificado — só mapeia estado UI.
 */

import type { WorkspaceBox } from "../types";
import { createWorkspaceBox, recomputeState } from "../../context/projectState";
import type { ProjectState } from "../../context/projectTypes";
import {
  PiproDesignWorkspace,
  buildPiproBaseCabinetId,
  type PiproDesignState,
} from "./PiproDesignWorkspace";
import type { IndustrialFeatureId } from "../unifiedIndustrialBox/types";

export const PIPRO_DESIGN_BOX_ID = "pipro-design-box";

export function piproStateToWorkspaceBox(state: PiproDesignState): WorkspaceBox {
  const ids = state.featureIds;
  const hasGps = ids.some((id) => String(id).includes("gaveta_porta_sep"));
  const hasA1 = ids.some((id) => String(id).includes("inner_cabinet_a1"));
  const hasWardrobe = ids.some((id) => String(id).includes("wardrobe_sep_parcial"));
  const hasGaveta = hasGps || hasA1 || hasWardrobe;
  const hasPorta = hasGps || state.extraPieceKinds.includes("porta");

  const box = createWorkspaceBox(
    PIPRO_DESIGN_BOX_ID,
    state.nome,
    {
      largura: state.dimensions.largura,
      altura: state.dimensions.altura,
      profundidade: state.dimensions.profundidade,
    },
    state.dimensions.espessura,
    0,
    [],
    "reta",
    "integrado",
    undefined,
    {
      baseCabinetId: buildPiproBaseCabinetId(state.featureIds),
      portaTipo: hasPorta ? "porta_simples" : "sem_porta",
      gavetas: hasGaveta ? (hasA1 ? 2 : 1) : 0,
      prateleiras: hasGps ? 2 : 0,
      cabinetType: "lower",
      feetEnabled: true,
    }
  );

  return {
    ...box,
    alturaGaveta: hasA1 ? 400 : hasGps ? 180 : box.alturaGaveta,
    material: state.bodyMaterialId,
    manualPosition: true,
    posicaoX_mm: 0,
    posicaoZ_mm: 0,
  };
}

/** Aplica o estado do motor pipro ao ProjectState (1 caixa). */
export function applyPiproToProjectState(
  prev: ProjectState,
  workspace: PiproDesignWorkspace
): ProjectState {
  const box = piproStateToWorkspaceBox(workspace.state);
  return recomputeState(
    prev,
    {
      projectName: workspace.state.nome,
      workspaceBoxes: [box],
      selectedWorkspaceBoxId: box.id,
      dimensoes: { ...box.dimensoes },
      material: {
        ...prev.material,
        espessura: workspace.state.dimensions.espessura,
      },
    },
    false
  );
}

/** Lê dims/material da caixa do projecto e actualiza o workspace pipro. */
export function syncPiproFromProjectBox(
  workspace: PiproDesignWorkspace,
  box: WorkspaceBox | undefined
): boolean {
  if (!box) return false;
  const d = box.dimensoes;
  const esp = box.espessura;
  const changed =
    workspace.state.dimensions.largura !== d.largura ||
    workspace.state.dimensions.altura !== d.altura ||
    workspace.state.dimensions.profundidade !== d.profundidade ||
    workspace.state.dimensions.espessura !== esp ||
    workspace.state.nome !== box.nome ||
    (box.material && workspace.state.bodyMaterialId !== box.material);

  if (!changed) return false;

  workspace.state.nome = box.nome;
  workspace.setDimensions({
    largura: d.largura,
    altura: d.altura,
    profundidade: d.profundidade,
    espessura: esp,
  });
  if (box.material) {
    workspace.setMaterials(box.material);
  }
  return true;
}

export function setPiproFeatures(
  workspace: PiproDesignWorkspace,
  featureIds: IndustrialFeatureId[]
): void {
  workspace.setFeatures(featureIds);
}
