import jsPDF from "jspdf";
import qrcode from "qrcode-generator";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import type { SettingsSchema } from "../settings/settingsService";
import { buildGlobalQrCutlistMerged } from "../manufacturing/cutlistFromBoxes";
import { generateQrCanvasWithLogo } from "../qrcode/qrcodeService";
import { resolveAuthoritativeLabelNumber } from "../qrcode/panelLabelNumber";
import { buildPiecesPerSheetMap, labelItemSheetKey } from "../etiquetas/qr/etiquetaCodeV5";
import { resolveEtiquetaDisplayCodeV5 } from "../etiquetas/qr/etiquetaQr";
import type { LabelConfig } from "../labelConfig/labelConfig";
import {
  resolveLabelSystemConfig,
  type ResolvedLabelRuntime,
} from "../labelSystem/resolveLabelSystemConfig";
import type { QrPolicy } from "../labelSystem/LabelSystemV5";
import { normalizeCutLayoutPlacements } from "../etiquetas/engine/nestingAdapter";
import { prepareEtiquetasForPrint } from "../etiquetas/engine/nestingLabelOrder";
import { drawAutoFitLabelText } from "../etiquetas/render/labelTextAutoFit";
import { formatDimensionV5, formatNumberV5 } from "./labelMeasuresV5";
import {
  computeV5LabelLayout,
  V5_LAYOUT_PAD_MM,
  V5_LAYOUT_QR_GAP_BELOW_MM,
} from "./labelLayoutV5";
import {
  collectObservationsForItem,
  observationsToV5Slots,
} from "../observacoes/ObservacoesService";
import { drawLogoIndustrialInBox, loadLogoIndustrialDataUrl, LOGO_INDUSTRIAL_SIZE_MM } from "./logoIndustrialPublic";
import {
  buildV5BottomStripIndustrialName,
  resolveNomeIndustrialForEtiqueta,
} from "../etiquetas/industrialDisplayName";
import {
  computePieceSequence,
  type PieceData,
  type PieceOrlaConfigInput,
  type PieceProductionKind,
  type PieceProductionSequence,
} from "../labelConfig/labelSequenceEngine";
import { pieceShouldHaveDrillLabel } from "../drill/xmlMachineRouting";
import type {
  LabelDesignerConfig,
  LabelTextElement,
  LabelQrElement,
  LabelLogoElement,
} from "../labelDesigner/labelDesignerTypes";

const BRAND_RED_ETI: [number, number, number] = [139, 0, 0];

/** Posição de uma peça no layout de corte (usada para ordenar etiquetas por chapa). */
type SheetPlacement = {
  partName: string;
  boxId: string;
  sheetIndex: number;
  x_mm: number;
  y_mm: number;
};

export type ProjectForEtiquetasPdf = {
  projectName: string;
  boxes: BoxModule[];
  rules: RulesConfig;
  materialId?: string;
  extractedPartsByBoxId?: Record<string, Record<string, CutListItemComPreco[]>>;
  settings?: SettingsSchema;
  /** Posições das peças no nesting final; se fornecidas, ordena etiquetas por chapa. */
  cutLayoutPlacements?: SheetPlacement[];
  /** Config do designer de etiquetas (legado S3 — ignorado pelo motor v5 de produção). */
  designerConfig?: LabelDesignerConfig;
  /** Itens pré-calculados (útil para exportação multi-projeto; skip getCutlistWithMetadata). */
  precomputedItems?: CutListItemComPreco[];
  /** Orla V1 por panelId — opcional para renderer v5. */
  orlaPiecesByPanelId?: Record<string, PieceOrlaConfigInput>;
  /** Observações por peça (panelId). */
  pieceObservacoes?: import("../observacoes/observacoesTypes").PieceObservacoesStore;
};

type LabelItem = CutListItemComPreco & {
  boxNome?: string;
  pieceName?: string;
  /** Nome do projeto de origem da peça (fabricação em massa). */
  sourceProjectName?: string;
  /** Total de peças na folha/caixa (NUM_CAIXA) — uso interno v5 / futuro tracking. */
  numCaixa?: number;
  /** Observações ligadas à peça/etiqueta (máx. 3 para v5). */
  observations?: string[];
};

/** Nome industrial alinhado ao Layout de Corte PRO (`<prefixoCaixa>_<prefixoPeca>`). */
function nomeIndustrialParaEtiqueta(item: LabelItem, project: ProjectForEtiquetasPdf): string {
  const projectName = item.sourceProjectName ?? project.projectName;
  return resolveNomeIndustrialForEtiqueta(item, projectName, item.boxNome);
}

/** Código da etiqueta — ID industrial (`buildIndustrialId`); legado S1/S3 usa o mesmo SSOT. */
function resolveEtiquetaCodeParaEtiqueta(
  item: LabelItem,
  ctx: { projectName: string; boxes: BoxModule[]; rules: RulesConfig }
): string {
  return resolveEtiquetaDisplayCodeV5(item, ctx, new Map(), 0);
}

