/**
 * Shell de design pipro v2 — mesma arquitectura da página principal (LegacyApp),
 * dedicado a criar/editar modelos pipro (não projectos).
 * Rota: /admin/pipro/workspace2
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../../components/layout/header/Header";
import LeftToolbar from "../../components/layout/left-toolbar/LeftToolbar";
import LeftPanel from "../../components/layout/left-panel/LeftPanel";
import ToolbarModals from "../../components/layout/ToolbarModals";
import Workspace from "../../components/layout/workspace/Workspace";
import Footer from "../../components/layout/footer/Footer";
import BottomInfoToolbar from "../../components/layout/bottom-info-toolbar/BottomInfoToolbar";
import BottomInfoPanelsOverlay from "../../components/layout/bottom-info-toolbar/BottomInfoPanelsOverlay";
import { BottomInfoProvider } from "../../context/BottomInfoContext";
import { PimoViewerProvider } from "../../context/PimoViewerContext";
import { ProjectProvider } from "../../context/ProjectProvider";
import { WorkspaceUndoRedoRegistryProvider } from "../../context/WorkspaceUndoRedoRegistryContext";
import { MaterialProvider } from "../../context/materialContext";
import { ToolbarModalProvider } from "../../context/ToolbarModalContext";
import { ToastProvider } from "../../context/ToastContext";
import { SettingsProvider } from "../../context/SettingsContext";
import { useProject } from "../../context/useProject";
import MateriaisSsotBootstrap from "../../core/catalog/MateriaisSsotBootstrap";
import { DEFAULT_VIEWER_OPTIONS, VIEWER_BACKGROUND } from "../../constants/viewerOptions";
import { useUiStore } from "../../stores/uiStore";
import { wallStore } from "../../stores/wallStore";
import { PiproDesignWorkspace } from "../../core/pipro/PiproDesignWorkspace";
import { loadPiproModel } from "../../core/pipro/piproModelsRegistry";
import { INDUSTRIAL_FEATURES } from "../../core/unifiedIndustrialBox/industrialFeatures";
import type { IndustrialFeatureId } from "../../core/unifiedIndustrialBox/types";
import {
  applyPiproToProjectState,
  PIPRO_DESIGN_BOX_ID,
  syncPiproFromProjectBox,
} from "../../core/pipro/piproProjectBridge";
import {
  PIPRO_MODELS_PUBLIC_PATH,
  PIPRO_WORKSPACE_V2_PATH,
} from "../routes/piproPaths";

const muted: CSSProperties = { color: "var(--text-muted)", fontSize: 11 };
const row: CSSProperties = {
  marginBottom: 4,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  paddingBottom: 4,
  fontSize: 11,
};

function PiproDesignBridge({
  workspace,
  onPanelRefresh,
}: {
  workspace: PiproDesignWorkspace;
  onPanelRefresh: () => void;
}) {
  const { project, actions } = useProject();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const bootRef = useRef(false);
  const syncingRef = useRef(false);

  // Boot: limpar sala + carregar modelo pipro → project state
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    try {
      wallStore.getState().clearRoom();
    } catch {
      /* ignore */
    }
    if (editId) {
      const record = loadPiproModel(editId);
      if (record) workspace.loadFromRecord(record);
      else {
        workspace.createBaseBox({
          nome: "Modelo pipro vazio",
          featureIds: [],
          engineEnabled: true,
        });
      }
    } else {
      workspace.createBaseBox({
        nome: "Modelo pipro vazio",
        featureIds: [],
        engineEnabled: true,
      });
    }
    syncingRef.current = true;
    actions.applyDesignWorkspaceState(applyPiproToProjectState(project, workspace), {
      pushUndo: false,
    });
    syncingRef.current = false;
    onPanelRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, [editId]);

  // Project box → pipro (dims/material editados no LeftPanel)
  useEffect(() => {
    if (syncingRef.current) return;
    const box = project.workspaceBoxes.find((b) => b.id === PIPRO_DESIGN_BOX_ID);
    if (!box && project.workspaceBoxes[0]) {
      // permitir edição se o id regenerou
      const first = project.workspaceBoxes[0];
      const changed = syncPiproFromProjectBox(workspace, first);
      if (changed) {
        syncingRef.current = true;
        actions.applyDesignWorkspaceState(applyPiproToProjectState(project, workspace), {
          pushUndo: false,
        });
        syncingRef.current = false;
        onPanelRefresh();
      }
      return;
    }
    const changed = syncPiproFromProjectBox(workspace, box);
    if (changed) {
      onPanelRefresh();
    }
  }, [project.workspaceBoxes, project, workspace, actions, onPanelRefresh]);

  return null;
}

