import type { ViewerMaterialSyncSurface } from '../../3d/viewer-engine/integration/viewerIndustrialSurface';
import { getViewerMaterialId } from '../materials/service';

/**
 * Boundary viewer ↔ app (design).
 * Mantido no criativo — sem dependência do MES industrial.
 */

export type MaterialSyncViewerRefresh = {
  affectedRemateIds: string[];
  affectedRodapeIds: string[];
};

export type ViewerCoreIndustrialSurface = ViewerMaterialSyncSurface;

export function refreshViewerAfterMaterialSync(result: MaterialSyncViewerRefresh): void {
  if (typeof window === 'undefined') return;
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
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  } else {
    run();
  }
}

export function syncDrawerFrontMaterialToViewer(
  boxId: string,
  drawerLayerId: string,
  materialId: string
): void {
  if (typeof window === 'undefined') return;
  const viewerMaterialId = getViewerMaterialId(materialId);
  const run = () => {
    const core = (
      window as Window & {
        viewerCore?: ViewerCoreIndustrialSurface & {
          updateDrawerMaterial?: (b: string, d: string, m: string) => void;
        };
      }
    ).viewerCore;
    core?.updateDrawerMaterial?.(boxId, drawerLayerId, viewerMaterialId);
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  } else {
    run();
  }
}
