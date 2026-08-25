import qrcode from "qrcode-generator";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { resolveNomeIndustrialForEtiqueta } from "../etiquetas/industrialDisplayName";
import { buildEtiquetaCodeV5 } from "../etiquetas/qr/etiquetaCodeV5";
import { resolveAuthoritativeLabelNumber } from "./panelLabelNumber";

type ProjectQrContext = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
};

function cyclicPieceNumber(index0: number, restart99: boolean): number {
  if (!restart99) return index0 + 1;
  return (index0 % 99) + 1;
}

function normalizePieceDigits(value: number): 2 | 3 {
  if (!Number.isFinite(value)) return 3;
  if (value <= 2) return 2;
  return 3;
}

function getPieceSuffix(pieceNumber: number, pieceDigits: 2 | 3): string {
  const maxNumber = 10 ** pieceDigits - 1;
  const safeNumber = ((Math.max(1, Math.floor(pieceNumber)) - 1) % maxNumber) + 1;
  return String(safeNumber).padStart(pieceDigits, "0");
}

export function getPieceLabel(pieceNumber: number, rules?: RulesConfig): string {
  const pieceDigits = normalizePieceDigits(rules?.qrcode?.numeroDigitosPeca ?? 3);
  return `P-${getPieceSuffix(pieceNumber, pieceDigits)}`;
}

/** ID industrial (N QR) da peça — mesma regra da etiqueta. */
export function resolvePieceIndustrialId(
  piece: CutListItemComPreco,
  project: ProjectQrContext
): string {
  const boxNome =
    project.boxes.find((b) => b.id === piece.boxId)?.nome ?? piece.boxId ?? "";
  const tokenMap = project.rules.labelSystemV5?.naming?.pieceTypeTokens ?? null;
  const nomeIndustrial = resolveNomeIndustrialForEtiqueta(
    piece,
    project.projectName ?? "PROJETO",
    boxNome,
    tokenMap
  );
  return buildEtiquetaCodeV5({
    projectName: project.projectName ?? "PROJETO",
    pieceSeq: resolveAuthoritativeLabelNumber(piece) ?? 1,
    totalPiecesInSheet: 0,
    boxName: boxNome,
    nomeIndustrial,
  });
}

type QrErrorLevel = "L" | "M" | "Q" | "H";

export function generateQrCodeSvg(content: string, errorLevel: QrErrorLevel = "M", margin = 0): string {
  const qr = qrcode(0, errorLevel);
  qr.addData(content);
  qr.make();
  return qr.createSvgTag({ scalable: true, margin });
}

export type QrLogoConfig = {
  logoDataUrl?: string;
  logoSizePercent?: number;
  /** Tamanho absoluto do logo no centro do QR (mm). Tem prioridade sobre percentagem. */
  logoSizeMm?: number;
  /** Tamanho do QR em mm (necessário quando logoSizeMm é usado). */
  qrSizeMm?: number;
  errorCorrection?: QrErrorLevel;
};

export async function generateQrCanvasWithLogo(
  data: string,
  size: number,
  config: QrLogoConfig = {}
): Promise<HTMLCanvasElement> {
  const qr = qrcode(0, config.errorCorrection ?? "H");
  qr.addData(data);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const moduleSize = size / Math.max(1, moduleCount);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context from canvas");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (!qr.isDark(r, c)) continue;
      const x = c * moduleSize;
      const y = r * moduleSize;
      ctx.fillRect(x, y, moduleSize, moduleSize);
    }
  }

  if (config.logoDataUrl) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => reject(new Error("Failed to load logo image"));
        logoImg.src = config.logoDataUrl!;
      });

      let logoDimension: number;
      if (config.logoSizeMm != null && config.logoSizeMm > 0 && config.qrSizeMm != null && config.qrSizeMm > 0) {
        logoDimension = (size * config.logoSizeMm) / config.qrSizeMm;
      } else {
        const logoPercent = Math.min(30, Math.max(10, config.logoSizePercent ?? 20));
        logoDimension = (size * logoPercent) / 100;
      }

      const logoX = (size - logoDimension) / 2;
      const logoY = (size - logoDimension) / 2;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(logoX - 2, logoY - 2, logoDimension + 4, logoDimension + 4);
      ctx.drawImage(logoImg, logoX, logoY, logoDimension, logoDimension);
    } catch (err) {
      console.warn("[qrcodeService] Failed to render logo:", err);
    }
  }

  return canvas;
}

/**
 * Atribui `pieceNumber` + `qrSvg` (payload = ID industrial da etiqueta).
 * Substitui o antigo `attachQrCodesToCutlist` (sem shortCode legado).
 */
export function attachLabelNumbersToCutlist(
  items: CutListItemComPreco[],
  project: ProjectQrContext
): CutListItemComPreco[] {
  if (!items || !Array.isArray(items)) return [];
  if (!project || !project.rules) {
    console.warn("[qrcodeService] Invalid project context, returning items without label numbers");
    return items;
  }

  const restartAt99 = project.rules?.qrcode?.reiniciarContagemEm99 ?? true;

  return items.map((item, idx) => {
    if (!item || !item.tipo) {
      console.warn("[qrcodeService] Skipping invalid item:", item);
      return item;
    }

    try {
      const authoritative = resolveAuthoritativeLabelNumber(item);
      const pieceNumber =
        authoritative != null ? authoritative : cyclicPieceNumber(idx, restartAt99);
      const withNumber = { ...item, pieceNumber };
      const industrialId = resolvePieceIndustrialId(withNumber, project);
      const { shortCode: _removed, ...rest } = withNumber as CutListItemComPreco & {
        shortCode?: string;
      };
      return {
        ...rest,
        pieceNumber,
        qrSvg: industrialId ? generateQrCodeSvg(industrialId) : "",
      };
    } catch (err) {
      console.warn(`[qrcodeService] Error attaching label number to item ${idx}:`, err);
      return item;
    }
  });
}
