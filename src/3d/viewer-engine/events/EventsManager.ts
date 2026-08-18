/**
 * Gestão centralizada de eventos do Viewer Engine (canvas: click, pointer, etc.).
 * Toda a lógica de handlers de mouse/pointer foi extraída do ViewerCore.
 */

import { getPointerNdc } from "../utils";
import type { IViewerEventEngine } from "./EventEngineTypes";
import { devLogger } from "../../../utils/devLogger";
import { boxSelectionId, remateSelectionId } from "../../../core/viewer/selectionIds";

export class EventsManager {
  private readonly engine: IViewerEventEngine;
  private canvas: HTMLCanvasElement | null = null;
  /** True enquanto o utilizador arrasta o gizmo de transformação (mover/rodar caixa) ou o wall gizmo. */
  private isDraggingGizmo = false;
  /** True quando o pointerdown foi fora do gizmo (arrastar = orbit/pan câmera). */
  private isDraggingCamera = false;
  /** Evita double-toggle quando pointerdown já activou a gaveta. */
  private drawerToggledOnPointerDown = false;
  private boundHandlers: {
    click: (_event: MouseEvent) => void;
    dblclick: (_event: MouseEvent) => void;
    pointerdown: (_event: PointerEvent) => void;
    pointermove: (_event: PointerEvent) => void;
    pointerup: (_event: PointerEvent) => void;
    pointercancel: (_event: PointerEvent) => void;
    pointerleave: () => void;
    blur: () => void;
  } | null = null;

  constructor(engine: IViewerEventEngine) {
    this.engine = engine;
    this.boundHandlers = {
      click: this.handleCanvasClick.bind(this),
      dblclick: this.handleCanvasDoubleClick.bind(this),
      pointerdown: this.handleCanvasPointerDown.bind(this),
      pointermove: this.handleCanvasPointerMove.bind(this),
      pointerup: this.handleCanvasPointerUp.bind(this),
      pointercancel: this.handleCanvasPointerUp.bind(this),
      pointerleave: this.handleCanvasPointerLeave.bind(this),
      blur: this.handleWindowBlur.bind(this),
    };
  }

  /** Regista os listeners no canvas. Deve ser chamado após o canvas estar disponível. */
  register(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return;
    this.unregister();
    this.canvas = canvas;
    const h = this.boundHandlers!;
    canvas.addEventListener("click", h.click);
    canvas.addEventListener("dblclick", h.dblclick);
    canvas.addEventListener("pointerdown", h.pointerdown, true);
    canvas.addEventListener("pointermove", h.pointermove);
    canvas.addEventListener("pointerup", h.pointerup);
    window.addEventListener("pointerup", h.pointerup);
    window.addEventListener("pointercancel", h.pointercancel);
    window.addEventListener("blur", h.blur);
    canvas.addEventListener("pointerleave", h.pointerleave);
  }

  /** Remove os listeners do canvas. */
  unregister(): void {
    if (!this.canvas || !this.boundHandlers) return;
    const h = this.boundHandlers;
    this.canvas.removeEventListener("click", h.click);
    this.canvas.removeEventListener("dblclick", h.dblclick);
    this.canvas.removeEventListener("pointerdown", h.pointerdown, true);
    this.canvas.removeEventListener("pointermove", h.pointermove);
    this.canvas.removeEventListener("pointerup", h.pointerup);
    window.removeEventListener("pointerup", h.pointerup);
    window.removeEventListener("pointercancel", h.pointercancel);
    window.removeEventListener("blur", h.blur);
    this.canvas.removeEventListener("pointerleave", h.pointerleave);
    this.canvas = null;
  }

  private activateDrawerToggle(
    event: MouseEvent | PointerEvent,
    drawerHit: { boxId: string; drawerLayerId: string }
  ): void {
    const e = this.engine;
    this.drawerToggledOnPointerDown = true;
    this.isDraggingCamera = false;
    e.setSuppressNextCanvasClick(false);
    event.preventDefault();
    event.stopPropagation();
    e.getOnDrawerLayerClick()?.(drawerHit.boxId, drawerHit.drawerLayerId);
  }

