import jsPDF from "jspdf";
import qrcode from "qrcode-generator";
import type { LabelDesignerConfig, LabelElement, LabelTextElement, LabelQrElement, LabelLogoElement } from "./labelDesignerTypes";
import { generateQrCodeSvg } from "../qrcode/qrcodeService";
import { buildFullIndustrialName, buildIndustrialId } from "../naming/industrialNaming";

const etiquetaCode = buildIndustrialId(
  buildFullIndustrialName("Meu Projeto", "Estante Principal", "prateleira")
);
const PREVIEW_DATA = {
  projeto: "Meu Projeto",
  caixa: "Estante Principal",
  peca: "Prateleira",
  madeira: "MDF Branco 18mm",
  medidas: "600×400×18 mm",
  numero_peca: etiquetaCode,
  etiquetaCode,
};

function getPreviewText(type: LabelElement["type"]): string {
  if (type === "qr" || type === "logo") return "";
  return (PREVIEW_DATA as Record<string, string>)[type] ?? "";
}

function isText(el: LabelElement): el is LabelTextElement {
  return el.type !== "qr" && el.type !== "logo";
}
function isQr(el: LabelElement): el is LabelQrElement {
  return el.type === "qr";
}
function isLogo(el: LabelElement): el is LabelLogoElement {
  return el.type === "logo";
}

function drawQrToPdf(doc: jsPDF, content: string, x: number, y: number, sizeMm: number, errorLevel: "L" | "M" | "Q" | "H" = "M", margin = 0) {
  const qr = qrcode(0, errorLevel);
  qr.addData(content);
  qr.make();
  const count = qr.getModuleCount();
  const moduleSize = sizeMm / Math.max(1, count);
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(0, 0, 0);
  const pad = margin;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue;
      doc.rect(x + pad + c * moduleSize, y + pad + r * moduleSize, moduleSize, moduleSize, "F");
    }
  }
}

export function exportLabelToPdf(config: LabelDesignerConfig, copiesPerPiece = 1): jsPDF {
  const w = config.widthMm;
  const h = config.heightMm;
  const doc = new jsPDF({ unit: "mm", format: [w, h] });
  const total = copiesPerPiece;
  for (let page = 0; page < total; page++) {
    if (page > 0) doc.addPage([w, h], config.orientation === "vertical" ? "portrait" : "landscape");
    doc.setFillColor(config.backgroundColor);
    doc.rect(0, 0, w, h, "F");
    doc.setDrawColor(config.borderColor);
    doc.setLineWidth(config.borderWidthMm);
    doc.roundedRect(0.5, 0.5, w - 1, h - 1, config.borderRadiusMm, config.borderRadiusMm, "S");
    const padT = config.marginTopMm;
    const padL = config.marginLeftMm;
    for (const el of config.elements) {
      if (!el.visible) continue;
      const x = padL + el.x;
      const y = padT + el.y;
      if (isQr(el)) {
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, el.qrSizeMm, el.qrSizeMm, "F");
        drawQrToPdf(doc, PREVIEW_DATA.etiquetaCode, x, y, el.qrSizeMm, el.qrErrorLevel ?? "M", el.qrMarginMm ?? 0);
      } else if (isLogo(el) && el.logoDataUrl) {
            try {
              const fmt = el.logoDataUrl.startsWith("data:image/svg") ? "SVG" : el.logoDataUrl.includes("jpeg") || el.logoDataUrl.includes("jpg") ? "JPEG" : "PNG";
              doc.addImage(el.logoDataUrl, fmt, x, y, el.width, el.height);
            } catch {
          doc.setFontSize(8);
          doc.text("Logo", x, y + el.height / 2);
        }
      } else if (isText(el)) {
        doc.setFont(el.fontFamily, el.fontWeight === "bold" ? "bold" : "normal");
        doc.setFontSize(el.fontSize);
        const hex = el.color.replace("#", "");
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        doc.setTextColor(r, g, b);
        const text = getPreviewText(el.type);
        doc.text(text, x, y + el.fontSize * 0.35, { maxWidth: el.width });
      }
    }
  }
  return doc;
}

