/**
 * Bridges read-only para remates, TAMPO, roda pé e hematis
 * no showroom PROJETOS (paridade com Workspace.tsx, sem ViewerCore).
 */

import * as THREE from "three";
import type { ProjectState } from "../../context/projectTypes";
import { RematePieceVisualizer, type RematePieceVisualBridge } from "../../3d/viewer-engine/remate/RematePieceVisualizer";
import { TampoPieceVisualizer } from "../../3d/viewer-engine/remate/TampoPieceVisualizer";
import { RodapeVisualizer, type RodapeVisualBridge } from "../../3d/viewer-engine/rodape/RodapeVisualizer";
import { HematiVisualizer, type HematiVisualBridge } from "../../3d/viewer-engine/hemati/HematiVisualizer";
import { mmToM } from "../../utils/units";

export type ShowroomFinishVisuals = {
  remateVisualizer: RematePieceVisualizer;
  tampoVisualizer: TampoPieceVisualizer;
  rodapeVisualizer: RodapeVisualizer;
  hematiVisualizer: HematiVisualizer;
  syncAll: () => void;
  dispose: () => void;
};

function buildFinishBoxDims(project: ProjectState, boxId: string) {
  const wsBox = project.workspaceBoxes.find((b) => b.id === boxId);
  if (!wsBox) return null;
  return {
    boxId,
    widthM: Math.max(0.001, mmToM(wsBox.dimensoes?.largura ?? 600)),
    heightM: Math.max(0.001, mmToM(wsBox.dimensoes?.altura ?? 720)),
    depthM: Math.max(0.001, mmToM(wsBox.dimensoes?.profundidade ?? 560)),
  };
}

export function createShowroomFinishVisuals(
  project: ProjectState,
  getBoxWorldMatrix: (boxId: string) => THREE.Matrix4 | null
): ShowroomFinishVisuals {
  const remateVisualizer = new RematePieceVisualizer();
  const tampoVisualizer = new TampoPieceVisualizer();
  const rodapeVisualizer = new RodapeVisualizer();
  const hematiVisualizer = new HematiVisualizer();

  const remateBridge: RematePieceVisualBridge = {
    listRematePieces: () => project.remates ?? [],
    getBoxConfig: (boxId) => {
      const dims = buildFinishBoxDims(project, boxId);
      if (!dims) return null;
      const wsBox = project.workspaceBoxes.find((b) => b.id === boxId);
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
  };

  const buildHematiBoxConfig = (boxId: string) => {
    const dims = buildFinishBoxDims(project, boxId);
    if (!dims) return null;
    const hematis = (project.hematis ?? []).filter((h) => h.parentBoxId === boxId);
    return { ...dims, hematis };
  };

  const buildRodapeBoxConfig = (boxId: string) => {
    const dims = buildFinishBoxDims(project, boxId);
    if (!dims) return null;
    const rodapes = (project.rodapes ?? []).filter((r) => r.parentBoxId === boxId);
    return { ...dims, rodapes };
  };

  const hematiBridge: HematiVisualBridge = {
    getBoxHematiConfig: (boxId) => buildHematiBoxConfig(boxId),
    listBoxHematiConfigs: () =>
      project.workspaceBoxes
        .map((box) => buildHematiBoxConfig(box.id))
        .filter((cfg): cfg is NonNullable<typeof cfg> => cfg != null && cfg.hematis.length > 0),
    getBoxWorldMatrix,
  };

  const rodapeBridge: RodapeVisualBridge = {
    getBoxRodapeConfig: (boxId) => buildRodapeBoxConfig(boxId),
    listBoxRodapeConfigs: () =>
      project.workspaceBoxes
        .map((box) => buildRodapeBoxConfig(box.id))
        .filter((cfg): cfg is NonNullable<typeof cfg> => cfg != null && cfg.rodapes.length > 0),
    getBoxWorldMatrix,
  };

  remateVisualizer.bindBridge(remateBridge);
  tampoVisualizer.bindBridge(remateBridge);
  hematiVisualizer.bindBridge(hematiBridge);
  rodapeVisualizer.bindBridge(rodapeBridge);

  const syncAll = () => {
    remateVisualizer.syncAll();
    tampoVisualizer.syncAll();
    hematiVisualizer.syncAll();
    rodapeVisualizer.syncAll();
  };

  const dispose = () => {
    remateVisualizer.dispose();
    tampoVisualizer.dispose();
    hematiVisualizer.dispose();
    rodapeVisualizer.dispose();
  };

  return {
    remateVisualizer,
    tampoVisualizer,
    rodapeVisualizer,
    hematiVisualizer,
    syncAll,
    dispose,
  };
}
