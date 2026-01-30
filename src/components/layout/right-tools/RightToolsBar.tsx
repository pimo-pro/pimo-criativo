import { useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import {
  cutlistComPrecoFromBoxes,
  ferragensFromBoxes,
} from "../../../core/manufacturing/cutlistFromBoxes";
import {
  calcularPrecoTotalPecas,
  calcularPrecoTotalProjeto,
} from "../../../core/pricing/pricing";

type RightToolsItem = {
  id: string;
  label: string;
  icon: string;
};

type ModalType = "projects" | "2d" | "image" | "send" | "integration" | null;

type SendMethod = "whatsapp" | "email" | "download";

type SendSelections = {
  image: boolean;
  viewerSnapshot: boolean;
  projectSnapshot: boolean;
  cutlist: boolean;
  ferragens: boolean;
  precos: boolean;
};

const tools: RightToolsItem[] = [
  { id: "projeto", label: "PROJETO", icon: "P" },
  { id: "salvar", label: "SALVAR", icon: "S" },
  { id: "desfazer", label: "DESFAZER", icon: "⟲" },
  { id: "refazer", label: "REFAZER", icon: "⟳" },
  { id: "2d", label: "2D", icon: "2D" },
  { id: "imagem", label: "IMAGEM", icon: "🖼" },
  { id: "enviar", label: "ENVIAR", icon: "↗" },
];

export default function RightToolsBar() {
  const { actions, viewerSync, project } = useProject();
  // Single Source of Truth: Resultados Atuais derivados de project.boxes (não project.resultados/acessorios)
  // boxes em useMemo para referência estável e evitar reexecução dos useMemo abaixo a cada render
  const boxes = useMemo(() => project.boxes ?? [], [project.boxes]);
  const cutlistFromBoxes = useMemo(() => {
    const parametric = cutlistComPrecoFromBoxes(boxes);
    const extracted = boxes.flatMap((box) =>
      Object.values(project.extractedPartsByBoxId?.[box.id] ?? {}).flat()
    );
    return [...parametric, ...extracted];
  }, [boxes, project.extractedPartsByBoxId]);
  const ferragensFromBoxesList = useMemo(
    () => ferragensFromBoxes(boxes),
    [boxes]
  );
  const totalPecas =
    cutlistFromBoxes.reduce((sum, item) => sum + item.quantidade, 0);
  const totalFerragens =
    ferragensFromBoxesList.reduce((sum, a) => sum + a.quantidade, 0);
  const totalItens = totalPecas + totalFerragens;
  const [modal, setModal] = useState<ModalType>(null);
  const [savedProjects, setSavedProjects] = useState(actions.listSavedProjects());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renderQuality, setRenderQuality] = useState<"low" | "medium" | "high">("medium");
  const [renderBackground, setRenderBackground] = useState<"white" | "transparent">("white");
  const [renderResult, setRenderResult] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
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
  const modalTitle = useMemo(() => {
    if (modal === "projects") return "Projetos salvos";
    if (modal === "2d") return "2D Viewer";
    if (modal === "image") return "Renderização";
    if (modal === "send") return "Enviar";
    if (modal === "integration") return "Integração";
    return "";
  }, [modal]);

  const openProjectsModal = () => {
    setSavedProjects(actions.listSavedProjects());
    setRenamingId(null);
    setRenameValue("");
    setModal("projects");
  };

  const handleSelect = (id: string) => {
    if (id === "projeto") {
      openProjectsModal();
      return;
    }
    if (id === "salvar") {
      actions.saveProjectSnapshot();
      setSavedProjects(actions.listSavedProjects());
      return;
    }
    if (id === "desfazer") {
      actions.undo();
      return;
    }
    if (id === "refazer") {
      actions.redo();
      return;
    }
    if (id === "2d") {
      setModal("2d");
      return;
    }
    if (id === "imagem") {
      setRenderResult(null);
      setModal("image");
      return;
    }
    if (id === "enviar") {
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
      setModal("send");
    }
  };

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
    const cutlistFromBoxes = cutlistComPrecoFromBoxes(boxes);
    const ferragensFromBoxesList = ferragensFromBoxes(boxes);
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
    setModal("integration");
  };

  return (
    <>
      <aside className="right-tools-bar" aria-label="Ferramentas rápidas">
        {tools.map((item) => (
          <button
            key={item.id}
            type="button"
            className="right-tools-item"
            onClick={() => handleSelect(item.id)}
          >
            <span className="right-tools-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="right-tools-label">{item.label}</span>
          </button>
        ))}
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
      </aside>

      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">{modalTitle}</div>
              <button type="button" className="modal-close" onClick={() => setModal(null)}>
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
                              setModal(null);
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
                    <div className="modal-list-title">Qualidade</div>
                  </div>
                  <select
                    className="select select-xs"
                    value={renderQuality}
                    onChange={(event) => setRenderQuality(event.target.value as "low" | "medium" | "high")}
                  >
                    <option value="low">Low (1280x720)</option>
                    <option value="medium">Medium (1600x900)</option>
                    <option value="high">High (1920x1080)</option>
                  </select>
                </div>
                <div className="modal-list-item">
                  <div className="modal-list-info">
                    <div className="modal-list-title">Fundo</div>
                  </div>
                  <select
                    className="select select-xs"
                    value={renderBackground}
                    onChange={(event) =>
                      setRenderBackground(event.target.value as "white" | "transparent")
                    }
                  >
                    <option value="white">Branco</option>
                    <option value="transparent">Transparente</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="modal-action"
                  onClick={() => {
                    const result = viewerSync.renderScene({
                      quality: renderQuality,
                      background: renderBackground,
                    });
                    if (result) setRenderResult(result);
                  }}
                >
                  Gerar imagem
                </button>
                {renderResult && (
                  <div className="modal-placeholder">
                    <img
                      src={renderResult.dataUrl}
                      alt="Render 2D"
                      style={{ maxWidth: "100%", borderRadius: 8 }}
                    />
                    <button
                      type="button"
                      className="modal-action"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = renderResult.dataUrl;
                        link.download = `pimo-render-${renderResult.width}x${renderResult.height}.png`;
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
                          link.download = `pimo-render-${renderResult.width}x${renderResult.height}.png`;
                          link.click();
                        }}
                      >
                        Pré-visualizar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="modal-action"
                        onClick={() => {
                          const result = viewerSync.renderScene({
                            quality: renderQuality,
                            background: renderBackground,
                          });
                          if (result) setRenderResult(result);
                        }}
                      >
                        Gerar agora
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
            ) : (
              <div className="modal-placeholder">Opções indisponíveis.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
