import { useEffect, useState } from "react";
import { useToast } from "../../../context/ToastContext";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { usePhotoModeLivePreview } from "../../../hooks/usePhotoModeLivePreview";
import { useUiStore } from "../../../stores/uiStore";
import type { PimoViewerApi } from "../../../context/PimoViewerContextCore";
import type {
  ViewerCameraPreset,
  ViewerRenderBackground,
  ViewerRenderFormat,
  ViewerRenderMode,
  ViewerRenderOptions,
  ViewerRenderResult,
} from "../../../context/projectTypes";

function triggerDownloadFromDataUrl(dataUrl: string, width: number, height: number) {
  const extension = dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png";
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `pimo-photo-${width}x${height}.${extension}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function callRenderScene(
  viewerApi: PimoViewerApi | null,
  options: ViewerRenderOptions
): Promise<ViewerRenderResult | null> {
  const bound = viewerApi?.renderScene;
  if (typeof bound === "function") {
    return bound(options);
  }
  return null;
}

/**
 * Definições de captura do Photo Mode (painel esquerdo).
 * O viewport principal reflete as opções em tempo real.
 */
export default function PhotoModeSettingsContent() {
  const { viewerApi } = usePimoViewerContext();
  const setPhotoModePanelOpen = useUiStore((s) => s.setPhotoModePanelOpen);
  const { startLoading, stopLoading, showToast } = useToast();

  const [renderPreset, setRenderPreset] = useState<ViewerCameraPreset>("current");
  const [renderBackground, setRenderBackground] = useState<ViewerRenderBackground>("white");
  const [renderMode, setRenderMode] = useState<ViewerRenderMode>("pbr");
  const [renderWatermark, setRenderWatermark] = useState<boolean>(false);
  const [renderShadowIntensity, setRenderShadowIntensity] = useState<number>(1);
  const [renderFormat, setRenderFormat] = useState<ViewerRenderFormat>("png");
  const [renderQuality, setRenderQuality] = useState<number>(0.92);
  const [advancedRealism, setAdvancedRealism] = useState<boolean>(false);
  const [renderLoading, setRenderLoading] = useState(false);
  const [lineExportLoading, setLineExportLoading] = useState(false);
  const [lineDrawingBackground, setLineDrawingBackground] = useState<"white" | "transparent">("white");

  usePhotoModeLivePreview({
    active: true,
    viewerApi,
    background: renderBackground,
    shadowIntensity: renderShadowIntensity,
    advancedRealism,
    mode: renderMode,
  });

  useEffect(() => {
    if (renderPreset === "current" || !viewerApi?.setCameraView) return;
    const map: Partial<Record<ViewerCameraPreset, "front" | "top" | "isometric">> = {
      front: "front",
      top: "top",
      iso1: "isometric",
      iso2: "isometric",
    };
    const mapped = map[renderPreset];
    if (mapped) viewerApi.setCameraView(mapped);
  }, [renderPreset, viewerApi]);

  const closePanel = () => {
    setPhotoModePanelOpen(false);
  };

  const buildCaptureOptions = (): ViewerRenderOptions => ({
    size: "viewport",
    preset: renderPreset,
    background: renderBackground,
    mode: renderMode,
    watermark: renderWatermark,
    shadowIntensity: renderShadowIntensity,
    format: renderFormat,
    quality: renderQuality,
    advancedRealism,
  });

  const handleDownload = async () => {
    const loadingId = startLoading("A gerar imagem…");
    setRenderLoading(true);
    try {
      const result = await callRenderScene(viewerApi, buildCaptureOptions());
      if (!result?.dataUrl) {
        showToast("Não foi possível gerar a imagem. Verifique se o viewer está carregado.", "error");
        return;
      }
      triggerDownloadFromDataUrl(result.dataUrl, result.width, result.height);
      showToast("Download iniciado.", "info", 1200);
    } catch {
      showToast("Erro ao gerar imagem.", "error");
    } finally {
      setRenderLoading(false);
      stopLoading(loadingId);
    }
  };

  const handleExportLines = async () => {
    const loadingId = startLoading("A exportar linhas…");
    setLineExportLoading(true);
    try {
      const result = await callRenderScene(viewerApi, {
        size: "viewport",
        preset: renderPreset,
        background: lineDrawingBackground === "transparent" ? "transparent" : "white",
        mode: "lines",
        watermark: false,
        shadowIntensity: 0,
        format: "png",
        quality: 1,
        advancedRealism: false,
        lineDrawingExport: true,
        lineDrawingBackground,
      });
      if (!result?.dataUrl) {
        showToast("Não foi possível exportar linhas.", "error");
        return;
      }
      triggerDownloadFromDataUrl(result.dataUrl, result.width, result.height);
      showToast("Download de linhas iniciado.", "info", 1200);
    } catch {
      showToast("Erro ao exportar linhas.", "error");
    } finally {
      setLineExportLoading(false);
      stopLoading(loadingId);
    }
  };

  return (
    <div className="photo-mode-settings-root">
      <div className="photo-mode-settings-scroll">
        <div className="modal-list photo-mode-popover-list">
          <div className="modal-list-item" style={{ marginBottom: 8 }}>
            <div className="modal-list-info">
              <div className="modal-list-title">Modo foto</div>
              <div className="modal-list-meta">O canvas principal é a pré-visualização. Descarregar gera o ficheiro com as opções atuais.</div>
            </div>
            <button type="button" className="button button-ghost" onClick={closePanel}>
              Fechar
            </button>
          </div>

          <div className="modal-list-item">
            <div className="modal-list-info">
              <div className="modal-list-title">Ângulo</div>
              <div className="modal-list-meta">Presets ou câmera atual (também pode orbitar no canvas)</div>
            </div>
            <select
              className="select select-xs"
              value={renderPreset}
              onChange={(event) => setRenderPreset(event.target.value as ViewerCameraPreset)}
            >
              <option value="current">Usar câmera atual</option>
              <option value="front">Frontal</option>
              <option value="top">Topo</option>
              <option value="iso1">Isométrico 1</option>
              <option value="iso2">Isométrico 2</option>
            </select>
          </div>

          <div className="modal-list-item">
            <div className="modal-list-info">
              <div className="modal-list-title">Fundo</div>
              <div className="modal-list-meta">Aplicado em tempo real no viewport</div>
            </div>
            <select
              className="select select-xs"
              value={renderBackground}
              onChange={(event) => setRenderBackground(event.target.value as ViewerRenderBackground)}
            >
              <option value="white">Branco puro</option>
              <option value="transparent">Transparente (pré-visualização em branco; PNG com alpha na exportação)</option>
              <option value="hdri">Fundo padrão do sistema (HDRI)</option>
              <option value="project-transparent">Exportar projeto (sem chão nem fundo)</option>
            </select>
          </div>

          <button
            type="button"
            className={`button ${renderWatermark ? "" : "button-ghost"} photo-mode-option-button`}
            aria-pressed={renderWatermark}
            onClick={() => setRenderWatermark((prev) => !prev)}
          >
            <span className="photo-mode-option-main">
              <span className="modal-list-title">Marca d’água</span>
              <span className="modal-list-meta">Logo π (logo-pi) no canto inferior direito na exportação</span>
            </span>
            <span className="photo-mode-option-state">{renderWatermark ? "ON" : "OFF"}</span>
          </button>

          <div className="modal-list-item">
            <div className="modal-list-info">
              <div className="modal-list-title">Iluminação (sombras)</div>
              <div className="modal-list-meta">Intensidade em tempo real no viewport</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={renderShadowIntensity}
                onChange={(event) => setRenderShadowIntensity(parseFloat(event.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{Math.round(renderShadowIntensity * 100)}%</span>
            </div>
          </div>

          <button
            type="button"
            className={`button ${advancedRealism ? "" : "button-ghost"} photo-mode-option-button`}
            aria-pressed={advancedRealism}
            onClick={() => setAdvancedRealism((prev) => !prev)}
          >
            <span className="photo-mode-option-main">
              <span className="modal-list-title">Realismo avançado</span>
              <span className="modal-list-meta">Modo showcase no viewer (iluminação refinada na exportação PBR)</span>
            </span>
            <span className="photo-mode-option-state">{advancedRealism ? "ON" : "OFF"}</span>
          </button>

          <div className="modal-list-item">
            <div className="modal-list-info">
              <div className="modal-list-title">Modo de pré-visualização</div>
              <div className="modal-list-meta">Realista ou silhuetas (caixas envolventes)</div>
            </div>
            <div className="photo-mode-mode-buttons">
              {(
                [
                  ["pbr", "Realista (PBR)"],
                  ["lines", "Silhuetas"],
                ] as const
              ).map(([m, label]) => {
                const active = renderMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`button ${active ? "" : "button-ghost"} photo-mode-mode-button`}
                    aria-pressed={active}
                    onClick={() => setRenderMode(m)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="modal-list-item">
            <div className="modal-list-info">
              <div className="modal-list-title">Formato da exportação</div>
              <div className="modal-list-meta">PNG (transparência) ou JPG</div>
            </div>
            <select
              className="select select-xs"
              value={renderFormat}
              onChange={(event) => setRenderFormat(event.target.value as ViewerRenderFormat)}
            >
              <option value="png">PNG (sem perdas)</option>
              <option value="jpg">JPG (compressão)</option>
            </select>
          </div>

          {renderFormat === "jpg" && (
            <div className="modal-list-item">
              <div className="modal-list-info">
                <div className="modal-list-title">Qualidade do JPG</div>
                <div className="modal-list-meta">100% = melhor qualidade, ficheiros maiores</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={renderQuality}
                  onChange={(event) => setRenderQuality(parseFloat(event.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{Math.round(renderQuality * 100)}%</span>
              </div>
            </div>
          )}

          <div className="modal-list-item">
            <div className="modal-list-info">
              <div className="modal-list-title">Exportar linhas</div>
              <div className="modal-list-meta">Silhuetas das caixas; PNG à resolução do viewport</div>
            </div>
            <select
              className="select select-xs"
              value={lineDrawingBackground}
              onChange={(event) => setLineDrawingBackground(event.target.value as "white" | "transparent")}
              style={{ marginBottom: 8 }}
            >
              <option value="white">Fundo branco</option>
              <option value="transparent">Fundo transparente</option>
            </select>
            <button
              type="button"
              className="button button-ghost photo-mode-action-button"
              disabled={lineExportLoading}
              onClick={() => void handleExportLines()}
            >
              {lineExportLoading ? "A exportar…" : "Exportar linhas"}
            </button>
          </div>
        </div>
      </div>

      <div className="left-panel-footer">
        <button
          type="button"
          className="button button-primary photo-mode-action-button"
          style={{ width: "100%" }}
          disabled={renderLoading}
          onClick={() => void handleDownload()}
        >
          {renderLoading ? "A gerar…" : "Descarregar"}
        </button>
      </div>
    </div>
  );
}
