import type { AutoLayoutPlan } from "../autoLayout/autoLayoutTypes";
import { findNearestWallId } from "../autoLayout/autoLayoutRoomGeometry";
import { AutoWallFillEngine } from "./autoWallFillEngine";
import type { SmartLayoutEngineDeps } from "./smartLayoutTypes";

/**
 * Auto-Room-Fill 3D — adapter do LayoutEngine.
 * Delega ao Kitchen 3.0 (`runProjectRoomFill`) quando o bridge de projecto está ligado.
 */
export class AutoRoomFillEngine {
  private readonly deps: SmartLayoutEngineDeps;
  private readonly wallFill: AutoWallFillEngine;

  constructor(deps: SmartLayoutEngineDeps) {
    this.deps = deps;
    this.wallFill = new AutoWallFillEngine(deps);
  }

  /**
   * Preenchimento completo: usa `runProjectRoomFill` (Kitchen Layout 3.0) quando disponível,
   * senão preenche as 4 paredes com o módulo mais próximo de cada parede.
   */
  fillRoom(seedBoxId?: string): boolean {
    const bridge = this.deps.getBridge();
    if (!bridge) return false;

    if (bridge.runProjectRoomFill?.()) {
      return true;
    }

    return this.fillRoomWithModuleOnAllWalls(seedBoxId);
  }

  private fillRoomWithModuleOnAllWalls(seedBoxId?: string): boolean {
    const bridge = this.deps.getBridge();
    if (!bridge) return false;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return false;

    const boxes = bridge.getWorkspaceBoxes().filter((b) => !b.locked);
    if (!boxes.length) return false;

    let moduleId = seedBoxId;
    if (!moduleId) {
      const unlocked = boxes[0]!;
      moduleId = unlocked.id;
    }

    const module = boxes.find((b) => b.id === moduleId);
    if (!module) return false;

    const wallOffset = bridge.getWallOffsetMm();
    const primaryWall = findNearestWallId(module, bounds, wallOffset);

    const merged: AutoLayoutPlan = { cloneBoxes: [], moveBoxes: [], shelfUpdates: [] };
    let applied = false;

    for (const wallId of [primaryWall, 0, 1, 2, 3]) {
      const plan = this.wallFill.buildPlan({
        wallId,
        moduleBoxId: moduleId,
        alignTop: true,
        alignFront: true,
        equalGaps: true,
      });
      if (!plan) continue;
      if (wallId === primaryWall) {
        merged.moveBoxes.push(...plan.moveBoxes);
      }
      merged.cloneBoxes.push(...plan.cloneBoxes);
      applied = true;
    }

    if (!applied) return false;
    bridge.applyPlan(merged);
    if (this.deps.isSmartSnapEnabled()) {
      this.deps.refineBoxWithSmartSnap(moduleId);
    }
    return true;
  }
}
