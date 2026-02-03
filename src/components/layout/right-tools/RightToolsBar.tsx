import { useEffect, useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import { useToolbarModal } from "../../../context/ToolbarModalContext";
import {
  cutlistComPrecoFromBoxes,
  ferragensFromBoxes,
} from "../../../core/manufacturing/cutlistFromBoxes";
import { validateProject } from "../../../core/validation/validateProject";
import { buildTechnicalPdf } from "../../../core/pdf/pdfTechnical";
import { buildCutlistPdf } from "../../../core/pdf/pdfCutlist";
import { buildUnifiedPdf } from "../../../core/pdf/pdfUnified";
import { runCutLayout, cutlistToPieces } from "../../../core/cutlayout/cutLayoutEngine";
import { buildCutLayoutPdf } from "../../../core/cutlayout/cutLayoutPdf";
import { exportCncFiles, buildBasicDrillOperations } from "../../../core/cnc/cncExport";
import {
  calcularPrecoTotalPecas,
  calcularPrecoTotalProjeto,
} from "../../../core/pricing/pricing";
import CreateRoomModal from "../../modals/CreateRoomModal";
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

export default function RightToolsBar() {
  const { actions, project } = useProject();
  const { modal, openModal, closeModal } = useToolbarModal();
  // Single Source of Truth: Resultados Atuais derivados de project.boxes (não project.resultados/acessorios)
  // boxes em useMemo para referência estável e evitar reexecução dos useMemo abaixo a cada render
  const boxes = useMemo(() => project.boxes ?? [], [project.boxes]);
  const cutlistFromBoxes = useMemo(() => {
    const parametric = cutlistComPrecoFromBoxes(boxes, project.rules);
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
    if (modal === "room") return "Criar Sala";
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
    const viewerSnapshot = shouldCaptureViewer ? viewerSync.saveViewerSnapshot() : null;
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
    const cutlistFromBoxes = cutlistComPrecoFromBoxes(boxes, project.rules);
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
        <div className="right-tools-card">
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
        <div
          className="right-tools-card"
          style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <button
            type="button"
            className="modal-action"
            style={{ width: "100%", fontWeight: 600 }}
            onClick={() => openModal("validation")}
          >
            Verificar Projeto
          </button>
          <button
            type="button"
            className="modal-action"
            style={{ width: "100%", fontWeight: 600 }}
            onClick={() => openModal("image")}
          >
            Abrir Photo Mode
          </button>
        </div>
        <div
          className="right-tools-card"
          style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div className="right-tools-card-title">Exportar</div>
          <button
            type="button"
            className="modal-action"
            style={{ width: "100%", fontSize: 12 }}
            onClick={() => {
              const boxes = project.boxes ?? [];
              if (boxes.length === 0) {
                alert("Nenhuma caixa no projeto. Gere o design primeiro.");
                return;
              }
              const pdfProject = {
                projectName: project.projectName ?? "Projeto",
                boxes,
                rules: project.rules,
              };
              const doc = buildTechnicalPdf(pdfProject);
              const name = (project.projectName || "projeto").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_") || "projeto";
              doc.save(`${name}_tecnico.pdf`);
            }}
          >
            PDF Técnico
          </button>
          <button
            type="button"
            className="modal-action"
            style={{ width: "100%", fontSize: 12 }}
            onClick={() => {
              const boxes = project.boxes ?? [];
              if (boxes.length === 0) {
                alert("Nenhuma caixa no projeto. Gere o design primeiro.");
                return;
              }
              const pdfProject = {
                projectName: project.projectName ?? "Projeto",
                boxes,
                rules: project.rules,
                extractedPartsByBoxId: project.extractedPartsByBoxId ?? {},
              };
              const doc = buildCutlistPdf(pdfProject);
              const name = (project.projectName || "projeto").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_") || "projeto";
              doc.save(`${name}_cutlist.pdf`);
            }}
          >
            Cutlist
          </button>
          <button
            type="button"
            className="modal-action"
            style={{ width: "100%", fontSize: 12, fontWeight: 600 }}
            onClick={() => {
              const boxes = project.boxes ?? [];
              if (boxes.length === 0) {
                alert("Nenhuma caixa no projeto. Gere o design primeiro.");
                return;
              }
              const pdfProject = {
                projectName: project.projectName ?? "Projeto",
                boxes,
                rules: project.rules,
                extractedPartsByBoxId: project.extractedPartsByBoxId ?? {},
              };
              const doc = buildUnifiedPdf(pdfProject);
              const name = (project.projectName || "projeto").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_") || "projeto";
              doc.save(`${name}_completo.pdf`);
            }}
          >
            Ambos (Unificado)
          </button>
          <button
            type="button"
            className="modal-action"
            title="Otimização com rotação e agrupamento por material"
            style={{ width: "100%", fontSize: 12, opacity: 0.9 }}
            onClick={() => {
              const boxes = project.boxes ?? [];
              if (boxes.length === 0) {
                alert("Nenhuma caixa no projeto. Gere o design primeiro.");
                return;
              }
              const parametric = cutlistComPrecoFromBoxes(boxes, project.rules);
              const extracted = boxes.flatMap((b) =>
                Object.values(project.extractedPartsByBoxId?.[b.id] ?? {}).flat()
              );
              const allItems = [...parametric, ...extracted].map((p) => ({
                ...p,
                boxId: p.boxId ?? "",
              }));
              const pieces = cutlistToPieces(allItems);
              if (pieces.length === 0) {
                alert("Nenhuma peça na cutlist para o layout de corte.");
                return;
              }
              const result = runCutLayout(pieces, {
                largura_mm: 2750,
                altura_mm: 1830,
                espessura_mm: 19,
              });
              const doc = buildCutLayoutPdf(result);
              const name = (project.projectName || "projeto").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_") || "projeto";
              doc.save(`${name}_layout_corte.pdf`);
            }}
          >
            Layout de Corte PRO
          </button>
          <button
            type="button"
            className="modal-action"
            style={{ width: "100%", fontSize: 12, fontWeight: 600 }}
            onClick={() => {
              const boxes = project.boxes ?? [];
              if (boxes.length === 0) {
                alert("Nenhuma caixa no projeto. Gere o design primeiro.");
                return;
              }
              const parametric = cutlistComPrecoFromBoxes(boxes, project.rules);
              const extracted = boxes.flatMap((b) =>
                Object.values(project.extractedPartsByBoxId?.[b.id] ?? {}).flat()
              );
              const allItems = [...parametric, ...extracted].map((p) => ({
                ...p,
                boxId: p.boxId ?? "",
              }));
              const pieces = cutlistToPieces(allItems);
              if (pieces.length === 0) {
                alert("Nenhuma peça na cutlist para exportar CNC.");
                return;
              }
              const layoutResult = runCutLayout(pieces, {
                largura_mm: 2750,
                altura_mm: 1830,
                espessura_mm: 19,
              });
              const drillOps = buildBasicDrillOperations(layoutResult);
              const cnc = exportCncFiles(project, layoutResult, drillOps);
              const name = (project.projectName || "projeto").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_") || "projeto";
              const tcnBlob = new Blob([cnc.tcn], { type: "text/plain" });
              const kdtBlob = new Blob([cnc.kdt], { type: "text/xml" });
              const tcnUrl = URL.createObjectURL(tcnBlob);
              const kdtUrl = URL.createObjectURL(kdtBlob);
              const link1 = document.createElement("a");
              link1.href = tcnUrl;
              link1.download = `${name}.tcn`;
              link1.click();
              const link2 = document.createElement("a");
              link2.href = kdtUrl;
              link2.download = `${name}.kdt`;
              link2.click();
              setTimeout(() => {
                URL.revokeObjectURL(tcnUrl);
                URL.revokeObjectURL(kdtUrl);
              }, 500);
            }}
          >
            Exportar CNC (TCN + KDT)
          </button>
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
                    onClick={() => viewerSync.enable2DView("top")}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    className="modal-action"
                    onClick={() => viewerSync.enable2DView("front")}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    className="modal-action"
                    onClick={() => viewerSync.enable2DView("left")}
                  >
                    Left
                  </button>
                  <button
                    type="button"
                    className="modal-action"
                    onClick={() => viewerSync.enable2DView("right")}
                  >
                    Right
                  </button>
                </div>
                <button type="button" className="modal-close" onClick={viewerSync.disable2DView}>
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
                      const result = await viewerSync.renderScene({
                        size: renderSize,
                        preset: renderPreset,
                        background: renderBackground,
                        mode: renderMode,
                        watermark: renderWatermark,
                        shadowIntensity: renderShadowIntensity,
                        format: renderFormat,
                        quality: renderFormat === "jpg" ? renderQuality : undefined,
                      });
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
                            const result = await viewerSync.renderScene({
                              size: renderSize,
                              background: renderBackground,
                              mode: renderMode,
                            });
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
            ) : modal === "room" ? (
              <CreateRoomModal
                onCreateRoom={(config) => viewerSync.createRoom(config)}
                onRemoveRoom={() => viewerSync.removeRoom()}
                onSetPlacementMode={(mode) => viewerSync.setPlacementMode(mode)}
                onSetOnRoomElementPlaced={(cb) => viewerSync.setOnRoomElementPlaced(cb)}
                onSetOnRoomElementSelected={(cb) => viewerSync.setOnRoomElementSelected(cb)}
                onUpdateRoomElementConfig={(id, config) => viewerSync.updateRoomElementConfig(id, config)}
              />
            ) : modal === "validation" ? (
              (() => {
                const result = validateProject({
                  workspaceBoxes: project.workspaceBoxes,
                  boxes: project.boxes ?? [],
                  roomConfig: null,
                });
                return (
                  <div className="modal-list">
                    {result.items.length === 0 ? (
                      <div className="modal-empty">Nenhum problema encontrado.</div>
                    ) : (
                      result.items.map((item) => (
                        <div key={item.id} className="modal-list-item">
                          <div className="modal-list-info">
                            <div
                              className="modal-list-title"
                              style={{
                                color: item.severity === "error" ? "var(--red)" : "var(--warning)",
                              }}
                            >
                              {item.message}
                            </div>
                          </div>
                          {item.boxId && (
                            <button
                              type="button"
                              className="modal-action"
                              onClick={() => {
                                actions.selectBox(item.boxId!);
                                closeModal();
                              }}
                            >
                              Selecionar Caixa
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })()
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
