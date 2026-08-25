/**
 * Etiqueta Designer Pro - Editor profissional completo.
 * Fase 1: Snap, Grid, Smart Guides, Lock, Duplicate, Undo/Redo, Zoom.
 * Fase 2: Texto/QR/Logo avançados.
 * Fase 3: Export PDF/PNG, templates, safe area/bleed, preview 1:1.
 */

/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LabelDesignerConfig,
  LabelElement,
  LabelElementType,
  LabelTextElement,
  LabelQrElement,
  LabelLogoElement,
  AlignOption,
  QrErrorLevel,
  LogoBlendMode,
  LogoMaskShape,
} from "../../core/labelDesigner/labelDesignerTypes";
import { defaultLabelDesignerConfig } from "../../core/labelDesigner/labelDesignerDefaults";
import {
  loadLabelDesignerConfig,
  saveLabelDesignerConfig,
  exportLabelDesignerConfig,
  importLabelDesignerConfig,
} from "../../core/labelDesigner/labelDesignerStorage";
import { builtinTemplates, loadCustomTemplates } from "../../core/labelDesigner/labelDesignerTemplates";
import { exportLabelToPdf, exportLabelGridPrint, exportLabelToPng300 } from "../../core/labelDesigner/labelDesignerExport";
import { generateQrCodeSvg } from "../../core/qrcode/qrcodeService";
import { buildFullIndustrialName, buildIndustrialId } from "../../core/naming/industrialNaming";
import { AdminPageHeader, AdminStickyActionBar } from "./AdminUi";
import { useToast } from "../../context/ToastContext";

const MAX_HISTORY = 50;

/** Dados de preview para renderizar a etiqueta */
const designerPreviewEtiquetaCode = buildIndustrialId(
  buildFullIndustrialName("Meu Projeto", "Estante Principal", "prateleira")
);
const PREVIEW_DATA = {
  projeto: "Meu Projeto",
  caixa: "Estante Principal",
  peca: "Prateleira",
  madeira: "MDF Branco 18mm",
  medidas: "600×400×18 mm",
  numero_peca: designerPreviewEtiquetaCode,
  etiquetaCode: designerPreviewEtiquetaCode,
};

function getElementLabel(type: LabelElementType): string {
  const map: Record<LabelElementType, string> = {
    projeto: "Projeto",
    caixa: "Caixa",
    peca: "Peça",
    madeira: "Madeira",
    medidas: "Medidas",
    numero_peca: "Nº Peça",
    qr: "QR",
    logo: "Logo",
  };
  return map[type] ?? type;
}

function getPreviewText(type: LabelElementType): string {
  const k = type === "medidas" ? "medidas" : type;
  return (PREVIEW_DATA as Record<string, string>)[k] ?? `[${type}]`;
}

function isTextElement(el: LabelElement): el is LabelTextElement {
  return el.type !== "qr" && el.type !== "logo";
}
function isQrElement(el: LabelElement): el is LabelQrElement {
  return el.type === "qr";
}
function isLogoElement(el: LabelElement): el is LabelLogoElement {
  return el.type === "logo";
}

const MM_TO_PX = 3.78;

function snapToGrid(v: number, gridMm: number, enabled: boolean): number {
  if (!enabled) return v;
  return Math.round(v / gridMm) * gridMm;
}

export interface EtiquetaDesignerPageProps {
  /**
   * Quando fornecido, o designer opera em modo controlado: usa este valor como
   * configuração inicial em vez do localStorage. Passa a ser o SSOT do perfil.
   */
  externalConfig?: LabelDesignerConfig;
  /**
   * Quando fornecido, "Salvar" chama este callback em vez de escrever em localStorage.
   * O caller é responsável por persistir a configuração no perfil.
   */
  onExternalSave?: (config: LabelDesignerConfig) => void;
  /** Quando true, omite o AdminPageHeader e a AdminStickyActionBar (para embed em tab). */
  embedded?: boolean;
}

