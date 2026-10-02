/**
 * pimo-room v4 — API pública oficial (RoomEngine A–E consolidado).
 * Renderer: ViewerCore WebGL. Industrial: via RoomIndustrialAdapter (metadados).
 */

export {
  ROOM_ENGINE_VERSION,
  ROOM_ENGINE_PHASE,
  PIMO_ROOM_PACKAGE,
  PIMO_ALFA_VERSION,
  PIMO_ALFA_EDITION,
  PIMO_ROOM_CAPABILITIES,
} from "./version";

export * from "./RoomState";
export * from "./RoomGeometry";
export * from "./RoomValidator";
export * from "./RoomConverter";
export * from "./RoomBridge";
export { WallEngine } from "./WallEngine";
export { FloorEngine } from "./FloorEngine";
export { CeilingEngine } from "./CeilingEngine";
export { OpeningsEngine } from "./OpeningsEngine";
export { MaterialsEngine, MATERIAL_PRESETS } from "./MaterialsEngine";
export { SlabEngine } from "./SlabEngine";
export {
  enrichLevelsWithElevations,
  getActiveLevelState,
  createLevel,
  toRoomLevelState,
  type RoomLevelState,
  type VerticalConnection,
} from "./levels/RoomLevelState";
export { RoomLevelGeometry, type RoomLevelGeometryDesc } from "./levels/RoomLevelGeometry";
export { RoomLevelManager } from "./levels/RoomLevelManager";
export { WalkthroughCamera } from "./walkthrough/WalkthroughCamera";
export {
  startWalkthrough,
  stopWalkthrough,
  isWalkthroughActive,
  syncLevelGhosts,
} from "./walkthrough/walkthroughHost";
export {
  getRoomEngineViewerApi,
  getRoomEngineViewerHost,
  getRoomViewerApi,
  getRoomViewerCore,
  roomEngineStore,
  setRoomEngineViewerFallback,
  setRoomEngineViewerHost,
  setRoomViewerCore,
  useRoomEngineStore,
  type RoomEngineOpeningConfig,
  type RoomEngineViewerApi,
  type RoomEngineViewerFallback,
  type RoomEngineViewerHost,
} from "./roomEngineStore";
export type { CatalogItem, CatalogItemType, CatalogItemScale } from "./catalog/CatalogItem";
export type { CatalogItemState } from "./catalog/CatalogItemState";
export { CatalogItemManager, toCatalogItemState } from "./catalog/CatalogItemManager";
export { CATALOG_PRESETS, getCatalogPreset } from "./catalog/CatalogPresets";
export {
  syncCatalogItems,
  clearCatalogItemsFromScene,
  selectCatalogItem,
  getSelectedCatalogItemId,
} from "./catalog/catalogHost";
export {
  attachOpeningKeyboardListeners,
  detachOpeningKeyboardListeners,
  registerOpeningKeyboardHandlers,
  patchProjectOpeningFromDoorConfig,
  syncRoomStateOpeningFromConfig,
} from "./openingsHost";
export { IfcLoader } from "./ifc/IfcLoader";
export { IfcParser } from "./ifc/IfcParser";
export { IfcToRoomState, ifcModelToRoomState } from "./ifc/IfcToRoomState";
export { extractIfcModel } from "./ifc/IfcExtractor";
export { syncIfcPreviewFromRoomState, clearIfcPreview } from "./ifc/ifcHost";
export { GlbLoader, RoomGlbLoader } from "./glb/GlbLoader";
export { GlbExporter, buildRoomExportScene } from "./glb/GlbExporter";
export { enhancePbrMaterials, ensureAssetLights } from "./glb/glbMaterials";
export { AiEngine } from "./ai/AiEngine";
export { AiAutoArrange } from "./ai/AiAutoArrange";
export { AiAutoDesign } from "./ai/AiAutoDesign";
export { AI_PRESETS, getAiPreset, isAiPresetId, type AiPresetId } from "./ai/AiPresets";
export { AI_RULES, getLevelBounds, isValidPlacement } from "./ai/AiRules";
export {
  showAiPreview,
  clearAiPreview,
  animateApplyAiLayout,
  cancelAiAnimation,
} from "./ai/aiHost";
export {
  RoomIndustrialAdapter,
  type RoomIndustrialConstraints,
  type RoomFurnitureHint,
  type RoomIndustrialSyncResult,
} from "./RoomIndustrialAdapter";
export {
  buildRoomReportMetadata,
  attachRoomMetadataToDocument,
  type RoomReportMetadata,
} from "./roomMetadata";
export { AboutRoomEngineModal } from "./ui/AboutRoomEngineModal";

