import * as THREE from "three";
import type { OrlaVisualBridge, OrlaVisualizer } from "./orla/OrlaVisualizer";
import type { RematePieceVisualBridge, RematePieceVisualizer } from "./remate/RematePieceVisualizer";
import type { TampoPieceVisualizer } from "./remate/TampoPieceVisualizer";
import { resolveLRemateCimaLeadId, resolveRemateTransformRoot } from "./remate/remateLCompositeVisual";
import type { HematiVisualBridge, HematiVisualizer } from "./hemati/HematiVisualizer";
import type { RodapeVisualBridge, RodapeVisualizer } from "./rodape/RodapeVisualizer";
import type { DivSepVisualBridge } from "./divSep/DivSepVisualBridge";
import type { ViewerBoxEntry } from "./types";
import type { SelectedDivSep, ViewerState } from "./state/ViewerState";
import { requestFinishSync, type FinishSyncFlags } from "./finish/ViewerFinishSync";
import { clearCompetingSelectionsFor } from "./input/neutralSelection";

export type ViewerCoreFinishOpsDeps = {
  orlaVisualizer: OrlaVisualizer;
  remateVisualizer: RematePieceVisualizer;
  tampoVisualizer: TampoPieceVisualizer;
  hematiVisualizer: HematiVisualizer;
  rodapeVisualizer: RodapeVisualizer;
  getRemateVisualBridge: () => RematePieceVisualBridge | null;
  setRemateVisualBridge: (bridge: RematePieceVisualBridge | null) => void;
  setRodapeVisualBridge: (bridge: RodapeVisualBridge | null) => void;
  setDivSepVisualBridge: (bridge: DivSepVisualBridge | null) => void;
  boxes: Map<string, ViewerBoxEntry>;
  pendingViewerVisualSync: FinishSyncFlags;
  isTransformDragging: () => boolean;
  refreshViewerAttachmentsAfterMeshMutation: () => void;
  applyPanelVisibilityForObject: (root: THREE.Object3D) => void;
  viewerState: ViewerState;
  onRemateSelected: ((_remateId: string | null) => void) | null;
  onRodapeSelected: ((_rodapeId: string | null) => void) | null;
  refreshTransformControlsAttachment: () => void;
  refreshOutlineTarget: () => void;
  notifyRemateTransform: () => void;
  syncRemateVisuals: () => void;
  lockEnabled: boolean;
  resolveFinishCollisionAfterSync: (params: { remateId?: string; rodapeId?: string }) => void;
  getRemateMesh: (remateId: string) => THREE.Object3D | null;
};

export function bindOrlaBridgeImpl(
  deps: ViewerCoreFinishOpsDeps,
  bridge: Pick<OrlaVisualBridge, "getBoxOrlaConfig"> | null
): void {
  deps.orlaVisualizer.bindBridge(bridge);
  syncOrlaVisualsImpl(deps);
}

export function syncOrlaVisualsImpl(deps: ViewerCoreFinishOpsDeps): void {
  requestFinishSync(deps.pendingViewerVisualSync, "orla", deps.isTransformDragging(), () => {
    for (const [boxId, entry] of deps.boxes.entries()) {
      if (entry?.mesh) deps.orlaVisualizer.syncBoxRoot(boxId, entry.mesh);
    }
    deps.refreshViewerAttachmentsAfterMeshMutation();
  });
}

export function syncOrlaForBoxImpl(deps: ViewerCoreFinishOpsDeps, boxId: string): void {
  requestFinishSync(deps.pendingViewerVisualSync, "orla", deps.isTransformDragging(), () => {
    const entry = deps.boxes.get(boxId);
    if (!entry?.mesh) return;
    deps.orlaVisualizer.syncBoxRoot(boxId, entry.mesh);
    deps.refreshViewerAttachmentsAfterMeshMutation();
  });
}

export function bindRemateBridgeImpl(
  deps: ViewerCoreFinishOpsDeps,
  bridge: RematePieceVisualBridge | null
): void {
  deps.setRemateVisualBridge(bridge);
  deps.remateVisualizer.bindBridge(bridge);
  deps.tampoVisualizer.bindBridge(bridge);
  syncRemateVisualsImpl(deps);
}