export default function EtiquetaDesignerPage({ externalConfig, onExternalSave, embedded }: EtiquetaDesignerPageProps = {}) {
  const { showToast } = useToast();
  const initialConfig = externalConfig ?? loadLabelDesignerConfig();
  const [config, setConfig] = useState<LabelDesignerConfig>(() => JSON.parse(JSON.stringify(initialConfig)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ elX: 0, elY: 0, mouseX: 0, mouseY: 0 });
  const [resizeStart, setResizeStart] = useState({ elW: 0, elH: 0, mouseX: 0, mouseY: 0 });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [history, setHistory] = useState<LabelDesignerConfig[]>([JSON.parse(JSON.stringify(initialConfig))]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const baseScale = Math.min(400 / config.widthMm, 400 / config.heightMm, 4);
  const scale = (baseScale * zoomPercent) / 100;
  const wPx = config.widthMm * MM_TO_PX * scale;
  const hPx = config.heightMm * MM_TO_PX * scale;
  const gridMm = config.gridSizeMm ?? 5;
  const snap = config.snapToGrid ?? true;

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    setHistoryIndex((i) => i - 1);
    setConfig(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    showToast("Desfazer", "info");
  }, [history, historyIndex, showToast]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex((i) => i + 1);
    setConfig(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    showToast("Refazer", "info");
  }, [history, historyIndex, showToast]);

  const updateElement = useCallback((id: string, patch: Partial<LabelElement>) => {
    setConfig((prev) => ({
      ...prev,
      elements: prev.elements.map((e) =>
        e.id === id ? ({ ...e, ...patch } as LabelElement) : e
      ),
    }));
  }, []);

  const updateElementWithHistory = useCallback((id: string, patch: Partial<LabelElement>) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        elements: prev.elements.map((e) =>
          e.id === id ? ({ ...e, ...patch } as LabelElement) : e
        ),
      };
      setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.parse(JSON.stringify(next))].slice(-MAX_HISTORY));
      setHistoryIndex((i) => Math.min(i + 1, MAX_HISTORY - 1));
      return next;
    });
  }, [historyIndex]);

  const selected = config.elements.find((e) => e.id === selectedId);

  const handleElementMouseDown = (e: React.MouseEvent, el: LabelElement) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (el.locked) return;
    setSelectedId(el.id);
    setIsDragging(true);
    setDragStart({
      elX: el.x,
      elY: el.y,
      mouseX: e.clientX,
      mouseY: e.clientY,
    });
  };

  // Resize (bottom-right handle)
  const handleResizeMouseDown = (ev: React.MouseEvent, el: LabelElement) => {
    ev.stopPropagation();
    ev.preventDefault();
    if (ev.button !== 0) return;
    setSelectedId(el.id);
    setIsResizing(true);
    const w = isQrElement(el) ? el.qrSizeMm : el.width;
    const h = isQrElement(el) ? el.qrSizeMm : el.height;
    setResizeStart({
      elW: w,
      elH: h,
      mouseX: ev.clientX,
      mouseY: ev.clientY,
    });
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (isDragging && selectedId) {
        const dx = (e.clientX - dragStart.mouseX) / (MM_TO_PX * scale);
        const dy = (e.clientY - dragStart.mouseY) / (MM_TO_PX * scale);
        let nx = Math.max(0, dragStart.elX + dx);
        let ny = Math.max(0, dragStart.elY + dy);
        nx = snapToGrid(nx, gridMm, snap);
        ny = snapToGrid(ny, gridMm, snap);
        updateElement(selectedId, { x: nx, y: ny });
      }
      if (isResizing && selectedId) {
        const el = config.elements.find((x) => x.id === selectedId);
        if (!el) return;
        const dx = (e.clientX - resizeStart.mouseX) / (MM_TO_PX * scale);
        const dy = (e.clientY - resizeStart.mouseY) / (MM_TO_PX * scale);
        const delta = Math.max(dx, dy);
        const newSize = Math.max(5, resizeStart.elW + delta);
        if (isQrElement(el)) {
          const snapped = snapToGrid(newSize, gridMm, snap);
          updateElement(selectedId, { qrSizeMm: Math.max(5, snapped), width: Math.max(5, snapped), height: Math.max(5, snapped) });
        } else if (isLogoElement(el)) {
          const nw = snapToGrid(Math.max(5, resizeStart.elW + dx), gridMm, snap);
          const nh = snapToGrid(Math.max(3, resizeStart.elH + dy), gridMm, snap);
          updateElement(selectedId, { width: nw, height: nh });
        }
      }
    };
    const onUp = () => {
      if (isDragging || isResizing) {
        const latest = configRef.current;
        setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.parse(JSON.stringify(latest))].slice(-MAX_HISTORY));
        setHistoryIndex((i) => Math.min(i + 1, MAX_HISTORY - 1));
      }
      setIsDragging(false);
      setIsResizing(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    isDragging,
    isResizing,
    historyIndex,
    selectedId,
    dragStart,
    resizeStart,
    scale,
    gridMm,
    snap,
    updateElement,
    config.elements,
  ]);

  const handleSave = () => {
    if (onExternalSave) {
      // Modo controlado (embed em LabelConfigPage) — delega ao caller.
      onExternalSave(config);
      showToast("Layout actualizado. Use 'Guardar perfil' para persistir.", "info");
    } else {
      saveLabelDesignerConfig(config);
      showToast("Configuração da etiqueta guardada.", "info");
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportLabelDesignerConfig(config)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "etiqueta-designer-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result);
          const imported = importLabelDesignerConfig(text);
          if (imported) {
            setConfig(imported);
            showToast("Configuração importada.", "info");
          } else {
            showToast("Ficheiro JSON inválido.", "error");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleReset = () => {
    setConfig(JSON.parse(JSON.stringify(defaultLabelDesignerConfig)));
    setSelectedId(null);
    setHistory([JSON.parse(JSON.stringify(defaultLabelDesignerConfig))]);
    setHistoryIndex(0);
    showToast("Configuração reposta ao padrão.", "info");
  };

  const handleDuplicate = () => {
    if (!selectedId) return;
    const el = config.elements.find((e) => e.id === selectedId);
    if (!el) return;
    const dup: LabelElement = { ...JSON.parse(JSON.stringify(el)), id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, x: el.x + 5, y: el.y + 5 };
    setConfig((prev) => ({
      ...prev,
      elements: [...prev.elements, dup],
    }));
    setSelectedId(dup.id);
    showToast("Elemento duplicado.", "info");
  };

  const handleExportPdf = () => {
    const doc = exportLabelToPdf(config, 1);
    doc.save("etiqueta.pdf");
    showToast("PDF exportado.", "info");
  };

  const handleExportPng = async () => {
    try {
      const blob = await exportLabelToPng300(config);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "etiqueta-300dpi.png";
      a.click();
      URL.revokeObjectURL(url);
      showToast("PNG 300 DPI exportado.", "info");
    } catch {
      showToast("Erro ao exportar PNG.", "error");
    }
  };

  const handleExportGrid = () => {
    const cols = 3;
    const rows = 4;
    const copies = 2;
    const doc = exportLabelGridPrint(config, cols, rows, copies);
    doc.save("etiquetas-grid.pdf");
    showToast(`PDF em grelha (${cols}x${rows}) exportado.`, "info");
  };

  const customTemplates = loadCustomTemplates();
  const allTemplates = [...builtinTemplates, ...customTemplates];

  const handleApplyTemplate = (templateId: string) => {
    const t = allTemplates.find((x) => x.id === templateId);
    if (t) {
      setConfig(JSON.parse(JSON.stringify(t.config)));
      setSelectedId(null);
      showToast(`Template "${t.name}" aplicado.`, "info");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const qrSvg = generateQrCodeSvg(PREVIEW_DATA.etiquetaCode);
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Preview Etiqueta</title></head>
        <body style="margin:0;padding:20px;font-family:Helvetica,sans-serif;background:#eee;">
          <h2>Preview Etiqueta (100% escala)</h2>
          <div style="
            width:${config.widthMm}mm;
            height:${config.heightMm}mm;
            background:${config.backgroundColor};
            border:${config.borderWidthMm}mm solid ${config.borderColor};
            border-radius:${config.borderRadiusMm}mm;
            padding:${config.marginTopMm}mm ${config.marginRightMm}mm ${config.marginBottomMm}mm ${config.marginLeftMm}mm;
            box-sizing:border-box;
            position:relative;
          ">
            ${config.elements
              .filter((e) => e.visible)
              .map((el) => {
                if (el.type === "qr") {
                  const size = (el as LabelQrElement).qrSizeMm;
                  return `
                    <div style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${size}mm;height:${size}mm;">
                      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#fff;">
                        ${qrSvg.startsWith("<svg") ? qrSvg.replace(/<svg\s/, '<svg style="width:100%;height:100%;display:block" ') : qrSvg}
                      </div>
                    </div>`;
                }
                if (el.type === "logo" && (el as LabelLogoElement).logoDataUrl) {
                  return `
                    <img src="${(el as LabelLogoElement).logoDataUrl}" alt="Logo"
                      style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.width}mm;height:${el.height}mm;object-fit:contain;" />`;
                }
                if (isTextElement(el)) {
                  const text = getPreviewText(el.type);
                  return `
                    <div style="
                      position:absolute;left:${el.x}mm;top:${el.y}mm;max-width:${el.width}mm;
                      font-size:${el.fontSize}pt;font-family:${el.fontFamily};font-weight:${el.fontWeight ?? "normal"};
                      color:${el.color};text-align:${el.alignment};opacity:${el.opacity};
                    ">${text}</div>`;
                }
                return "";
              })
              .join("")}
          </div>
        </body>
      </html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "100%" }}>
      {!embedded && (
        <AdminPageHeader
          title="Etiqueta / QR N"
          subtitle="Personalize o layout da etiqueta. Arraste os elementos, redimensione o QR e o logo, configure cores e fontes."
        />
      )}

      <AdminStickyActionBar>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="button button-primary" onClick={handleSave}>Salvar</button>
          <button type="button" className="button button-ghost" onClick={handleExport}>Exportar JSON</button>
          <button type="button" className="button button-ghost" onClick={handleImport}>Importar JSON</button>
          <button type="button" className="button button-ghost" onClick={handleReset}>Repor</button>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />
          <button type="button" className="button button-ghost" title="Desfazer" onClick={undo} disabled={historyIndex <= 0}>↶ Undo</button>
          <button type="button" className="button button-ghost" title="Refazer" onClick={redo} disabled={historyIndex >= history.length - 1}>↷ Redo</button>
          <button type="button" className="button button-ghost" title="Duplicar" onClick={handleDuplicate} disabled={!selectedId}>⊕ Duplicar</button>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />
          <label style={{ fontSize: 11 }}>Zoom
            <select className="input input-xs" style={{ width: 70 }} value={zoomPercent} onChange={(e) => setZoomPercent(Number(e.target.value))}>
              <option value={25}>25%</option>
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={150}>150%</option>
              <option value={200}>200%</option>
            </select>
          </label>
          <button type="button" className="button button-ghost" style={{ padding: "4px 8px", fontSize: 11 }} title="Preview tamanho real (1:1)" onClick={() => setZoomPercent(Math.max(50, Math.min(200, Math.round((100 / baseScale) * 100))))}>
            1:1
          </button>
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={config.snapToGrid ?? true} onChange={(e) => setConfig((c) => ({ ...c, snapToGrid: e.target.checked }))} /> Snap</label>
          <label style={{ fontSize: 11 }}>Grid
            <select className="input input-xs" style={{ width: 55 }} value={config.gridSizeMm ?? 5} onChange={(e) => setConfig((c) => ({ ...c, gridSizeMm: Number(e.target.value) }))}>
              <option value={5}>5mm</option>
              <option value={10}>10mm</option>
            </select>
          </label>
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={config.showGrid ?? true} onChange={(e) => setConfig((c) => ({ ...c, showGrid: e.target.checked }))} /> Grade</label>
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={config.showSmartGuides ?? true} onChange={(e) => setConfig((c) => ({ ...c, showSmartGuides: e.target.checked }))} /> Guias</label>
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={config.showSafeArea ?? false} onChange={(e) => setConfig((c) => ({ ...c, showSafeArea: e.target.checked }))} /> Safe</label>
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={config.showBleed ?? false} onChange={(e) => setConfig((c) => ({ ...c, showBleed: e.target.checked }))} /> Bleed</label>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />
          <select className="input input-xs" style={{ width: 180 }} value="" onChange={(e) => { const v = e.target.value; if (v) { handleApplyTemplate(v); e.target.value = ""; } }}>
            <option value="">Templates…</option>
            {allTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />
          <button type="button" className="button" onClick={handlePrint}>Imprimir</button>
          <button type="button" className="button button-ghost" onClick={handleExportPdf}>PDF</button>
          <button type="button" className="button button-ghost" onClick={handleExportPng}>PNG 300</button>
          <button type="button" className="button button-ghost" onClick={handleExportGrid}>Grid</button>
        </div>
      </AdminStickyActionBar>

      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
        {/* Config gerais + Editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <div
            style={{
              padding: 12,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "var(--radius)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Largura (mm)
              <input
                className="input input-xs"
                type="number"
                value={config.widthMm}
                min={20}
                max={300}
                onChange={(e) => setConfig((c) => ({ ...c, widthMm: Number(e.target.value) || 100 }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Altura (mm)
              <input
                className="input input-xs"
                type="number"
                value={config.heightMm}
                min={20}
                max={300}
                onChange={(e) => setConfig((c) => ({ ...c, heightMm: Number(e.target.value) || 50 }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Orientação
              <select
                className="input input-xs"
                value={config.orientation}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    orientation: e.target.value as "vertical" | "horizontal",
                  }))
                }
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Margem T (mm)
              <input
                className="input input-xs"
                type="number"
                min={0}
                value={config.marginTopMm}
                onChange={(e) => setConfig((c) => ({ ...c, marginTopMm: Number(e.target.value) || 0 }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Margem R (mm)
              <input
                className="input input-xs"
                type="number"
                min={0}
                value={config.marginRightMm}
                onChange={(e) => setConfig((c) => ({ ...c, marginRightMm: Number(e.target.value) || 0 }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Margem B (mm)
              <input
                className="input input-xs"
                type="number"
                min={0}
                value={config.marginBottomMm}
                onChange={(e) => setConfig((c) => ({ ...c, marginBottomMm: Number(e.target.value) || 0 }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Margem L (mm)
              <input
                className="input input-xs"
                type="number"
                min={0}
                value={config.marginLeftMm}
                onChange={(e) => setConfig((c) => ({ ...c, marginLeftMm: Number(e.target.value) || 0 }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Cor fundo
              <input
                className="input input-xs"
                type="color"
                value={config.backgroundColor}
                onChange={(e) => setConfig((c) => ({ ...c, backgroundColor: e.target.value }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Borda (mm)
              <input
                className="input input-xs"
                type="number"
                value={config.borderWidthMm}
                min={0}
                step={0.5}
                onChange={(e) => setConfig((c) => ({ ...c, borderWidthMm: Number(e.target.value) || 0 }))}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Raio borda (mm)
              <input className="input input-xs" type="number" value={config.borderRadiusMm} min={0} step={0.5} onChange={(e) => setConfig((c) => ({ ...c, borderRadiusMm: Number(e.target.value) || 0 }))} />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Safe area (mm)
              <input className="input input-xs" type="number" value={config.safeAreaMm ?? 3} min={0} onChange={(e) => setConfig((c) => ({ ...c, safeAreaMm: Number(e.target.value) || 0 }))} />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Bleed (mm)
              <input className="input input-xs" type="number" value={config.bleedMm ?? 3} min={0} onChange={(e) => setConfig((c) => ({ ...c, bleedMm: Number(e.target.value) || 0 }))} />
            </label>
          </div>

          {/* Layout Editor */}
          <div
            style={{
              flex: 1,
              minHeight: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.25)",
              borderRadius: "var(--radius)",
              padding: 24,
            }}
          >
            <div
              ref={canvasRef}
              style={{
                position: "relative",
                width: wPx,
                height: hPx,
                background: config.backgroundColor,
                border: `${config.borderWidthMm * MM_TO_PX * scale}px solid ${config.borderColor}`,
                borderRadius: `${config.borderRadiusMm * MM_TO_PX * scale}px`,
                padding: config.marginTopMm * MM_TO_PX * scale,
                paddingRight: config.marginRightMm * MM_TO_PX * scale,
                paddingBottom: config.marginBottomMm * MM_TO_PX * scale,
                paddingLeft: config.marginLeftMm * MM_TO_PX * scale,
                boxSizing: "border-box",
              }}
              onClick={() => setSelectedId(null)}
            >
              {/* Safe area */}
              {config.showSafeArea && (config.safeAreaMm ?? 0) > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: (config.safeAreaMm ?? 3) * MM_TO_PX * scale,
                    border: "1px dashed rgba(34,197,94,0.6)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {/* Bleed */}
              {config.showBleed && (config.bleedMm ?? 0) > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: -(config.bleedMm ?? 3) * MM_TO_PX * scale,
                    border: "1px dashed rgba(245,158,11,0.6)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {/* Grid overlay */}
              {config.showGrid && (config.gridSizeMm ?? 5) > 0 && (
                <>
                  {Array.from({ length: Math.ceil((wPx - (config.marginLeftMm + config.marginRightMm) * MM_TO_PX * scale) / ((config.gridSizeMm ?? 5) * MM_TO_PX * scale)) + 1 }, (_, i) => i * (config.gridSizeMm ?? 5) * MM_TO_PX * scale).map((x) => (
                    <div key={`v${x}`} style={{ position: "absolute", left: config.marginLeftMm * MM_TO_PX * scale + x, top: config.marginTopMm * MM_TO_PX * scale, width: 1, height: hPx - (config.marginTopMm + config.marginBottomMm) * MM_TO_PX * scale, background: "rgba(0,0,0,0.08)", pointerEvents: "none" }} />
                  ))}
                  {Array.from({ length: Math.ceil((hPx - (config.marginTopMm + config.marginBottomMm) * MM_TO_PX * scale) / ((config.gridSizeMm ?? 5) * MM_TO_PX * scale)) + 1 }, (_, i) => i * (config.gridSizeMm ?? 5) * MM_TO_PX * scale).map((y) => (
                    <div key={`h${y}`} style={{ position: "absolute", left: config.marginLeftMm * MM_TO_PX * scale, top: config.marginTopMm * MM_TO_PX * scale + y, width: wPx - (config.marginLeftMm + config.marginRightMm) * MM_TO_PX * scale, height: 1, background: "rgba(0,0,0,0.08)", pointerEvents: "none" }} />
                  ))}
                </>
              )}
              {/* Smart guides - alinhamentos com outros elementos */}
              {config.showSmartGuides && selectedId && (() => {
                const sel = config.elements.find((e) => e.id === selectedId);
                if (!sel) return null;
                const tol = 3;
                const selL = sel.x;
                const selR = sel.x + (isQrElement(sel) ? sel.qrSizeMm : sel.width);
                const selT = sel.y;
                const selB = sel.y + (isQrElement(sel) ? sel.qrSizeMm : sel.height);
                const selCx = selL + (selR - selL) / 2;
                const selCy = selT + (selB - selT) / 2;
                const guides: React.ReactNode[] = [];
                for (const o of config.elements) {
                  if (o.id === selectedId || !o.visible) continue;
                  const oL = o.x, oR = o.x + (isQrElement(o) ? o.qrSizeMm : o.width);
                  const oT = o.y, oB = o.y + (isQrElement(o) ? o.qrSizeMm : o.height);
                  const oCx = oL + (oR - oL) / 2, oCy = oT + (oB - oT) / 2;
                  if (Math.abs(selL - oL) < tol) guides.push(<div key={`vl${oL}`} style={{ position: "absolute", left: config.marginLeftMm * MM_TO_PX * scale + oL * MM_TO_PX * scale, top: 0, width: 1, height: hPx, background: "rgba(59,130,246,0.5)", pointerEvents: "none" }} />);
                  if (Math.abs(selR - oR) < tol) guides.push(<div key={`vr${oR}`} style={{ position: "absolute", left: config.marginLeftMm * MM_TO_PX * scale + oR * MM_TO_PX * scale, top: 0, width: 1, height: hPx, background: "rgba(59,130,246,0.5)", pointerEvents: "none" }} />);
                  if (Math.abs(selCx - oCx) < tol) guides.push(<div key={`vc${oCx}`} style={{ position: "absolute", left: config.marginLeftMm * MM_TO_PX * scale + oCx * MM_TO_PX * scale, top: 0, width: 1, height: hPx, background: "rgba(59,130,246,0.5)", pointerEvents: "none" }} />);
                  if (Math.abs(selT - oT) < tol) guides.push(<div key={`ht${oT}`} style={{ position: "absolute", left: 0, top: config.marginTopMm * MM_TO_PX * scale + oT * MM_TO_PX * scale, width: wPx, height: 1, background: "rgba(59,130,246,0.5)", pointerEvents: "none" }} />);
                  if (Math.abs(selB - oB) < tol) guides.push(<div key={`hb${oB}`} style={{ position: "absolute", left: 0, top: config.marginTopMm * MM_TO_PX * scale + oB * MM_TO_PX * scale, width: wPx, height: 1, background: "rgba(59,130,246,0.5)", pointerEvents: "none" }} />);
                  if (Math.abs(selCy - oCy) < tol) guides.push(<div key={`hc${oCy}`} style={{ position: "absolute", left: 0, top: config.marginTopMm * MM_TO_PX * scale + oCy * MM_TO_PX * scale, width: wPx, height: 1, background: "rgba(59,130,246,0.5)", pointerEvents: "none" }} />);
                }
                return guides.length ? <>{guides}</> : null;
              })()}
              {config.elements.map((el) => {
                if (!el.visible) return null;
                const left = el.x * MM_TO_PX * scale;
                const top = el.y * MM_TO_PX * scale;
                const width = (isQrElement(el) ? el.qrSizeMm : el.width) * MM_TO_PX * scale;
                const height = (isQrElement(el) ? el.qrSizeMm : el.height) * MM_TO_PX * scale;

                const boxStyle: React.CSSProperties = {
                  position: "absolute",
                  left,
                  top,
                  width: isTextElement(el) ? undefined : width,
                  minWidth: isTextElement(el) ? el.width * MM_TO_PX * scale : undefined,
                  maxWidth: isTextElement(el) ? el.width * MM_TO_PX * scale : undefined,
                  height: isTextElement(el) ? height : height,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  opacity: "opacity" in el ? el.opacity : 1,
                  cursor: "move",
                  border: selectedId === el.id ? "2px solid #3b82f6" : "1px dashed rgba(0,0,0,0.2)",
                  borderRadius: 2,
                  boxSizing: "border-box",
                };

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                    style={{
                      ...boxStyle,
                      display: "flex",
                      alignItems: "center",
                      ...(isTextElement(el) && {
                        justifyContent:
                          el.alignment === "center"
                            ? "center"
                            : el.alignment === "right"
                              ? "flex-end"
                              : "flex-start",
                      }),
                    }}
                  >
                    {el.type === "qr" && (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "#fff",
                          padding: (el as LabelQrElement).qrMarginMm ?? 0,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: (generateQrCodeSvg(PREVIEW_DATA.etiquetaCode, (el as LabelQrElement).qrErrorLevel ?? "M", (el as LabelQrElement).qrMarginMm ?? 0) as string).replace(/<svg\s/, '<svg style="width:100%;height:100%;display:block" '),
                        }}
                      />
                    )}
                    {el.type === "logo" && (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          mixBlendMode: (el as LabelLogoElement).logoBlendMode ?? "normal",
                          borderRadius: (el as LabelLogoElement).logoMaskShape === "circle" ? "50%" : (el as LabelLogoElement).logoMaskShape === "rounded" ? 8 : 0,
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        {(el as LabelLogoElement).logoDataUrl ? (
                          <>
                            <img
                              src={(el as LabelLogoElement).logoDataUrl}
                              alt="Logo"
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                            {(el as LabelLogoElement).logoTintColor && (
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  backgroundColor: (el as LabelLogoElement).logoTintColor!,
                                  mixBlendMode: "multiply",
                                  pointerEvents: "none",
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 10, color: "#999" }}>Logo</span>
                        )}
                      </div>
                    )}
                    {isTextElement(el) && (
                      <span
                        style={{
                          fontSize: el.fontSize * scale,
                          fontFamily: el.fontFamily,
                          fontWeight: el.fontWeight ?? "normal",
                          color: el.color,
                          letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                          lineHeight: el.lineHeight ?? 1.2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          padding: (el.backgroundColor || el.borderColor) ? 2 : 0,
                          background: el.backgroundColor,
                          border: el.borderColor && (el.borderWidthMm ?? 0) > 0 ? `${(el.borderWidthMm ?? 0) * MM_TO_PX * scale}px solid ${el.borderColor}` : undefined,
                          borderRadius: (el.borderRadiusMm ?? 0) * MM_TO_PX * scale,
                        }}
                      >
                        {getPreviewText(el.type)}
                      </span>
                    )}
                    {selectedId === el.id && (el.type === "qr" || el.type === "logo") && (
                      <div
                        onMouseDown={(ev) => handleResizeMouseDown(ev, el)}
                        style={{
                          position: "absolute",
                          right: -4,
                          bottom: -4,
                          width: 10,
                          height: 10,
                          background: "#3b82f6",
                          borderRadius: 2,
                          cursor: "nwse-resize",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div
          style={{
            width: 280,
            minWidth: 280,
            padding: 12,
            background: "rgba(0,0,0,0.2)",
            borderRadius: "var(--radius)",
            height: "fit-content",
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Propriedades</div>
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{getElementLabel(selected.type)}</div>

              <label style={{ fontSize: 11 }}>
                Visível
                <input type="checkbox" checked={selected.visible} onChange={(e) => updateElementWithHistory(selected.id, { visible: e.target.checked })} />
              </label>
              <label style={{ fontSize: 11 }}>
                Bloquear
                <input type="checkbox" checked={selected.locked ?? false} onChange={(e) => updateElementWithHistory(selected.id, { locked: e.target.checked })} />
              </label>

              <label style={{ fontSize: 11 }}>X (mm)
                <input className="input input-xs" type="number" value={Math.round(selected.x * 10) / 10} onChange={(e) => updateElementWithHistory(selected.id, { x: Number(e.target.value) })} />
              </label>
              <label style={{ fontSize: 11 }}>Y (mm)
                <input className="input input-xs" type="number" value={Math.round(selected.y * 10) / 10} onChange={(e) => updateElementWithHistory(selected.id, { y: Number(e.target.value) })} />
              </label>

              {isTextElement(selected) && (
                <>
                  <label style={{ fontSize: 11 }}>Tamanho fonte
                    <input className="input input-xs" type="number" min={4} max={72} value={selected.fontSize} onChange={(e) => updateElementWithHistory(selected.id, { fontSize: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Fonte
                    <select className="input input-xs" value={selected.fontFamily} onChange={(e) => updateElementWithHistory(selected.id, { fontFamily: e.target.value })}>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Arial">Arial</option>
                      <option value="Times">Times</option>
                      <option value="Courier">Courier</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 11 }}>Cor
                    <input type="color" value={selected.color} onChange={(e) => updateElementWithHistory(selected.id, { color: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Letter spacing
                    <input className="input input-xs" type="number" value={selected.letterSpacing ?? 0} onChange={(e) => updateElementWithHistory(selected.id, { letterSpacing: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Line height
                    <input className="input input-xs" type="number" min={0.5} max={3} step={0.1} value={selected.lineHeight ?? 1.2} onChange={(e) => updateElementWithHistory(selected.id, { lineHeight: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Bg caixa
                    <input type="color" value={selected.backgroundColor || "#ffffff"} onChange={(e) => updateElementWithHistory(selected.id, { backgroundColor: e.target.value || undefined })} title={selected.backgroundColor ? "Clique para remover" : "Cor de fundo do texto"}
                  />
                  </label>
                  <label style={{ fontSize: 11 }}>Borda cor
                    <input type="color" value={selected.borderColor || "#cccccc"} onChange={(e) => updateElementWithHistory(selected.id, { borderColor: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Borda (mm)
                    <input className="input input-xs" type="number" min={0} value={selected.borderWidthMm ?? 0} onChange={(e) => updateElementWithHistory(selected.id, { borderWidthMm: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Raio borda (mm)
                    <input className="input input-xs" type="number" min={0} value={selected.borderRadiusMm ?? 0} onChange={(e) => updateElementWithHistory(selected.id, { borderRadiusMm: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Alinhamento
                    <select className="input input-xs" value={selected.alignment} onChange={(e) => updateElementWithHistory(selected.id, { alignment: e.target.value as AlignOption })}>
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 11 }}>Opacidade
                    <input className="input input-xs" type="number" min={0} max={1} step={0.1} value={selected.opacity} onChange={(e) => updateElementWithHistory(selected.id, { opacity: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Rotação (°)
                    <input className="input input-xs" type="number" value={selected.rotation} onChange={(e) => updateElementWithHistory(selected.id, { rotation: Number(e.target.value) })} />
                  </label>
                </>
              )}

              {isQrElement(selected) && (
                <>
                  <label style={{ fontSize: 11 }}>Tamanho QR (mm)
                    <input className="input input-xs" type="number" min={8} max={80} value={selected.qrSizeMm}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateElementWithHistory(selected.id, { qrSizeMm: v, width: v, height: v });
                      }} />
                  </label>
                  <label style={{ fontSize: 11 }}>Nível erro
                    <select className="input input-xs" value={selected.qrErrorLevel ?? "M"} onChange={(e) => updateElementWithHistory(selected.id, { qrErrorLevel: e.target.value as QrErrorLevel })}>
                      <option value="L">L (7%)</option>
                      <option value="M">M (15%)</option>
                      <option value="Q">Q (25%)</option>
                      <option value="H">H (30%)</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 11 }}>Margem (mm)
                    <input className="input input-xs" type="number" min={0} value={selected.qrMarginMm ?? 0} onChange={(e) => updateElementWithHistory(selected.id, { qrMarginMm: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Opacidade
                    <input className="input input-xs" type="number" min={0} max={1} step={0.1} value={selected.opacity} onChange={(e) => updateElementWithHistory(selected.id, { opacity: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Rotação (°)
                    <input className="input input-xs" type="number" value={selected.rotation} onChange={(e) => updateElementWithHistory(selected.id, { rotation: Number(e.target.value) })} />
                  </label>
                </>
              )}

              {isLogoElement(selected) && (
                <>
                  <label style={{ fontSize: 11 }}>Logo (PNG/SVG)
                    <input className="input input-xs" type="file" accept="image/png,image/svg+xml"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUrl = String(reader.result);
                            updateElementWithHistory(selected.id, { logoDataUrl: dataUrl });
                            setConfig((c) => ({ ...c, logoDataUrl: dataUrl }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                  </label>
                  <label style={{ fontSize: 11 }}>Tint (cor)
                    <input type="color" value={selected.logoTintColor || "#000000"} onChange={(e) => updateElementWithHistory(selected.id, { logoTintColor: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Blend
                    <select className="input input-xs" value={selected.logoBlendMode ?? "normal"} onChange={(e) => updateElementWithHistory(selected.id, { logoBlendMode: e.target.value as LogoBlendMode })}>
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="overlay">Overlay</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 11 }}>Máscara
                    <select className="input input-xs" value={selected.logoMaskShape ?? "none"} onChange={(e) => updateElementWithHistory(selected.id, { logoMaskShape: e.target.value as LogoMaskShape })}>
                      <option value="none">Nenhuma</option>
                      <option value="circle">Círculo</option>
                      <option value="square">Quadrado</option>
                      <option value="rounded">Arredondado</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 11 }}>Largura (mm)
                    <input className="input input-xs" type="number" min={5} value={selected.width} onChange={(e) => updateElementWithHistory(selected.id, { width: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Altura (mm)
                    <input className="input input-xs" type="number" min={3} value={selected.height} onChange={(e) => updateElementWithHistory(selected.id, { height: Number(e.target.value) })} />
                  </label>
                  <label style={{ fontSize: 11 }}>Rotação (°)
                    <input className="input input-xs" type="number" value={selected.rotation} onChange={(e) => updateElementWithHistory(selected.id, { rotation: Number(e.target.value) })} />
                  </label>
                </>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Selecione um elemento no editor.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