function getCutlistWithMetadata(project: ProjectForEtiquetasPdf): LabelItem[] {
  const boxById = new Map(project.boxes.map((b) => [b.id, b]));

  if (project.precomputedItems) {
    return project.precomputedItems.map((p) => {
      const documentaryBox =
        typeof p.metadata?.documentaryBoxNome === "string"
          ? p.metadata.documentaryBoxNome.trim()
          : "";
      return {
        ...p,
        boxNome:
          documentaryBox ||
          boxById.get(p.boxId ?? "")?.nome ||
          p.boxId ||
          "—",
        pieceName: p.nome,
        sourceProjectName: (p as unknown as Record<string, unknown>).sourceProjectName as
          | string
          | undefined,
      };
    });
  }

  const parametric = buildGlobalQrCutlistMerged(
    project.boxes,
    project.rules,
    project.materialId,
    project.projectName,
    project.extractedPartsByBoxId
  );
  return parametric.map((p) => ({
    ...p,
    boxNome: boxById.get(p.boxId ?? "")?.nome ?? p.boxId ?? "—",
    pieceName: p.nome,
  }));
}

function drawQrFromCode(doc: jsPDF, code: string, x: number, y: number, size: number) {
  const qr = qrcode(0, "M");
  qr.addData(code);
  qr.make();
  const count = qr.getModuleCount();
  const moduleSize = size / Math.max(1, count);
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue;
      doc.rect(x + c * moduleSize, y + r * moduleSize, moduleSize, moduleSize, "F");
    }
  }
}

async function drawQrWithLogoOrFallback(
  doc: jsPDF,
  code: string,
  x: number,
  y: number,
  size: number,
  settings?: SettingsSchema
) {
  const industrialLogo = await loadLogoIndustrialDataUrl();
  const logoUrl =
    industrialLogo ||
    (settings?.etiquetasQr?.logoAtivado && settings.etiquetasQr.logoDataUrl
      ? settings.etiquetasQr.logoDataUrl
      : "");
  if (!logoUrl) {
    drawQrFromCode(doc, code, x, y, size);
    return;
  }

  try {
    const canvas = await generateQrCanvasWithLogo(code, size * 10, {
      logoDataUrl: logoUrl,
      logoSizeMm: LOGO_INDUSTRIAL_SIZE_MM,
      qrSizeMm: size,
      logoSizePercent: settings?.etiquetasQr?.logoTamanhoPorcento ?? 20,
    });
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", x, y, size, size);
  } catch {
    drawQrFromCode(doc, code, x, y, size);
  }
}

/** Renderer S3 legado — não usado em produção (ver `labelPdfLegacyRenderRefs`). */
async function renderEtiquetaPageFromDesignerConfig(
  doc: jsPDF,
  item: LabelItem,
  project: ProjectForEtiquetasPdf,
  cfg: LabelDesignerConfig,
): Promise<void> {
  const w = cfg.widthMm;
  const h = cfg.heightMm;

  doc.setFillColor(cfg.backgroundColor || "#ffffff");
  doc.rect(0, 0, w, h, "F");

  if ((cfg.borderWidthMm ?? 0) > 0) {
    doc.setDrawColor(cfg.borderColor || "#888888");
    doc.setLineWidth(cfg.borderWidthMm);
    const r = cfg.borderRadiusMm ?? 0;
    if (r > 0) {
      doc.roundedRect(0.5, 0.5, w - 1, h - 1, r, r, "S");
    } else {
      doc.rect(0.5, 0.5, w - 1, h - 1, "S");
    }
  }

  const effectiveProjectName = item.sourceProjectName ?? project.projectName;
  const etiquetaCode = resolveEtiquetaCodeParaEtiqueta(item, {
    projectName: effectiveProjectName,
    boxes: project.boxes,
    rules: project.rules,
  });

  const larg = Math.round(item.dimensoes?.largura ?? 0);
  const alt  = Math.round(item.dimensoes?.altura ?? 0);
  const esp  = Math.round(item.espessura ?? 0);

  const nomeIndustrial = nomeIndustrialParaEtiqueta(item, project);

  const dataMap: Record<string, string> = {
    projeto:     effectiveProjectName || "PROJETO",
    caixa:       item.boxNome ?? item.boxId ?? "—",
    peca:        nomeIndustrial,
    madeira:     (item.material ?? "—").toUpperCase(),
    medidas:     `${larg}×${alt}×${esp} mm`,
    numero_peca: etiquetaCode,
  };

  const padT = cfg.marginTopMm ?? 2;
  const padL = cfg.marginLeftMm ?? 2;

  for (const el of cfg.elements) {
    if (!el.visible) continue;
    const x = padL + el.x;
    const y = padT + el.y;

    if (el.type === "qr") {
      await drawQrWithLogoOrFallback(
        doc,
        etiquetaCode,
        x,
        y,
        (el as LabelQrElement).qrSizeMm,
        project.settings,
      );
    } else if (el.type === "logo") {
      const logoUrl = (el as LabelLogoElement).logoDataUrl || cfg.logoDataUrl;
      if (logoUrl) {
        try {
          const fmt = logoUrl.startsWith("data:image/svg")
            ? "SVG"
            : logoUrl.includes("jpeg") || logoUrl.includes("jpg")
            ? "JPEG"
            : "PNG";
          doc.addImage(logoUrl, fmt, x, y, el.width, el.height);
        } catch { /* logo error não interrompe a geração da etiqueta */ }
      }
    } else {
      const tEl = el as LabelTextElement;
      const text = dataMap[el.type] ?? "";
      if (!text) continue;
      const hex = (tEl.color ?? "#111111").replace("#", "").padEnd(6, "0");
      doc.setTextColor(
        parseInt(hex.slice(0, 2), 16) || 0,
        parseInt(hex.slice(2, 4), 16) || 0,
        parseInt(hex.slice(4, 6), 16) || 0,
      );
      if (el.type === "projeto" || el.type === "peca") {
        drawAutoFitLabelText(doc, text, x, y, {
          maxFontPt: tEl.fontSize,
          minFontPx: 8,
          boxWidthMm: el.width,
          boxHeightMm: el.height,
          fontName: tEl.fontFamily ?? "Helvetica",
          fontStyle: tEl.fontWeight === "bold" ? "bold" : "normal",
          lineHeight: tEl.lineHeight ?? 1.15,
        });
      } else {
        doc.setFont(tEl.fontFamily ?? "Helvetica", tEl.fontWeight === "bold" ? "bold" : "normal");
        doc.setFontSize(tEl.fontSize);
        const lines = doc.splitTextToSize(text, el.width);
        doc.text(lines, x, y + tEl.fontSize * 0.35);
      }
    }
  }
}

