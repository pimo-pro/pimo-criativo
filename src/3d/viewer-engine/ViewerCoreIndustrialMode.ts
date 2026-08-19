import * as THREE from "three";
import type { BoxPanelIds, ViewerDrillMarkersByPanel } from "../../core/types";
import type { HoleTypeId } from "../../core/drill/holeCatalog";
import type { DesignDrillHole, IndustrialDesignBox } from "../../core/industrialDesigner/types";
import type { DesignValidationIssue } from "../../core/industrialDesigner/geometryValidation";
import { DesignValidationError } from "../../core/industrialDesigner/geometryValidation";
import type { ViewerPanelVisibility } from "./panels/ViewerPanelVisibility";
import type { IndustrialDesignWorkspaceMode } from "./modes/IndustrialDesignWorkspaceMode";
import type { IndustrialDesignViewerOverlay } from "./overlays/IndustrialDesignViewerOverlay";
import type { BoxSceneController } from "./box/BoxSceneController";
import type { ViewerBoxEntry } from "./types";

export type IndustrialDesignCallbacksState = {
  onPanelSelected?: (panelId: string | null, boxId: string | null) => void;
  onHolePlaced?: (
    panelId: string,
    hole: DesignDrillHole,
    paired?: { panelId: string; hole: DesignDrillHole }
  ) => void;
  onDesignChanged?: (box: IndustrialDesignBox) => void;
  onValidationChanged?: (issues: DesignValidationIssue[]) => void;
  onValidationFailed?: (error: DesignValidationError) => void;
};

export type ViewerCoreIndustrialModeDeps = {
  panelVisibility: ViewerPanelVisibility;
  industrialDesignMode: IndustrialDesignWorkspaceMode;
  industrialDesignViewerOverlay: IndustrialDesignViewerOverlay;
  boxes: Map<string, ViewerBoxEntry>;
  getIndustrialDesignCallbacks: () => IndustrialDesignCallbacksState;
  setIndustrialDesignCallbacks: (callbacks: IndustrialDesignCallbacksState) => void;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  getCamera: () => THREE.Camera;
  getCanvas: () => HTMLCanvasElement;
  boxSceneController: BoxSceneController;
};

function syncIndustrialDesignModeCallbacks(deps: ViewerCoreIndustrialModeDeps): void {
  deps.industrialDesignMode.setCallbacks({ ...deps.getIndustrialDesignCallbacks() });
}

export function setExplodedViewEnabledImpl(deps: ViewerCoreIndustrialModeDeps, enabled: boolean): void {
  deps.panelVisibility.setExplodedViewEnabled(enabled);
}

export function getExplodedViewEnabledImpl(deps: ViewerCoreIndustrialModeDeps): boolean {
  return deps.panelVisibility.getExplodedViewEnabled();
}

export function setExplodedViewIntensityImpl(deps: ViewerCoreIndustrialModeDeps, value: number): void {
  deps.panelVisibility.setExplodedViewIntensity(value);
}

export function getExplodedViewIntensityImpl(deps: ViewerCoreIndustrialModeDeps): number {
  return deps.panelVisibility.getExplodedViewIntensity();
}

export function applyPanelIdsToBoxImpl(
  deps: ViewerCoreIndustrialModeDeps,
  root: THREE.Object3D,
  boxId: string,
  panelIds?: Partial<BoxPanelIds> | null,
  materialPresetId?: string
): void {
  deps.panelVisibility.applyPanelIdsToBox(root, boxId, panelIds, materialPresetId);
}

export function applyPanelVisibilityForObjectImpl(
  deps: ViewerCoreIndustrialModeDeps,
  root: THREE.Object3D
): void {
  deps.panelVisibility.applyPanelVisibilityForObject(root);
}

export function applyPanelVisibilityForAllBoxesImpl(deps: ViewerCoreIndustrialModeDeps): void {
  deps.panelVisibility.applyPanelVisibilityForAllBoxes();
}

export function applyExplodedViewForObjectImpl(
  deps: ViewerCoreIndustrialModeDeps,
  root: THREE.Object3D
): void {
  deps.panelVisibility.applyExplodedViewForObject(root);
}