  private handleCanvasClick(event: MouseEvent): void {
    const e = this.engine;
    if (e.getTransformControlsDragging()) return;

    if (this.drawerToggledOnPointerDown) {
      this.drawerToggledOnPointerDown = false;
      return;
    }

    const drawerHit = e.getDrawerHitAtPointer(event);
    if (drawerHit) {
      this.activateDrawerToggle(event, drawerHit);
      return;
    }

    if (e.getSuppressNextCanvasClick()) {
      e.setSuppressNextCanvasClick(false);
      return;
    }
    if (e.getIndustrialDesignWorkspaceEnabled()) {
      if (e.handleIndustrialDesignPointerClick(event)) {
        return;
      }
    }
    if (e.getInternalSelectionEnabled()) {
      const internalHit = e.getInternalSelectionHit(event);
      if (internalHit) {
        e.setInternalSelection(internalHit);
        if (e.getSelectedBoxId() !== internalHit.boxId) {
          e.setSelectedBox(internalHit.boxId);
        }
        e.getOnRoomElementSelected()?.(null);
        e.getOnWallSelected()?.(null);
        return;
      }
    }
    if (e.getHighlightEnabled() && e.getHighlightManager()) {
      const hits = e.getHighlightIntersects(event);
      const mesh = e.getHighlightManager()!.getSelectableMeshFromIntersects(hits);
      if (mesh) {
        const boxId = e.getBoxIdByMesh(mesh);
        if (boxId == null) {
          // Não consumir o clique quando o highlight acertar um mesh que não pertence a box.
          // Permite fallback para raycast normal de box/sala/parede.
        } else {
          e.getHighlightManager()!.setSelected(mesh);
          e.setSelectedBox(boxId);
          e.getOnRoomElementSelected()?.(null);
          e.getOnWallSelected()?.(null);
          return;
        }
      }
    }
    if (e.getPlacementMode() && e.getOnRoomElementPlaced()) {
      const hit = e.getWallHitAtPointer(event);
      if (hit) {
        if (hit.type === "door") {
          e.getRoomBuilder().addDoorByIndex(hit.wallId, hit.config);
        } else {
          e.getRoomBuilder().addWindowByIndex(hit.wallId, hit.config);
        }
        e.getOnRoomElementPlaced()!(hit.wallId, hit.config, hit.type);
        e.setPlacementMode(null);
      }
      return;
    }
    const hematiId = e.getHematiIdAtPointer(event);
    if (hematiId) {
      e.selectHemati(hematiId);
      e.setHoveredBox(null);
      e.setSelectedBox(null);
      e.getOnRoomElementSelected()?.(null);
      e.getOnWallSelected()?.(null);
      e.getOnBoxSelected()?.(null);
      return;
    }
    const rodapeId = e.getRodapeIdAtPointer(event);
    if (rodapeId) {
      e.selectRodape(rodapeId);
      e.selectDivSep(null);
      e.setHoveredBox(null);
      e.setSelectedBox(null);
      e.getOnRoomElementSelected()?.(null);
      e.getOnWallSelected()?.(null);
      e.getOnBoxSelected()?.(null);
      return;
    }
    const divSepHit = e.getDivSepHitAtPointer(event);
    if (divSepHit) {
      e.selectDivSep(divSepHit);
      e.selectRemate(null);
      e.selectHemati(null);
      e.selectRodape(null);
      e.setHoveredBox(null);
      e.setSelectedBox(null);
      e.getOnRoomElementSelected()?.(null);
      e.getOnWallSelected()?.(null);
      e.getOnBoxSelected()?.(null);
      e.getOnRemateSelected?.()?.(null);
      return;
    }
    const remateId = e.getRemateIdAtPointer(event);
    if (remateId) {
      if (this.isMultiSelectModifier(event)) {
        this.emitMultiSelectToggle(event, remateSelectionId(remateId));
      }
      e.selectRemate(remateId);
      e.getOnRemateSelected?.()?.(remateId);
      e.setHoveredBox(null);
      e.setHoveredRemate(null);
      e.setSelectedBox(null);
      e.getOnRoomElementSelected()?.(null);
      e.getOnWallSelected()?.(null);
      e.getOnBoxSelected()?.(null);
      return;
    }
    const boxId = e.getBoxIdAtPointer(event);
    if (boxId) {
      this.selectBoxFromPointer(event, boxId);
      return;
    }
    const roomHit = e.getRoomElementAtPointer(event);
    if (roomHit) {
      e.setHoveredBox(null);
      e.setSelectedBox(null);
      e.setSelectedWallIndex(null);
      e.setSelectedRoomElementId(roomHit.elementId);
      e.setSelectedRoomUtilityId(null);
      e.refreshTransformControlsAttachment();
      e.refreshOutlineTarget();
      e.getOnBoxSelected()?.(null);
      e.getOnRoomElementSelected()?.(roomHit);
      e.getOnRoomUtilitySelected()?.(null);
      e.getOnWallSelected()?.(null);
      return;
    }
    const utilityHit = e.getRoomUtilityAtPointer(event);
    if (utilityHit) {
      e.setHoveredBox(null);
      e.setSelectedBox(null);
      e.setSelectedWallIndex(null);
      e.setSelectedRoomElementId(null);
      e.setSelectedRoomUtilityId(utilityHit.utilityId);
      e.refreshTransformControlsAttachment();
      e.refreshOutlineTarget();
      e.getOnBoxSelected()?.(null);
      e.getOnRoomElementSelected()?.(null);
      e.getOnRoomUtilitySelected()?.(utilityHit);
      e.getOnWallSelected()?.(null);
      return;
    }
    const wallId = e.getWallIdAtPointer(event);
    if (wallId !== null) {
      e.setHoveredBox(null);
      e.setSelectedBox(null);
      e.setSelectedWallIndex(wallId);
      e.setSelectedRoomElementId(null);
      e.setSelectedRoomUtilityId(null);
      const wall = e.getRoomBoxWalls().find((w) => w.id === wallId)?.mesh;
      const wallGizmo = e.getWallGizmo();
      if (wallGizmo && wall && e.getWallEditMode()) wallGizmo.attach(wall);
      e.refreshTransformControlsAttachment();
      e.refreshOutlineTarget();
      e.getOnBoxSelected()?.(null);
      e.getOnRoomElementSelected()?.(null);
      e.getOnRoomUtilitySelected()?.(null);
      e.getOnWallSelected()?.(wallId);
      return;
    }
    e.setHoveredBox(null);
    e.setHoveredRemate(null);
    e.setSelectedBox(null);
    e.setSelectedWallIndex(null);
    e.setSelectedRoomElementId(null);
    e.setSelectedRoomUtilityId(null);
    e.selectRemate(null);
    e.selectHemati(null);
    e.selectRodape(null);
    const wallGizmo = e.getWallGizmo();
    if (wallGizmo) wallGizmo.detach();
    e.refreshTransformControlsAttachment();
    e.refreshOutlineTarget();
    e.getOnBoxSelected()?.(null);
    e.getOnRoomElementSelected()?.(null);
    e.getOnRoomUtilitySelected()?.(null);
    e.getOnWallSelected()?.(null);
    e.getOnRemateSelected?.()?.(null);
  }

