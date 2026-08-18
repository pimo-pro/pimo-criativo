/**
 * Barra de ferramentas fixa acima do Footer.
 * Botões de texto para abrir/fechar painéis de informação (Resumo, Cutlist, Portas, etc.).
 * Um único painel aberto por vez; clique no mesmo botão fecha.
 * Estilo alinhado à toolbar unificada.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBottomInfo, type BottomInfoGroupId } from "../../../context/BottomInfoContext";
import IndustrialToolbarIcon from "../../icons/industrialToolbar/IndustrialToolbarIcon";
import { useProject } from "../../../context/useProject";
import { Icon } from "@/components/icons";
import { resolveDoorLabel } from "../../../core/doors/doorLabels";
import { hasObservacoes } from "../../../core/observacoes/ObservacoesService";
import PieceObservacoesOverlay from "../overlays/PieceObservacoesOverlay";
import { useCutlistData } from "../../../hooks/useCutlistData";
import { buildPecasTotaisRows } from "../../../core/industrial/industrialBottomSectionData";
import { useMaterials } from "../../../hooks/useMaterials";

type HistoryFilter = "all" | "move" | "resize" | "add" | "remove" | "height" | "other";

const HISTORY_FILTER_STORAGE_KEY = "pimo_history_filter";
const HISTORY_PANEL_POSITION_STORAGE_KEY = "pimo_history_panel_position";

const HISTORY_FILTER_OPTIONS: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "Todas as ações" },
  { value: "move", label: "Movimentações" },
  { value: "resize", label: "Redimensionamentos" },
  { value: "add", label: "Adições" },
  { value: "remove", label: "Remoções" },
  { value: "height", label: "Alterações de altura" },
  { value: "other", label: "Outras ações" },
];

const panelLabels: Record<"left" | "right" | "top" | "bottom" | "back", string> = {
  left: "Lateral Esq",
  right: "Lateral Dir",
  top: "Topo",
  bottom: "Fundo",
  back: "Costa",
};

const drawerPartLabels: Record<"front" | "left-side" | "right-side" | "bottom" | "back" | "body", string> = {
  front: "Frente de gaveta",
  "left-side": "Lateral esquerda da gaveta",
  "right-side": "Lateral direita da gaveta",
  bottom: "Fundo da gaveta",
  back: "Traseira da gaveta",
  body: "Corpo da gaveta",
};

const panelKeyByType = {
  left: "lateral_esquerda",
  right: "lateral_direita",
  top: "cima",
  bottom: "fundo",
  back: "costa",
} as const;

const MAIN_TOOLBAR_GROUPS: {
  id: BottomInfoGroupId;
  label: string;
  icon: "finance" | "industrial" | "operations";
}[] = [
  { id: "financeiro", label: "Financeiro", icon: "finance" },
  { id: "industriais", label: "Industriais", icon: "industrial" },
  { id: "operacoes", label: "Operações", icon: "operations" },
];

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 12px",
  background: "var(--viewer-toolbar-bg)",
  borderTop: "1px solid var(--toolbar-border)",
  borderBottom: "1px solid var(--toolbar-border)",
  flexShrink: 0,
  minHeight: 40,
  height: 40,
  boxSizing: "border-box",
};

const leftButtonsWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const buttonBaseStyle: React.CSSProperties = {
  padding: "4px 6px",
  border: "none",
  borderRadius: 0,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  color: "var(--text-main)",
  background: "transparent",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "opacity 0.15s ease",
};

const componentsGroupStyle: React.CSSProperties = {
  marginLeft: "auto",
  paddingLeft: 12,
  borderLeft: "1px solid rgba(255,255,255,0.12)",
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const componentsButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "var(--text-muted)",
};

const historyButtonStyle: React.CSSProperties = {
  ...componentsButtonStyle,
};

const componentsPopoverStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  bottom: "calc(100% + 8px)",
  minWidth: 340,
  padding: 6,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(8, 12, 26, 0.98)",
  boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
  zIndex: 40,
};

const componentsSidePanelStyle: React.CSSProperties = {
  position: "fixed",
  right: 10,
  width: 300,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(7, 11, 24, 0.98)",
  boxShadow: "-10px 0 30px rgba(0,0,0,0.35)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  zIndex: 50,
};

const historyPanelStyle: React.CSSProperties = {
  position: "fixed",
  width: 320,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(7, 11, 24, 0.88)",
  boxShadow: "0 14px 34px rgba(0,0,0,0.4)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  zIndex: 50,
};

const historyPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-main)",
  cursor: "move",
  userSelect: "none",
};

const historyPanelBodyStyle: React.CSSProperties = {
  padding: 8,
  overflowY: "auto",
};

const componentsSidePanelResizeHandleStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 10,
  cursor: "ns-resize",
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const componentsSidePanelResizeGripStyle: React.CSSProperties = {
  width: 44,
  height: 3,
  borderRadius: 999,
  background: "rgba(255,255,255,0.35)",
};

const componentsSidePanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-main)",
};

const componentsSidePanelBodyStyle: React.CSSProperties = {
  padding: "12px 12px 14px",
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.45,
  overflow: "auto",
};

const piecePanelContainerStyle: React.CSSProperties = {
  minWidth: 340,
};

const piecePanelListStyle: React.CSSProperties = {
  maxHeight: 180,
  overflowY: "auto",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const badgeStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: "1px 6px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  background: "rgba(59, 130, 246, 0.25)",
  color: "var(--text-main)",
};

const piecePanelHeaderButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--text-main)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};

export default function BottomInfoToolbar() {
  const { openPanel, togglePanel } = useBottomInfo();
  const { actions, project, history } = useProject();
  const cutlistData = useCutlistData();
  const { materials } = useMaterials();
  const pecasCount = useMemo(
    () => buildPecasTotaisRows(project, materials).reduce((s, r) => s + r.qtd, 0),
    [project, materials]
  );
  const [componentsPopoverOpen, setComponentsPopoverOpen] = useState(false);
  const [componentsPanelOpen, setComponentsPanelOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyPanelPosition, setHistoryPanelPosition] = useState<{ x: number; y: number } | null>(() => {
    const raw = window.localStorage.getItem(HISTORY_PANEL_POSITION_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
      if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
      return { x: parsed.x, y: parsed.y };
    } catch {
      return null;
    }
  });
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>(() => {
    const raw = window.localStorage.getItem(HISTORY_FILTER_STORAGE_KEY);
    if (
      raw === "all" ||
      raw === "move" ||
      raw === "resize" ||
      raw === "add" ||
      raw === "remove" ||
      raw === "height" ||
      raw === "other"
    ) {
      return raw;
    }
    return "all";
  });
  const [pieceSearch, setPieceSearch] = useState("");
  const [obsOverlayPiece, setObsOverlayPiece] = useState<{ id: string; label: string } | null>(null);
  const [layoutInsets, setLayoutInsets] = useState({ top: 56, bottom: 42 });
  const [componentsPanelTop, setComponentsPanelTop] = useState(56);
  const componentsGroupRef = useRef<HTMLDivElement | null>(null);
  const historyHeaderRef = useRef<HTMLDivElement | null>(null);
  const historyDragOffsetRef = useRef({ x: 0, y: 0 });
  const historyDraggingRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartTopRef = useRef(56);
  const isResizingPanelRef = useRef(false);

  const workspaceBoxes = useMemo(() => project.workspaceBoxes ?? [], [project.workspaceBoxes]);
  const panelVisibilityEntries = useMemo(() => {
    return workspaceBoxes.flatMap((box) => {
      const entries: Array<{
        id: string;
        panel?: "left" | "right" | "top" | "bottom" | "back";
        boxId: string;
        boxName: string;
        label: string;
        searchText: string;
      }> = [];

      (Object.keys(panelLabels) as Array<"left" | "right" | "top" | "bottom" | "back">).forEach((panel) => {
        const panelKey = panelKeyByType[panel];
        const panelIdFromBox = box.panelIds?.[panelKey];
        const pieceId =
          typeof panelIdFromBox === "string" && (panelIdFromBox?.trim()?.length ?? 0) > 0
            ? panelIdFromBox
            : `${box.id}:${panel}`;
        entries.push({
          id: pieceId,
          panel,
          boxId: box.id,
          boxName: box.nome,
          label: panelLabels[panel],
          searchText: `${box.nome} ${panelLabels[panel]} ${box.id}`.toLowerCase(),
        });
      });

      const shelfIds = box.panelIds?.prateleiras ?? [];
      const shelfCount = Math.max(shelfIds.length, Math.max(0, Math.floor(box.prateleiras ?? 0)));
      for (let i = 0; i < shelfCount; i++) {
        const configuredId = shelfIds[i];
        const pieceId = (configuredId?.trim()?.length ?? 0) > 0 ? configuredId : `shelf:${box.id}:${i}`;
        const label = `Prateleira ${i + 1}`;
        entries.push({
          id: pieceId,
          boxId: box.id,
          boxName: box.nome,
          label,
          searchText: `${box.nome} ${label} ${box.id}`.toLowerCase(),
        });
      }

      const doors = box.doorsLayer ?? [];
      if (doors.length > 0) {
        doors.forEach((door, index) => {
          const pieceId = `door:${door.id}`;
          const label = resolveDoorLabel(door, index, doors);
          entries.push({
            id: pieceId,
            boxId: box.id,
            boxName: box.nome,
            label,
            searchText: `${box.nome} ${label} ${box.id}`.toLowerCase(),
          });
        });
      } else {
        const doorIds = box.panelIds?.portas ?? [];
        doorIds
          .filter((id) => (id?.trim()?.length ?? 0) > 0)
          .forEach((id, idx) => {
            const label = resolveDoorLabel(undefined, idx);
            entries.push({
              id,
              boxId: box.id,
              boxName: box.nome,
              label,
              searchText: `${box.nome} ${label} ${box.id}`.toLowerCase(),
            });
          });
      }

      for (const drawer of box.drawersLayer ?? []) {
        (Object.keys(drawerPartLabels) as Array<keyof typeof drawerPartLabels>).forEach((part) => {
          const pieceId = `drawer:${drawer.id}:${part}`;
          const label = drawerPartLabels[part];
          entries.push({
            id: pieceId,
            boxId: box.id,
            boxName: box.nome,
            label,
            searchText: `${box.nome} ${label} ${box.id}`.toLowerCase(),
          });
        });
      }

      const boxRemates = (project.remates ?? []).filter((remate) => remate.parentBoxId === box.id);
      for (const remate of boxRemates) {
        const kindLabel =
          remate.tipo === "RODAPE"
            ? "Roda pé"
            : remate.tipo === "L" || remate.tipo === "RODAPE_L"
              ? `${remate.tipo}${remate.partIndex ?? ""}`
              : `Remate ${remate.tipo}`;
        entries.push({
          id: remate.id,
          boxId: box.id,
          boxName: box.nome,
          label: kindLabel,
          searchText: `${box.nome} ${kindLabel} ${remate.id} remate`.toLowerCase(),
        });
      }

      for (const hemati of (project.hematis ?? []).filter((h) => h.parentBoxId === box.id)) {
        entries.push({
          id: hemati.id,
          boxId: box.id,
          boxName: box.nome,
          label:
            hemati.kind === "L" || hemati.kind === "U"
              ? `Remate ${hemati.kind}${hemati.partIndex ?? ""}`
              : `Remate ${hemati.kind}`,
          searchText: `${box.nome} remate ${hemati.id}`.toLowerCase(),
        });
      }
      for (const rodape of (project.rodapes ?? []).filter((r) => r.parentBoxId === box.id)) {
        entries.push({
          id: rodape.id,
          boxId: box.id,
          boxName: box.nome,
          label:
            rodape.kind === "L" || rodape.kind === "U"
              ? `Roda pé ${rodape.kind}${rodape.partIndex ?? ""}`
              : rodape.kind === "FULL"
                ? "Roda pé Full Wall"
                : "Roda pé",
          searchText: `${box.nome} roda pé ${rodape.id}`.toLowerCase(),
        });
      }

      return entries;
    });
  }, [workspaceBoxes, project.remates, project.hematis, project.rodapes]);

  const filteredPanelVisibilityEntries = useMemo(() => {
    const query = pieceSearch.trim().toLowerCase();
    if (!query) return panelVisibilityEntries;
    return panelVisibilityEntries.filter((entry) => entry.searchText.includes(query));
  }, [panelVisibilityEntries, pieceSearch]);

  const clampHistoryPanelPosition = useCallback(
    (position: { x: number; y: number }) => {
      const panelWidth = 320;
      const panelHeight = Math.min(520, Math.max(220, window.innerHeight - layoutInsets.top - layoutInsets.bottom - 24));
      return {
        x: Math.max(8, Math.min(window.innerWidth - panelWidth - 8, position.x)),
        y: Math.max(layoutInsets.top + 4, Math.min(window.innerHeight - layoutInsets.bottom - panelHeight - 4, position.y)),
      };
    },
    [layoutInsets.top, layoutInsets.bottom]
  );

  const filteredHistoryEntries = useMemo(() => {
    const indexed = history.entries.map((entry, idx) => ({ entry, idx }));
    if (historyFilter === "all") return indexed;
    return indexed.filter(({ entry }) => entry.actionType === historyFilter);
  }, [history.entries, historyFilter]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!componentsGroupRef.current) return;
      if (componentsGroupRef.current.contains(event.target as Node)) return;
      setComponentsPopoverOpen(false);
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setComponentsPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_FILTER_STORAGE_KEY, historyFilter);
  }, [historyFilter]);

  useEffect(() => {
    if (!historyPanelPosition) return;
    window.localStorage.setItem(HISTORY_PANEL_POSITION_STORAGE_KEY, JSON.stringify(historyPanelPosition));
  }, [historyPanelPosition]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || target.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isEditableTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() !== "h") return;
      event.preventDefault();
      if (historyPanelOpen) {
        setHistoryPanelOpen(false);
      } else {
        if (!historyPanelPosition) {
          const panelWidth = 320;
          const defaultPos = clampHistoryPanelPosition({
            x: window.innerWidth - panelWidth - 16,
            y: Math.max(layoutInsets.top + 10, 80),
          });
          setHistoryPanelPosition(defaultPos);
        }
        setHistoryPanelOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyPanelOpen, historyPanelPosition, layoutInsets.bottom, layoutInsets.top, clampHistoryPanelPosition]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!historyDraggingRef.current || !historyPanelPosition) return;
      const next = clampHistoryPanelPosition({
        x: event.clientX - historyDragOffsetRef.current.x,
        y: event.clientY - historyDragOffsetRef.current.y,
      });
      setHistoryPanelPosition(next);
    };
    const onPointerUp = () => {
      historyDraggingRef.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [historyPanelPosition, layoutInsets.bottom, layoutInsets.top, clampHistoryPanelPosition]);

  useEffect(() => {
    const updateLayoutInsets = () => {
      const topToolbar = document.querySelector(".viewer-toolbar") as HTMLElement | null;
      const bottomToolbar = document.querySelector(".bottom-info-toolbar") as HTMLElement | null;

      const top = topToolbar ? Math.round(topToolbar.getBoundingClientRect().bottom) : 56;
      const bottom = bottomToolbar
        ? Math.max(0, Math.round(window.innerHeight - bottomToolbar.getBoundingClientRect().top))
        : 42;

      setLayoutInsets({ top, bottom });

      setComponentsPanelTop((prev) => {
        const maxTop = Math.max(0, window.innerHeight - bottom - 56);
        return Math.min(Math.max(prev, 0), maxTop);
      });
    };

    updateLayoutInsets();
    const rafUpdate = () => requestAnimationFrame(updateLayoutInsets);
    window.addEventListener("resize", rafUpdate);
    window.addEventListener("scroll", rafUpdate, true);
    return () => {
      window.removeEventListener("resize", rafUpdate);
      window.removeEventListener("scroll", rafUpdate, true);
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!isResizingPanelRef.current) return;
      const delta = event.clientY - resizeStartYRef.current;
      const rawTop = resizeStartTopRef.current + delta;
      const minTop = 0;
      const maxTop = Math.max(minTop, window.innerHeight - layoutInsets.bottom - 56);
      const nextTop = Math.max(minTop, Math.min(maxTop, rawTop));
      setComponentsPanelTop(nextTop);
    };

    const onPointerUp = () => {
      if (!isResizingPanelRef.current) return;
      isResizingPanelRef.current = false;
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [layoutInsets.bottom]);

  const openPecasPaineisPanel = () => {
    setComponentsPopoverOpen(false);
    setComponentsPanelTop(layoutInsets.top);
    setComponentsPanelOpen(true);
  };

  const openHistoryPanel = () => {
    const panelWidth = 320;
    const defaultPosition = clampHistoryPanelPosition({
      x: window.innerWidth - panelWidth - 16,
      y: Math.max(layoutInsets.top + 10, 80),
    });
    setHistoryPanelPosition((prev) => (prev ? clampHistoryPanelPosition(prev) : defaultPosition));
    setHistoryPanelOpen(true);
  };

  const onHistoryDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!historyPanelOpen) return;
    const panel = historyHeaderRef.current?.closest("aside");
    if (!(panel instanceof HTMLElement)) return;
    const rect = panel.getBoundingClientRect();
    historyDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    historyDraggingRef.current = true;
    document.body.style.userSelect = "none";
  };

  const handlePanelResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!componentsPanelOpen) return;
    resizeStartYRef.current = event.clientY;
    resizeStartTopRef.current = componentsPanelTop;
    isResizingPanelRef.current = true;
    document.body.style.userSelect = "none";
  };

  const sidePanelListMaxHeight = Math.max(
    220,
    window.innerHeight - componentsPanelTop - layoutInsets.bottom - 180
  );

  const toggleHiddenPanel = (panel: "left" | "right" | "top" | "bottom" | "back") => {
    const current = project.viewerSettings.hiddenPanels;
    const next = current.includes(panel)
      ? current.filter((item) => item !== panel)
      : [...current, panel];
    actions.setViewerSettings({ hiddenPanels: next });
  };

  const toggleHiddenPiece = (pieceId: string) => {
    const current = project.viewerSettings.hiddenPanels;
    const next = current.includes(pieceId)
      ? current.filter((item) => item !== pieceId)
      : [...current, pieceId];
    actions.setViewerSettings({ hiddenPanels: next });
  };

  const isPieceHidden = (pieceId: string, panel?: "left" | "right" | "top" | "bottom" | "back") => {
    const hidden = project.viewerSettings.hiddenPanels;
    return hidden.includes(pieceId) || (panel != null && hidden.includes(panel));
  };

  const renderPecasPaineisList = (maxHeight: number) => (
    <div style={piecePanelContainerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button
          type="button"
          onClick={openPecasPaineisPanel}
          style={piecePanelHeaderButtonStyle}
          title="Abrir painel lateral"
          aria-label="Abrir painel lateral de peças e painéis"
        >
          peças / painéis
        </button>
        <button
          type="button"
          className="button button-ghost"
          style={{ fontSize: 11, padding: "4px 8px" }}
          onClick={() => actions.setViewerSettings({ hiddenPanels: [] })}
        >
          Mostrar tudo
        </button>
      </div>
      <input
        className="input input-sm"
        placeholder="Buscar peça (caixa ou painel)"
        value={pieceSearch}
        onChange={(event) => setPieceSearch(event.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {(Object.keys(panelLabels) as Array<"left" | "right" | "top" | "bottom" | "back">).map((panel) => {
          const isHidden = project.viewerSettings.hiddenPanels.includes(panel);
          return (
            <button
              key={`bottom-panel-toggle-${panel}`}
              type="button"
              className="button button-ghost"
              style={{ fontSize: 11, padding: "4px 8px", opacity: isHidden ? 0.65 : 1 }}
              onClick={() => toggleHiddenPanel(panel)}
            >
              {isHidden ? "Mostrar" : "Esconder"} todas: {panelLabels[panel]}
            </button>
          );
        })}
      </div>
      <div style={{ ...piecePanelListStyle, maxHeight }}>
        {filteredPanelVisibilityEntries.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Nenhuma peça encontrada.</div>
        ) : (
          filteredPanelVisibilityEntries.map((entry) => {
            const hiddenGlobally = entry.panel != null && project.viewerSettings.hiddenPanels.includes(entry.panel);
            const hidden = isPieceHidden(entry.id, entry.panel);
            return (
              <label
                key={`bottom-panel-piece-${entry.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 11,
                  opacity: hidden ? 0.65 : 1,
                }}
              >
                <span style={{ color: "var(--text-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.boxName} · {entry.label}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {hasObservacoes(entry.id, project.pieceObservacoes) ? (
                    <button
                      type="button"
                      title="Ver observações"
                      aria-label={`Observações: ${entry.label}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setObsOverlayPiece({ id: entry.id, label: `${entry.boxName} · ${entry.label}` });
                      }}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 5px",
                        borderRadius: 4,
                        border: "1px solid rgba(251, 191, 36, 0.35)",
                        background: "rgba(251, 191, 36, 0.15)",
                        color: "#fbbf24",
                        cursor: "pointer",
                      }}
                    >
                      OBS
                    </button>
                  ) : null}
                  <input
                    type="checkbox"
                    checked={!hidden}
                    disabled={hiddenGlobally}
                    onChange={() => toggleHiddenPiece(entry.id)}
                    title={
                      hiddenGlobally
                        ? "Tipo de painel está escondido globalmente"
                        : hidden
                          ? "Mostrar peça"
                          : "Esconder peça"
                    }
                  />
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );

  const componentsSidePanel = (
    <aside
      className="components-side-panel"
      aria-label="Painel lateral de peças e painéis"
      style={{
        ...componentsSidePanelStyle,
        top: componentsPanelTop,
        bottom: layoutInsets.bottom,
      }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Redimensionar altura do painel"
        style={componentsSidePanelResizeHandleStyle}
        onPointerDown={handlePanelResizeStart}
      >
        <div style={componentsSidePanelResizeGripStyle} />
      </div>
      <div style={componentsSidePanelHeaderStyle}>
        <span>peças / painéis</span>
        <button
          type="button"
          aria-label="Fechar painel de componentes"
          onClick={() => setComponentsPanelOpen(false)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <Icon name="close" size={14} aria-hidden />
        </button>
      </div>
      <div style={componentsSidePanelBodyStyle}>
        {renderPecasPaineisList(sidePanelListMaxHeight)}
      </div>
    </aside>
  );

  const historyPanelMaxHeight = Math.min(520, Math.max(220, window.innerHeight - layoutInsets.top - layoutInsets.bottom - 24));

  const historyPanel = historyPanelPosition ? (
    <aside
      className="history-side-panel"
      aria-label="Painel de histórico"
      style={{
        ...historyPanelStyle,
        left: historyPanelPosition.x,
        top: historyPanelPosition.y,
        maxHeight: historyPanelMaxHeight,
      }}
    >
      <div ref={historyHeaderRef} style={historyPanelHeaderStyle} onPointerDown={onHistoryDragStart}>
        <span>Histórico</span>
        <button
          type="button"
          aria-label="Fechar histórico"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setHistoryPanelOpen(false)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <Icon name="close" size={14} aria-hidden />
        </button>
      </div>
      <div style={historyPanelBodyStyle}>
        <div style={{ marginBottom: 8 }}>
          <select
            aria-label="Filtrar histórico"
            value={historyFilter}
            onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)}
            className="input input-sm"
            style={{ width: "100%" }}
          >
            {HISTORY_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {filteredHistoryEntries.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Sem histórico disponível.</div>
        ) : (
          filteredHistoryEntries.map(({ entry, idx }) => {
            const isCurrent = idx === history.currentIndex;
            const label = entry.actionName?.trim() || "Alteração";
            const timestampMs = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
            const timestampText = Number.isFinite(timestampMs)
              ? new Date(timestampMs).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
              : "";
            return (
              <button
                key={`${entry.id}-${idx}`}
                type="button"
                onClick={() => history.goTo(idx)}
                style={{
                  width: "100%",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  background: isCurrent ? "rgba(59, 130, 246, 0.25)" : "rgba(255,255,255,0.03)",
                  color: "var(--text-main)",
                  textAlign: "left",
                  padding: "8px 10px",
                  marginBottom: 6,
                  cursor: "pointer",
                }}
                title={`Ir para: ${label}`}
                aria-label={`Ir para histórico: ${label}`}
              >
                <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500 }}>{label}</div>
                {timestampText ? (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{timestampText}</div>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </aside>
  ) : null;

  return (
    <>
      <div
        className="bottom-info-toolbar"
        role="toolbar"
        aria-label="Painéis de informação do projeto"
        style={toolbarStyle}
      >
        <div style={leftButtonsWrapStyle}>
          {MAIN_TOOLBAR_GROUPS.map(({ id, label, icon }) => {
            const isActive = openPanel === id;
            const badge =
              id === "financeiro"
                ? pecasCount
                : id === "industriais"
                  ? cutlistData.totalPecas
                  : id === "operacoes"
                    ? Object.values(project.industrialOperacoes ?? {}).filter((o) => o?.completedAt).length
                    : null;
            return (
              <button
                key={id}
                type="button"
                className="bottom-info-toolbar__main-btn"
                title={isActive ? `Fechar ${label}` : `Abrir ${label}`}
                aria-pressed={isActive}
                onClick={() => togglePanel(id)}
                style={{
                  ...buttonBaseStyle,
                  background: isActive ? "var(--toolbar-pressed-bg)" : "transparent",
                  color: isActive ? "var(--text-main)" : "var(--text-muted)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                <IndustrialToolbarIcon name={icon} size={16} />
                {label}
                {badge != null && badge > 0 ? <span style={badgeStyle}>{badge}</span> : null}
              </button>
            );
          })}
        </div>

        <div ref={componentsGroupRef} style={componentsGroupStyle}>
          <button
            type="button"
            title="Abrir menu de componentes"
            aria-label="Abrir menu de componentes"
            aria-haspopup="menu"
            aria-expanded={componentsPopoverOpen}
            onClick={() => setComponentsPopoverOpen((prev) => !prev)}
            style={{
              ...componentsButtonStyle,
              background: componentsPopoverOpen ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: componentsPopoverOpen ? "var(--text-main)" : "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              if (!componentsPopoverOpen) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              else e.currentTarget.style.background = "rgba(59, 130, 246, 0.28)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = componentsPopoverOpen ? "rgba(59, 130, 246, 0.2)" : "transparent";
            }}
          >
            <Icon name="grid" size={16} aria-hidden />
            componentes
          </button>
          <button
            type="button"
            title="Histórico de alterações"
            aria-label="Histórico de alterações"
            aria-pressed={historyPanelOpen}
            onClick={() => {
              if (historyPanelOpen) setHistoryPanelOpen(false);
              else openHistoryPanel();
            }}
            style={{
              ...historyButtonStyle,
              marginLeft: 4,
              background: historyPanelOpen ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: historyPanelOpen ? "var(--text-main)" : "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              if (!historyPanelOpen) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              else e.currentTarget.style.background = "rgba(59, 130, 246, 0.28)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = historyPanelOpen ? "rgba(59, 130, 246, 0.2)" : "transparent";
            }}
          >
            <Icon name="undo" size={16} aria-hidden />
            Histórico
          </button>

          {componentsPopoverOpen && (
            <div role="menu" aria-label="Menu componentes" style={componentsPopoverStyle}>
              {renderPecasPaineisList(180)}
            </div>
          )}
        </div>
      </div>

      {componentsPanelOpen ? createPortal(componentsSidePanel, document.body) : null}
      {historyPanelOpen && historyPanel ? createPortal(historyPanel, document.body) : null}
      {obsOverlayPiece
        ? createPortal(
            <PieceObservacoesOverlay
              pieceId={obsOverlayPiece.id}
              pieceName={obsOverlayPiece.label}
              onClose={() => setObsOverlayPiece(null)}
            />,
            document.body
          )
        : null}
    </>
  );
}
