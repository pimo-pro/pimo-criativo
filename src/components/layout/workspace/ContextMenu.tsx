import { useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "../../../context/useProject";
import { listOfficialMaterials } from "../../../core/materials/materials.api";
import { getViewerMaterialId } from "../../../core/materials/service";
import {
  getMaterialEspessuraMm,
  groupMaterialsByPadronizado,
} from "../../settings/material/materialGrouping";
import type { ViewerMousePreset } from "../../../context/projectTypes";
import { Icon } from "@/components/icons";
import ContextMenuPortal from "./ContextMenuPortal";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import {
  buildMouseMenu,
  type MouseMenuAction,
  type MouseMenuActionId,
  type MouseMenuCategory,
  type MouseMenuTarget,
} from "../../../ui/context-menu/ContextMenuEngine";
import { uiStore } from "../../../stores/uiStore";
import { groupStore } from "../../../stores/groupStore";
import { promptScalingNewLength } from "../../../context/hooks/useSelectionTransformActions";
import { decodeSelectionId } from "../../../core/viewer/selectionIds";
import { buildScalingPreviewData, type ScalingPreviewData } from "../../../core/viewer/scalingPreview";
import type { ScalingMode } from "../../../context/projectTypes";
import ScalingPreviewDialog from "./ScalingPreviewDialog";

export type ContextMenuPosition = { x: number; y: number } | null;

export type ContextMenuLayerTarget = MouseMenuTarget | null;

export type ContextMenuProps = {
  /** Posição do canto superior esquerdo do menu (clientX, clientY). null = não exibir. */
  position: ContextMenuPosition;
  /** Chamado ao fechar o menu (clique fora, ESC ou após ação). */
  onClose: () => void;
  /** Alvo do clique direito: porta ou gaveta (para mostrar item "Alterar material"). */
  contextMenuLayerTarget?: ContextMenuLayerTarget;
  /** Chamado após alterar material da porta (para atualizar o viewer imediatamente). */
  onDoorMaterialChange?: (_boxId: string, _doorLayerId: string, _materialId: string) => void;
  /** Chamado após alterar material da gaveta (para atualizar o viewer imediatamente). */
  onDrawerMaterialChange?: (_boxId: string, _drawerLayerId: string, _materialId: string) => void;
  /** IDs de seleção atual (Ctrl+Click) para ações em lote. */
  selectedBoxIds?: string[];
  /** IDs codificados da multi-seleção global (selectedObjects). */
  selectedObjectIds?: string[];
};

/** Materiais oficiais do projeto (mesma lista do módulo); agrupados para o picker. */
const OFFICIAL_MATERIALS = listOfficialMaterials();
const OFFICIAL_MATERIAL_GRUPOS = groupMaterialsByPadronizado(OFFICIAL_MATERIALS);

const menuStyle: React.CSSProperties = {
  position: "fixed",
  minWidth: 180,
  background: "var(--popover-bg)",
  border: "1px solid var(--popover-border)",
  borderRadius: 8,
  padding: 6,
  zIndex: 10000,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "8px 12px",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text-main)",
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
};

const ITEM_HEIGHT = 34;
const MENU_MARGIN = 8;
const MENU_MIN_WIDTH = 180;
const SUBMENU_MIN_WIDTH = 160;
const SUBMENU_CLOSE_DELAY_MS = 220;
const CONTEXT_MENU_Z = 10000;

const MOUSE_PRESET_OPTIONS: { preset: ViewerMousePreset; label: string }[] = [
  { preset: "cad", label: "Mouse CAD" },
  { preset: "classic", label: "Mouse Classic" },
  { preset: "orbitFriendly", label: "Orbit-Friendly" },
  { preset: "mouseCentric", label: "Mouse-Centric" },
];

type Placement = "right-down" | "right-up" | "left-down" | "left-up";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function placeMenu(anchorX: number, anchorY: number, width: number, height: number): { left: number; top: number; placement: Placement } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const preferRight = anchorX + width + MENU_MARGIN <= vw - MENU_MARGIN;
  const preferDown = anchorY + height + MENU_MARGIN <= vh - MENU_MARGIN;
  const left = preferRight
    ? clamp(anchorX + MENU_MARGIN, MENU_MARGIN, vw - width - MENU_MARGIN)
    : clamp(anchorX - width - MENU_MARGIN, MENU_MARGIN, vw - width - MENU_MARGIN);
  const top = preferDown
    ? clamp(anchorY + MENU_MARGIN, MENU_MARGIN, vh - height - MENU_MARGIN)
    : clamp(anchorY - height - MENU_MARGIN, MENU_MARGIN, vh - height - MENU_MARGIN);
  const placement: Placement = preferRight
    ? (preferDown ? "right-down" : "right-up")
    : (preferDown ? "left-down" : "left-up");
  return { left, top, placement };
}