import { RoomBridge, type RoomBridgeImportResult } from "./RoomBridge";
import {
  getRoomEngineViewerApi,
  getRoomEngineViewerHost,
  roomEngineStore,
  setRoomEngineViewerFallback,
  setRoomEngineViewerHost,
} from "./roomEngineStore";
import type { RoomState } from "./RoomState";
import { AiEngine } from "./ai/AiEngine";
import type { AiPresetId } from "./ai/AiPresets";
import type { GlbImportKind } from "./glb/GlbLoader";
import { GlbExporter } from "./glb/GlbExporter";
import { ROOM_ENGINE_PHASE, ROOM_ENGINE_VERSION, PIMO_ALFA_VERSION } from "./version";
import { RoomIndustrialAdapter } from "./RoomIndustrialAdapter";

/** Carrega sala a partir de JSON (RoomState / floorplan / envelope IFC/GLB). */
export function loadRoom(raw: unknown): RoomBridgeImportResult {
  return RoomBridge.importJson(raw);
}

export async function importIfc(file: File): Promise<RoomBridgeImportResult> {
  return RoomBridge.importIfcFile(file);
}

export async function importGlb(
  file: File,
  kind: GlbImportKind = "room",
  baseState?: RoomState | null
): Promise<RoomBridgeImportResult> {
  return RoomBridge.importGlbFile(file, kind, baseState);
}

export async function exportGlb(state?: RoomState | null) {
  const s = state ?? roomEngineStore.getState().roomState;
  if (!s) {
    return { ok: false as const, buffer: null, errors: ["Sem RoomState"], warnings: [] as string[] };
  }
  return GlbExporter.exportRoomState(s);
}

export function applyAiPreset(presetId: AiPresetId, state?: RoomState | null) {
  const s = state ?? roomEngineStore.getState().roomState;
  if (!s) {
    return {
      ok: false as const,
      state: null,
      projectRoom: null,
      errors: ["Sem RoomState"],
      warnings: [] as string[],
    };
  }
  return RoomBridge.applyAiPreset(s, presetId);
}

export function autoArrange(state?: RoomState | null) {
  const s = state ?? roomEngineStore.getState().roomState;
  if (!s) return null;
  return AiEngine.arrangeNow(s);
}

export function autoDesign(presetId: AiPresetId, state?: RoomState | null) {
  const s = state ?? roomEngineStore.getState().roomState;
  if (!s) return null;
  return AiEngine.designNow(s, { presetId });
}

export function getRoomState(): RoomState | null {
  return roomEngineStore.getState().roomState;
}

export function setRoomState(state: RoomState | null): void {
  roomEngineStore.getState().setRoomState(state);
}

/** Fachada estável para consumidores externos. */
export const PimoRoom = {
  version: ROOM_ENGINE_VERSION,
  phase: ROOM_ENGINE_PHASE,
  alfaVersion: PIMO_ALFA_VERSION,
  loadRoom,
  importIfc,
  importGlb,
  exportGlb,
  applyAiPreset,
  autoArrange,
  autoDesign,
  getRoomState,
  setRoomState,
  industrial: RoomIndustrialAdapter,
  bridge: RoomBridge,
} as const;

/**
 * Boundary pública do RoomEngine.
 * Consumidores externos devem entrar por esta fachada.
 */
export const RoomEngineBoundary = {
  ...PimoRoom,
  viewer: {
    setHost: setRoomEngineViewerHost,
    setFallback: setRoomEngineViewerFallback,
    getHost: getRoomEngineViewerHost,
    getApi: getRoomEngineViewerApi,
  },
} as const;
