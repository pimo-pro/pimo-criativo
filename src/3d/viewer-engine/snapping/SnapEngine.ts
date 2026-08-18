import type * as THREE from "three";
import { snapModelToNearestWall, SNAP_THRESHOLD } from "../../snapping/ModelWallSnap";
import type { TransformConstraints, ClampTransformContext } from "../constraints/TransformConstraints";
import type { SmartAlignSnapEngine } from "./SmartAlignSnapEngine";
import type { SmartAlignSnapContext, SmartSnapEntityKind } from "./smartAlignSnapTypes";

/** Limiar de ModelWallSnap (0,25 m) expresso em mm — D-10 / testes de drag. */
export const SNAP_WALL_THRESHOLD_MM = SNAP_THRESHOLD * 1000;

export type SnapAlignTarget = {
  mesh: THREE.Object3D;
  entity: {
    kind: SmartSnapEntityKind;
    id: string;
    parentBoxId?: string;
  };
  isDragging: boolean;
  currentTool: string;
};

export type SnapEngineDeps = {
  getAlignEngine: () => SmartAlignSnapEngine;
  isAlignEnabled: () => boolean;
  buildAlignContext: () => SmartAlignSnapContext;
  syncAlignOverlay: () => void;
  getConstraints: () => TransformConstraints;
};

/**
 * Motor canónico de snap do Viewer (Z-01.2.3).
 *
 * Ordem obrigatória no translate de caixa (não alterar sem testes D-10):
 *   1. SmartAlign — alinhamento entre entidades
 *   2. TransformConstraints — chão, colisão, ModelWallSnap, limites da sala
 *
 * `SmartSnapping.applyDuringTranslate` **não** entra neste pipeline (overlay / `viewerApi.snapping`).
 * Remates/rodapés usam só o passo 1 (alinhamento); o passo 2 é exclusivo de caixas.
 */
export class SnapEngine {
  private readonly deps: SnapEngineDeps;

  constructor(deps: SnapEngineDeps) {
    this.deps = deps;
  }

  applyDuringTranslate(params: SnapAlignTarget): void {
    if (!this.deps.isAlignEnabled() || !this.deps.getAlignEngine().isEnabled()) return;
    this.deps.getAlignEngine().applyDuringTranslate({
      mesh: params.mesh,
      entity: params.entity,
      ctx: this.deps.buildAlignContext(),
      isDragging: params.isDragging,
      currentTool: params.currentTool,
    });
    this.deps.syncAlignOverlay();
  }

  /**
   * Pipeline de caixa: SmartAlign e, a seguir, TransformConstraints (ModelWallSnap incluído).
   */
  applyBoxTranslatePipeline(params: {
    align: SnapAlignTarget;
    clampCtx: ClampTransformContext;
  }): void {
    this.applyDuringTranslate(params.align);
    this.deps.getConstraints().clampTransform(params.clampCtx);
  }

  /** Único ponto de ModelWallSnap fora de TransformConstraints (grupos). */
  snapMeshToNearestMainWall(
    mesh: THREE.Object3D,
    mainWalls: THREE.Mesh[]
  ): ReturnType<typeof snapModelToNearestWall> {
    return snapModelToNearestWall(mesh, mainWalls);
  }
}