/** Ponte invisível entre item anchor e submenu — evita perda de hover no gap. */
function SubmenuHoverBridge(props: {
  anchorRect: DOMRect;
  submenuLeft: number;
  submenuTop: number;
  submenuHeight: number;
  onPointerEnter: () => void;
}) {
  const { anchorRect, submenuLeft, submenuTop, submenuHeight, onPointerEnter } = props;
  const gapLeft = Math.min(anchorRect.right, submenuLeft);
  const gapWidth = Math.max(Math.abs(submenuLeft - anchorRect.right), 8);
  const top = Math.min(anchorRect.top, submenuTop);
  const height = Math.max(anchorRect.height, submenuHeight, ITEM_HEIGHT);
  return (
    <div
      style={{
        position: "fixed",
        left: gapLeft,
        top,
        width: gapWidth,
        height,
        pointerEvents: "auto",
        zIndex: CONTEXT_MENU_Z - 1,
      }}
      onPointerEnter={onPointerEnter}
      aria-hidden
    />
  );
}

/**
 * Menu de contexto (clique direito) no Viewer/Workspace.
 * Mostra: Bloquear/Desbloquear peça (se houver peça selecionada) e modo do mouse (CAD / Classic / Orbit-Friendly / Mouse-Centric).
 * Fecha ao clicar fora, pressionar ESC ou ao escolher uma ação.
 */