/** Sync visual de remates — aplica apenas transform guardado no estado (sem re-snap à caixa). */
export function syncRemateVisualsImpl(deps: ViewerCoreFinishOpsDeps): void {
  requestFinishSync(deps.pendingViewerVisualSync, "remate", deps.isTransformDragging(), () => {
    deps.remateVisualizer.syncAll();
    deps.tampoVisualizer.syncAll();
    for (const [, entry] of deps.boxes.entries()) {
      if (!entry?.mesh) continue;
      clearBoxChildrenRemateLegacyImpl(deps, entry.mesh);
      deps.applyPanelVisibilityForObject(entry.mesh);
    }
    deps.applyPanelVisibilityForObject(deps.remateVisualizer.getRoot());
    deps.applyPanelVisibilityForObject(deps.tampoVisualizer.getRoot());
    deps.refreshViewerAttachmentsAfterMeshMutation();
  });
}

export function clearBoxChildrenRemateLegacyImpl(
  deps: ViewerCoreFinishOpsDeps,
  boxRoot: THREE.Object3D
): void {
  deps.remateVisualizer.clearBoxChildren(boxRoot);
}

export function getRemateMeshImpl(
  deps: ViewerCoreFinishOpsDeps,
  remateId: string
): THREE.Object3D | null {
  return (
    deps.tampoVisualizer.getMeshByRemateId(remateId) ??
    deps.remateVisualizer.getMeshByRemateId(remateId) ??
    null
  );
}

/**
 * Nudge de remate via teclado — opera no root de transform (grupo L CIMA composite quando aplicável),
 * propaga via notifyRemateTransform (mesmo pipeline do gizmo).
 */
export function applyRemateKeyboardTransformImpl(
  deps: ViewerCoreFinishOpsDeps,
  remateId: string,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
  options?: { stepMm?: number; stepDeg?: number; shiftKey?: boolean }
): boolean {
  const pieces = deps.getRemateVisualBridge()?.listRematePieces() ?? [];
  const leadId = resolveLRemateCimaLeadId(remateId, pieces);
  const rawMesh = deps.getRemateMesh(leadId);
  const mesh = resolveRemateTransformRoot(rawMesh) ?? rawMesh;
  if (!mesh) return false;

  const tool = deps.viewerState.getCurrentTool();
  if (tool === "scale") return false;

  const stepMm = options?.stepMm ?? 1;
  const stepDeg = options?.stepDeg ?? 1;
  const shiftKey = options?.shiftKey ?? false;
  const stepM = stepMm / 1000;
  const stepRad = (stepDeg * Math.PI) / 180;

  if (tool === "rotate") {
    const axis = new THREE.Vector3();
    let sign = 1;
    if (shiftKey) {
      axis.set(0, 0, 1);
      if (key === "ArrowUp") sign = 1;
      else if (key === "ArrowDown") sign = -1;
      else return false;
    } else if (key === "ArrowLeft" || key === "ArrowRight") {
      axis.set(0, 1, 0);
      sign = key === "ArrowLeft" ? 1 : -1;
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      axis.set(1, 0, 0);
      sign = key === "ArrowUp" ? 1 : -1;
    } else {
      return false;
    }
    mesh.rotateOnWorldAxis(axis, sign * stepRad);
  } else {
    const delta = new THREE.Vector3();
    if (shiftKey) {
      if (key === "ArrowUp") delta.z = stepM;
      else if (key === "ArrowDown") delta.z = -stepM;
      else return false;
    } else if (key === "ArrowUp") delta.y = stepM;
    else if (key === "ArrowDown") delta.y = -stepM;
    else if (key === "ArrowLeft") delta.x = -stepM;
    else if (key === "ArrowRight") delta.x = stepM;
    else return false;
    mesh.position.add(delta);
  }

  mesh.updateMatrixWorld(true);

  const prevSelected = deps.viewerState.getSelectedRemate();
  if (prevSelected !== leadId) deps.viewerState.setSelectedRemate(leadId);
  deps.notifyRemateTransform();
  if (prevSelected !== leadId) deps.viewerState.setSelectedRemate(prevSelected);

  deps.syncRemateVisuals();

  const isLCimaComposite = mesh.userData?.isRemateLComposite === true;
  if (!isLCimaComposite && deps.lockEnabled) {
    deps.resolveFinishCollisionAfterSync({ remateId: leadId });
  }

  return true;
}

