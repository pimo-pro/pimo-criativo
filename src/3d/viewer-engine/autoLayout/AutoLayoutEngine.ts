import type {
  AutoLayoutBridge,
  AutoLayoutPlan,
  AutoStackShelvesOptions,
} from "./autoLayoutTypes";
import {
  boxCenterOnAxis,
  buildWallDef,
  computeEvenPlacementsAlongInterval,
  findNearestWallId,
  getFreeIntervalsOnWall,
  intervalContaining,
  moduleWidthOnWall,
  pickLongestInterval,
  placementOnWall,
} from "./autoLayoutRoomGeometry";

/**
 * Motor Auto-Layout 3D — adapter do LayoutEngine (menu Ferramentas).
 * Não é o auto-fill de projecto (Kitchen 3.0).
 */
export class AutoLayoutEngine {
  private bridge: AutoLayoutBridge | null = null;

  bindBridge(bridge: AutoLayoutBridge | null): void {
    this.bridge = bridge;
  }

  fillWallWithModule(wallId: string | number, moduleBoxId: string): boolean {
    const bridge = this.bridge;
    if (!bridge) return false;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return false;
    const wallNum = typeof wallId === "string" ? Number.parseInt(wallId, 10) : wallId;
    const wall = buildWallDef(wallNum, bounds, bridge.getWallOffsetMm());
    if (!wall) return false;

    const boxes = bridge.getWorkspaceBoxes();
    const module = boxes.find((b) => b.id === moduleBoxId);
    if (!module || module.locked) return false;

    const moduleW = moduleWidthOnWall(module, wall);
    const intervals = getFreeIntervalsOnWall(wall, bridge.getOpeningsMm(), moduleW);
    const interval = pickLongestInterval(intervals);
    if (!interval) return false;

    const span = interval.end - interval.start;
    const count = Math.max(1, Math.floor(span / moduleW));
    const centers = computeEvenPlacementsAlongInterval(interval.start, interval.end, moduleW, count);

    const plan: AutoLayoutPlan = {
      cloneBoxes: [],
      moveBoxes: [],
      shelfUpdates: [],
    };

    centers.forEach((along, idx) => {
      const placement = placementOnWall(wall, along, module, bounds);
      if (idx === 0) {
        plan.moveBoxes.push({ boxId: moduleBoxId, placement });
      } else {
        plan.cloneBoxes.push({ sourceId: moduleBoxId, placement });
      }
    });

    bridge.applyPlan(plan);
    return plan.moveBoxes.length + plan.cloneBoxes.length > 0;
  }

  extendAlongWallFromBox(boxId: string): boolean {
    const bridge = this.bridge;
    if (!bridge) return false;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return false;

    const boxes = bridge.getWorkspaceBoxes();
    const source = boxes.find((b) => b.id === boxId);
    if (!source || source.locked) return false;

    const wallOffset = bridge.getWallOffsetMm();
    const wallId = findNearestWallId(source, bounds, wallOffset);
    const wall = buildWallDef(wallId, bounds, wallOffset);
    if (!wall) return false;

    const moduleW = moduleWidthOnWall(source, wall);
    const intervals = getFreeIntervalsOnWall(wall, bridge.getOpeningsMm(), moduleW);
    const center = boxCenterOnAxis(source, wall.axis);
    const interval = intervalContaining(intervals, center, moduleW) ?? pickLongestInterval(intervals);
    if (!interval) return false;

    const span = interval.end - interval.start;
    const count = Math.max(1, Math.floor(span / moduleW));
    const centers = computeEvenPlacementsAlongInterval(interval.start, interval.end, moduleW, count);

    const plan: AutoLayoutPlan = { cloneBoxes: [], moveBoxes: [], shelfUpdates: [] };
    let usedSource = false;
    for (const along of centers) {
      const placement = placementOnWall(wall, along, source, bounds);
      if (!usedSource) {
        plan.moveBoxes.push({ boxId: source.id, placement });
        usedSource = true;
      } else {
        plan.cloneBoxes.push({ sourceId: source.id, placement });
      }
    }

    bridge.applyPlan(plan);
    return plan.moveBoxes.length + plan.cloneBoxes.length > 0;
  }

  distributeBoxesEvenly(boxIds: string[]): boolean {
    const bridge = this.bridge;
    if (!bridge || boxIds.length < 2) return false;

    const boxes = bridge.getWorkspaceBoxes().filter((b) => boxIds.includes(b.id) && !b.locked);
    if (boxes.length < 2) return false;

    const spreadX =
      Math.max(...boxes.map((b) => b.posicaoX_mm)) - Math.min(...boxes.map((b) => b.posicaoX_mm));
    const spreadZ =
      Math.max(...boxes.map((b) => b.posicaoZ_mm ?? 0)) -
      Math.min(...boxes.map((b) => b.posicaoZ_mm ?? 0));
    const axis: "x" | "z" = spreadX >= spreadZ ? "x" : "z";

    const sorted = [...boxes].sort((a, b) => boxCenterOnAxis(a, axis) - boxCenterOnAxis(b, axis));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const start = boxCenterOnAxis(first, axis);
    const end = boxCenterOnAxis(last, axis);
    const middle = sorted.slice(1, -1);

    const plan: AutoLayoutPlan = { cloneBoxes: [], moveBoxes: [], shelfUpdates: [] };
    if (middle.length === 0) {
      bridge.applyPlan(plan);
      return false;
    }

    const step = (end - start) / (sorted.length - 1);
    middle.forEach((box, idx) => {
      const target = start + step * (idx + 1);
      const placement: { x_mm: number; y_mm: number; z_mm: number } = {
        x_mm: box.posicaoX_mm,
        y_mm: box.posicaoY_mm ?? box.dimensoes.altura / 2,
        z_mm: box.posicaoZ_mm ?? 0,
      };
      if (axis === "x") placement.x_mm = target;
      else placement.z_mm = target;
      plan.moveBoxes.push({ boxId: box.id, placement });
    });

    bridge.applyPlan(plan);
    return plan.moveBoxes.length > 0;
  }

  autoStackShelvesInBox(boxId: string, options: AutoStackShelvesOptions): boolean {
    const bridge = this.bridge;
    if (!bridge) return false;
    const box = bridge.getWorkspaceBoxes().find((b) => b.id === boxId);
    if (!box || box.locked) return false;

    let count = Math.max(0, Math.floor(options.count));
    if (count <= 0) {
      const interior =
        box.dimensoes.altura - 2 * box.espessura - options.topMarginMm - options.bottomMarginMm;
      const spacing = Math.max(80, interior / 4);
      count = Math.max(1, Math.floor(interior / spacing));
    }

    const plan: AutoLayoutPlan = {
      cloneBoxes: [],
      moveBoxes: [],
      shelfUpdates: [{ boxId, count }],
    };
    bridge.applyPlan(plan);
    return true;
  }
}