/** Renderer S1 legado — não usado em produção (ver `labelPdfLegacyRenderRefs`). */
async function renderEtiquetaPage(
  doc: jsPDF,
  item: LabelItem,
  project: ProjectForEtiquetasPdf,
  logoDataUrl: string | null
) {
  const cfg = project.rules.etiqueta;
  const width = cfg.larguraMm;
  const height = cfg.alturaMm;
  const margin = cfg.margemInternaMm;
  const borderMm = Math.max(0.1, cfg.bordaPx * 0.264583);
  const qrSize = Math.max(12, cfg.tamanhoQr);
  const bodySize = Math.max(6, cfg.tamanhoTexto);

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(borderMm);
  doc.rect(0.5, 0.5, width - 1, height - 1);

  const logoSizeMm = LOGO_INDUSTRIAL_SIZE_MM;
  const logoX = margin;
  const logoY = margin + 0.5;
  drawLogoIndustrialInBox(doc, logoDataUrl, logoX, logoY, logoSizeMm, BRAND_RED_ETI);

  const effectiveProjectName = item.sourceProjectName ?? project.projectName;
  const ref = `${effectiveProjectName || "PROJETO"}_${item.boxNome ?? item.boxId ?? "BOX"}_${item.pieceName ?? item.nome}`;
  const refX = logoX + logoSizeMm + 2;
  const refMaxW = Math.max(8, width - refX - margin);

  doc.setTextColor(10, 10, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  let headerBottom = logoY + logoSizeMm;
  if (cfg.mostrarReferencia) {
    const refLines = doc.splitTextToSize(ref.toUpperCase(), refMaxW);
    doc.text(refLines.slice(0, 2), refX, logoY + 3.2);
    headerBottom = Math.max(headerBottom, logoY + Math.min(refLines.length, 2) * 3.6 + 1);
  }

  const y = headerBottom + 2;
  const qrX = margin;
  const qrY = y + 1.5;
  const etiquetaCode = resolveEtiquetaCodeParaEtiqueta(item, {
    projectName: effectiveProjectName,
    boxes: project.boxes,
    rules: project.rules,
  });

  await drawQrWithLogoOrFallback(doc, etiquetaCode, qrX, qrY, qrSize, project.settings);

  if (project.rules.qrcode.mostrarTextoAbaixoQr) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize + 1);
    doc.text(etiquetaCode, qrX, qrY + qrSize + 4.2);
  }

  let rightY = qrY + 1;
  const rightX = qrX + qrSize + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize);
  const nomeIndustrial = nomeIndustrialParaEtiqueta(item, project);
  doc.setFont("helvetica", "bold");
  doc.text(nomeIndustrial, rightX, rightY);
  rightY += 4.2;
  doc.setFont("helvetica", "normal");
  if (cfg.mostrarMaterial) {
    doc.text(`MAT: ${(item.material ?? "-").toUpperCase()}`, rightX, rightY);
    rightY += 4.2;
  }
  if (cfg.mostrarDimensoes) {
    doc.text(
      `LxAxE: ${Math.round(item.dimensoes.largura)}x${Math.round(item.dimensoes.altura)}x${Math.round(item.espessura)}`,
      rightX,
      rightY
    );
    rightY += 4.2;
  }
  if (project.rules.qrcode.destacarNumeroPeca) {
    doc.setFont("helvetica", "bold");
    doc.text(etiquetaCode, rightX, rightY);
  }
}

// ============================================================================
// Renderer v5 — layout FINAL (100×50 mm, faixa inferior 10 mm, grelha produção)
// ============================================================================

/** px CSS @96dpi → mm (maqueta PIMO_LABEL_DESIGN_PREVIEW). */
function v5Px(px: number): number {
  return (px / 96) * 25.4;
}

/** px CSS → pontos jsPDF (≈ font-size em px). */
function v5Pt(px: number): number {
  return px * 0.75;
}

const V5_PAD_MM = v5Px(8);
const V5_BORDER_MM = v5Px(2);
const V5_TEXT: [number, number, number] = [17, 17, 17];
const V5_MUTED: [number, number, number] = [102, 102, 102];
const V5_LINE_LIGHT: [number, number, number] = [221, 221, 221];
const V5_LINE_CUT: [number, number, number] = [68, 68, 68];
const V5_INFO_GAP_MM = v5Px(12);
const V5_LABEL_COL_MM = v5Px(26);
const V5_SEQ_BOX_MM = v5Px(21);
const V5_OBS_LABEL_W_MM = v5Px(14);