export function exportLabelGridPrint(config: LabelDesignerConfig, cols: number, rows: number, copiesPerPiece: number): jsPDF {
  const w = config.widthMm;
  const h = config.heightMm;
  const gap = 5;
  const perPage = cols * rows;
  const total = copiesPerPiece * perPage;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (let idx = 0; idx < total; idx++) {
    if (idx > 0 && idx % perPage === 0) doc.addPage("a4");
    const actualCol = idx % cols;
    const actualRow = Math.floor((idx % perPage) / cols);
    const tx = gap + actualCol * (w + gap);
    const ty = gap + actualRow * (h + gap);
        doc.setFillColor(config.backgroundColor);
        doc.rect(tx, ty, w, h, "F");
        doc.setDrawColor(config.borderColor);
        doc.setLineWidth(config.borderWidthMm);
        doc.roundedRect(tx + 0.5, ty + 0.5, w - 1, h - 1, config.borderRadiusMm, config.borderRadiusMm, "S");
        const padT = config.marginTopMm;
        const padL = config.marginLeftMm;
        for (const el of config.elements) {
          if (!el.visible) continue;
          const x = tx + padL + el.x;
          const y = ty + padT + el.y;
          if (isQr(el)) {
            doc.setFillColor(255, 255, 255);
            doc.rect(x, y, el.qrSizeMm, el.qrSizeMm, "F");
            drawQrToPdf(doc, PREVIEW_DATA.etiquetaCode, x, y, el.qrSizeMm, el.qrErrorLevel ?? "M", el.qrMarginMm ?? 0);
          } else if (isLogo(el) && el.logoDataUrl) {
            try {
              const fmt = el.logoDataUrl.startsWith("data:image/svg") ? "SVG" : el.logoDataUrl.includes("jpeg") || el.logoDataUrl.includes("jpg") ? "JPEG" : "PNG";
              doc.addImage(el.logoDataUrl, fmt, x, y, el.width, el.height);
            } catch {
              doc.setFontSize(8);
              doc.text("Logo", x, y + el.height / 2);
            }
          } else if (isText(el)) {
            doc.setFont(el.fontFamily, el.fontWeight === "bold" ? "bold" : "normal");
            doc.setFontSize(el.fontSize);
            const hex = el.color.replace("#", "");
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            doc.setTextColor(r, g, b);
            doc.text(getPreviewText(el.type), x, y + el.fontSize * 0.35, { maxWidth: el.width });
          }
        }
  }
  return doc;
}

export async function exportLabelToPng300(config: LabelDesignerConfig): Promise<Blob> {
  const dpi = 300;
  const scale = dpi / 25.4;
  const w = config.widthMm * scale;
  const h = config.heightMm * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = config.borderWidthMm * scale;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, config.borderRadiusMm * scale);
  ctx.stroke();
  const padT = config.marginTopMm * scale;
  const padL = config.marginLeftMm * scale;
  for (const el of config.elements) {
    if (!el.visible) continue;
    const x = padL + el.x * scale;
    const y = padT + el.y * scale;
    const elW = (isQr(el) ? el.qrSizeMm : el.width) * scale;
    const elH = (isQr(el) ? el.qrSizeMm : el.height) * scale;
    if (isQr(el)) {
      const qrSvg = generateQrCodeSvg(PREVIEW_DATA.etiquetaCode, el.qrErrorLevel ?? "M", el.qrMarginMm ?? 0);
      const img = new Image();
      const blob = new Blob([qrSvg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((res, rej) => {
        img.onload = () => {
          ctx.fillStyle = "#fff";
          ctx.fillRect(x, y, elW, elH);
          ctx.drawImage(img, x, y, elW, elH);
          URL.revokeObjectURL(url);
          res();
        };
        img.onerror = rej;
        img.src = url;
      });
    } else if (isLogo(el) && el.logoDataUrl) {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => {
          ctx.drawImage(img, x, y, elW, elH);
          res();
        };
        img.onerror = rej;
        img.src = el.logoDataUrl;
      });
    } else if (isText(el)) {
      ctx.font = `${el.fontWeight === "bold" ? "bold " : ""}${el.fontSize * scale}px ${el.fontFamily}`;
      ctx.fillStyle = el.color;
      ctx.globalAlpha = el.opacity;
      ctx.textBaseline = "top";
      ctx.fillText(getPreviewText(el.type), x, y, el.width * scale);
      ctx.globalAlpha = 1;
    }
  }
  return new Promise((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("Canvas toBlob failed"))),
      "image/png",
      1
    );
  });
}