export function setPanelEdgesVisibleImpl(deps: ViewerCoreIndustrialModeDeps, visible: boolean): void {
  deps.panelVisibility.setPanelEdgesVisible(visible);
}

export function setPanelHiddenImpl(
  deps: ViewerCoreIndustrialModeDeps,
  panel: "left" | "right" | "top" | "bottom" | "back",
  hidden: boolean
): void {
  deps.panelVisibility.setPanelHidden(panel, hidden);
}

export function setHiddenPanelsImpl(deps: ViewerCoreIndustrialModeDeps, keys: string[]): void {
  deps.panelVisibility.setHiddenPanels(keys);
}

export function getHiddenPanelsImpl(deps: ViewerCoreIndustrialModeDeps): string[] {
  return deps.panelVisibility.getHiddenPanels();
}

export function setAllPanelsHiddenImpl(deps: ViewerCoreIndustrialModeDeps, hidden: boolean): void {
  deps.panelVisibility.setAllPanelsHidden(hidden);
}

export function setPanelRenderingEnabledImpl(deps: ViewerCoreIndustrialModeDeps, enabled: boolean): void {
  deps.panelVisibility.setPanelRenderingEnabled(enabled);
}

export function getPanelRenderingEnabledImpl(deps: ViewerCoreIndustrialModeDeps): boolean {
  return deps.panelVisibility.getPanelRenderingEnabled();
}

export function setIndustrialDesignWorkspaceEnabledImpl(
  deps: ViewerCoreIndustrialModeDeps,
  enabled: boolean
): void {
  deps.industrialDesignMode.setEnabled(enabled);
}

export function getIndustrialDesignWorkspaceEnabledImpl(deps: ViewerCoreIndustrialModeDeps): boolean {
  return deps.industrialDesignMode.isEnabled();
}

export function setIndustrialDesignActiveHoleTypeImpl(
  deps: ViewerCoreIndustrialModeDeps,
  id: HoleTypeId | null
): void {
  deps.industrialDesignMode.setActiveHoleTypeId(id);
}

export function getIndustrialDesignActiveHoleTypeImpl(
  deps: ViewerCoreIndustrialModeDeps
): HoleTypeId | null {
  return deps.industrialDesignMode.getActiveHoleTypeId();
}

export function setIndustrialDesignBoxImpl(
  deps: ViewerCoreIndustrialModeDeps,
  box: IndustrialDesignBox | null,
  targetBoxId?: string | null
): void {
  deps.industrialDesignMode.setDesignBox(box, targetBoxId);
}

export function getIndustrialDesignBoxImpl(deps: ViewerCoreIndustrialModeDeps): IndustrialDesignBox | null {
  return deps.industrialDesignMode.getDesignBox();
}

export function getIndustrialDesignSelectedPanelIdImpl(
  deps: ViewerCoreIndustrialModeDeps
): string | null {
  return deps.industrialDesignMode.getSelectedPanelId();
}

export function setOnIndustrialDesignPanelSelectedImpl(
  deps: ViewerCoreIndustrialModeDeps,
  callback: ((panelId: string | null, boxId: string | null) => void) | null
): void {
  deps.setIndustrialDesignCallbacks({
    ...deps.getIndustrialDesignCallbacks(),
    onPanelSelected: callback ?? undefined,
  });
  syncIndustrialDesignModeCallbacks(deps);
}

export function setOnIndustrialDesignHolePlacedImpl(
  deps: ViewerCoreIndustrialModeDeps,
  callback: ((
    panelId: string,
    hole: DesignDrillHole,
    paired?: { panelId: string; hole: DesignDrillHole }
  ) => void) | null
): void {
  deps.setIndustrialDesignCallbacks({
    ...deps.getIndustrialDesignCallbacks(),
    onHolePlaced: callback ?? undefined,
  });
  syncIndustrialDesignModeCallbacks(deps);
}

export function setOnIndustrialDesignChangedImpl(
  deps: ViewerCoreIndustrialModeDeps,
  callback: ((box: IndustrialDesignBox) => void) | null
): void {
  deps.setIndustrialDesignCallbacks({
    ...deps.getIndustrialDesignCallbacks(),
    onDesignChanged: callback ?? undefined,
  });
  syncIndustrialDesignModeCallbacks(deps);
}