/** Rótulos abreviados da grelha de produção v5. */
const V5_PRODUCTION_GRID_LABELS = {
  nisting: "CNC",
  manual: "MAN",
  drill: "DRILL",
  limpezas: "LIMP",
  orlar: "ORLAR",
  montagem: "MONT",
  embalagem: "EMB",
} as const;

function mapPaletteGroupToAAA(group: string): string {
  const g = String(group ?? "").trim().toUpperCase();
  if (g.length >= 3) return g.slice(0, 3);
  if (g.length === 2) return `${g[0]}${g[1]}${g[0]}`;
  if (g.length === 1) return g.repeat(3);
  return "---";
}

function formatDrillDistancesGridV5(seq: PieceProductionSequence): string {
  if (!seq.drillDistances || seq.drillDistances.every((d) => d <= 0)) return "– – – –";
  return seq.drillDistances.map((d) => (d > 0 ? String(Math.round(d)) : "–")).join("  ");
}

function formatOrlarSidesGridV5(sides: PieceProductionSequence["orlarSides"]): string {
  const flags = [sides.front, sides.back, sides.right, sides.left];
  return flags.map((f) => (f ? "S" : "N")).join("  ");
}

/** Medidas v5 na etiqueta: largura × altura (sem espessura; ~5 espaços visuais). */
function formatMedidasLabelV5(widthMm: number, heightMm: number): string {
  const w = formatNumberV5(widthMm);
  const h = formatNumberV5(heightMm);
  return `${w}     ×     ${h} MM`;
}

function fmtStepNum(n: number | null): string {
  return n != null ? String(n) : "—";
}

function panelIdFromItemMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata || typeof metadata.panelId !== "string") return null;
  const s = metadata.panelId.trim();
  return s || null;
}

function inferPieceKind(item: LabelItem): PieceProductionKind {
  const tipo = String(item.tipo ?? "").toLowerCase();
  const nome = String(item.pieceName ?? item.nome ?? "").toUpperCase();
  if (tipo === "remate" || nome.includes("_REMATE_")) return "REMATE";
  if (tipo === "rodape" || nome.includes("_RODA_PE_")) return "RODAPE";
  if (nome.includes("LED") && nome.includes("LATERAL")) return "LATERAIS_COM_LED";
  if (nome.includes("SENSOR") && nome.includes("FUNDO")) return "FUNDO_COM_SENSOR";
  if (tipo === "cima" || nome.includes("CIMA") || nome.includes("TOPO")) return "CIMA";
  if (tipo === "prateleira" || nome.includes("PRATELEIRA")) return "PRATELEIRA";
  if (
    tipo === "gaveta_frente_ext" ||
    tipo === "gaveta_frente_int" ||
    tipo === "gaveta_frente" ||
    nome.includes("GAVETA_FRENTE") ||
    nome.includes("GAV_FRENT")
  )
    return "FRENTE_GAVETA";
  if (tipo === "gaveta_lat_esq" || tipo === "gaveta_lat_dir" || nome.includes("GAV_LAT")) return "GAV_LATERAIS";
  if (tipo === "gaveta_traseira" || nome.includes("GAV_COST") || nome.includes("GAV_TRA")) return "GAV_TRAS";
  if (tipo === "gaveta_fundo" || nome.includes("GAV_FUN") || nome.includes("GAVETA_FUNDO")) return "FUNDO_GAVETA";
  if (tipo === "fundo" || nome === "FUNDO" || nome.includes("FUNDO")) return "FUNDO";
  if (tipo.includes("lateral") || nome.includes("LATERAL") || nome.includes("LAT_")) return "LATERAL";
  if (nome.includes("REMATE")) return "REMATE";
  if (nome.includes("RODAPE") || nome.includes("RODAP")) return "RODAPE";
  return "GENERIC";
}

function labelItemToPieceData(item: LabelItem, project: ProjectForEtiquetasPdf): PieceData {
  const panelId = panelIdFromItemMetadata(item.metadata);
  const orlaPieceConfig =
    panelId && project.orlaPiecesByPanelId?.[panelId]
      ? project.orlaPiecesByPanelId[panelId]
      : undefined;
  return {
    name: item.pieceName ?? item.nome ?? "peca",
    kind: inferPieceKind(item),
    thicknessMm: item.espessura ?? 0,
    hasDrillFile: pieceShouldHaveDrillLabel(item),
    orlaPieceConfig,
    drillHoles: item.drillHoles?.map((h) => ({ x: h.x, y: h.y })),
    widthMm: item.dimensoes?.largura,
    heightMm: item.dimensoes?.altura,
  };
}

async function drawV5_QR(
  doc: jsPDF,
  code: string,
  x: number,
  y: number,
  sizeMm: number,
  qrLogoDataUrl: string,
  qrLogoSizePercent: number,
  settings?: SettingsSchema
): Promise<void> {
  const logoUrl =
    qrLogoDataUrl.trim() ||
    (await loadLogoIndustrialDataUrl()) ||
    (settings?.etiquetasQr?.logoAtivado && settings.etiquetasQr.logoDataUrl
      ? settings.etiquetasQr.logoDataUrl
      : "") ||
    "";

  if (!logoUrl) {
    drawQrFromCode(doc, code, x, y, sizeMm);
    return;
  }

  try {
    const canvas = await generateQrCanvasWithLogo(code, sizeMm * 10, {
      logoDataUrl: logoUrl,
      logoSizeMm: LOGO_INDUSTRIAL_SIZE_MM,
      qrSizeMm: sizeMm,
      logoSizePercent: qrLogoSizePercent > 0 ? qrLogoSizePercent : 20,
    });
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", x, y, sizeMm, sizeMm);
  } catch {
    drawQrFromCode(doc, code, x, y, sizeMm);
  }
}

