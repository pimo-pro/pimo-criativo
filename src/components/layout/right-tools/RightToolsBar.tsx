import { useEffect, useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { useToolbarModal } from "../../../context/ToolbarModalContext";
import {
  cutlistComPrecoFromBoxes,
  ferragensFromBoxes,
} from "../../../core/manufacturing/cutlistFromBoxes";
import {
  calcularPrecoTotalPecas,
  calcularPrecoTotalProjeto,
} from "../../../core/pricing/pricing";
import Piece3DModal from "../../modals/Piece3DModal";
import type {
  ViewerRenderBackground,
  ViewerRenderMode,
  ViewerRenderResult,
  ViewerRenderSize,
  ViewerCameraPreset,
  ViewerRenderFormat,
} from "../../../context/projectTypes";

type SendMethod = "whatsapp" | "email" | "download";

type SendSelections = {
  image: boolean;
  viewerSnapshot: boolean;
  projectSnapshot: boolean;
  cutlist: boolean;
  ferragens: boolean;
  precos: boolean;
};

const boxCardStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  marginBottom: 8,
};
const boxCardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-main)",
  marginBottom: 6,
};
const boxCardDimsStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginBottom: 8,
};
const boxCardRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

export default function RightToolsBar() {
  const { actions, project } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const { modal, openModal, closeModal } = useToolbarModal();
  const workspaceBoxes = project.workspaceBoxes;
  const selectedId = project.selectedWorkspaceBoxId;
  // Single Source of Truth: Resultados Atuais derivados de project.boxes (não project.resultados/acessorios)
  // boxes em useMemo para referência estável e evitar reexecução dos useMemo abaixo a cada render
  const boxes = useMemo(() => project.boxes ?? [], [project.boxes]);
  const cutlistFromBoxes = useMemo(() => {
    const parametric = cutlistComPrecoFromBoxes(boxes, project.rules, project.materialId);
    const extracted = boxes.flatMap((box) =>
      Object.values(project.extractedPartsByBoxId?.[box.id] ?? {}).flat()
    );
    return [...parametric, ...extracted];
  }, [boxes, project.extractedPartsByBoxId, project.rules]);
  const ferragensFromBoxesList = useMemo(
    () => ferragensFromBoxes(boxes, project.rules),
    [boxes, project.rules]
  );
  const totalPecas =
    cutlistFromBoxes.reduce((sum, item) => sum + item.quantidade, 0);
  const totalFerragens =
    ferragensFromBoxesList.reduce((sum, a) => sum + a.quantidade, 0);
  const totalItens = totalPecas + totalFerragens;
  const [savedProjects, setSavedProjects] = useState(actions.listSavedProjects());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renderSize, setRenderSize] = useState<ViewerRenderSize>("medium");
  const [renderPreset, setRenderPreset] = useState<ViewerCameraPreset>("current");
  const [renderBackground, setRenderBackground] =
    useState<ViewerRenderBackground>("white");
  const [renderMode, setRenderMode] = useState<ViewerRenderMode>("pbr");
  const [renderWatermark, setRenderWatermark] = useState<boolean>(false);
  const [renderShadowIntensity, setRenderShadowIntensity] = useState<number>(0.85);
  const [renderFormat, setRenderFormat] = useState<ViewerRenderFormat>("png");
  const [renderQuality, setRenderQuality] = useState<number>(0.92);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderResult, setRenderResult] = useState<ViewerRenderResult | null>(null);
  const [sendMethod, setSendMethod] = useState<SendMethod>("download");
  const [sendSelections, setSendSelections] = useState<SendSelections>({
    image: true,
    viewerSnapshot: true,
    projectSnapshot: true,
    cutlist: true,
    ferragens: true,
    precos: true,
  });
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [showPiece3DModal, setShowPiece3DModal] = useState(false);
  const modalTitle = useMemo(() => {
    if (modal === "projects") return "Projetos salvos";
    if (modal === "2d") return "2D Viewer";
    if (modal === "image") return "Photo Mode";
    if (modal === "send") return "Enviar";
    if (modal === "integration") return "Integração";
    return "";
  }, [modal]);

  useEffect(() => {
    if (modal === "projects") {
      setSavedProjects(actions.listSavedProjects());
      setRenamingId(null);
      setRenameValue("");
    }
  }, [modal, actions]);

  useEffect(() => {
    if (modal === "send") {
      setSendMethod("download");
      setSendSelections({
        image: true,
        viewerSnapshot: true,
        projectSnapshot: true,
        cutlist: true,
        ferragens: true,
        precos: true,
      });
      setIntegrationMessage("");
    }
  }, [modal]);

  useEffect(() => {
    if (modal === "image") {
      setRenderResult(null);
      setRenderLoading(false);
      setRenderSize("medium");
      setRenderPreset("current");
      setRenderBackground("white");
      setRenderMode("pbr");
      setRenderWatermark(false);
      setRenderShadowIntensity(1);
      setRenderFormat("png");
      setRenderQuality(0.92);
    }
  }, [modal]);

  const toggleSendSelection = (key: keyof SendSelections) => {
    setSendSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const slugifyName = (value: string) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const serializeProjectState = () => {
    return JSON.parse(
      JSON.stringify(project, (_key, value) => {
        if (value instanceof Date) {
          return { __date: value.toISOString() };
        }
        return value;
      })
    );
  };

  const buildSendPackage = () => {
    const timestamp = new Date();
    const shouldCaptureViewer = sendSelections.viewerSnapshot || sendSelections.projectSnapshot;
    const viewerSnapshot = shouldCaptureViewer ? null : null;
    const payload: Record<string, unknown> = {};

    if (sendSelections.viewerSnapshot) {
      payload.viewerSnapshot = viewerSnapshot;
    }

    if (sendSelections.projectSnapshot) {
      payload.projectSnapshot = {
        projectState: serializeProjectState(),
        viewerSnapshot,
      };
    }

    if (sendSelections.image) {
      payload.imagem = renderResult?.dataUrl ?? null;
    }

    // Single Source of Truth: cutlist, ferragens e precos derivados de project.boxes
    const boxes = project.boxes ?? [];
    const cutlistFromBoxes = cutlistComPrecoFromBoxes(boxes, project.rules, project.materialId);
    const ferragensFromBoxesList = ferragensFromBoxes(boxes, project.rules);
    const totalPecasFromBoxes =
      cutlistFromBoxes.length > 0
        ? calcularPrecoTotalPecas(cutlistFromBoxes)
        : null;
    const totalAcessoriosFromBoxes =
      ferragensFromBoxesList.length > 0
        ? ferragensFromBoxesList.reduce((s, a) => s + a.precoTotal, 0)
        : null;
    const totalProjetoFromBoxes =
      totalPecasFromBoxes != null && totalAcessoriosFromBoxes != null
        ? calcularPrecoTotalProjeto(totalPecasFromBoxes + totalAcessoriosFromBoxes)
        : null;

    if (sendSelections.cutlist) {
      payload.cutlist = cutlistFromBoxes.length > 0 ? cutlistFromBoxes : null;
    }

    if (sendSelections.ferragens) {
      payload.ferragens =
        ferragensFromBoxesList.length > 0 ? ferragensFromBoxesList : null;
    }

    if (sendSelections.precos) {
      payload.precos = {
        cutListComPreco: cutlistFromBoxes.length > 0 ? cutlistFromBoxes : null,
        acessorios: ferragensFromBoxesList.length > 0 ? ferragensFromBoxesList : null,
        totalPecas: totalPecasFromBoxes,
        totalAcessorios: totalAcessoriosFromBoxes,
        totalProjeto: totalProjetoFromBoxes,
      };
    }

    return {
      meta: {
        createdAt: timestamp.toISOString(),
        projectName: project.projectName,
        version: "fase-6-g",
      },
      payload,
    };
  };

  const downloadSendPackage = () => {
    const pacote = buildSendPackage();
    const projectSlug = slugifyName(project.projectName || "projeto");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `pimo-envio-${projectSlug || "projeto"}-${timestamp}.json`;
    const blob = new Blob([JSON.stringify(pacote, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const handleSendPackage = () => {
    if (sendMethod === "download") {
      downloadSendPackage();
      return;
    }
    const channelLabel = sendMethod === "whatsapp" ? "WhatsApp" : "Email";
    setIntegrationMessage(`Integração ${channelLabel} em desenvolvimento.`);
    openModal("integration");
  };

  const handleCloseModal = () => closeModal();

  return (
    <>
      <aside className="right-tools-bar" aria-label="Resultados e modais">
        <div className="right-tools-card" style={{ marginTop: 0 }}>
          <div className="right-tools-card-title">Resultados Atuais</div>
          <div className="right-tools-card-row">
            <span>Peças</span>
            <strong>{totalPecas}</strong>
          </div>
          <div className="right-tools-card-row">
            <span>Ferragens</span>
            <strong>{totalFerragens}</strong>
          </div>
          <div className="right-tools-card-row">
            <span>Total de itens</span>
            <strong>{totalItens}</strong>
          </div>
        </div>

        {/* Lista de Caixas - último bloco do painel direito */}
        <div className="right-tools-card" style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Lista de Caixas</div>
          <div
            className="boxes-list"
            style={{
              maxHeight: 300,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {workspaceBoxes.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
                Nenhuma caixa. Clique em &quot;Adicionar caixote&quot; ou &quot;Gerar Design 3D&quot;.
              </div>
            ) : (
              workspaceBoxes.map((box) => {
                const d = box.dimensoes;
                const isSelected = box.id === selectedId;
                return (
                  <div
                    key={`box-list-${box.id}`}
                    style={{
                      ...boxCardStyle,
                      borderColor: isSelected ? "var(--blue-light)" : "rgba(255,255,255,0.08)",
                      background: isSelected ? "rgba(59, 130, 246, 0.12)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={boxCardTitleStyle}>{box.nome}</div>
                    <div style={boxCardDimsStyle}>
                      {d?.largura != null && d?.altura != null && d?.profundidade != null
                        ? `${d.largura} × ${d.altura} × ${d.profundidade} mm`
                        : "—"}
                    </div>
                    <div style={boxCardRowStyle}>
                      <button
                        type="button"
                        onClick={() => {
                          actions.selectBox(box.id);
                          viewerApi?.highlightBox?.(box.id);
                        }}
                        className="button button-ghost"
                        style={{
                          flex: 1,
                          fontSize: 11,
                          padding: "4px 8px",
                        }}
                      >
                        Selecionar
                      </button>
                      <button
                        type="button"
                        onClick={() => actions.removeWorkspaceBoxById(box.id)}
                        className="button button-ghost"
                        style={{
                          flex: 1,
                          fontSize: 11,
                          padding: "4px 8px",
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">{modalTitle}</div>
              <button type="button" className="modal-close" onClick={handleCloseModal}>
                Fechar
              </button>
            </div>

            {modal === "projects" ? (
              <div className="modal-list">
                <button
                  type="button"
                  className="modal-action"
                  onClick={() => {
                    actions.createNewProject();
                    setSavedProjects(actions.listSavedProjects());
                  }}
                >
                  Criar novo projeto
                </button>
                {savedProjects.length === 0 ? (
                  <div className="modal-empty">Nenhum projeto salvo ainda.</div>
                ) : (
                  savedProjects.map((project) => (
                    <div key={project.id} className="modal-list-item">
                      <div className="modal-list-info">
                        {renamingId === project.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <input
                              className="input input-sm"
                              value={renameValue}
                              onChange={(event) => setRenameValue(event.target.value)}
                              placeholder="Novo nome"
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="modal-action"
                                onClick={() => {
                                  actions.renameProject(project.id, renameValue);
                                  setSavedProjects(actions.listSavedProjects());
                                  setRenamingId(null);
                                  setRenameValue("");
                                }}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="modal-close"
                                onClick={() => {
                                  setRenamingId(null);
                                  setRenameValue("");
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="modal-list-title">{project.name}</div>
                            <div className="modal-list-meta">
                              Criado: {new Date(project.createdAt).toLocaleString("pt-PT")}
                            </div>
                            <div className="modal-list-meta">
                              Atualizado: {new Date(project.updatedAt).toLocaleString("pt-PT")}
                            </div>
                          </>
                        )}
                      </div>
                      {renamingId !== project.id && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="modal-action"
                            onClick={() => {
                              actions.loadProjectSnapshot(project.id);
                              setSavedProjects(actions.listSavedProjects());
                              closeModal();
                            }}
                          >
                            Carregar
                          </button>
                          <button
                            type="button"
                            className="modal-action"
                            onClick={() => {
                              setRenamingId(project.id);
                              setRenameValue(project.name);
                            }}
                          >
                            Renomear
                          </button>
                          <button
                            type="button"
                            className="modal-action"
                            style={{ borderColor: "rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.18)" }}
                            onClick={() => {
                              actions.deleteProject(project.id);
                              setSavedProjects(actions.listSavedProjects());
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : modal === "2d" ? (
              <div className="modal-list">
                <div className="modal-list-item">
                  <div className="modal-list-title">Selecionar ângulo</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="modal-action"
                    onClick={() => {}}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    className="modal-action"
                    onClick={() => {}}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    className="modal-action"
                    onClick={() => {}}
                  >
                    Left
                  </button>
                  <button
                    type="button"
                    className="modal-action"
                    onClick={() => {}}
                  >
                    Right
                  </button>
                </div>
                <button type="button" className="modal-close" onClick={() => {}}>
                  Voltar ao 3D
                </button>
              </div>
            ) : modal === "image" ? (
              <div className="modal-list">
                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Tamanho da imagem</div>
                    <div className="modal-list-meta">
                      Defina a resolução final da captura
                    </div>
                  </div>
                  <select
                    className="select select-xs"
                    value={renderSize}
                    onChange={(event) =>
                      setRenderSize(event.target.value as ViewerRenderSize)
                    }
                  >
                    <option value="small">Pequeno (1280×720)</option>
                    <option value="medium">Médio (1600×900)</option>
                    <option value="large">Grande (1920×1080)</option>
                    <option value="4k">4K (3840×2160)</option>
                  </select>
                </div>

                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Ângulo</div>
                    <div className="modal-list-meta">
                      Utilize presets rápidos ou mantenha a câmera atual
                    </div>
                  </div>
                  <select
                    className="select select-xs"
                    value={renderPreset}
                    onChange={(event) =>
                      setRenderPreset(event.target.value as ViewerCameraPreset)
                    }
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
                    <div className="modal-list-meta">
                      Utilize transparência para composições externas
                    </div>
                  </div>
                  <select
                    className="select select-xs"
                    value={renderBackground}
                    onChange={(event) =>
                      setRenderBackground(event.target.value as ViewerRenderBackground)
                    }
                  >
                    <option value="white">Branco</option>
                    <option value="transparent">Transparente</option>
                  </select>
                </div>

                <label
                  className="modal-list-item"
                  style={{ cursor: "pointer", alignItems: "center" }}
                >
                  <div className="modal-list-info">
                    <div className="modal-list-title">Marca d’água</div>
                    <div className="modal-list-meta">
                      Adicionar selo “PIMO” no canto inferior direito
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={renderWatermark}
                    onChange={() => setRenderWatermark((prev) => !prev)}
                  />
                </label>

                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Sombras</div>
                    <div className="modal-list-meta">
                      Ajuste a intensidade das sombras antes do render
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={renderShadowIntensity}
                      onChange={(event) =>
                        setRenderShadowIntensity(parseFloat(event.target.value))
                      }
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {Math.round(renderShadowIntensity * 100)}%
                    </span>
                  </div>
                </div>

                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Modo de renderização</div>
                    <div className="modal-list-meta">
                      Escolha entre visual realista ou linhas técnicas
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      ["pbr", "Realista (PBR)"],
                      ["lines", "Linhas (outline)"],
                    ].map(([mode, label]) => {
                      const active = renderMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRenderMode(mode as ViewerRenderMode)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: active
                              ? "1px solid rgba(56,189,248,0.8)"
                              : "1px solid rgba(148,163,184,0.4)",
                            background: active ? "rgba(56,189,248,0.16)" : "transparent",
                            color: "var(--text-primary)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Formato</div>
                    <div className="modal-list-meta">
                      Escolha entre PNG (transparência) ou JPG (mais leve)
                    </div>
                  </div>
                  <select
                    className="select select-xs"
                    value={renderFormat}
                    onChange={(event) =>
                      setRenderFormat(event.target.value as ViewerRenderFormat)
                    }
                  >
                    <option value="png">PNG (sem perdas)</option>
                    <option value="jpg">JPG (compressão)</option>
                  </select>
                </div>

                {renderFormat === "jpg" && (
                  <div className="modal-list-item">
                    <div className="modal-list-info">
                      <div className="modal-list-title">Qualidade do JPG</div>
                      <div className="modal-list-meta">
                        100% = melhor qualidade, arquivos maiores
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={renderQuality}
                        onChange={(event) =>
                          setRenderQuality(parseFloat(event.target.value))
                        }
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {Math.round(renderQuality * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="modal-action"
                  disabled={renderLoading}
                  onClick={async () => {
                    setRenderLoading(true);
                    setRenderResult(null);
                    try {
                      const result = await null;
                      if (result) {
                        setRenderResult(result);
                      }
                    } finally {
                      setRenderLoading(false);
                    }
                  }}
                >
                  {renderLoading ? "Gerando..." : "Gerar imagem"}
                </button>

                {renderResult && (
                  <div className="modal-placeholder">
                    <img
                      src={renderResult.dataUrl}
                      alt="Pré-visualização do render"
                      style={{ maxWidth: "100%", borderRadius: 8 }}
                    />
                    <div className="modal-list-meta" style={{ marginTop: 8 }}>
                      {renderResult.width}×{renderResult.height}px
                    </div>
                    <button
                      type="button"
                      className="modal-action"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = renderResult.dataUrl;
                        const extension = renderFormat === "jpg" ? "jpg" : "png";
                        link.download = `pimo-render-${renderResult.width}x${renderResult.height}.${extension}`;
                        link.click();
                      }}
                    >
                      Baixar imagem
                    </button>
                  </div>
                )}
              </div>
            ) : modal === "send" ? (
              <div className="modal-list">
                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Conteúdo do pacote</div>
                    <div className="modal-list-meta">Selecione o que deve ser incluído no envio</div>
                  </div>
                </div>
                {(
                  [
                    ["image", "Imagem renderizada"],
                    ["viewerSnapshot", "Snapshot do Viewer (JSON)"],
                    ["projectSnapshot", "Snapshot do Projeto (JSON)"],
                    ["cutlist", "Cutlist"],
                    ["ferragens", "Ferragens"],
                    ["precos", "Preços"],
                  ] as [keyof SendSelections, string][]
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="modal-list-item"
                    style={{ cursor: "pointer", alignItems: "center" }}
                  >
                    <div className="modal-list-info">
                      <div className="modal-list-title">{label}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendSelections[key]}
                      onChange={() => toggleSendSelection(key)}
                    />
                  </label>
                ))}
                {sendSelections.image && (
                  <div className="modal-list-item">
                    <div className="modal-list-info">
                      <div className="modal-list-title">Imagem renderizada</div>
                      <div className="modal-list-meta">
                        {renderResult
                          ? `Pronta (${renderResult.width}x${renderResult.height})`
                          : "Nenhuma imagem disponível"}
                      </div>
                    </div>
                    {renderResult ? (
                      <button
                        type="button"
                        className="modal-action"
                        onClick={() => {
                        const link = document.createElement("a");
                          link.href = renderResult.dataUrl;
                        const extension = renderFormat === "jpg" ? "jpg" : "png";
                        link.download = `pimo-render-${renderResult.width}x${renderResult.height}.${extension}`;
                          link.click();
                        }}
                      >
                        Pré-visualizar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="modal-action"
                        disabled={renderLoading}
                        onClick={async () => {
                          setRenderLoading(true);
                          try {
                            const result = await null;
                            if (result) {
                              setRenderResult(result);
                            }
                          } finally {
                            setRenderLoading(false);
                          }
                        }}
                      >
                        {renderLoading ? "Gerando..." : "Gerar agora"}
                      </button>
                    )}
                  </div>
                )}
                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Método de envio</div>
                    <div className="modal-list-meta">Escolha como deseja enviar o pacote</div>
                  </div>
                </div>
                {(
                  [
                    ["whatsapp", "WhatsApp"],
                    ["email", "Email"],
                    ["download", "Download local"],
                  ] as [SendMethod, string][]
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="modal-list-item"
                    style={{ cursor: "pointer", alignItems: "center" }}
                  >
                    <div className="modal-list-info">
                      <div className="modal-list-title">{label}</div>
                    </div>
                    <input
                      type="radio"
                      name="send-method"
                      checked={sendMethod === key}
                      onChange={() => setSendMethod(key)}
                    />
                  </label>
                ))}
                <button type="button" className="modal-action" onClick={handleSendPackage}>
                  Preparar envio
                </button>
              </div>
            ) : modal === "integration" ? (
              <div className="modal-placeholder">{integrationMessage}</div>
            ) : null}
          </div>
        </div>
      )}

      {showPiece3DModal && (
        <Piece3DModal
          box={project.workspaceBoxes.find((b) => b.id === project.selectedWorkspaceBoxId) ?? null}
          materialTipo={project.material.tipo}
          open={showPiece3DModal}
          onClose={() => setShowPiece3DModal(false)}
        />
      )}
    </>
  );
}
