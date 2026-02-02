import type { ViewerOptions } from "../3d/core/Viewer";

/**
 * Configurações padronizadas do viewer 3D.
 * Usadas pelo Workspace (página principal) e DevActions para manter
 * iluminação, controles e comportamento idênticos.
 */
export const DEFAULT_VIEWER_OPTIONS: Omit<ViewerOptions, "background" | "skipInitialBox"> = {
  enableControls: true,
  controls: {
    enableDamping: true,
    dampingFactor: 0.08,
    minDistance: 1.5,
    maxDistance: 12,
    minPolarAngle: Math.PI * 0.15,
    maxPolarAngle: Math.PI * 0.45,
  },
};

export const VIEWER_BACKGROUND = "#0f172a" as const;