function drawV5_Info(
  doc: jsPDF,
  x: number,
  yMaterial: number,
  width: number,
  material: string,
  medidas: string,
  dims: LabelConfig["dimensions"]
): number {
  const labelPt = v5Pt(8.5);
  const valuePt = v5Pt(10.5);
  const valX = x + V5_LABEL_COL_MM;
  const valueMaxW = width - V5_LABEL_COL_MM - 0.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(labelPt);
  doc.setTextColor(...V5_MUTED);
  doc.text("MATRIAL", x, yMaterial + labelPt * 0.35);

  doc.setFont("courier", "bold");
  doc.setFontSize(valuePt);
  doc.setTextColor(...V5_TEXT);
  const matLines = doc.splitTextToSize(material, valueMaxW);
  doc.text(matLines.slice(0, 2), valX, yMaterial + valuePt * 0.35);

  const yMed = yMaterial + dims.materialHeight_mm;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(labelPt);
  doc.setTextColor(...V5_MUTED);
  doc.text("MEDIDAS", x, yMed + labelPt * 0.35);

  doc.setFont("courier", "bold");
  doc.setFontSize(valuePt);
  doc.setTextColor(...V5_TEXT);
  doc.text(medidas, valX, yMed + valuePt * 0.35, { maxWidth: valueMaxW });

  return yMed + dims.medidasHeight_mm;
}

/** Referências de layout v5 legado — mantidas para compatibilidade e testes. */
export const v5EtiquetaLayoutLegacyRefs = {
  V5_PAD_MM,
  V5_BORDER_MM,
  V5_INFO_GAP_MM,
  V5_SEQ_BOX_MM,
  V5_OBS_LABEL_W_MM,
  drawV5_Info,
  formatDimensionV5,
  formatMedidasLabelV5,
};

/**
 * Célula da grelha de produção — layout horizontal: label à esquerda, caixa à direita.
 * Ambos centrados verticalmente na linha.
 */
function drawV5_SeqBox(
  doc: jsPDF,
  cellX: number,
  cellY: number,
  colW: number,
  rowH: number,
  pkLabel: string,
  stepNum: number | null
): void {
  const num = fmtStepNum(stepNum);
  const hasNum = num !== "—";

  // Caixa: alinhada à direita, centrada verticalmente
  const boxSize = Math.min(rowH - 2.2, colW * 0.40, 8);
  const boxX = cellX + colW - boxSize - 2;
  const boxY = cellY + (rowH - boxSize) / 2;

  // Label: alinhada à esquerda, centrada verticalmente
  const labelMaxW = boxX - cellX - 2.5;
  const labelPt = v5Pt(7);
  const labelY = cellY + rowH / 2 + labelPt * 0.16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(labelPt);
  doc.setTextColor(...V5_TEXT);
  // Quebra em 2 linhas se necessário (ex: EMBALAGEM)
  const labelLines = doc.splitTextToSize(pkLabel.toUpperCase(), labelMaxW);
  if (labelLines.length >= 2) {
    const lh = labelPt * 0.42;
    doc.text(String(labelLines[0]), cellX + 1.5, labelY - lh * 0.65);
    doc.text(String(labelLines[1]), cellX + 1.5, labelY + lh * 0.9);
  } else {
    doc.text(pkLabel.toUpperCase(), cellX + 1.5, labelY, { maxWidth: labelMaxW });
  }

  // Borda da caixa — contorno fino uniforme (sem preenchimento)
  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.15);
  doc.rect(boxX, boxY, boxSize, boxSize);

  // Número centrado na caixa
  if (hasNum) {
    const numPt = v5Pt(Math.min(11, boxSize * 2.5));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(numPt);
    doc.setTextColor(...V5_TEXT);
    doc.text(num, boxX + boxSize / 2, boxY + boxSize / 2 + numPt * 0.13, { align: "center" });
  }
}

function drawV5_GridDataLine(doc: jsPDF, cellX: number, cellY: number, colW: number, rowH: number, line: string): void {
  const pt = v5Pt(8.5);
  doc.setFont("courier", "bold");
  doc.setFontSize(pt);
  doc.setTextColor(...V5_TEXT);
  doc.text(line, cellX + colW / 2, cellY + rowH / 2 + pt * 0.13, {
    align: "center",
    maxWidth: colW - 2,
  });
}

