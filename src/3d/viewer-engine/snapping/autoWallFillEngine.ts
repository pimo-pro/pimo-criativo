import type { AutoLayoutPlan } from "../autoLayout/autoLayoutTypes";
import {
  buildWallDef,
  computeEvenPlacementsAlongInterval,
  getFreeIntervalsOnWall,
  moduleWidthOnWall,
  pickLongestInterval,
  placementOnWall,
} from "../autoLayout/autoLayoutRoomGeometry";
import type { AutoWallFillOptions, SmartLayoutEngineDeps } from "./smartLayoutTypes";

/**
 * Auto-Wall-Fill 3D — adapter do LayoutEngine (smartLayout).
 * Preenche parede com gaps iguais; preview opcional via overlay.
 */
export class AutoWallFillEngine {
  private readonly deps: SmartLayoutEngineDeps;

  constructor(deps: SmartLayoutEngineDeps) {
    this.deps = deps;
  }

  buildPlan(options: AutoWallFillOptions): AutoLayoutPlan | null {
    const bridge = this.deps.getBridge();
    if (!bridge) return null;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return null;

    const wallNum =
      typeof options.wallId === "string" ? Number.parseInt(options.wallId, 10) : options.wallId;
    const wall = buildWallDef(wallNum, bounds, bridge.getWallOffsetMm());
    if (!wall) return null;

    const boxes = bridge.getWorkspaceBoxes();
    const module = boxes.find((b) => b.id === options.moduleBoxId);
    if (!module || module.locked) return null;

    const moduleW = moduleWidthOnWall(module, wall);
    const intervals = getFreeIntervalsOnWall(wall, bridge.getOpeningsMm(), moduleW);
    const interval = pickLongestInterval(intervals);
    if (!interval) return null;

    const span = interval.end - interval.start;
    const count = Math.max(1, Math.floor(span / moduleW));
    const centers = options.equalGaps !== false
      ? computeEvenPlacementsAlongInterval(interval.start, interval.end, moduleW, count)
      : computeEvenPlacementsAlongInterval(interval.start, interval.end, moduleW, count);

    const plan: AutoLayoutPlan = { cloneBoxes: [], moveBoxes: [], shelfUpdates: [] };
    centers.forEach((along, idx) => {
      const placement = placementOnWall(wall, along, module, bounds);
      if (options.alignTop) {
        placement.y_mm = bounds.minY_mm + module.dimensoes.altura / 2;
      }
      if (idx === 0) {
        plan.moveBoxes.push({ boxId: options.moduleBoxId, placement });
      } else {
        plan.cloneBoxes.push({ sourceId: options.moduleBoxId, placement });
      }
    });

    return plan;
  }

  fillWall(options: AutoWallFillOptions): boolean {
    const bridge = this.deps.getBridge();
    const plan = this.buildPlan(options);
    if (!bridge || !plan) return false;
    if (!plan.moveBoxes.length && !plan.cloneBoxes.length) return false;

    bridge.applyPlan(plan);
    this.refinePlanBoxes(plan, options.moduleBoxId);
    return true;
  }

  private refinePlanBoxes(plan: AutoLayoutPlan, seedBoxId: string): void {
    if (!this.deps.isSmartSnapEnabled()) return;
    const ids = new Set<string>([seedBoxId]);
    for (const m of plan.moveBoxes) ids.add(m.boxId);
    for (const c of plan.cloneBoxes) {
      void c;
    }
    for (const id of ids) {
      this.deps.refineBoxWithSmartSnap(id);
    }
  }
}
