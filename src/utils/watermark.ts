/**
 * Aplica marca d'água com o logo oficial (logo-pi.png) em um canvas 2D.
 * Usado nas imagens geradas pelo viewer (export/screenshot).
 */

export interface WatermarkOptions {
  /** Opacidade da marca d'água (0.1–0.2 recomendado). */
  opacity?: number;
  /** Posição: 'bottom-right' | 'center'. */
  position?: "bottom-right" | "center";
  /** Largura da marca em % da largura do canvas (ex: 0.10–0.15). */
  widthPercent?: number;
  /** URL do logo (deve estar em public para funcionar em build). */
  logoUrl?: string;
}

const DEFAULT_LOGO_URL = "/logo-pi.png";
const DEFAULT_OPACITY = 0.15;
const DEFAULT_WIDTH_PERCENT = 0.12;
const DEFAULT_PADDING_PERCENT = 0.02;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

/**
 * Desenha o logo como marca d'água no canvas.
 * @param canvas - Canvas já preenchido com a imagem de destino
 * @param options - Opacidade, posição e tamanho
 */
export async function applyImageWatermark(
  canvas: HTMLCanvasElement,
  options: WatermarkOptions = {}
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const {
    opacity = DEFAULT_OPACITY,
    position = "bottom-right",
    widthPercent = DEFAULT_WIDTH_PERCENT,
    logoUrl = DEFAULT_LOGO_URL,
  } = options;

  const width = canvas.width;
  const height = canvas.height;
  const padding = Math.max(12, Math.min(width, height) * DEFAULT_PADDING_PERCENT);
  const logoWidth = Math.max(40, Math.round(width * widthPercent));
  const logoHeight = Math.round((logoWidth * 9) / 16); // proporção aproximada

  let img: HTMLImageElement;
  try {
    img = await loadImage(logoUrl);
  } catch {
    return;
  }

  let x: number;
  let y: number;
  if (position === "center") {
    x = (width - logoWidth) / 2;
    y = (height - logoHeight) / 2;
  } else {
    x = width - logoWidth - padding;
    y = height - logoHeight - padding;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0.1, Math.min(0.2, opacity));
  ctx.drawImage(img, x, y, logoWidth, logoHeight);
  ctx.restore();
}