function drawV5_ProductionGrid(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  seq: PieceProductionSequence
): void {
  const colW = width / 3;
  const rowH = height / 3;

  // Linhas internas da grelha (finas)
  doc.setDrawColor(...V5_LINE_LIGHT);
  doc.setLineWidth(0.1);
  for (let r = 1; r < 3; r++) {
    doc.line(x, y + r * rowH, x + width, y + r * rowH);
  }
  for (let c = 1; c < 3; c++) {
    doc.line(x + c * colW, y, x + c * colW, y + height);
  }
  // Borda exterior da grelha
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.12);
  doc.rect(x, y, width, height);

  // Linha 1
  drawV5_SeqBox(doc, x,            y,      colW, rowH, V5_PRODUCTION_GRID_LABELS.nisting,   seq.nisting);
  drawV5_SeqBox(doc, x + colW,     y,      colW, rowH, V5_PRODUCTION_GRID_LABELS.manual,    seq.manual);
  drawV5_SeqBox(doc, x + 2 * colW, y,      colW, rowH, V5_PRODUCTION_GRID_LABELS.limpezas,  seq.limpezas);
  // Linha 2
  const y1 = y + rowH;
  drawV5_SeqBox(doc, x,            y1, colW, rowH, V5_PRODUCTION_GRID_LABELS.drill,     seq.drill);
  drawV5_GridDataLine(doc, x + colW, y1, colW, rowH, formatDrillDistancesGridV5(seq));
  drawV5_SeqBox(doc, x + 2 * colW, y1, colW, rowH, V5_PRODUCTION_GRID_LABELS.montagem,  seq.montagem);
  // Linha 3
  const y2 = y + 2 * rowH;
  drawV5_SeqBox(doc, x,            y2, colW, rowH, V5_PRODUCTION_GRID_LABELS.orlar,     seq.orlar);
  drawV5_GridDataLine(doc, x + colW, y2, colW, rowH, formatOrlarSidesGridV5(seq.orlarSides));
  drawV5_SeqBox(doc, x + 2 * colW, y2, colW, rowH, V5_PRODUCTION_GRID_LABELS.embalagem, seq.embalagem);
}

/**
 * Barra de observações — rótulo único "OBSERVAÇÃO" à esquerda (abaixo do QR);
 * textos reais na mesma linha, sem repetir o rótulo nem caixas múltiplas.
 */