  private handleCanvasPointerDown(event: PointerEvent): void {
    const e = this.engine;
    if (import.meta.env.DEV) {
      devLogger.debug("[SELECTION][EventsManager] pointerdown:start", {
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
        selectedBoxBefore: e.getSelectedBoxId(),
        suppressNextCanvasClickBefore: e.getSuppressNextCanvasClick(),
      });
    }
    if (import.meta.env.DEV && event.button === 2) {
      devLogger.debug("[DOOR-MAT] handleCanvasPointerDown — botão direito (context menu virá a seguir)", {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }
    e.logTransformDiagnostic("pointerDown", {
      pointerType: event.pointerType,
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (event.button === 0) {
      const transformGizmoHits = e.getTransformGizmoIntersections(event);
      if (transformGizmoHits > 0) {
        this.isDraggingGizmo = true;
        this.isDraggingCamera = false;
        e.setCameraControlsEnabled(false);
        return;
      }

      const drawerHit = e.getDrawerHitAtPointer(event);
      if (drawerHit != null) {
        this.activateDrawerToggle(event, drawerHit);
        return;
      }

      this.isDraggingCamera = true;
      this.isDraggingGizmo = false;
    }

    // Orbit/Pan/Zoom são do rato (MouseInputMapper). A selecção fica no clique, não no pointerdown.
    if (event.button !== 0) {
      this.isDraggingCamera = true;
      this.isDraggingGizmo = false;
      return;
    }
    if (e.getSelectedWallIndex() === null || !e.getWallGizmo()) {
      this.isDraggingCamera = true;
      this.isDraggingGizmo = false;
      return;
    }
    const canvas = e.getCanvas();
    const { x, y } = getPointerNdc(canvas, event);
    if (e.getWallGizmo()!.onPointerDown(x, y)) {
      e.setWallGizmoDragging(true);
      this.isDraggingGizmo = true;
      this.isDraggingCamera = false;
      e.setCameraControlsEnabled(false);
    } else {
      this.isDraggingCamera = true;
      this.isDraggingGizmo = false;
    }
  }

  private handleCanvasDoubleClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    const doorHit = this.engine.getDoorHitAtPointer(event);
    if (doorHit) {
      event.preventDefault();
      event.stopPropagation();
      this.engine.getOnDoorLayerDoubleClick()?.(doorHit.boxId, doorHit.doorLayerId);
      return;
    }
    if (this.engine.getDrawerHitAtPointer(event)) return;
    const boxBodyHit = this.engine.getBoxBodyHitAtPointer(event);
    if (!boxBodyHit) return;
    event.preventDefault();
    event.stopPropagation();
    this.engine.getOnBoxDoubleClick()?.(boxBodyHit.boxId);
  }

  private handleCanvasPointerUp(event: PointerEvent): void {
    const e = this.engine;
    e.logTransformDiagnostic("pointerUp", {
      pointerType: event.pointerType,
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      gizmoHits: e.getTransformGizmoIntersections(event),
    });
    if (e.getWallGizmoDragging() && e.getWallGizmo()) {
      e.getWallGizmo()!.onPointerUp();
      e.setWallGizmoDragging(false);
    }
    this.isDraggingGizmo = false;
    this.isDraggingCamera = false;
    e.setCameraControlsEnabled(true);
  }

  private handleCanvasPointerMove(event: PointerEvent): void {
    const e = this.engine;
    if (this.isDraggingGizmo) return;
    if (this.isDraggingCamera) return;
    e.logTransformDiagnostic("pointerMove", {
      pointerType: event.pointerType,
      buttons: event.buttons,
      clientX: event.clientX,
      clientY: event.clientY,
      gizmoHits: e.getTransformGizmoIntersections(event),
    });
    if (e.getTransformControlsDragging()) return;
    if (e.getHighlightEnabled() && e.getHighlightManager()) {
      const hits = e.getHighlightIntersects(event);
      const mesh = e.getHighlightManager()!.getSelectableMeshFromIntersects(hits);
      e.getHighlightManager()!.setHovered(mesh);
      const boxId = mesh ? e.getBoxIdByMesh(mesh) : null;
      e.setHoveredBox(boxId);
      if (boxId == null) {
        const remateId = e.getRemateIdAtPointer(event);
        e.setHoveredRemate(remateId);
      } else {
        e.setHoveredRemate(null);
      }
      return;
    }
    const remateId = e.getRemateIdAtPointer(event);
    if (remateId) {
      e.setHoveredRemate(remateId);
      return;
    }
    e.setHoveredRemate(null);
    const id = e.getBoxIdAtPointer(event);
    e.setHoveredBox(id);
  }

  private handleCanvasPointerLeave(): void {
    const e = this.engine;
    this.isDraggingGizmo = false;
    this.isDraggingCamera = false;
    e.setCameraControlsEnabled(true);
    if (e.getHighlightEnabled() && e.getHighlightManager()) {
      e.getHighlightManager()!.setHovered(null);
    }
    e.setHoveredBox(null);
    e.setHoveredRemate(null);
  }

  private handleWindowBlur(): void {
    const e = this.engine;
    this.isDraggingGizmo = false;
    this.isDraggingCamera = false;
    e.setWallGizmoDragging(false);
    e.setCameraControlsEnabled(true);
  }

  private isMultiSelectModifier(event: MouseEvent | PointerEvent): boolean {
    return event.ctrlKey || event.metaKey;
  }

  private emitMultiSelectToggle(event: MouseEvent | PointerEvent, encodedId: string): boolean {
    if (!this.isMultiSelectModifier(event)) return false;
    const toggle = this.engine.getOnMultiSelectToggle();
    if (!toggle) return false;
    toggle(encodedId);
    return true;
  }

  private selectBoxFromPointer(event: MouseEvent | PointerEvent, boxId: string): void {
    const e = this.engine;
    const preserveGroup = this.isMultiSelectModifier(event);
    if (preserveGroup) {
      this.emitMultiSelectToggle(event, boxSelectionId(boxId));
    }
    e.selectHemati(null);
    e.selectRodape(null);
    e.selectRemate(null);
    e.setHoveredBox(boxId);
    e.setSelectedBox(boxId, preserveGroup ? { preserveGroupMembers: true } : undefined);
    e.getOnRoomElementSelected()?.(null);
    e.getOnWallSelected()?.(null);
  }
}
