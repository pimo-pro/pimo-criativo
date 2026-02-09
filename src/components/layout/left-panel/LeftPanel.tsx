import { useState } from "react";
import { useProject } from "../../../context/useProject";
import UnifiedPopover, { StepperPopover } from "../../ui/UnifiedPopover";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import Panel from "../../ui/Panel";
import { mmToM } from "../../../utils/units";
import { LEFT_TOOLBAR_IDS } from "../left-toolbar/LeftToolbar";
import PainelMoveisUnificado from "./PainelMoveisUnificado";
import PainelModelosDaCaixa from "./PainelModelosDaCaixa";
import SidebarWalls from "../../walls/SidebarWalls";
import RoomSetupPanel from "../../walls/RoomSetupPanel";
import OpeningSettings from "../../walls/OpeningSettings";
import { useWallStore } from "../../../stores/wallStore";
import { useUiStore } from "../../../stores/uiStore";

export type LeftPanelProps = {
  activeTab?: string;
};

/** Tab interno da página Info: "geral" | "tecnica" */
const INFO_INNER_TABS = ["geral", "tecnica"] as const;

function InfoPanelContent({ footer }: { footer: React.ReactNode }) {
  const [infoInnerTab, setInfoInnerTab] = useState<"geral" | "tecnica">("geral");

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Info</div>
          {/* Tabs internas: preparadas para futura Info Técnica */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 12,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {INFO_INNER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setInfoInnerTab(tab)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  background: infoInnerTab === tab ? "rgba(59,130,246,0.2)" : "transparent",
                  border: "none",
                  borderBottom: infoInnerTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                  color: "var(--text-main)",
                  cursor: "pointer",
                }}
              >
                {tab === "geral" ? "Geral" : "Técnica"}
              </button>
            ))}
          </div>

          {infoInnerTab === "geral" && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                Como funciona o PIMO.
              </p>
              <Panel title="Fluxo básico" description="Criar projeto e ver resultado 3D.">
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: "var(--text-muted)" }}>
                  <li>Use <strong>Página inicial</strong> para definir nome, tipo, material e dimensões.</li>
                  <li>Use <strong>Calculadora</strong> para adicionar caixas e gerar design.</li>
                  <li>Use <strong>Móveis</strong> ou <strong>Modelos</strong> para adicionar modelos 3D (GLB) às caixas.</li>
                  <li>O painel direito permite gerar design, adicionar/remover caixas e exportar PDF.</li>
                </ol>
              </Panel>
              <Panel title="Modelos CAD" description="Admin → Modelos CAD para registar ficheiros GLB.">
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  Em Admin pode carregar ficheiros .glb; depois aparecem em Móveis/Modelos para adicionar à caixa.
                </p>
              </Panel>
            </>
          )}

          {infoInnerTab === "tecnica" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Documentação técnica em breve.
            </p>
          )}
        </aside>
      </div>
      {footer}
    </div>
  );
}

