/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useMemo } from "react";
import { useProject } from "../../../context/useProject";
import UnifiedPopover, { StepperPopover } from "../../ui/UnifiedPopover";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import Panel from "../../ui/Panel";
import { mmToM } from "../../../utils/units";
import { LEFT_TOOLBAR_IDS } from "../left-toolbar/LeftToolbar";
import PainelMoveisUnificado from "./PainelMoveisUnificado";
import PainelModelosDaCaixa from "./PainelModelosDaCaixa";
import BoxLayersPanel from "./BoxLayersPanel";
import { useUiStore } from "../../../stores/uiStore";
import { useWallStore } from "../../../stores/wallStore";
import { useToast } from "../../../context/ToastContext";
import { listMaterials, getViewerMaterialId, getMaterialByIdOrLabel } from "../../../core/materials";
import { cutlistComPrecoFromBoxes, ferragensFromBoxes } from "../../../core/manufacturing/cutlistFromBoxes";

export type LeftPanelProps = {
  activeTab?: string;
};

/** Dimensões padrão da sala: 4m × 5m × 2.7m */
const DEFAULT_ROOM_WIDTH_M = 4;
const DEFAULT_ROOM_DEPTH_M = 5;
const DEFAULT_ROOM_HEIGHT_M = 2.7;

function PainelSala() {
  const { viewerApi } = usePimoViewerContext();
  const mainWallIndex = useWallStore((state) => state.mainWallIndex);
  const setMainWallIndex = useWallStore((state) => state.setMainWallIndex);
  const [widthM, setWidthM] = useState(DEFAULT_ROOM_WIDTH_M);
  const [depthM, setDepthM] = useState(DEFAULT_ROOM_DEPTH_M);
  const [heightM, setHeightM] = useState(DEFAULT_ROOM_HEIGHT_M);
  const [roomExistsState, setRoomExistsState] = useState(false);
  const [roomVisibleState, setRoomVisibleState] = useState(true);

  const roomExists = viewerApi?.getRoomExists?.() ?? roomExistsState;
  const roomVisible = viewerApi?.getRoomVisible?.() ?? roomVisibleState;
  const locked = viewerApi?.getRoomLocked?.() ?? false;

  useEffect(() => {
    setRoomExistsState(viewerApi?.getRoomExists?.() ?? false);
    setRoomVisibleState(viewerApi?.getRoomVisible?.() ?? true);
  }, [viewerApi]);

  useEffect(() => {
    if (!roomExists) return;
    const dims = viewerApi?.getRoomDimensions?.();
    if (dims) {
      setWidthM(dims.width);
      setDepthM(dims.depth);
      setHeightM(dims.height);
    }
  }, [roomExists, viewerApi]);

  const handleCreate = () => {
    const w = Math.max(0.5, Math.min(50, widthM));
    const d = Math.max(0.5, Math.min(50, depthM));
    const h = Math.max(0.5, Math.min(10, heightM));
    viewerApi?.createRoomWithDimensions?.(w, d, h);
    setRoomExistsState(true);
    setRoomVisibleState(true);
  };

  const handleRemove = () => {
    viewerApi?.removeRoom?.();
    setRoomExistsState(false);
    setRoomVisibleState(false);
  };

  const handleDimensionsChange = () => {
    const w = Math.max(0.5, Math.min(50, widthM));
    const d = Math.max(0.5, Math.min(50, depthM));
    const h = Math.max(0.5, Math.min(10, heightM));
    viewerApi?.setRoomDimensions?.(w, d, h);
  };

  return (
    <aside className="panel-content panel-content--side">
      <div className="design-panel-header">
        <div className="section-title">Sala</div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }} className="design-panel-subtitle">
        Dimensões em metros. Crie a sala para ter 4 paredes principais e piso; pode adicionar paredes extras e bloquear as principais.
      </p>
      <Panel title="Dimensões (m)">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="panel-field-row">
            <label className="panel-label" style={{ minWidth: 60 }}>Largura</label>
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.1}
              value={widthM}
              onChange={(e) => setWidthM(Number(e.target.value) || 0)}
              onBlur={roomExists ? handleDimensionsChange : undefined}
              className="input input-sm"
              style={{ width: 80 }}
            />
          </div>
          <div className="panel-field-row">
            <label className="panel-label" style={{ minWidth: 60 }}>Profundidade</label>
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.1}
              value={depthM}
              onChange={(e) => setDepthM(Number(e.target.value) || 0)}
              onBlur={roomExists ? handleDimensionsChange : undefined}
              className="input input-sm"
              style={{ width: 80 }}
            />
          </div>
          <div className="panel-field-row">
            <label className="panel-label" style={{ minWidth: 60 }}>Altura</label>
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.1}
              value={heightM}
              onChange={(e) => setHeightM(Number(e.target.value) || 0)}
              onBlur={roomExists ? handleDimensionsChange : undefined}
              className="input input-sm"
              style={{ width: 80 }}
            />
          </div>
        </div>
      </Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {!roomExists ? (
          <button
            type="button"
            onClick={handleCreate}
            className="button button-primary"
            style={{ width: "100%" }}
          >
            Criar Sala
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRemove}
              className="button button-ghost"
              style={{ width: "100%" }}
            >
              Remover Sala
            </button>
            <button
              type="button"
              onClick={() => viewerApi?.addExtraWall?.()}
              className="button button-ghost"
              style={{ width: "100%" }}
            >
              Adicionar Parede
            </button>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 2,
              }}
            >
              <label style={{ fontSize: 12, color: "var(--text-main)" }}>Parede principal</label>
              <select
                className="input input-sm"
                value={mainWallIndex}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setMainWallIndex(Math.max(0, Math.min(3, next)) as 0 | 1 | 2 | 3);
                }}
              >
                <option value={0}>Frontal</option>
                <option value={1}>Direita</option>
                <option value={2}>Traseira</option>
                <option value={3}>Esquerda</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (roomVisible) {
                  viewerApi?.hideRoom?.();
                  setRoomVisibleState(false);
                } else {
                  viewerApi?.showRoom?.();
                  setRoomVisibleState(true);
                }
              }}
              className="button button-ghost"
              style={{ width: "100%" }}
            >
              {roomVisible ? "Ocultar Sala" : "Mostrar Sala"}
            </button>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => viewerApi?.setRoomLocked?.(e.target.checked)}
              />
              Lock Walls (paredes principais conectadas)
            </label>
          </>
        )}
      </div>
    </aside>
  );
}