export default function ContextMenu({
  position,
  onClose,
  contextMenuLayerTarget = null,
  onDoorMaterialChange,
  onDrawerMaterialChange,
  selectedBoxIds = [],
  selectedObjectIds = [],
}: ContextMenuProps) {
  const { project, actions } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuCloseTimerRef = useRef<number | null>(null);
  const [materialSubmenuOpen, setMaterialSubmenuOpen] = useState<"door" | "drawer" | null>(null);
  const [materialGrupoOpen, setMaterialGrupoOpen] = useState<string | null>(null);
  const [mouseSubmenuOpen, setMouseSubmenuOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [materialSubmenuPos, setMaterialSubmenuPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [materialThicknessPos, setMaterialThicknessPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [mouseSubmenuPos, setMouseSubmenuPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [materialAnchorRect, setMaterialAnchorRect] = useState<DOMRect | null>(null);
  const [materialThicknessAnchorRect, setMaterialThicknessAnchorRect] = useState<DOMRect | null>(null);
  const [mouseAnchorRect, setMouseAnchorRect] = useState<DOMRect | null>(null);
  const [dimensionsSubmenuOpen, setDimensionsSubmenuOpen] = useState(false);
  const [dimensionsSubmenuPos, setDimensionsSubmenuPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [dimensionsAnchorRect, setDimensionsAnchorRect] = useState<DOMRect | null>(null);
  const [scalingPreview, setScalingPreview] = useState<ScalingPreviewData | null>(null);

  const selectedBoxId = project.selectedWorkspaceBoxId ?? "";
  const selectedBox = selectedBoxId
    ? project.workspaceBoxes.find((b) => b.id === selectedBoxId)
    : undefined;
  const locked = selectedBox?.locked === true;
  const rawMousePreset = project.viewerSettings.mousePreset ?? "cad";
  const mousePreset: ViewerMousePreset =
    rawMousePreset === "orbitFriendly" ||
    rawMousePreset === "mouseCentric" ||
    rawMousePreset === "cad" ||
    rawMousePreset === "classic"
      ? rawMousePreset
      : "cad";
  const activeSelectedIds = useMemo(() => {
    const fromObjects = Array.isArray(selectedObjectIds) ? selectedObjectIds.filter(Boolean) : [];
    if (fromObjects.length > 0) {
      const boxIds = fromObjects
        .map((encoded) => decodeSelectionId(encoded))
        .filter((d) => d?.kind === "box")
        .map((d) => d!.id);
      if (boxIds.length > 0) return Array.from(new Set(boxIds));
    }
    const fromContext = Array.isArray(selectedBoxIds) ? selectedBoxIds.filter(Boolean) : [];
    if (fromContext.length > 0) return Array.from(new Set(fromContext));
    if (!selectedBoxId) return [];
    return [selectedBoxId];
  }, [selectedBoxId, selectedBoxIds, selectedObjectIds]);

  const activeSelectedObjectIds = useMemo(() => {
    const fromObjects = Array.isArray(selectedObjectIds) ? selectedObjectIds.filter(Boolean) : [];
    if (fromObjects.length > 0) return Array.from(new Set(fromObjects));
    return activeSelectedIds.map((id) => `box:${id}`);
  }, [activeSelectedIds, selectedObjectIds]);

  const isDoorTarget = contextMenuLayerTarget?.type === "door" && contextMenuLayerTarget.doorLayerId != null;
  const isDrawerTarget = contextMenuLayerTarget?.type === "drawer" && contextMenuLayerTarget.drawerLayerId != null;
  const showDoorMaterial = isDoorTarget;
  const showDrawerMaterial = isDrawerTarget;
  const roomExists = viewerApi?.getRoomExists?.() === true || project.room != null;
  const hasSmartAlignTarget = false;
  const alignableCount = viewerApi?.getSelectedObjects?.(activeSelectedIds)?.length ?? 0;
  const canAlign = alignableCount >= 2;
  const activeGroupId = groupStore.getState().activeGroupId;
  const categoryMenu = buildMouseMenu({
    target: contextMenuLayerTarget,
    hasSelectedBox: Boolean(selectedBoxId),
    hasRoom: roomExists,
    hasRemates: (project.remates ?? []).length > 0,
    hasSmartAlignTarget,
    multiSelectionCount: Math.max(activeSelectedObjectIds.length, activeSelectedIds.length),
    activeGroupId,
    canAlign,
  });

  const clearSubmenuCloseTimer = () => {
    if (submenuCloseTimerRef.current == null) return;
    window.clearTimeout(submenuCloseTimerRef.current);
    submenuCloseTimerRef.current = null;
  };

  const closeSubmenus = () => {
    setMaterialSubmenuOpen(null);
    setMaterialGrupoOpen(null);
    setMaterialThicknessPos(null);
    setMaterialThicknessAnchorRect(null);
    setMouseSubmenuOpen(false);
    setDimensionsSubmenuOpen(false);
    setActiveCategoryId(null);
  };

  const scheduleCloseSubmenus = () => {
    clearSubmenuCloseTimer();
    submenuCloseTimerRef.current = window.setTimeout(() => {
      closeSubmenus();
      submenuCloseTimerRef.current = null;
    }, SUBMENU_CLOSE_DELAY_MS);
  };

  const openCategorySubmenu = (category: MouseMenuCategory, rect: DOMRect) => {
    clearSubmenuCloseTimer();
    const estimatedHeight = category.actions.length * ITEM_HEIGHT + 16;
    const nextPos = placeMenu(rect.right, rect.top, SUBMENU_MIN_WIDTH, estimatedHeight);
    setMouseAnchorRect(rect);
    setMouseSubmenuPos({ left: nextPos.left, top: nextPos.top, height: estimatedHeight });
    setActiveCategoryId(category.id);
    setMouseSubmenuOpen(false);
    setMaterialSubmenuOpen(null);
    setMaterialGrupoOpen(null);
    setMaterialThicknessPos(null);
  };

  const openMaterialPicker = (target: "door" | "drawer", rect: DOMRect) => {
    clearSubmenuCloseTimer();
    const estimatedHeight = OFFICIAL_MATERIAL_GRUPOS.length * ITEM_HEIGHT + 16;
    const nextPos = placeMenu(rect.right, rect.top, SUBMENU_MIN_WIDTH, estimatedHeight);
    setMaterialAnchorRect(rect);
    setMaterialSubmenuPos({ left: nextPos.left, top: nextPos.top, height: estimatedHeight });
    setMaterialSubmenuOpen(target);
    setMaterialGrupoOpen(null);
    setMaterialThicknessPos(null);
    setMaterialThicknessAnchorRect(null);
    setActiveCategoryId(null);
    setMouseSubmenuOpen(false);
  };

  const openMousePresetPicker = (rect: DOMRect) => {
    clearSubmenuCloseTimer();
    const estimatedHeight = MOUSE_PRESET_OPTIONS.length * ITEM_HEIGHT + 16;
    const nextPos = placeMenu(rect.right, rect.top, SUBMENU_MIN_WIDTH, estimatedHeight);
    setMouseAnchorRect(rect);
    setMouseSubmenuPos({ left: nextPos.left, top: nextPos.top, height: estimatedHeight });
    setMouseSubmenuOpen(true);
    setMaterialSubmenuOpen(null);
    setActiveCategoryId(null);
  };

  useEffect(() => {
    if (!position) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [position, onClose]);

  useEffect(() => {
    return () => {
      clearSubmenuCloseTimer();
    };
  }, []);

  useEffect(() => {
    if (!position) return;
    const handlePointerDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) {
        onClose();
        closeSubmenus();
      }
    };
    const t = setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [position, onClose]);

  if (!position) return null;
  const estimatedMainHeight = categoryMenu.length * ITEM_HEIGHT + 16;
  const mainPos = placeMenu(position.x, position.y, MENU_MIN_WIDTH, estimatedMainHeight);
  const snappingEnabled = viewerApi?.snapping?.isEnabled?.() === true;
  const snapMode = viewerApi?.snapping?.getMode?.() ?? "basic";
  const roomSnappingEnabled = viewerApi?.snapping?.isRoomSnappingEnabled?.() === true;
  const autoAlignmentEnabled = viewerApi?.snapping?.isAutoAlignmentEnabled?.() !== false;
  const autoSpacingEnabled = viewerApi?.snapping?.isAutoSpacingEnabled?.() === true;
  const smartAlignSnapEnabled = viewerApi?.settings?.enableSmartAlignSnap === true;

  const getActionLabel = (action: MouseMenuAction): string => {
    if (action.id === "box.lockToggle") return locked ? "Desbloquear peça" : "Bloquear peça";
    if (action.id === "ferramentas.snappingToggle") return snappingEnabled ? "Snapping: ON" : "Snapping: OFF";
    if (action.id === "ferramentas.snapModeToggle") return `Snapping Mode: ${snapMode === "advanced" ? "Advanced" : "Basic"}`;
    if (action.id === "sala.roomSnappingToggle") return `Room Snapping: ${roomSnappingEnabled ? "ON" : "OFF"}`;
    if (action.id === "ferramentas.autoAlignmentToggle") return `Auto-Alignment: ${autoAlignmentEnabled ? "ON" : "OFF"}`;
    if (action.id === "ferramentas.autoSpacingToggle") return `Auto-Spacing: ${autoSpacingEnabled ? "ON" : "OFF"}`;
    if (action.id === "ferramentas.wallOffset") return `Wall Offset: ${viewerApi?.snapping?.getWallOffset?.() ?? 0} mm`;
    if (action.id === "smartAlignSnap.toggle") {
      return smartAlignSnapEnabled ? "Smart Align & Snap: ON" : "Smart Align & Snap: OFF";
    }
    return action.label;
  };

  const applyLayerMaterial = (materialId: string) => {
    if (activeSelectedObjectIds.length >= 2) {
      actions.setSelectedObjectsMaterial(activeSelectedObjectIds, materialId);
      for (const encoded of activeSelectedObjectIds) {
        const decoded = decodeSelectionId(encoded);
        if (!decoded) continue;
        if (decoded.kind === "box") {
          viewerApi?.updateBoxMaterial?.(decoded.id, materialId);
          continue;
        }
        if (decoded.kind === "door") {
          const box = project.workspaceBoxes.find((b) =>
            (b.doorsLayer ?? []).some((d) => d.id === decoded.id)
          );
          if (box) viewerApi?.updateDoorMaterial?.(box.id, decoded.id, materialId);
          continue;
        }
        if (decoded.kind === "drawer") {
          const box = project.workspaceBoxes.find((b) =>
            (b.drawersLayer ?? []).some((d) => d.id === decoded.id)
          );
          if (box) viewerApi?.updateDrawerMaterial?.(box.id, decoded.id, getViewerMaterialId(materialId));
        }
      }
      viewerApi?.syncRemateVisuals?.();
      viewerApi?.syncRodapeVisuals?.();
      onClose();
      return;
    }
    if (contextMenuLayerTarget?.type === "door" && contextMenuLayerTarget.doorLayerId) {
      onDoorMaterialChange?.(contextMenuLayerTarget.boxId ?? "", contextMenuLayerTarget.doorLayerId, materialId);
    } else if (contextMenuLayerTarget?.type === "drawer" && contextMenuLayerTarget.drawerLayerId) {
      onDrawerMaterialChange?.(contextMenuLayerTarget.boxId ?? "", contextMenuLayerTarget.drawerLayerId, materialId);
    }
    onClose();
  };

  const runScaling = (mode: ScalingMode): boolean => {
    const newLength = promptScalingNewLength(project, activeSelectedObjectIds);
    if (newLength == null) return false;
    const preview = buildScalingPreviewData(project, activeSelectedObjectIds, newLength, mode);
    if (!preview) return false;
    setScalingPreview(preview);
    return true;
  };

  const runAction = (actionId: MouseMenuActionId, anchorRect?: DOMRect) => {
    if (actionId === "porta.material" && anchorRect && showDoorMaterial) {
      openMaterialPicker("door", anchorRect);
      return;
    }
    if ((actionId === "gaveta.material" || actionId === "peca.material") && anchorRect && showDrawerMaterial) {
      openMaterialPicker("drawer", anchorRect);
      return;
    }
    if ((actionId === "materiais.mousePreset" || actionId === "remate.material") && anchorRect) {
      openMousePresetPicker(anchorRect);
      return;
    }
    if (actionId === "box.lockToggle" && selectedBoxId) actions.setWorkspaceBoxLocked(selectedBoxId, !locked);
    if (actionId === "box.rename" && selectedBoxId) {
      const newName = window.prompt("Novo nome da peça:", selectedBox?.nome ?? "");
      if (newName?.trim()) actions.setWorkspaceBoxNome(selectedBoxId, newName.trim());
    }
    if (actionId === "box.duplicate") actions.duplicateWorkspaceBoxAtOffset(0);
    if (actionId === "box.delete") actions.removeWorkspaceBox();
    if (actionId === "box.alignFront" && selectedBoxId) actions.alignFrontWithNeighbor(selectedBoxId);
    if (actionId === "box.alignBottom") actions.alignBottomSelectedBoxes(activeSelectedIds);
    if (
      actionId === "alignment.right" ||
      actionId === "alignment.left" ||
      actionId === "alignment.front" ||
      actionId === "alignment.back" ||
      actionId === "alignment.top" ||
      actionId === "alignment.bottom"
    ) {
      const type = actionId.replace("alignment.", "") as
        | "right"
        | "left"
        | "front"
        | "back"
        | "top"
        | "bottom";
      viewerApi?.align?.(type, activeSelectedIds);
    }
    if (actionId === "remate.remove" && contextMenuLayerTarget?.type === "remate" && contextMenuLayerTarget.remateId) {
      actions.removeRemate(contextMenuLayerTarget.remateId);
    }
    if (actionId === "remate.snapFrente" && contextMenuLayerTarget?.remateId) {
      actions.resetRemateSnap(contextMenuLayerTarget.remateId, "FRENTE");
      viewerApi?.syncRemateVisuals?.();
    }
    if (actionId === "remate.snapFundo" && contextMenuLayerTarget?.remateId) {
      actions.resetRemateSnap(contextMenuLayerTarget.remateId, "FUNDO");
      viewerApi?.syncRemateVisuals?.();
    }
    if (actionId === "remate.snapCima" && contextMenuLayerTarget?.remateId) {
      actions.resetRemateSnap(contextMenuLayerTarget.remateId, "CIMA");
      viewerApi?.syncRemateVisuals?.();
    }
    if (actionId === "ferramentas.snappingToggle") {
      if (snappingEnabled) viewerApi?.snapping?.disable?.();
      else viewerApi?.snapping?.enable?.();
    }
    if (actionId === "ferramentas.snapModeToggle") viewerApi?.snapping?.setMode?.(snapMode === "advanced" ? "basic" : "advanced");
    if (actionId === "sala.roomSnappingToggle") viewerApi?.snapping?.setRoomSnappingEnabled?.(!roomSnappingEnabled);
    if (actionId === "ferramentas.autoAlignmentToggle") viewerApi?.snapping?.setAutoAlignmentEnabled?.(!autoAlignmentEnabled);
    if (actionId === "ferramentas.autoSpacingToggle") viewerApi?.snapping?.setAutoSpacingEnabled?.(!autoSpacingEnabled);
    if (actionId === "ferramentas.wallOffset") {
      const raw = window.prompt("Wall Offset (mm):", String(viewerApi?.snapping?.getWallOffset?.() ?? 0));
      const parsed = raw == null ? NaN : Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed >= 0) viewerApi?.snapping?.setWallOffset?.(parsed);
    }
    if (actionId === "ferramentas.fillWall" && selectedBoxId) {
      const raw = window.prompt("ID da parede (0=frente, 1=direita, 2=fundo, 3=esquerda):", "0");
      const wallId = raw == null ? NaN : Number.parseInt(raw, 10);
      if (Number.isFinite(wallId) && wallId >= 0 && wallId <= 3) viewerApi?.autoLayout?.fillWallWithModule?.(wallId, selectedBoxId);
    }
    if (actionId === "ferramentas.extendAlongWall" && selectedBoxId) viewerApi?.autoLayout?.extendAlongWallFromBox?.(selectedBoxId);
    if (actionId === "ferramentas.distributeBoxes") viewerApi?.autoLayout?.distributeBoxesEvenly?.(activeSelectedIds);
    if (actionId === "ferramentas.autoStackShelves" && selectedBoxId) {
      const countRaw = window.prompt("Número de prateleiras:", "3");
      const count = countRaw == null ? NaN : Number.parseInt(countRaw, 10);
      const topMarginMm = Number.parseFloat(window.prompt("Margem superior (mm):", "50") ?? "50");
      const bottomMarginMm = Number.parseFloat(window.prompt("Margem inferior (mm):", "50") ?? "50");
      if (Number.isFinite(count) && count >= 0) {
        viewerApi?.autoLayout?.autoStackShelvesInBox?.(selectedBoxId, {
          count,
          topMarginMm: Number.isFinite(topMarginMm) ? topMarginMm : 50,
          bottomMarginMm: Number.isFinite(bottomMarginMm) ? bottomMarginMm : 50,
        });
      }
    }
    if (actionId === "smartLayout.autoWallFill" && selectedBoxId) {
      const raw = window.prompt("ID da parede (0=frente, 1=direita, 2=fundo, 3=esquerda):", "0");
      const wallId = raw == null ? NaN : Number.parseInt(raw, 10);
      if (Number.isFinite(wallId) && wallId >= 0 && wallId <= 3) {
        if (viewerApi?.settings?.enableSmartAlignSnap) {
          viewerApi.smartLayout?.previewAutoWallFill?.(wallId, selectedBoxId);
        } else {
          viewerApi?.smartLayout?.autoWallFill?.(wallId, selectedBoxId);
        }
      }
    }
    if (actionId === "smartLayout.autoRoomFill") {
      viewerApi?.smartLayout?.autoRoomFill?.(selectedBoxId ?? undefined);
    }
    if (actionId === "smartLayout.autoDistribute" && activeSelectedIds.length >= 2) {
      viewerApi?.smartLayout?.autoDistribute?.(activeSelectedIds);
    }
    if (actionId === "smartLayout.autoStackShelves" && selectedBoxId) {
      const countRaw = window.prompt("Número de prateleiras (0=auto):", "0");
      const count = countRaw == null ? NaN : Number.parseInt(countRaw, 10);
      const topMarginMm = Number.parseFloat(window.prompt("Margem superior (mm):", "50") ?? "50");
      const bottomMarginMm = Number.parseFloat(window.prompt("Margem inferior (mm):", "50") ?? "50");
      if (Number.isFinite(count) && count >= 0) {
        viewerApi?.smartLayout?.autoStackShelves?.(selectedBoxId, {
          count,
          topMarginMm: Number.isFinite(topMarginMm) ? topMarginMm : 50,
          bottomMarginMm: Number.isFinite(bottomMarginMm) ? bottomMarginMm : 50,
        });
      }
    }
    if (actionId === "smartLayout.applyPredictive") {
      viewerApi?.smartLayout?.applyPredictiveLayout?.();
      viewerApi?.refreshTransformControlsAttachment?.();
    }
    if (actionId === "smartLayout.rejectPredictive") {
      viewerApi?.smartLayout?.rejectPredictiveLayout?.();
    }
    if (actionId === "intelligentDesigner.generateABC" && selectedBoxId) {
      viewerApi?.intelligentDesigner?.generateDesigns?.(selectedBoxId);
    }
    if (actionId === "intelligentDesigner.generateVariations") {
      viewerApi?.intelligentDesigner?.generateVariations?.();
    }
    if (actionId === "intelligentDesigner.applyA") {
      viewerApi?.intelligentDesigner?.previewDesign?.("A");
      viewerApi?.intelligentDesigner?.applyDesign?.("A");
      viewerApi?.refreshTransformControlsAttachment?.();
    }
    if (actionId === "intelligentDesigner.applyB") {
      viewerApi?.intelligentDesigner?.previewDesign?.("B");
      viewerApi?.intelligentDesigner?.applyDesign?.("B");
      viewerApi?.refreshTransformControlsAttachment?.();
    }
    if (actionId === "intelligentDesigner.applyC") {
      viewerApi?.intelligentDesigner?.previewDesign?.("C");
      viewerApi?.intelligentDesigner?.applyDesign?.("C");
      viewerApi?.refreshTransformControlsAttachment?.();
    }
    if (actionId === "intelligentDesigner.refine") {
      viewerApi?.intelligentDesigner?.refineLayout?.();
      viewerApi?.refreshTransformControlsAttachment?.();
    }
    if (actionId === "intelligentDesigner.learnPreferences") {
      const summary = viewerApi?.intelligentDesigner?.learnPreferences?.();
      if (summary) window.alert(`Preferências aprendidas:\n\n${summary}`);
    }
    const styleActionMap: Record<string, import("../../../3d/viewer-engine/snapping/intelligentDesignerTypes").EnvironmentStyleId> = {
      "designerStyles.modern": "modern",
      "designerStyles.nordic": "nordic",
      "designerStyles.industrial": "industrial",
      "designerStyles.minimalist": "minimalist",
      "designerStyles.classic": "classic",
      "designerStyles.scandinavian": "scandinavian",
      "designerStyles.japandi": "japandi",
      "designerStyles.luxury": "luxury",
    };
    const styleId = styleActionMap[actionId];
    if (styleId && selectedBoxId) {
      viewerApi?.intelligentDesigner?.previewStyle?.(styleId, selectedBoxId);
    }

    if (actionId === "multi.createGroup") {
      const groupId = actions.createObjectGroup(activeSelectedObjectIds);
      if (groupId) {
        groupStore.getState().setActiveGroupId(groupId);
        viewerApi?.setGroupTransformMembers?.(activeSelectedObjectIds);
      }
    }
    if (actionId === "multi.ungroup" && activeGroupId) {
      actions.ungroupObject(activeGroupId);
      groupStore.getState().clearGroupSelection();
      viewerApi?.clearGroupTransformMembers?.();
    }
    if (actionId === "multi.addAnchor") {
      const hit = viewerApi?.addMeasurementAnchorAtPointer?.({
        clientX: position?.x ?? 0,
        clientY: position?.y ?? 0,
      });
      if (hit) actions.addMeasurementAnchor(hit.position, hit.label);
    }
    if (actionId === "multi.copy") {
      actions.duplicateSelectedObjects(activeSelectedObjectIds);
    }
    if (actionId === "multi.delete") {
      actions.deleteSelectedObjects(activeSelectedObjectIds);
      uiStore.getState().clearMultiSelection();
    }
    if (actionId === "multi.rotate") {
      actions.rotateSelectedObjects(activeSelectedObjectIds);
    }
    if (actionId === "multi.move") {
      actions.setActiveTool("move");
    }
    if (actionId === "multi.showMcDimensions") {
      viewerApi?.setDimensionsOverlayVisible?.(true);
      viewerApi?.toggleDimensionsOverlay?.();
    }
    if (actionId === "multi.changeMaterial" && anchorRect) {
      openMaterialPicker("door", anchorRect);
      return;
    }
    if (actionId === "multi.changeDimensionsAdditive") {
      if (runScaling("additive")) return;
    } else if (actionId === "multi.changeDimensionsRatio") {
      if (runScaling("ratio")) return;
    }

    onClose();
  };

  const runDimensionsDefault = () => {
    runScaling(project.viewerSettings.defaultScalingMode ?? "additive");
  };

  const confirmScalingPreview = () => {
    if (!scalingPreview) return;
    actions.scaleSelectedObjects(activeSelectedObjectIds, scalingPreview.newMax, scalingPreview.mode);
    setScalingPreview(null);
    onClose();
  };

  const openDimensionsPicker = (anchorRect: DOMRect) => {
    clearSubmenuCloseTimer();
    setDimensionsAnchorRect(anchorRect);
    setDimensionsSubmenuOpen(true);
    const submenuHeight = 2 * ITEM_HEIGHT + 12;
    const submenuWidth = SUBMENU_MIN_WIDTH;
    const pos = placeMenu(anchorRect.right, anchorRect.top, submenuWidth, submenuHeight);
    setDimensionsSubmenuPos({ left: pos.left, top: pos.top, height: submenuHeight });
  };

  const renderMousePresetItem = (preset: ViewerMousePreset, label: string) => (
    <button
      key={preset}
      type="button"
      role="menuitem"
      style={itemStyle}
      onClick={() => {
        actions.setViewerSettings({ mousePreset: preset });
        onClose();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ width: 16, textAlign: "center" }} aria-hidden>
        {mousePreset === preset ? <Icon name="check" size={12} aria-hidden /> : null}
      </span>
      <span>{label}</span>
    </button>
  );

  const renderActionItem = (action: MouseMenuAction) => {
    if (action.id === "multi.changeDimensions") {
      return (
        <div
          key={action.id}
          style={{ display: "flex", alignItems: "stretch", width: "100%" }}
          onPointerEnter={(e) => openDimensionsPicker(e.currentTarget.getBoundingClientRect())}
          onPointerLeave={scheduleCloseSubmenus}
        >
          <button
            type="button"
            role="menuitem"
            style={{ ...itemStyle, flex: 1 }}
            onClick={() => runDimensionsDefault()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span>{action.label}</span>
          </button>
          <button
            type="button"
            aria-label="Submenu alterar medidas"
            style={{ ...itemStyle, width: 28, padding: "8px 6px", justifyContent: "center" }}
            onClick={(e) => openDimensionsPicker(e.currentTarget.getBoundingClientRect())}
          >
            <Icon name="chevronRight" size={12} aria-hidden />
          </button>
        </div>
      );
    }

    return (
    <button
      key={action.id}
      type="button"
      role="menuitem"
      style={{ ...itemStyle, color: action.danger ? "var(--text-danger, #f87171)" : itemStyle.color }}
      onClick={(e) => runAction(action.id, e.currentTarget.getBoundingClientRect())}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span>{getActionLabel(action)}</span>
      {(action.id === "porta.material" ||
        action.id === "gaveta.material" ||
        action.id === "peca.material" ||
        action.id === "materiais.mousePreset" ||
        action.id === "remate.material") && (
        <span style={{ marginLeft: "auto" }} aria-hidden>
          <Icon name="chevronRight" size={12} aria-hidden />
        </span>
      )}
    </button>
  );
  };

  const renderCategoryItem = (category: MouseMenuCategory) => (
    <div
      key={category.id}
      style={{ position: "relative" }}
      onPointerEnter={(e) => openCategorySubmenu(category, e.currentTarget.getBoundingClientRect())}
      onPointerLeave={scheduleCloseSubmenus}
    >
      <button
        type="button"
        role="menuitem"
        style={itemStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span>{category.label}</span>
        <span style={{ marginLeft: "auto" }} aria-hidden>
          <Icon name="chevronRight" size={12} aria-hidden />
        </span>
      </button>
    </div>
  );

  return (
    <>
    {scalingPreview && (
      <ScalingPreviewDialog
        preview={scalingPreview}
        onConfirm={confirmScalingPreview}
        onCancel={() => setScalingPreview(null)}
      />
    )}
    <ContextMenuPortal>
      <div ref={menuRef}>
        <div
          role="menu"
          aria-label="Menu de contexto"
          style={{
            ...menuStyle,
            left: mainPos.left,
            top: mainPos.top,
            minWidth: MENU_MIN_WIDTH,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {categoryMenu.map(renderCategoryItem)}
        </div>

        {materialSubmenuOpen && materialSubmenuPos && materialAnchorRect && (
          <>
            <SubmenuHoverBridge
              anchorRect={materialAnchorRect}
              submenuLeft={materialSubmenuPos.left}
              submenuTop={materialSubmenuPos.top}
              submenuHeight={materialSubmenuPos.height}
              onPointerEnter={clearSubmenuCloseTimer}
            />
            <div
              role="menu"
              aria-label="Materiais"
              style={{
                ...menuStyle,
                left: materialSubmenuPos.left,
                top: materialSubmenuPos.top,
                minWidth: SUBMENU_MIN_WIDTH,
              }}
              onPointerEnter={clearSubmenuCloseTimer}
              onPointerLeave={scheduleCloseSubmenus}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {OFFICIAL_MATERIAL_GRUPOS.map((grupo) => (
                <button
                  key={grupo.materialPadronizado}
                  type="button"
                  role="menuitem"
                  style={itemStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
                    clearSubmenuCloseTimer();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const estimatedHeight =
                      grupo.listaDeEspessuras.length * ITEM_HEIGHT + 16;
                    const nextPos = placeMenu(
                      rect.right,
                      rect.top,
                      SUBMENU_MIN_WIDTH,
                      estimatedHeight
                    );
                    setMaterialGrupoOpen(grupo.materialPadronizado);
                    setMaterialThicknessAnchorRect(rect);
                    setMaterialThicknessPos({
                      left: nextPos.left,
                      top: nextPos.top,
                      height: estimatedHeight,
                    });
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {grupo.materialPadronizado}
                  <span style={{ marginLeft: "auto", opacity: 0.55, fontSize: 11 }}>▸</span>
                </button>
              ))}
            </div>
          </>
        )}

        {materialSubmenuOpen &&
          materialGrupoOpen &&
          materialThicknessPos &&
          materialThicknessAnchorRect && (
            <>
              <SubmenuHoverBridge
                anchorRect={materialThicknessAnchorRect}
                submenuLeft={materialThicknessPos.left}
                submenuTop={materialThicknessPos.top}
                submenuHeight={materialThicknessPos.height}
                onPointerEnter={clearSubmenuCloseTimer}
              />
              <div
                role="menu"
                aria-label={`Espessuras — ${materialGrupoOpen}`}
                style={{
                  ...menuStyle,
                  left: materialThicknessPos.left,
                  top: materialThicknessPos.top,
                  minWidth: SUBMENU_MIN_WIDTH,
                }}
                onPointerEnter={clearSubmenuCloseTimer}
                onPointerLeave={scheduleCloseSubmenus}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {(
                  OFFICIAL_MATERIAL_GRUPOS.find(
                    (g) => g.materialPadronizado === materialGrupoOpen
                  )?.listaDeEspessuras ?? []
                ).map((m) => {
                  const t = getMaterialEspessuraMm(m);
                  return (
                    <button
                      key={m.canonicalId}
                      type="button"
                      role="menuitem"
                      style={itemStyle}
                      onClick={() => applyLayerMaterial(m.canonicalId)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {t > 0 ? `${t} mm` : m.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

        {mouseSubmenuOpen && mouseSubmenuPos && mouseAnchorRect && (
          <>
            <SubmenuHoverBridge
              anchorRect={mouseAnchorRect}
              submenuLeft={mouseSubmenuPos.left}
              submenuTop={mouseSubmenuPos.top}
              submenuHeight={mouseSubmenuPos.height}
              onPointerEnter={clearSubmenuCloseTimer}
            />
            <div
              role="menu"
              aria-label="Modo do mouse"
              style={{
                ...menuStyle,
                left: mouseSubmenuPos.left,
                top: mouseSubmenuPos.top,
                minWidth: SUBMENU_MIN_WIDTH,
              }}
              onPointerEnter={clearSubmenuCloseTimer}
              onPointerLeave={scheduleCloseSubmenus}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {MOUSE_PRESET_OPTIONS.map(({ preset, label }) => renderMousePresetItem(preset, label))}
            </div>
          </>
        )}

        {dimensionsSubmenuOpen && dimensionsSubmenuPos && dimensionsAnchorRect && (
          <>
            <SubmenuHoverBridge
              anchorRect={dimensionsAnchorRect}
              submenuLeft={dimensionsSubmenuPos.left}
              submenuTop={dimensionsSubmenuPos.top}
              submenuHeight={dimensionsSubmenuPos.height}
              onPointerEnter={clearSubmenuCloseTimer}
            />
            <div
              role="menu"
              aria-label="Alterar medidas"
              style={{
                ...menuStyle,
                left: dimensionsSubmenuPos.left,
                top: dimensionsSubmenuPos.top,
                minWidth: SUBMENU_MIN_WIDTH,
              }}
              onPointerEnter={clearSubmenuCloseTimer}
              onPointerLeave={scheduleCloseSubmenus}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                style={itemStyle}
                onClick={() => runAction("multi.changeDimensionsAdditive")}
              >
                Adicionar Diferença
              </button>
              <button
                type="button"
                role="menuitem"
                style={itemStyle}
                onClick={() => runAction("multi.changeDimensionsRatio")}
              >
                Escala Percentual
              </button>
            </div>
          </>
        )}
        {activeCategoryId && mouseSubmenuPos && mouseAnchorRect && (
          <>
            <SubmenuHoverBridge
              anchorRect={mouseAnchorRect}
              submenuLeft={mouseSubmenuPos.left}
              submenuTop={mouseSubmenuPos.top}
              submenuHeight={mouseSubmenuPos.height}
              onPointerEnter={clearSubmenuCloseTimer}
            />
            <div
              role="menu"
              aria-label="Submenu"
              style={{
                ...menuStyle,
                left: mouseSubmenuPos.left,
                top: mouseSubmenuPos.top,
                minWidth: SUBMENU_MIN_WIDTH,
              }}
              onPointerEnter={clearSubmenuCloseTimer}
              onPointerLeave={scheduleCloseSubmenus}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {categoryMenu.find((category) => category.id === activeCategoryId)?.actions.map(renderActionItem)}
            </div>
          </>
        )}
      </div>
    </ContextMenuPortal>
    </>
  );
}
