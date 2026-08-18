/**
 * Lógica de ferramentas do Viewer Engine (TransformControls, outline, move/rotate).
 * Centraliza attachment do gizmo e atualização do outline; delega clamp ao engine.
 */

import * as THREE from "three";
import type { IViewerToolsEngine } from "./ToolsEngineTypes";
import type { TransformControlsLike } from "./TransformControlsTypes";
import { shouldAttachScaleGizmo } from "./scaleGizmoPolicy";

type TransformControlsWithDragState = TransformControlsLike & {
  dragging?: boolean;
};

export class ViewerTools {
  private readonly engineOrGetter: IViewerToolsEngine | (() => IViewerToolsEngine);
  private getEngine(): IViewerToolsEngine {
    return typeof this.engineOrGetter === "function" ? this.engineOrGetter() : this.engineOrGetter;
  }
  constructor(engineOrGetter: IViewerToolsEngine | (() => IViewerToolsEngine)) {
    this.engineOrGetter = engineOrGetter;
  }

  restoreTransformGizmoPivot(): void {
    const e = this.getEngine();
    const controls = e.getTransformControls();
    if (!controls) return;
    if (e.getGroupGizmo().isActive()) {
      e.getGroupGizmo().end(controls);
    }
    controls.detach();
  }

  /** Anexa ou desanexa TransformControls conforme seleção (caixa, parede ou abertura). */
  updateTransformControlsAttachment(): void {
    const e = this.getEngine();
    const controls = e.getTransformControls();
    if (!controls) return;
    if ((controls as TransformControlsWithDragState).dragging) return;
    this.restoreTransformGizmoPivot();

    const groupMemberIds = e.getGroupTransformMemberIds();
    const mode = e.getCurrentTool();
    if (mode === "scale") {
      this.attachScaleGizmo(e, controls);
      return;
    }
    if (groupMemberIds.length >= 2 && mode) {
      const members = groupMemberIds
        .map((id) => {
          const mesh = e.resolveMemberMesh(id);
          return mesh ? { encodedId: id, mesh } : null;
        })
        .filter((m): m is { encodedId: string; mesh: THREE.Object3D } => m != null);
      if (members.length >= 2 && e.getGroupGizmo().begin(controls, members)) {
        controls.setMode(mode);
        controls.setSize(0.4);
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-group", { count: members.length });
        e.setTransformHelperVisible(true);
        return;
      }
    }

    const selectedHematiId = e.getSelectedHematiId();
    if (selectedHematiId && mode) {
      const hematiMesh = e.getHematiMesh(selectedHematiId);
      if (hematiMesh) {
        hematiMesh.matrixAutoUpdate = true;
        hematiMesh.updateMatrixWorld(true);
        controls.detach();
        controls.attach(hematiMesh);
        controls.setMode(mode);
        controls.setSize(0.35);
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-hemati", { hematiId: selectedHematiId, attachedUuid: hematiMesh.uuid });
        e.setTransformHelperVisible(true);
        return;
      }
    }

    const selectedRodapeId = e.getSelectedRodapeId();
    if (selectedRodapeId && mode) {
      const rodapeMesh = e.getRodapeMesh(selectedRodapeId);
      if (rodapeMesh) {
        rodapeMesh.matrixAutoUpdate = true;
        rodapeMesh.updateMatrixWorld(true);
        controls.detach();
        controls.attach(rodapeMesh);
        controls.setMode(mode);
        controls.setSize(0.35);
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-rodape", { rodapeId: selectedRodapeId, attachedUuid: rodapeMesh.uuid });
        e.setTransformHelperVisible(true);
        return;
      }
    }

    const selectedRemateId = e.getSelectedRemateId();
    if (selectedRemateId && mode) {
      const remateMesh = e.getRemateMesh(selectedRemateId);
      if (remateMesh) {
        remateMesh.matrixAutoUpdate = true;
        remateMesh.updateMatrixWorld(true);
        controls.detach();
        controls.attach(remateMesh);
        controls.setMode(mode);
        controls.setSpace("world");
        controls.setSize(0.35);
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-remate", { remateId: selectedRemateId, attachedUuid: remateMesh.uuid });
        e.setTransformHelperVisible(true);
        return;
      }
    }

    const selectedDivSep = e.getSelectedDivSep();
    if (selectedDivSep) {
      const divSepMesh = e.getDivSepMesh(selectedDivSep);
      if (divSepMesh) {
        divSepMesh.matrixAutoUpdate = true;
        divSepMesh.updateMatrixWorld(true);
        controls.detach();
        controls.attach(divSepMesh);
        controls.setMode("translate");
        controls.setSpace("local");
        controls.showX = selectedDivSep.kind === "div";
        controls.showY = selectedDivSep.kind === "sep";
        controls.showZ = false;
        controls.setSize(0.35);
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-divsep", {
          boxId: selectedDivSep.boxId,
          kind: selectedDivSep.kind,
          itemId: selectedDivSep.itemId,
          attachedUuid: divSepMesh.uuid,
        });
        e.setTransformHelperVisible(true);
        return;
      }
    }

    const selectedBoxId = e.getSelectedBoxId();
    if (selectedBoxId && mode) {
      const entry = e.getBoxEntry(selectedBoxId);
      if (entry) {
        if (entry.locked) {
          controls.detach();
          e.applyTransformControlsMouseGuard();
          e.logTransformDiagnostic("detach-box-locked", { boxId: selectedBoxId });
          e.setTransformHelperVisible(false);
          return;
        }
        entry.mesh.matrixAutoUpdate = true;
        entry.mesh.updateMatrixWorld(true);
        controls.detach();
        controls.attach(entry.mesh);
        controls.setMode(mode);
        controls.showX = true;
        controls.showY = true;
        controls.showZ = true;
        controls.setSpace("world");
        controls.setSize(e.getTransformGizmoSizeForBox(entry));
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-box", { boxId: selectedBoxId, attachedUuid: entry.mesh.uuid });
        e.setTransformHelperVisible(true);
        return;
      }
    }
    if (e.getSelectedWallIndex() !== null && mode) {
      const wall = e.getRoomBoxWalls().find((w) => w.id === e.getSelectedWallIndex())?.mesh;
      if (wall) {
        controls.detach();
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("detach-wall-selected", { wallId: e.getSelectedWallIndex() });
        e.setTransformHelperVisible(false);
        return;
      }
    }
    const selectedRoomElementId = e.getSelectedRoomElementId();
    if (selectedRoomElementId && mode) {
      const element = e.getRoomElementById(selectedRoomElementId);
      if (element) {
        element.matrixAutoUpdate = true;
        element.updateMatrixWorld(true);
        controls.detach();
        controls.attach(element);
        controls.setMode(mode);
        controls.setSize(0.65);
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-room-element", { elementId: selectedRoomElementId, attachedUuid: element.uuid });
        e.setTransformHelperVisible(true);
        return;
      }
    }
    const selectedRoomUtilityId = e.getSelectedRoomUtilityId();
    if (selectedRoomUtilityId && mode) {
      const utility = e.getRoomUtilityById(selectedRoomUtilityId);
      if (utility) {
        utility.matrixAutoUpdate = true;
        utility.updateMatrixWorld(true);
        controls.detach();
        controls.attach(utility);
        controls.setMode("translate");
        controls.setSize(0.35);
        e.applyTransformControlsMouseGuard();
        e.logTransformDiagnostic("attach-room-utility", { utilityId: selectedRoomUtilityId, attachedUuid: utility.uuid });
        e.setTransformHelperVisible(true);
        return;
      }
    }
    this.restoreTransformGizmoPivot();
    e.applyTransformControlsMouseGuard();
    e.logTransformDiagnostic("detach-none", { reason: "no-selected-target-or-transform-mode" });
    e.setTransformHelperVisible(false);
  }

  /**
   * Z-02.2 — gizmo de escala só em caixas cadOnly (GLB / modelos externos).
   * Remates, rodapés, caixas industriais, sala e paredes nunca recebem modo scale.
   */
  private attachScaleGizmo(
    e: IViewerToolsEngine,
    controls: NonNullable<ReturnType<IViewerToolsEngine["getTransformControls"]>>
  ): void {
    const selectedBoxId = e.getSelectedBoxId();
    const entry = selectedBoxId ? e.getBoxEntry(selectedBoxId) : undefined;
    const allowed = shouldAttachScaleGizmo({
      selectedRemateId: e.getSelectedRemateId(),
      selectedRodapeId: e.getSelectedRodapeId(),
      selectedHematiId: e.getSelectedHematiId(),
      selectedDivSep: e.getSelectedDivSep(),
      selectedWallIndex: e.getSelectedWallIndex(),
      selectedRoomElementId: e.getSelectedRoomElementId(),
      selectedRoomUtilityId: e.getSelectedRoomUtilityId(),
      groupMemberCount: e.getGroupTransformMemberIds().length,
      boxEntry: entry,
    });
    if (!allowed || !selectedBoxId || !entry) {
      e.applyTransformControlsMouseGuard();
      e.logTransformDiagnostic("detach-scale-blocked", { boxId: selectedBoxId ?? undefined });
      e.setTransformHelperVisible(false);
      return;
    }
    entry.mesh.matrixAutoUpdate = true;
    entry.mesh.updateMatrixWorld(true);
    controls.detach();
    controls.attach(entry.mesh);
    controls.setMode("scale");
    controls.showX = true;
    controls.showY = true;
    controls.showZ = true;
    controls.setSpace("world");
    controls.setSize(e.getTransformGizmoSizeForBox(entry));
    e.applyTransformControlsMouseGuard();
    e.logTransformDiagnostic("attach-scale-cadOnly", { boxId: selectedBoxId, attachedUuid: entry.mesh.uuid });
    e.setTransformHelperVisible(true);
  }

  /** Atualiza o outline de seleção/hover (cor e visibilidade). */
  updateOutline(): void {
    const e = this.getEngine();
    const outline = e.getSelectionOutline();
    const material = e.getSelectionOutlineMaterial();
    if (!outline || !material) return;
    const selectedHematiId = e.getSelectedHematiId();
    if (selectedHematiId) {
      const hematiMesh = e.getHematiMesh(selectedHematiId);
      if (hematiMesh) {
        e.setOutlineTarget(hematiMesh, 0.9, 0xf59e0b);
        return;
      }
    }
    const selectedRodapeId = e.getSelectedRodapeId();
    if (selectedRodapeId) {
      const rodapeMesh = e.getRodapeMesh(selectedRodapeId);
      if (rodapeMesh) {
        e.setOutlineTarget(rodapeMesh, 0.9, 0xa78bfa);
        return;
      }
    }
    const selectedRemateId = e.getSelectedRemateId();
    if (selectedRemateId) {
      const remateMesh = e.getRemateMesh(selectedRemateId);
      if (remateMesh) {
        e.setOutlineTarget(remateMesh, 0.9, 0x38bdf8);
        return;
      }
    }

    const selectedDivSep = e.getSelectedDivSep();
    if (selectedDivSep) {
      const divSepMesh = e.getDivSepMesh(selectedDivSep);
      if (divSepMesh) {
        e.setOutlineTarget(divSepMesh, 0.9, 0x34d399);
        return;
      }
    }

    const hoveredRemateId = e.getHoveredRemateId();
    if (hoveredRemateId && hoveredRemateId !== selectedRemateId) {
      const remateMesh = e.getRemateMesh(hoveredRemateId);
      if (remateMesh) {
        e.setOutlineTarget(remateMesh, 0.55, 0x7dd3fc);
        return;
      }
    }

    const targetId = e.getSelectedBoxId() ?? e.getHoveredBoxId();
    if (!targetId) {
      e.setOutlineTarget(null, 0, 0);
      return;
    }
    const entry = e.getBoxEntry(targetId);
    if (!entry) {
      e.setOutlineTarget(null, 0, 0);
      return;
    }
    const isSelected = targetId === e.getSelectedBoxId();
    const opacity = isSelected ? 0.9 : 0.55;
    const intersectsWall = e.getBoxesIntersectingWalls().has(targetId);
    const colorHex = intersectsWall ? 0xef4444 : (isSelected ? 0x38bdf8 : 0x7dd3fc);
    e.setOutlineTarget(entry.mesh, opacity, colorHex);
  }

  /** Aplica o clamp atual (translate/rotate) após arraste; delega ao engine. */
  applyCurrentTool(): void {
    this.getEngine().clampTransform();
  }

  applyMoveTool(): void {
    this.getEngine().clampTransform();
  }

  applyRotateTool(): void {
    this.getEngine().clampTransform();
  }

  applyScaleTool(): void {
    this.getEngine().clampTransform();
  }

  applyPlacementTool(): void {
    // Placement é tratado nos eventos (EventsManager); não há clamp específico.
  }

  applyWallEditTool(): void {
    this.getEngine().clampTransform();
  }

  applyRoomEditTool(): void {
    this.getEngine().clampTransform();
  }
}