/** Tab interno da página Info: "geral" | "tecnica" */
const INFO_INNER_TABS = ["geral", "tecnica"] as const;

function InfoPanelContent() {
  const [infoInnerTab, setInfoInnerTab] = useState<"geral" | "tecnica">("geral");

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="design-panel-header">
            <div className="section-title">Info</div>
            <p className="design-panel-subtitle">Ajuda rápida sobre fluxo e operação da página de design.</p>
          </div>
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
    </div>
  );
}

export default function LeftPanel({ activeTab = "home" }: LeftPanelProps) {
  const selectedTool = useUiStore((state) => state.selectedTool);
  const setSelectedObject = useUiStore((state) => state.setSelectedObject);
  const setSelectedTool = useUiStore((state) => state.setSelectedTool);
  const { project, actions } = useProject();
  const { showToast } = useToast();
  const selectedBox = project.workspaceBoxes.find(
    (box) => box.id === project.selectedWorkspaceBoxId
  );
  const selectedPrateleiras = selectedBox?.prateleiras ?? 0;
  const selectedGavetas = selectedBox?.gavetas ?? 0;
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editingBoxName, setEditingBoxName] = useState("");
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const { viewerApi } = usePimoViewerContext();
  const materialsList = listMaterials();
  const boxes = useMemo(() => project.boxes ?? [], [project.boxes]);
  const cutlistFromBoxes = useMemo(() => {
    const parametric = cutlistComPrecoFromBoxes(
      boxes,
      project.rules,
      project.materialId,
      project.projectName
    );
    const extracted = boxes.flatMap((box) =>
      Object.values(project.extractedPartsByBoxId?.[box.id] ?? {}).flat()
    );
    return [...parametric, ...extracted];
  }, [boxes, project.extractedPartsByBoxId, project.materialId, project.projectName, project.rules]);
  const ferragensFromBoxesList = useMemo(
    () => ferragensFromBoxes(boxes, project.rules),
    [boxes, project.rules]
  );
  const totalPecas = cutlistFromBoxes.reduce((sum, item) => sum + item.quantidade, 0);
  const totalFerragens = ferragensFromBoxesList.reduce((sum, item) => sum + item.quantidade, 0);
  const totalItens = totalPecas + totalFerragens;

  // Footer removed - buttons now in main content area

  const resolvedTabRaw = selectedTool ?? activeTab;
  const resolvedTab =
    resolvedTabRaw === LEFT_TOOLBAR_IDS.LAYOUT ? LEFT_TOOLBAR_IDS.HOME : resolvedTabRaw;

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
      </div>
    );
  }

  // Calculadora — criar e apagar caixas
  if (resolvedTab === LEFT_TOOLBAR_IDS.CALCULADORA) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
      <aside className="panel-content panel-content--side">
        <Panel title="Resultados Atuais" description="Resumo rápido do projeto em edição.">
          <div className="panel-field-row">
            <span className="panel-label">Peças</span>
            <strong style={{ fontSize: 12, fontWeight: 600 }}>{totalPecas}</strong>
          </div>
          <div className="panel-field-row">
            <span className="panel-label">Ferragens</span>
            <strong style={{ fontSize: 12, fontWeight: 600 }}>{totalFerragens}</strong>
          </div>
          <div className="panel-field-row">
            <span className="panel-label">Total de itens</span>
            <strong style={{ fontSize: 12, fontWeight: 600 }}>{totalItens}</strong>
          </div>
        </Panel>

        <div className="design-panel-header">
          <div className="section-title">Calculadora</div>
          <p className="design-panel-subtitle">
            Criar, renomear e organizar caixas do projeto.
          </p>
        </div>
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
      </div>
    );
  }

  // Sala — RoomManager: dimensões, criar/remover sala, paredes extras, lock
  if (resolvedTab === LEFT_TOOLBAR_IDS.SALA) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <PainelSala />
        </div>
      </div>
    );
  }

  // Eletrodomésticos — placeholder
  if (resolvedTab === LEFT_TOOLBAR_IDS.ELETRO) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="design-panel-header">
            <div className="section-title">Eletrodomésticos</div>
          </div>
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
          <div className="design-panel-header">
            <div className="section-title">Acessórios</div>
          </div>
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
      <InfoPanelContent />
    );
  }

  if (resolvedTab === LEFT_TOOLBAR_IDS.HOME && !selectedBox) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <aside className="panel-content panel-content--side">
            <div className="design-panel-header">
              <div className="section-title">Início</div>
              <p className="design-panel-subtitle">Comece criando uma caixa e definindo os dados básicos do projeto.</p>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Nenhuma caixa selecionada. Defina o nome do projeto abaixo.
            </p>

            <button
              type="button"
              onClick={() => actions.addWorkspaceBox()}
              className="button button-primary"
              style={{ width: "100%", marginBottom: 12 }}
            >
              Criar Caixa
            </button>

            <Panel title="NOME DE PROJETO">
              <input
                type="text"
                value={project.projectName}
                onChange={(e) => actions.setProjectName(e.target.value)}
                placeholder="Nome do projeto"
                className="input input-sm"
              />
            </Panel>

            <Panel title="Notas">
              <NotesField projectName={project.projectName} />
            </Panel>
          </aside>
        </div>
      </div>
    );
  }

  // Página inicial (HOME)
  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
    <aside className="panel-content panel-content--side">
      <div className="design-panel-header">
        <div className="section-title">Início</div>
        <p className="design-panel-subtitle">Controles principais da caixa selecionada e definição inicial do projeto.</p>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Crie novas caixas a partir daqui para começar o seu projeto.
      </p>
      
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => actions.addWorkspaceBox()}
          className="button button-primary"
          style={{ flex: 1, minWidth: 140 }}
        >
          Adicionar Caixote
        </button>
        {selectedBox && (
          <button
            type="button"
            onClick={() => actions.duplicateWorkspaceBox()}
            className="button button-ghost"
            style={{ flex: 1, minWidth: 140 }}
          >
            Duplicar Caixa
          </button>
        )}
      </div>

      {selectedBox && (
        <Panel title="NOME DA CAIXA">
          <input
            type="text"
            value={selectedBox.nome}
            onChange={(e) => actions.setWorkspaceBoxNome(selectedBox.id, e.target.value)}
            placeholder="Nome da caixa"
            className="input input-sm"
          />
        </Panel>
      )}

      {!selectedBox && (
        <div className="section-title" style={{ marginTop: 20 }}>Definições</div>
      )}

      {!selectedBox && (
        <Panel title="NOME DE PROJETO">
          <input
            type="text"
            value={project.projectName}
            onChange={(e) => actions.setProjectName(e.target.value)}
            placeholder="Nome do projeto"
            className="input input-sm"
          />
        </Panel>
      )}

      {!selectedBox && (
        <Panel title="Material do projeto" description="Material padrão (somente leitura)">
          <div style={{ fontSize: 12, color: "var(--text-main)" }}>
            {project.materialId
              ? (getMaterialByIdOrLabel(project.materialId)?.label ?? project.material.tipo)
              : project.material.tipo}
          </div>
        </Panel>
      )}

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

      {selectedBox && (
        <button
          type="button"
          className="button button-ghost"
          style={{ width: "100%", marginBottom: 8 }}
          onClick={() => setMaterialModalOpen(true)}
        >
          Selecionar Material
        </button>
      )}

      {materialModalOpen && selectedBox && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setMaterialModalOpen(false)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: 360, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">Selecionar Material</div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setMaterialModalOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div style={{ padding: "0 16px 16px", overflowY: "auto", flex: 1 }}>
              {materialsList.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Nenhum material no registo. Adicione em Admin → Materials.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {materialsList.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="card"
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          textAlign: "left",
                          cursor: "pointer",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.04)",
                        }}
                        onClick={() => {
                          actions.setWorkspaceBoxMaterial(selectedBox.id, m.id);
                          viewerApi?.updateBox(selectedBox.id, {
                            materialName: getViewerMaterialId(m.id),
                          });
                          showToast("Material aplicado à caixa.", "info");
                          setMaterialModalOpen(false);
                        }}
                      >
                        {m.color && (
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              background: m.color,
                              border: "1px solid rgba(255,255,255,0.2)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>{m.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {m.espessura ?? "—"} mm · {m.precoPorM2 ?? "—"} €/m²
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedBox?.cabinetType === "lower" && (
        <Panel title="Pés">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--text-main)",
            }}
          >
            <input
              type="checkbox"
              checked={selectedBox.feetEnabled !== false}
              onChange={(e) => {
                const nextEnabled = e.target.checked;
                const partial: {
                  feetEnabled: boolean;
                  y_mm?: number;
                  manualPosition?: boolean;
                } = { feetEnabled: nextEnabled };
                if (nextEnabled) {
                  partial.y_mm = ((selectedBox.pe_cm ?? 10) * 10) + selectedBox.dimensoes.altura / 2;
                  partial.manualPosition = false;
                } else {
                  partial.manualPosition = true;
                }
                actions.updateWorkspaceBoxTransform(selectedBox.id, partial);
              }}
            />
            Ativar pés
          </label>

          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Com pés desativados, a caixa move livremente no eixo Y (sem atravessar o chão).
          </p>
        </Panel>
      )}

      {selectedBox && (
        <Panel title="Opções do box" description="Prateleiras, portas e gavetas no mesmo local.">
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

          <BoxLayersPanel embedded />
        </Panel>
      )}

    </aside>
      </div>
    </div>
  );
}

function NotesField({ projectName }: { projectName: string }) {
  const storageKey = `pimo_project_notes:${projectName}`;
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) ?? "";
      setNotes(saved);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, notes);
    } catch {
      /* ignore */
    }
  }, [storageKey, notes]);

  return (
    <div>
      <textarea
        className="input input-sm"
        style={{ width: "100%", minHeight: 80 }}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas do projeto (local)"
      />
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Nota atual:</div>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--text-main)", background: "var(--surface)", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
          {notes || (<span style={{ color: "var(--text-muted)" }}>Nenhuma nota</span>)}
        </div>
      </div>
    </div>
  );
}
