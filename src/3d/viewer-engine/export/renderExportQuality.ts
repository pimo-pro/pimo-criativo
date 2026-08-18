/**
 * Constantes e helpers da captura de imagem do Viewer.
 * Sem WebGL — testável em isolamento.
 */

export const VIEWER_RENDER_SIZE_MAP = {
  small: [1280, 720],
  medium: [1600, 900],
  large: [1920, 1080],
  "4k": [3840, 2160],
} as const;

/** Tecto GPU da captura (4K). Evita 8K em size=4k com supersample. */
export const MAX_EXPORT_EDGE = 3840;
export const MAX_EXPORT_PIXELS = 3840 * 2160;

export type BloomCapturePreset = {
  strength: number;
  radius: number;
  threshold: number;
};

/** Bloom de captura: limiar alto para não destruir arestas nem lavar o MDF. */
export const CAPTURE_SHOWCASE_BLOOM: BloomCapturePreset = {
  strength: 0.08,
  radius: 0.26,
  threshold: 0.94,
};

export const CAPTURE_MAIN_BLOOM: BloomCapturePreset = {
  strength: 0.035,
  radius: 0.28,
  threshold: 0.92,
};

/** Bloom ao vivo (Alta/Média) — mais contido que o valor histórico 0.18. */
export const LIVE_SHOWCASE_BLOOM: BloomCapturePreset = {
  strength: 0.1,
  radius: 0.28,
  threshold: 0.93,
};

export const LIVE_MAIN_BLOOM: BloomCapturePreset = {
  strength: 0.04,
  radius: 0.32,
  threshold: 0.9,
};

export type PhotoCaptureLightFactors = {
  exposure: number;
  keyMul: number;
  fillBase: number;
  fillSpan: number;
  ambientBase: number;
  ambientSpan: number;
  rimBase: number;
  rimSpan: number;
  hemisphereMul: number;
};

export const PHOTO_CAPTURE_LIGHT: PhotoCaptureLightFactors = {
  exposure: 1.34,
  keyMul: 1.32,
  fillBase: 1.05,
  fillSpan: 0.28,
  ambientBase: 1.18,
  ambientSpan: 0.12,
  rimBase: 1.02,
  rimSpan: 0.22,
  hemisphereMul: 1.22,
};

export function clampExportDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 2) return fallback;
  return Math.min(MAX_EXPORT_EDGE, Math.max(2, Math.round(value)));
}

export function resolveSupersampleScale(
  width: number,
  height: number,
  advancedRealism: boolean
): number {
  if (!advancedRealism) return 1;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let scale = 2;
  while (scale > 1 && w * scale * h * scale > MAX_EXPORT_PIXELS) {
    scale -= 0.25;
  }
  return Math.max(1, scale);
}

export function resolveExportRenderSize(
  width: number,
  height: number,
  advancedRealism: boolean
): { renderWidth: number; renderHeight: number; supersampleScale: number } {
  const supersampleScale = resolveSupersampleScale(width, height, advancedRealism);
  const renderWidth = Math.max(1, Math.round(width * supersampleScale));
  const renderHeight = Math.max(1, Math.round(height * supersampleScale));
  return { renderWidth, renderHeight, supersampleScale };
}