function drawV5_ObservationBar(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  observations: [string, string, string],
  options?: { drawTopRule?: boolean }
): void {
  const textPt = v5Pt(7);
  const textY = y + height * 0.50 + textPt * 0.13;
  const labelW = V5_OBS_LABEL_W_MM;

  if (options?.drawTopRule !== false) {
    doc.setDrawColor(...V5_LINE_LIGHT);
    doc.setLineWidth(0.1);
    doc.line(x, y, x + width, y);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(textPt);
  doc.setTextColor(...V5_MUTED);
  doc.text("OBSERVAÇÃO", x + 0.5, textY);

  const parts = observations.map((o) => String(o ?? "").trim()).filter(Boolean);
  if (parts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(textPt);
    doc.setTextColor(...V5_TEXT);
    doc.text(parts.join("  "), x + labelW + 1, textY, { maxWidth: width - labelW - 2 });
  }
  doc.setTextColor(...V5_TEXT);
}

/**
 * Badge preto com número da etiqueta (leitura humana rápida).
 * Posicionado no canto superior direito, sem sobrepor o QR.
 */
function drawV5_EtiquetaNumberBadge(
  doc: jsPDF,
  pageW: number,
  pad: number,
  etiquetaNumber: number
): void {
  const text = String(Math.max(1, Math.floor(Number(etiquetaNumber) || 1)));
  const fontPt = v5Pt(13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontPt);
  const textW = doc.getTextWidth(text);
  const padH = 1.4;
  const padV = 0.9;
  const boxW = textW + padH * 2;
  const boxH = fontPt * 0.38 + padV * 2;
  const x = pageW - pad - boxW;
  const y = pad;

  doc.setFillColor(0, 0, 0);
  doc.rect(x, y, boxW, boxH, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(text, x + padH, y + padV + fontPt * 0.3);
  doc.setTextColor(...V5_TEXT);
}

function drawV5_CutLine(doc: jsPDF, y: number, width: number): void {
  doc.setDrawColor(...V5_LINE_CUT);
  doc.setLineWidth(v5Px(2.5));
  const dash = v5Px(4);
  const docDash = doc as jsPDF & { setLineDashPattern?: (a: number[], b: number) => void };
  if (typeof docDash.setLineDashPattern === "function") {
    docDash.setLineDashPattern([dash, dash * 0.6], 0);
  }
  doc.line(0, y, width, y);
  if (typeof docDash.setLineDashPattern === "function") {
    docDash.setLineDashPattern([], 0);
  }
}

/**
 * Faixa inferior — fundo branco (igual ao resto), 10 mm, delimitada por linha fina no topo.
 * Esquerda: CODIGO / AAA · Direita: nome industrial completo (texto preto).
 */
function drawV5_BottomStrip(
  doc: jsPDF,
  y: number,
  width: number,
  height: number,
  etiquetaCode: string,
  aaa: string,
  industrialDisplayName: string
): void {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, y, width, height, "F");

  doc.setDrawColor(...V5_LINE_LIGHT);
  doc.setLineWidth(0.12);
  doc.line(0, y, width, y);

  const PAD = 3;
  const centerY = y + height / 2 + v5Pt(13) * 0.12;
  const leftText = `${etiquetaCode} / ${aaa}`;
  const rightText = industrialDisplayName;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(v5Pt(13));
  doc.setTextColor(...V5_TEXT);
  doc.text(leftText, PAD, centerY);

  const leftW = doc.getTextWidth(leftText);
  const sepX = PAD + leftW + 4;
  doc.setDrawColor(...V5_LINE_LIGHT);
  doc.setLineWidth(0.12);
  doc.line(sepX, y + 1.2, sepX, y + height - 1.2);

  const rightX = sepX + PAD;
  const rightMaxW = width - rightX - PAD;
  doc.setFont("helvetica", "bold");
  drawAutoFitLabelText(doc, rightText, rightX, y, {
    maxFontPt: v5Pt(13 + 1.5),
    minFontPx: 8,
    boxWidthMm: rightMaxW,
    boxHeightMm: height,
    fontName: "helvetica",
    fontStyle: "bold",
  });
}

/**
 * Código efectivo para rasterizar a imagem QR na etiqueta v5.
 * Deve ser idêntico ao código identificador impresso (faixa inferior).
 */
export function resolveV5QrImageCode(bottomStripCode: string): string {
  return bottomStripCode;
}

/**
 * Renderer principal v5 — QR único ou dual (qrPolicy); logo via ResolvedLabelRuntime.
 */
async function renderEtiquetaPageV5(
  doc: jsPDF,
  item: LabelItem,
  project: ProjectForEtiquetasPdf,
  runtime: ResolvedLabelRuntime,
  seq: PieceProductionSequence,
  piecesPerSheet: Map<string, number>,
  _index0: number
): Promise<void> {
  const config = runtime.labelConfig;
  const dims = config.dimensions;
  const qrPolicy: QrPolicy = runtime.qrPolicy ?? "v5";
  const w = dims.totalWidth_mm;
  const h = dims.totalHeight_mm;

  // ── Fundo branco + borda fina ────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.2);
  doc.rect(0.25, 0.25, w - 0.5, h - 0.5);

  // ── Dados da peça ────────────────────────────────────────────────────────
  const effectiveProjectName = item.sourceProjectName ?? project.projectName;
  const qrCtx = {
    projectName: effectiveProjectName,
    boxes: project.boxes,
    rules: project.rules,
  };
  const etiquetaNumber = resolveAuthoritativeLabelNumber(item);
  if (etiquetaNumber == null) {
    throw new Error("Etiqueta sem número único atribuído antes da impressão.");
  }
  const codeV5Display = resolveEtiquetaDisplayCodeV5(item, qrCtx, piecesPerSheet, etiquetaNumber - 1);

  const secondaryQrCode: string | null = null;
  let bottomStripCode = codeV5Display;

  switch (qrPolicy) {
    case "short":
      // Short legado removido — mesmo ID industrial da política v5.
      bottomStripCode = codeV5Display;
      break;
    case "dual":
      // Dual sem segundo algoritmo: um único código industrial.
      bottomStripCode = codeV5Display;
      break;
    case "v5":
    default:
      break;
  }

  const nomeIndustrial = nomeIndustrialParaEtiqueta(item, project);
  const material = (item.material ?? "—").toUpperCase();
  const medidas = formatMedidasLabelV5(
    item.dimensoes?.largura ?? 0,
    item.dimensoes?.altura ?? 0
  );
  const aaa = mapPaletteGroupToAAA(seq.paletteGroup);
  const observations = observationsToV5Slots(item.observations ?? []);

  const layout = computeV5LabelLayout(dims);
  const PAD = V5_LAYOUT_PAD_MM;
  const QR_INFO_GAP = 3;
  const bottomStripMm = layout.bottomStripMm;
  const bottomY = layout.bottomY;
  const cutY = layout.cutY;
  const obsY = layout.obsY;

  // Coluna da esquerda (QR)
  const qrColW = dims.qrColumnWidth_mm;
  const qrX = PAD;

  // Coluna da direita (info)
  const infoX = PAD + qrColW + QR_INFO_GAP;
  const infoW = w - infoX - PAD;

  // ── QR(s) conforme qrPolicy — tamanho exacto quando cabe na secção superior (40 mm) ──
  const qrSize1 = layout.qrSizeMm;
  const qrY1 = PAD;
  const logoUrl = runtime.qrLogoDataUrl;
  const logoPct = runtime.qrLogoSizePercent;

  const qrImageCode = resolveV5QrImageCode(bottomStripCode);

  let belowQrY: number;
  if (qrPolicy === "dual" && secondaryQrCode) {
    const gapMm = 1;
    const dualSize = Math.min((qrColW - gapMm) / 2, qrSize1);
    await drawV5_QR(doc, qrImageCode, qrX, qrY1, dualSize, logoUrl, logoPct, project.settings);
    await drawV5_QR(
      doc,
      secondaryQrCode,
      qrX + dualSize + gapMm,
      qrY1,
      dualSize,
      logoUrl,
      logoPct,
      project.settings
    );
    belowQrY = qrY1 + dualSize + V5_LAYOUT_QR_GAP_BELOW_MM;
  } else {
    await drawV5_QR(doc, qrImageCode, qrX, qrY1, qrSize1, logoUrl, logoPct, project.settings);
    belowQrY = qrY1 + qrSize1 + V5_LAYOUT_QR_GAP_BELOW_MM;
  }

  // Badge do número da etiqueta — canto superior direito (Opção A)
  drawV5_EtiquetaNumberBadge(doc, w, PAD, etiquetaNumber);

  const obsBlockH = Math.min(dims.observationHeight_mm, Math.max(3.5, obsY - belowQrY));
  drawV5_ObservationBar(doc, qrX, belowQrY, w - qrX - PAD, obsBlockH, observations, {
    drawTopRule: false,
  });

  // ── Secção de informação ──────────────────────────────────────────────────
  const yMaterial = PAD;
  const yMedidas  = yMaterial + dims.materialHeight_mm;
  const yGrid = yMedidas + dims.medidasHeight_mm;
  const gridH = layout.gridH;

  // Rótulo "MATRIAL" + valor
  const LABEL_COL_W = 16;
  const labelPt = v5Pt(9);
  const valuePt = v5Pt(12.5);
  const materialValuePt = v5Pt(12.5 + 1.5);
  const valX    = infoX + LABEL_COL_W;
  const valMaxW = infoW - LABEL_COL_W - 0.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(labelPt);
  doc.setTextColor(...V5_MUTED);
  doc.text("MATRIAL", infoX, yMaterial + dims.materialHeight_mm * 0.62);

  doc.setFont("courier", "bold");
  doc.setFontSize(materialValuePt);
  doc.setTextColor(...V5_TEXT);
  const matLines = doc.splitTextToSize(material, valMaxW);
  doc.text(matLines.slice(0, 1) as string[], valX, yMaterial + dims.materialHeight_mm * 0.62);

  // Rótulo "MEDIDAS" + valor
  const medY = yMedidas + dims.medidasHeight_mm * 0.65;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(labelPt);
  doc.setTextColor(...V5_MUTED);
  doc.text("MEDIDAS", infoX, medY);

  doc.setFont("courier", "bold");
  doc.setFontSize(valuePt);
  doc.setTextColor(...V5_TEXT);
  doc.text(medidas, valX, medY, { maxWidth: valMaxW });

  // Linha separadora entre medidas e grelha
  doc.setDrawColor(...V5_LINE_LIGHT);
  doc.setLineWidth(0.1);
  doc.line(infoX, yGrid - 0.3, infoX + infoW, yGrid - 0.3);

  // Grelha de produção (gridH dinâmico)
  drawV5_ProductionGrid(doc, infoX, yGrid, infoW, gridH, seq);

  // Delimitador da faixa de observações (secção mantida; rótulo já desenhado abaixo do QR)
  doc.setDrawColor(...V5_LINE_LIGHT);
  doc.setLineWidth(0.1);
  doc.line(PAD, obsY, w - PAD, obsY);

  // ── Linha de corte ────────────────────────────────────────────────────────
  drawV5_CutLine(doc, cutY, w);

  // ── Faixa inferior ────────────────────────────────────────────────────────
  const bottomStripIndustrialName = buildV5BottomStripIndustrialName(
    effectiveProjectName || "PROJETO",
    item.boxNome ?? item.boxId ?? "—",
    nomeIndustrial
  );
  drawV5_BottomStrip(
    doc,
    bottomY,
    w,
    bottomStripMm,
    bottomStripCode,
    aaa,
    bottomStripIndustrialName
  );
}

/**
 * PDF de etiquetas de produção — motor v5 unificado (único renderer activo).
 */
export async function buildProductionEtiquetasV5Pdf(
  project: ProjectForEtiquetasPdf,
  runtime: ResolvedLabelRuntime
): Promise<jsPDF> {
  const labelConfig = runtime.labelConfig;
  const items = getCutlistWithMetadata(project);
  const ordered = prepareEtiquetasForPrint(items, project.cutLayoutPlacements);
  const piecesPerSheet = buildPiecesPerSheetMap(ordered, project.cutLayoutPlacements);
  for (const item of ordered) {
    const key = labelItemSheetKey(item.boxId, item.nome);
    item.numCaixa = piecesPerSheet.get(key) ?? 0;
    const collected = collectObservationsForItem(item, undefined, project.pieceObservacoes);
    item.observations = collected;
  }

  const dims = labelConfig.dimensions;
  const pageW = dims.totalWidth_mm;
  const pageH = dims.totalHeight_mm;
  const doc = new jsPDF({
    orientation: pageW >= pageH ? "landscape" : "portrait",
    unit: "mm",
    format: [pageW, pageH],
  });

  for (let idx = 0; idx < ordered.length; idx++) {
    if (idx > 0) doc.addPage([pageW, pageH], pageW >= pageH ? "landscape" : "portrait");
    const pieceData = labelItemToPieceData(ordered[idx], project);
    const seq = computePieceSequence(pieceData, labelConfig);
    await renderEtiquetaPageV5(doc, ordered[idx], project, runtime, seq, piecesPerSheet, idx);
  }
  return doc;
}

/** Hub público — delega sempre ao motor v5 (`buildProductionEtiquetasV5Pdf`). */
export async function buildEtiquetasPdf(project: ProjectForEtiquetasPdf): Promise<jsPDF> {
  const industrialLogo = (await loadLogoIndustrialDataUrl()) ?? "";
  const runtime = resolveLabelSystemConfig(
    project.rules,
    project.settings ?? null,
    project.rules.labelSystemV5 ?? null
  );
  const placements = normalizeCutLayoutPlacements(project.cutLayoutPlacements);
  return buildProductionEtiquetasV5Pdf(
    { ...project, cutLayoutPlacements: placements, designerConfig: undefined },
    {
      ...runtime,
      qrLogoDataUrl: industrialLogo || runtime.qrLogoDataUrl,
    }
  );
}

/**
 * @deprecated API legada — redireccionada para o motor v5. Mantida para compatibilidade de imports (UEE).
 */
export async function buildEtiquetasPdfLegacy(project: ProjectForEtiquetasPdf): Promise<jsPDF> {
  return buildEtiquetasPdf(project);
}

// ─── Referências S1/S3 (não usadas em produção) ───────────────────────────────

/** Funções legadas exportadas apenas para compatibilidade TS / regressão isolada. */
export const labelPdfLegacyRenderRefs = {
  renderEtiquetaPage,
  renderEtiquetaPageFromDesignerConfig,
  drawQrWithLogoOrFallback,
  resolveEtiquetaCodeParaEtiqueta,
  loadLogoIndustrialDataUrl,
  drawLogoIndustrialInBox,
  buildEtiquetasPdfLegacy,
};
