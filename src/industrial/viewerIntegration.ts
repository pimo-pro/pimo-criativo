import type { ViewerMaterialSyncSurface } from "../3d/viewer-engine/integration/viewerIndustrialSurface";
import { getViewerMaterialId } from "../core/materials/service";
import { getActiveViewerCore } from "../core/viewer/pimoViewerRuntime";
import type { DrawerLayerItem } from "../models/BoxLayers";

/**
 * Boundary viewer ↔ mundo industrial / app.
 *
 * O ViewerCore não importa `industrial/**` directamente.
 * Integrações passam por projectState, hooks e este módulo.
 *
 * @see docs/architecture/industrial-boundaries.md
 */

export type MaterialSyncViewerRefresh = {
  affectedRemateIds: string[];
  affectedRodapeIds: string[];
};

/** Callbacks opcionais da superfície pública do viewer usados após sync de materiais. */
export type ViewerCoreIndustrialSurface = ViewerMaterialSyncSurface;

/**
 * Actualiza overlays do viewer após alteração de materiais (remates/rodapés).
 * Extraído de `core/materials/materialSync` para boundary explícito.
 */
export function refreshViewerAfterMaterialSync(result: MaterialSyncViewerRefresh): void {
  const run = () => {
    const core = getActiveViewerCore() as ViewerCoreIndustrialSurface | null;
    if (!core) return;
    if (result.affectedRemateIds.length > 0) {
      core.syncRemateVisuals?.();
    }
    if (result.affectedRodapeIds.length > 0) {
      core.syncRodapeVisuals?.();
    }
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    run();
  }
}

/**
 * Aplica material à frente da gaveta no viewer 3D (rebuild via updateBox quando há drawerLayerItems).
 * Usado por actions de material e como fallback em useCalculadoraSync.
 */
export function syncDrawerFrontMaterialToViewer(
  boxId: string,
  drawerLayerId: string,
  materialId: string,
  drawerLayerItems?: DrawerLayerItem[]
): void {
  const viewerMaterialId = getViewerMaterialId(materialId);
  const run = () => {
    const core = getActiveViewerCore();
    core?.updateDrawerMaterial?.(boxId, drawerLayerId, viewerMaterialId, drawerLayerItems);
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    run();
  }
}

/** Pontos de integração documentados (sem lógica — referência para Fase 4). */
export const VIEWER_INDUSTRIAL_INTEGRATION_POINTS = {
  materialSync: "core/materials/materialSync → refreshViewerAfterMaterialSync",
  cutlist: "context/projectState → manufacturing/cutlistFromBoxes (sem import viewer)",
  export: "hooks/useGerarArquivoHandlers → fabrication (independente do viewer loop)",
  pieceQr: "app/industrial/piece → qrcode/qrcodeService",
  workspace: "components/layout/workspace/Workspace → PimoViewerApi",
} as const;