function PiproIndustrialSidePanel({
  workspace,
  onChange,
}: {
  workspace: PiproDesignWorkspace;
  onChange: () => void;
}) {
  const { project, actions } = useProject();
  const panel = workspace.getIndustrialPanelData();
  const summary = panel.summary;

  const toggleFeature = (id: IndustrialFeatureId) => {
    const set = new Set(workspace.state.featureIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    workspace.setFeatures([...set]);
    actions.applyDesignWorkspaceState(applyPiproToProjectState(project, workspace), {
      pushUndo: true,
    });
    onChange();
  };

  return (
    <aside
      data-testid="pipro-shell-industrial-panel"
      style={{
        width: 300,
        minWidth: 260,
        maxWidth: 340,
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        overflow: "auto",
        padding: 10,
        fontSize: 12,
        background: "rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Motor: {summary.engineEnabled ? "ON" : "OFF"} · peças: {summary.pieceCount}
      </div>

      <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Features A–D</h3>
      {INDUSTRIAL_FEATURES.map((f) => (
        <label key={f.id} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <input
            type="checkbox"
            checked={workspace.state.featureIds.includes(f.id)}
            onChange={() => toggleFeature(f.id)}
          />
          <span>
            [{f.phase}] {f.nomeTecnico}
          </span>
        </label>
      ))}

      <h3 style={{ margin: "12px 0 6px", fontSize: 13 }}>Cutlist</h3>
      <div data-testid="pipro-panel-cutlist">
        {panel.cutlist.map((p) => (
          <div key={p.id} style={row}>
            <strong>{p.industrialLabel || p.nome}</strong>
            <div style={muted}>
              {p.tipo} · {Math.round(p.dimensoes.largura)}×{Math.round(p.dimensoes.altura)}×
              {Math.round(p.espessura)}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: "12px 0 6px", fontSize: 13 }}>DRILL / CNC / Orla</h3>
      <ul style={{ margin: 0, paddingLeft: 16, ...muted }}>
        <li>DRILL: {summary.drillPieceCount} · furos: {summary.holeCount}</li>
        <li>CNC: {summary.cncPieceCount}</li>
        <li>Orla: {summary.orlaPieceCount}</li>
      </ul>

      <h3 style={{ margin: "12px 0 6px", fontSize: 13 }}>Metadata</h3>
      <pre
        data-testid="pipro-panel-metadata"
        style={{ whiteSpace: "pre-wrap", fontSize: 10, margin: 0 }}
      >
        {JSON.stringify(
          {
            modelId: workspace.modelId,
            engine: panel.metadata.engine,
            baseCabinetId: panel.metadata.baseCabinetId,
            features: summary.activeFeatureIds,
          },
          null,
          2
        )}
      </pre>
    </aside>
  );
}

function PiproShellToolbar({
  workspace,
  onRefresh,
}: {
  workspace: PiproDesignWorkspace;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const { project, actions } = useProject();

  const onNew = () => {
    navigate(PIPRO_WORKSPACE_V2_PATH);
    workspace.createBaseBox({
      nome: "Modelo pipro vazio",
      featureIds: [],
      engineEnabled: true,
    });
    actions.applyDesignWorkspaceState(applyPiproToProjectState(project, workspace), {
      pushUndo: false,
    });
    onRefresh();
  };

  const onSave = () => {
    const saved = workspace.save();
    onRefresh();
    navigate(`${PIPRO_WORKSPACE_V2_PATH}?id=${encodeURIComponent(saved.id)}`, { replace: true });
  };

  return (
    <div
      data-testid="pipro-shell-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        flexWrap: "wrap",
      }}
    >
      <strong style={{ marginRight: 8 }}>Workspace Pipro v2</strong>
      <span style={muted}>
        {workspace.modelId ? `Modelo: ${workspace.modelId}` : "Novo modelo"} · motor{" "}
        {workspace.state.engineEnabled ? "ON" : "OFF"}
      </span>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onNew}>
        Novo modelo
      </button>
      <button type="button" onClick={onSave}>
        Guardar modelo pipro
      </button>
      <button type="button" onClick={() => navigate(PIPRO_MODELS_PUBLIC_PATH)}>
        Biblioteca /moveis
      </button>
      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={workspace.state.engineEnabled}
          onChange={(e) => {
            workspace.setEngineEnabled(e.target.checked);
            actions.applyDesignWorkspaceState(applyPiproToProjectState(project, workspace), {
              pushUndo: false,
            });
            onRefresh();
          }}
        />
        Motor unificado
      </label>
    </div>
  );
}

function PiproDesignShellInner() {
  const workspace = useMemo(() => new PiproDesignWorkspace(), []);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const [leftOpen, setLeftOpen] = useState(true);
  const leftPanelTab = useUiStore((state) => state.selectedTool);
  const setLeftPanelTab = useUiStore((state) => state.setSelectedTool);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const photoModePanelOpen = useUiStore((state) => state.photoModePanelOpen);
  const setPhotoModePanelOpen = useUiStore((state) => state.setPhotoModePanelOpen);
  const [leftWidth, setLeftWidth] = useState(260);
  const resizeState = useRef({ active: false, startX: 0, startWidth: 260 });
  const viewerOptions = useMemo(() => DEFAULT_VIEWER_OPTIONS, []);
  const navigate = useNavigate();

  const clampLeftWidth = (value: number) => Math.min(420, Math.max(220, value));

  return (
    <div className="app-root" data-testid="pipro-design-shell-page">
      <PiproDesignBridge workspace={workspace} onPanelRefresh={refresh} />
      <Header />
      <PiproShellToolbar workspace={workspace} onRefresh={refresh} />

      <div className="app-main">
        <BottomInfoProvider>
          <ToolbarModalProvider>
            <div
              className="app-main-content-fixed"
              style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
            >
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div className="app-panels" style={{ flex: 1, minHeight: 0 }}>
                  <div style={{ position: "relative", zIndex: 20 }}>
                    <LeftToolbar
                      selectedId={leftPanelTab}
                      onSelect={(id) => {
                        if (photoModePanelOpen) setPhotoModePanelOpen(false);
                        setLeftPanelTab(id);
                        clearSelection();
                        if (!leftOpen) setLeftOpen(true);
                      }}
                    />
                  </div>
                  <div
                    className="panel panel-shell panel-shell--side left-panel panel-shell-left"
                    style={{
                      width: leftOpen ? leftWidth : 0,
                      minWidth: leftOpen ? leftWidth : 0,
                      maxWidth: leftOpen ? leftWidth : 0,
                      overflow: "hidden",
                      transition: "width 0.2s ease",
                      position: "relative",
                    }}
                  >
                    <LeftPanel activeTab={leftPanelTab} />
                    {leftOpen && (
                      <div
                        className="panel-resizer"
                        onPointerDown={(e) => {
                          resizeState.current = {
                            active: true,
                            startX: e.clientX,
                            startWidth: leftWidth,
                          };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!resizeState.current.active) return;
                          const delta = e.clientX - resizeState.current.startX;
                          setLeftWidth(clampLeftWidth(resizeState.current.startWidth + delta));
                        }}
                        onPointerUp={() => {
                          resizeState.current.active = false;
                        }}
                        onPointerCancel={() => {
                          resizeState.current.active = false;
                        }}
                      />
                    )}
                  </div>
                  <Workspace
                    viewerBackground={VIEWER_BACKGROUND}
                    viewerHeight="100%"
                    viewerOptions={viewerOptions}
                  />
                  <PiproIndustrialSidePanel workspace={workspace} onChange={refresh} />
                  <ToolbarModals />
                </div>
                <BottomInfoPanelsOverlay />
              </div>
              <BottomInfoToolbar />
            </div>
          </ToolbarModalProvider>
        </BottomInfoProvider>
      </div>

      <Footer
        onShowAjuda={() => navigate("/ajuda")}
        onShowUserProjects={() => navigate("/meus-projetos")}
        onShowLanding={() => navigate("/apresentacao")}
      />
    </div>
  );
}

export function PiproDesignShellPage() {
  return (
    <ProjectProvider variant="pipro-design">
      <WorkspaceUndoRedoRegistryProvider>
        <SettingsProvider>
          <MaterialProvider>
            <ToastProvider>
              <MateriaisSsotBootstrap />
              <PimoViewerProvider>
                <PiproDesignShellInner />
              </PimoViewerProvider>
            </ToastProvider>
          </MaterialProvider>
        </SettingsProvider>
      </WorkspaceUndoRedoRegistryProvider>
    </ProjectProvider>
  );
}

export default PiproDesignShellPage;