export function selectRemateImpl(deps: ViewerCoreFinishOpsDeps, remateId: string | null): void {
  const resolvedId =
    remateId != null
      ? resolveLRemateCimaLeadId(remateId, deps.getRemateVisualBridge()?.listRematePieces() ?? [])
      : null;
  deps.viewerState.setSelectedRemate(resolvedId);
  deps.onRemateSelected?.(resolvedId);
  clearCompetingSelectionsFor(deps.viewerState, "remate", resolvedId);
  deps.refreshTransformControlsAttachment();
  deps.refreshOutlineTarget();
}

export function bindDivSepBridgeImpl(
  deps: ViewerCoreFinishOpsDeps,
  bridge: DivSepVisualBridge | null
): void {
  deps.setDivSepVisualBridge(bridge);
}

export function getDivSepMeshImpl(
  deps: ViewerCoreFinishOpsDeps,
  selection: SelectedDivSep
): THREE.Object3D | null {
  const entry = deps.boxes.get(selection.boxId);
  if (!entry) return null;
  const meshName =
    selection.kind === "div" ? `divsep-div-${selection.itemId}` : `divsep-sep-${selection.itemId}`;
  const found = entry.mesh.getObjectByName(meshName);
  return found ?? null;
}

export function selectDivSepImpl(
  deps: ViewerCoreFinishOpsDeps,
  selection: SelectedDivSep | null
): void {
  deps.viewerState.setSelectedDivSep(selection);
  if (selection) {
    clearCompetingSelectionsFor(deps.viewerState, "divSep", selection);
    if (deps.viewerState.getCurrentTool() !== "translate") {
      deps.viewerState.setCurrentTool("translate");
    }
  }
  deps.refreshTransformControlsAttachment();
  deps.refreshOutlineTarget();
}

export function bindHematiBridgeImpl(
  deps: ViewerCoreFinishOpsDeps,
  bridge: HematiVisualBridge | null
): void {
  deps.hematiVisualizer.bindBridge(bridge);
  syncHematiVisualsImpl(deps);
}

export function syncHematiVisualsImpl(deps: ViewerCoreFinishOpsDeps): void {
  requestFinishSync(deps.pendingViewerVisualSync, "hemati", deps.isTransformDragging(), () => {
    deps.hematiVisualizer.syncAll();
    deps.applyPanelVisibilityForObject(deps.hematiVisualizer.getRoot());
    deps.refreshViewerAttachmentsAfterMeshMutation();
  });
}

export function getHematiMeshImpl(
  deps: ViewerCoreFinishOpsDeps,
  hematiId: string
): THREE.Object3D | null {
  return deps.hematiVisualizer.getMeshByHematiId(hematiId) ?? null;
}

export function selectHematiImpl(deps: ViewerCoreFinishOpsDeps, hematiId: string | null): void {
  deps.viewerState.setSelectedHemati(hematiId);
  clearCompetingSelectionsFor(deps.viewerState, "hemati", hematiId);
  deps.refreshTransformControlsAttachment();
  deps.refreshOutlineTarget();
}

export function bindRodapeBridgeImpl(
  deps: ViewerCoreFinishOpsDeps,
  bridge: RodapeVisualBridge | null
): void {
  deps.setRodapeVisualBridge(bridge);
  deps.rodapeVisualizer.bindBridge(bridge);
  syncRodapeVisualsImpl(deps);
}

/** Sync visual de rodapés — aplica apenas transform guardado no estado (sem re-snap à caixa). */
export function syncRodapeVisualsImpl(deps: ViewerCoreFinishOpsDeps): void {
  requestFinishSync(deps.pendingViewerVisualSync, "rodape", deps.isTransformDragging(), () => {
    deps.rodapeVisualizer.syncAll();
    deps.applyPanelVisibilityForObject(deps.rodapeVisualizer.getRoot());
    deps.refreshViewerAttachmentsAfterMeshMutation();
  });
}

export function getRodapeMeshImpl(
  deps: ViewerCoreFinishOpsDeps,
  rodapeId: string
): THREE.Object3D | null {
  return deps.rodapeVisualizer.getMeshByRodapeId(rodapeId) ?? null;
}

export function selectRodapeImpl(deps: ViewerCoreFinishOpsDeps, rodapeId: string | null): void {
  deps.viewerState.setSelectedRodape(rodapeId);
  deps.onRodapeSelected?.(rodapeId);
  clearCompetingSelectionsFor(deps.viewerState, "rodape", rodapeId);
  deps.refreshTransformControlsAttachment();
  deps.refreshOutlineTarget();
}