export default function LeftPanel({ activeTab = "home" }: LeftPanelProps) {
  const isRoomOpen = useWallStore((state) => state.isOpen);
  const walls = useWallStore((state) => state.walls);
  const selectedTool = useUiStore((state) => state.selectedTool);
  const selectedObject = useUiStore((state) => state.selectedObject);
  const setSelectedObject = useUiStore((state) => state.setSelectedObject);
  const setSelectedTool = useUiStore((state) => state.setSelectedTool);
  const { project, actions } = useProject();
  const selectedBox = project.workspaceBoxes.find(
    (box) => box.id === project.selectedWorkspaceBoxId
  );
  const selectedPrateleiras = selectedBox?.prateleiras ?? 0;
  const selectedGavetas = selectedBox?.gavetas ?? 0;
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editingBoxName, setEditingBoxName] = useState("");
  const { viewerApi } = usePimoViewerContext();

  const footer = (
    <div className="left-panel-footer">
      <button
        type="button"
        onClick={() => actions.addWorkspaceBox()}
        className="button button-ghost"
        style={{ width: "100%" }}
      >
        Criar Caixa
      </button>
    </div>
  );

  const resolvedTab = selectedTool ?? activeTab;

  // Layout = configurações da Sala (paredes, aberturas, Reiniciar Sala)
  if (resolvedTab === LEFT_TOOLBAR_IDS.LAYOUT) {
    if (selectedObject?.type === "roomElement" && selectedObject?.id) {
      const wallWithOpening = walls.find((w) =>
        (w.openings ?? []).some((o) => o.id === selectedObject.id)
      );
      const opening = wallWithOpening?.openings?.find((o) => o.id === selectedObject.id) ?? null;
      return (
        <OpeningSettings
          opening={opening}
          wallId={wallWithOpening?.id ?? null}
        />
      );
    }
    const isInitialRoomView =
      selectedObject?.type === "none" && project.workspaceBoxes.length === 0;
    if (isInitialRoomView) {
      return <RoomSetupPanel onClear={() => viewerApi?.removeRoom?.()} />;
    }
    return <SidebarWalls />;
  }

  // Móveis = painel unificado
  if (resolvedTab === LEFT_TOOLBAR_IDS.MOVEIS) {
    return <PainelMoveisUnificado />;
  }

  // Modelos = Instâncias dentro da caixa atual
  if (resolvedTab === LEFT_TOOLBAR_IDS.MODELOS) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <PainelModelosDaCaixa />
        </div>
        {footer}
      </div>
    );
  }

  // Calculadora — criar e apagar caixas
  if (resolvedTab === LEFT_TOOLBAR_IDS.CALCULADORA) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
      <aside className="panel-content panel-content--side">
        <div className="section-title">Calculadora</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Criar e gerir caixas do projeto.
        </p>
        <Panel title="Caixas">
          <button
            type="button"
            onClick={() => actions.addWorkspaceBox()}
            className="button button-ghost"
            style={{ width: "100%", marginBottom: 12 }}
          >
            Adicionar caixote
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {project.workspaceBoxes.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Nenhuma caixa. Clique em &quot;Adicionar caixote&quot;.
              </p>
            ) : (
              project.workspaceBoxes.map((box) => {
                const isSelected = box.id === project.selectedWorkspaceBoxId;
                const isEditing = editingBoxId === box.id;
                return (
                  <div
                    key={box.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      background: isSelected ? "rgba(56, 189, 248, 0.12)" : "var(--surface)",
                      border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      borderRadius: 6,
                    }}
                  >
                    {isEditing ? (
                      <div style={{ flex: 1, display: "flex", gap: 4 }}>
                        <input
                          type="text"
                          value={editingBoxName}
                          onChange={(e) => setEditingBoxName(e.target.value)}
                          className="input input-xs"
                          style={{ flex: 1 }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              actions.setWorkspaceBoxNome(box.id, editingBoxName.trim() || box.nome);
                              setEditingBoxId(null);
                            } else if (e.key === "Escape") setEditingBoxId(null);
                          }}
                          autoFocus
                        />
                        <button type="button" className="panel-button" style={{ fontSize: 11 }} onClick={() => { actions.setWorkspaceBoxNome(box.id, editingBoxName.trim() || box.nome); setEditingBoxId(null); }}>OK</button>
                        <button type="button" className="panel-button" style={{ fontSize: 11 }} onClick={() => setEditingBoxId(null)}>✕</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          actions.selectBox(box.id);
                          setSelectedTool(LEFT_TOOLBAR_IDS.HOME);
                          setSelectedObject({ type: "box", id: box.id });
                        }}
                        onDoubleClick={() => { setEditingBoxId(box.id); setEditingBoxName(box.nome); }}
                        className="panel-button"
                        title="Duplo-clique para editar nome"
                        style={{
                          flex: 1,
                          textAlign: "left",
                          padding: "6px 8px",
                          background: "transparent",
                          border: "none",
                        }}
                      >
                        {box.nome} — {box.dimensoes.largura}×{box.dimensoes.altura}×{box.dimensoes.profundidade} mm
                      </button>
                    )}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => actions.removeWorkspaceBoxById(box.id)}
                        className="panel-button"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        title="Apagar caixa"
                      >
                        Apagar
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Panel>
        <button
          type="button"
          onClick={() => actions.gerarDesign()}
          disabled={project.estaCarregando}
          className="button button-primary"
          style={{ width: "100%", marginTop: 8 }}
        >
          {project.estaCarregando ? "A calcular…" : "Gerar Design 3D"}
        </button>
      </aside>
        </div>
        {footer}
      </div>
    );
  }

  // Eletrodomésticos — placeholder
  if (resolvedTab === LEFT_TOOLBAR_IDS.ELETRO) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Eletrodomésticos</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            Modelos 3D de eletrodomésticos (em breve).
          </p>
        </aside>
        </div>
      </div>
    );
  }

  // Acessórios — placeholder
  if (resolvedTab === LEFT_TOOLBAR_IDS.ACESSORIOS) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Acessórios</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            Acessórios (em breve).
          </p>
        </aside>
        </div>
      </div>
    );
  }

  // Info — ajuda / como funciona (estrutura com tabs para futura Info Técnica)
  if (resolvedTab === LEFT_TOOLBAR_IDS.INFO) {
    return (
      <InfoPanelContent footer={null} />
    );
  }

  if (resolvedTab === LEFT_TOOLBAR_IDS.HOME && !selectedBox) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <aside className="panel-content panel-content--side">
            <div className="section-title">Seleção</div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              Nenhum item selecionado.
            </p>
          </aside>
        </div>
        {footer}
      </div>
    );
  }

  // Página inicial (HOME)
  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
    <aside className="panel-content panel-content--side">
      <div className="section-title">
        {selectedBox
          ? `Caixa selecionada: ${selectedBox.nome}`
          : "Definições"}
      </div>
      {selectedBox && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Edite largura, altura, profundidade, prateleiras e material abaixo.
        </p>
      )}

      <Panel title="NOME DE PROJETO">
        <input
          type="text"
          value={project.projectName}
          onChange={(e) => actions.setProjectName(e.target.value)}
          placeholder="Nome do projeto"
          className="input input-sm"
        />
      </Panel>

      <Panel title="Dimensões" description="Valores em milímetros">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="panel-field-row">
            <span className="panel-label">
              Largura:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                value={selectedBox?.dimensoes.largura ?? project.dimensoes.largura}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  actions.setDimensoes({ largura: value });
                  if (project.selectedWorkspaceBoxId) {
                    viewerApi?.updateBox(project.selectedWorkspaceBoxId, { width: mmToM(value) });
                  }
                }}
                className="input input-xs"
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>mm</span>
            </div>
          </div>
          <div className="panel-field-row">
            <span className="panel-label">
              Altura:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                value={selectedBox?.dimensoes.altura ?? project.dimensoes.altura}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  actions.setDimensoes({ altura: value });
                  if (project.selectedWorkspaceBoxId) {
                    viewerApi?.updateBox(project.selectedWorkspaceBoxId, { height: mmToM(value) });
                  }
                }}
                className="input input-xs"
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>mm</span>
            </div>
          </div>
          <div className="panel-field-row">
            <span className="panel-label">
              Profundidade:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                value={selectedBox?.dimensoes.profundidade ?? project.dimensoes.profundidade}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  actions.setDimensoes({ profundidade: value });
                  if (project.selectedWorkspaceBoxId) {
                    viewerApi?.updateBox(project.selectedWorkspaceBoxId, { depth: mmToM(value) });
                  }
                }}
                className="input input-xs"
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>mm</span>
            </div>
          </div>
        </div>
      </Panel>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <StepperPopover
          id="prateleiras-popover"
          label="Prateleiras"
          value={selectedPrateleiras}
          onChange={(v) => actions.setPrateleiras(v)}
        />
        <StepperPopover
          id="gavetas-popover"
          label="Gavetas"
          value={selectedGavetas}
          onChange={(v) => actions.setGavetas(v)}
        />
        <UnifiedPopover trigger={<span>Tipo de porta: <strong>{selectedBox?.portaTipo === "sem_porta" ? "Sem" : selectedBox?.portaTipo === "porta_simples" ? "Simples" : selectedBox?.portaTipo === "porta_correr" ? "Correr" : "Dupla"}</strong></span>}>
          <select
            value={selectedBox?.portaTipo ?? "sem_porta"}
            onChange={(e) => actions.setPortaTipo(e.target.value as "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr")}
            className="select"
            style={{ width: "100%" }}
          >
            <option value="sem_porta">Sem porta</option>
            <option value="porta_simples">Porta simples</option>
            <option value="porta_dupla">Porta dupla</option>
            <option value="porta_correr">Porta de correr</option>
          </select>
        </UnifiedPopover>
      </div>

    </aside>
      </div>
      {footer}
    </div>
  );
}