export function setOnIndustrialDesignValidationChangedImpl(
  deps: ViewerCoreIndustrialModeDeps,
  callback: ((issues: DesignValidationIssue[]) => void) | null
): void {
  deps.setIndustrialDesignCallbacks({
    ...deps.getIndustrialDesignCallbacks(),
    onValidationChanged: callback ?? undefined,
  });
  syncIndustrialDesignModeCallbacks(deps);
}

export function setOnIndustrialDesignValidationFailedImpl(
  deps: ViewerCoreIndustrialModeDeps,
  callback: ((error: DesignValidationError) => void) | null
): void {
  deps.setIndustrialDesignCallbacks({
    ...deps.getIndustrialDesignCallbacks(),
    onValidationFailed: callback ?? undefined,
  });
  syncIndustrialDesignModeCallbacks(deps);
}

export function getIndustrialDesignValidationIssuesImpl(
  deps: ViewerCoreIndustrialModeDeps
): DesignValidationIssue[] {
  return deps.industrialDesignMode.getValidationIssues();
}

export function refreshIndustrialDesignValidationImpl(
  deps: ViewerCoreIndustrialModeDeps
): DesignValidationIssue[] {
  return deps.industrialDesignMode.refreshValidation();
}

export function setIndustrialDesignValidationHighlightImpl(
  deps: ViewerCoreIndustrialModeDeps,
  boxId: string,
  panelIds: string[]
): void {
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  const idSet = new Set(panelIds);
  entry.mesh.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const panelId = node.userData?.panelId as string | undefined;
    if (!panelId) return;
    node.userData.industrialDesignValidationError = idSet.has(panelId);
  });
  applyPanelVisibilityForObjectImpl(deps, entry.mesh);
}

export function setIndustrialDesignSelectionHighlightImpl(
  deps: ViewerCoreIndustrialModeDeps,
  boxId: string,
  panelId: string | null
): void {
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  entry.mesh.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const pid = node.userData?.panelId as string | undefined;
    if (!pid) return;
    node.userData.industrialDesignSelected = panelId != null && pid === panelId;
  });
  applyPanelVisibilityForObjectImpl(deps, entry.mesh);
}

export function syncIndustrialDesignViewerOverlayImpl(
  deps: ViewerCoreIndustrialModeDeps,
  boxId: string
): void {
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  const enabled = deps.industrialDesignMode.isEnabled();
  const designBox = deps.industrialDesignMode.getDesignBox();
  const targetId = deps.industrialDesignMode.getTargetBoxId();
  if (!enabled || targetId !== boxId) {
    deps.industrialDesignViewerOverlay.clear(boxId, entry.mesh);
    return;
  }
  deps.industrialDesignViewerOverlay.syncPairingLines(boxId, entry.mesh, designBox, enabled);
}

export function getBoxPanelRaycastHitsImpl(
  deps: ViewerCoreIndustrialModeDeps,
  event: { clientX: number; clientY: number }
): THREE.Intersection[] {
  const canvas = deps.getCanvas();
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return [];
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  deps.pointer.set(x, y);
  deps.raycaster.setFromCamera(deps.pointer, deps.getCamera());
  deps.raycaster.layers.set(0);
  const roots: THREE.Object3D[] = [];
  deps.boxes.forEach((entry) => roots.push(entry.mesh));
  if (!roots.length) return [];
  return deps.raycaster.intersectObjects(roots, true);
}

export function updateBoxDrillMarkersImpl(
  deps: ViewerCoreIndustrialModeDeps,
  boxId: string,
  markers: ViewerDrillMarkersByPanel
): void {
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  entry.drillMarkersByPanel = markers;
  applyPanelVisibilityForObjectImpl(deps, entry.mesh);
  syncIndustrialDesignViewerOverlayImpl(deps, boxId);
}

export function applyViewerDrillHoleSceneRulesImpl(
  deps: ViewerCoreIndustrialModeDeps,
  root: THREE.Object3D
): void {
  deps.boxSceneController.applyViewerDrillHoleSceneRules(root);
}
