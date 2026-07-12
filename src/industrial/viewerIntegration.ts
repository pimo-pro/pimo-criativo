import type { ViewerMaterialSyncSurface } from "../3d/viewer-engine/integration/viewerIndustrialSurface";
import { getViewerMaterialId } from "../core/materials/service";

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

/** Callbacks opcionais expostos em `window.viewerCore` usados após sync de materiais. */
export type ViewerCoreIndustrialSurface = ViewerMaterialSyncSurface;

/**
 * Actualiza overlays do viewer após alteração de materiais (remates/rodapés).
 * Extraído de `core/materials/materialSync` para boundary explícito.
 */
export function refreshViewerAfterMaterialSync(result: MaterialSyncViewerRefresh): void {
  if (typeof window === "undefined") return;
  const run = () => {
    const core = (window as Window & { viewerCore?: ViewerCoreIndustrialSurface }).viewerCore;
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
 * Aplica material à frente da gaveta no viewer 3D (sem rebuild estrutural).
 * Usado por actions de material e como fallback em useCalculadoraSync.
 */
export function syncDrawerFrontMaterialToViewer(
  boxId: string,
  drawerLayerId: string,
  materialId: string,
  grainOptions?: { allowPieceRotation?: boolean }
): void {
  if (typeof window === "undefined") return;
  const viewerMaterialId = getViewerMaterialId(materialId);
  const run = () => {
    const core = (
      window as Window & {
        viewerCore?: ViewerCoreIndustrialSurface & {
          updateDrawerMaterial?: (
            b: string,
            d: string,
            m: string,
            g?: { allowPieceRotation?: boolean }
          ) => void;
        };
      }
    ).viewerCore;
    core?.updateDrawerMaterial?.(boxId, drawerLayerId, viewerMaterialId, grainOptions);
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    run();
  }
}

/** Reaplica UV do veio na porta após toggle "Rotação do veio (YY)". */
export function syncDoorWoodGrainToViewer(
  boxId: string,
  doorLayerId: string,
  materialId: string,
  grainOptions?: { allowPieceRotation?: boolean; pieceTipo?: string }
): void {
  if (typeof window === "undefined") return;
  const viewerMaterialId = getViewerMaterialId(materialId);
  const run = () => {
    const core = (
      window as Window & {
        viewerCore?: ViewerCoreIndustrialSurface & {
          updateDoorMaterial?: (
            b: string,
            d: string,
            m: string,
            g?: { allowPieceRotation?: boolean; pieceTipo?: string }
          ) => void;
        };
      }
    ).viewerCore;
    core?.updateDoorMaterial?.(boxId, doorLayerId, viewerMaterialId, grainOptions);
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
  workspace: "components/layout/workspace/Workspace → window.viewerCore",
} as const;
