import { useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import { useToast } from "../../../context/ToastContext";
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
import { buildViewerDrillMarkersByPanel } from "../../../modules/drilling/drillingAdapter";

type SendMethod = "whatsapp" | "email" | "download";

type SendSelections = {
  image: boolean;
  viewerSnapshot: boolean;
  projectSnapshot: boolean;
  cutlist: boolean;
  ferragens: boolean;
  precos: boolean;
};

const defaultSendSelections: SendSelections = {
  image: true,
  viewerSnapshot: true,
  projectSnapshot: true,
  cutlist: true,
  ferragens: true,
  precos: true,
};

export default function RightToolsBar() {
  const { actions, project } = useProject();
  const { showToast } = useToast();
  const { viewerApi } = usePimoViewerContext();
  const { modal, openModal, closeModal } = useToolbarModal();
  // Single Source of Truth: Resultados Atuais derivados de project.boxes (não project.resultados/acessorios)
  const [savedProjects, setSavedProjects] = useState(() => actions.listSavedProjects());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [photoCaptureUrl, setPhotoCaptureUrl] = useState<string | null>(null);
  const [sendMethod, setSendMethod] = useState<SendMethod>("download");
  const [sendSelections, setSendSelections] = useState<SendSelections>(defaultSendSelections);
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [showPiece3DModal, setShowPiece3DModal] = useState(false);
  const modalTitle = useMemo(() => {
    if (modal === "projects") return "Projetos salvos";
    if (modal === "2d") return "2D Viewer";
    if (modal === "send") return "Enviar";
    if (modal === "integration") return "Integração";
    return "";
  }, [modal]);
  const selectedWorkspaceBox = useMemo(
    () => project.workspaceBoxes.find((b) => b.id === project.selectedWorkspaceBoxId) ?? null,
    [project.selectedWorkspaceBoxId, project.workspaceBoxes]
  );
  const selectedViewerDrillMarkers = useMemo(() => {
    const selectedBoxCutList = project.boxes.find((b) => b.id === project.selectedWorkspaceBoxId)?.cutList;
    return buildViewerDrillMarkersByPanel(selectedBoxCutList);
  }, [project.boxes, project.selectedWorkspaceBoxId]);
  const refreshSavedProjects = () => {
    setSavedProjects(actions.listSavedProjects());
  };

  const resetSendState = () => {
    setSendMethod("download");
    setSendSelections(defaultSendSelections);
    setIntegrationMessage("");
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
      payload.imagem = photoCaptureUrl ?? null;
    }

    // Single Source of Truth: cutlist, ferragens e precos derivados de project.boxes
    const boxes = project.boxes ?? [];
    const cutlistFromBoxes = cutlistComPrecoFromBoxes(
      boxes,
      project.rules,
      project.materialId,
      project.projectName
    );
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

  const handleCloseModal = () => {
    if (modal === "projects") {
      setRenamingId(null);
      setRenameValue("");
    }
    if (modal === "send" || modal === "integration") {
      resetSendState();
    }
    closeModal();
  };

  return (
    <>
      <aside className="right-tools-bar" aria-label="Resultados e modais">
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
                    refreshSavedProjects();
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
                                  refreshSavedProjects();
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
                              refreshSavedProjects();
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
                              refreshSavedProjects();
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
                        {photoCaptureUrl
                          ? "Captura pronta para download"
                          : "Capture uma imagem no Photo Mode da toolbar"}
                      </div>
                    </div>
                    {photoCaptureUrl ? (
                      <button
                        type="button"
                        className="modal-action"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = photoCaptureUrl;
                          link.download = photoCaptureUrl.startsWith("data:image/jpeg")
                            ? "pimo-photo.jpg"
                            : "pimo-photo.png";
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
                          const dataUrl = viewerApi?.capturePhotoDataUrl?.("png", 1);
                          if (dataUrl) {
                            setPhotoCaptureUrl(dataUrl);
                            showToast("Captura pronta para envio.", "info", 1400);
                          } else {
                            showToast("Não foi possível capturar a imagem do Viewer.", "warning");
                          }
                        }}
                      >
                        Capturar agora
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
          box={selectedWorkspaceBox}
          drillingByPanel={selectedViewerDrillMarkers}
          materialTipo={project.material.tipo}
          open={showPiece3DModal}
          onClose={() => setShowPiece3DModal(false)}
        />
      )}
    </>
  );
}
