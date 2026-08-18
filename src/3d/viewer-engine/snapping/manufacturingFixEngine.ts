import type { AutoLayoutPlan, AutoLayoutPlacement } from "../autoLayout/autoLayoutTypes";
import type { WorkspaceBox } from "../../../core/types";
import type { ManufacturingFixKind, ManufacturingFixPlan, ManufacturingScanResult } from "./manufacturingTypes";
import { getManufacturingRules } from "./rulesRuntime";

export type ManufacturingFixDeps = {
  getBoxes: () => WorkspaceBox[];
  applyPlan: (plan: AutoLayoutPlan) => void;
  refinePlan?: (plan: AutoLayoutPlan) => void;
  distribute: (boxIds: string[]) => boolean;
  isSmartSnapEnabled: () => boolean;
};

function emptyPlan(): AutoLayoutPlan {
  return { cloneBoxes: [], moveBoxes: [], shelfUpdates: [] };
}

function mergePlans(target: AutoLayoutPlan, source: AutoLayoutPlan): void {
  const moveById = new Map(target.moveBoxes.map((m) => [m.boxId, m]));
  for (const m of source.moveBoxes) {
    moveById.set(m.boxId, m);
  }
  target.moveBoxes = [...moveById.values()];
  target.cloneBoxes.push(...source.cloneBoxes);
  target.shelfUpdates.push(...source.shelfUpdates);
}

function placementFor(box: WorkspaceBox): AutoLayoutPlacement {
  return {
    x_mm: box.posicaoX_mm,
    y_mm: box.posicaoY_mm ?? box.dimensoes.altura / 2,
    z_mm: box.posicaoZ_mm ?? 0,
  };
}

function boxDepthMm(box: WorkspaceBox): number {
  return Math.max(1, box.dimensoes?.profundidade ?? 600);
}

function boxCenterZ(box: WorkspaceBox): number {
  return box.posicaoZ_mm ?? 0;
}

function boxFrontZ(box: WorkspaceBox): number {
  return boxCenterZ(box) + boxDepthMm(box) / 2;
}

function boxBottomY(box: WorkspaceBox): number {
  const h = Math.max(1, box.dimensoes?.altura ?? 720);
  const cy = box.posicaoY_mm ?? h / 2;
  return cy - h / 2;
}

/**
 * Correções automáticas não industriais — Smart Align & Snap + heurísticas de layout.
 */
export class ManufacturingFixEngine {
  private readonly deps: ManufacturingFixDeps;
  private lastFixPlan: ManufacturingFixPlan | null = null;

  constructor(deps: ManufacturingFixDeps) {
    this.deps = deps;
  }

  getLastFixPlan(): ManufacturingFixPlan | null {
    return this.lastFixPlan;
  }

  buildAutoFixPlan(scan: ManufacturingScanResult): ManufacturingFixPlan | null {
    const boxes = this.deps.getBoxes().filter((b) => !b.locked);
    if (!boxes.length) return null;

    const plan = emptyPlan();
    const applied: ManufacturingFixKind[] = [];
    const resolved: string[] = [];

    const depthPlan = this.fixDepthMismatch(boxes);
    if (depthPlan.moveBoxes.length) {
      mergePlans(plan, depthPlan);
      applied.push("depthAlign");
    }

    const rodapePlan = this.fixRodapeContinuity(boxes);
    if (rodapePlan.moveBoxes.length) {
      mergePlans(plan, rodapePlan);
      applied.push("rodapeContinuity");
    }

    const rematePlan = this.fixRemateAlignment(boxes, scan);
    if (rematePlan.moveBoxes.length) {
      mergePlans(plan, rematePlan);
      applied.push("remateAlign");
    }

    const doorPlan = this.fixDoorClearance(boxes);
    if (doorPlan.moveBoxes.length) {
      mergePlans(plan, doorPlan);
      applied.push("doorClearance");
    }

    const drawerPlan = this.fixGavetaClearance(boxes);
    if (drawerPlan.moveBoxes.length) {
      mergePlans(plan, drawerPlan);
      applied.push("drawerClearance");
    }

    const wallPlan = this.fixWallClearance(boxes);
    if (wallPlan.moveBoxes.length) {
      mergePlans(plan, wallPlan);
      applied.push("wallClearance");
    }

    if (!plan.moveBoxes.length) {
      const distributeIds = boxes.map((b) => b.id);
      if (distributeIds.length >= 2) {
        applied.push("distributeFlush");
      }
    }

    for (const c of scan.conflicts) {
      if (c.suggestedFixId && applied.includes(c.suggestedFixId)) {
        resolved.push(c.id);
      }
    }

    if (!plan.moveBoxes.length && !applied.length) return null;

    const result: ManufacturingFixPlan = {
      label: "Correções Auto-Manufacturing AI",
      plan,
      appliedFixes: applied,
      resolvedConflictIds: resolved,
    };
    this.lastFixPlan = result;
    return result;
  }

  applyAutoFixes(scan: ManufacturingScanResult): boolean {
    const fixPlan = this.buildAutoFixPlan(scan);
    if (!fixPlan) {
      const boxIds = this.deps.getBoxes().filter((b) => !b.locked).map((b) => b.id);
      if (boxIds.length >= 2 && this.deps.distribute(boxIds)) {
        return true;
      }
      return false;
    }

    if (fixPlan.plan.moveBoxes.length) {
      this.deps.applyPlan(fixPlan.plan);
      if (this.deps.isSmartSnapEnabled()) {
        this.deps.refinePlan?.(fixPlan.plan);
      }
    } else {
      const boxIds = [...new Set(fixPlan.plan.moveBoxes.map((m) => m.boxId))];
      if (boxIds.length >= 2) this.deps.distribute(boxIds);
    }

    return true;
  }

  fixDepthMismatch(boxes?: WorkspaceBox[]): AutoLayoutPlan {
    const list = boxes ?? this.deps.getBoxes().filter((b) => !b.locked);
    const plan = emptyPlan();
    if (list.length < 2) return plan;

    const refFront = Math.max(...list.map(boxFrontZ));
    for (const box of list) {
      const currentFront = boxFrontZ(box);
      const delta = refFront - currentFront;
      if (Math.abs(delta) < 0.5) continue;
      const p = placementFor(box);
      p.z_mm += delta;
      plan.moveBoxes.push({ boxId: box.id, placement: p });
    }
    return plan;
  }

  fixRodapeContinuity(boxes?: WorkspaceBox[]): AutoLayoutPlan {
    const list = (boxes ?? this.deps.getBoxes()).filter((b) => !b.locked && b.cabinetType !== "upper");
    const plan = emptyPlan();
    if (!list.length) return plan;

    const targetBottom = Math.min(...list.map(boxBottomY));
    for (const box of list) {
      const bottom = boxBottomY(box);
      const deltaY = targetBottom - bottom;
      if (Math.abs(deltaY) < 0.5) continue;
      const p = placementFor(box);
      p.y_mm += deltaY;
      plan.moveBoxes.push({ boxId: box.id, placement: p });
    }
    return plan;
  }

  fixRemateAlignment(boxes?: WorkspaceBox[], scan?: ManufacturingScanResult): AutoLayoutPlan {
    const list = boxes ?? this.deps.getBoxes().filter((b) => !b.locked);
    const plan = emptyPlan();
    const misalignedIds = new Set(
      scan?.conflicts.filter((c) => c.kind === "remateMisaligned").flatMap((c) => c.boxIds) ?? []
    );
    if (!misalignedIds.size) return plan;

    const targets = list.filter((b) => misalignedIds.has(b.id));
    if (!targets.length) return plan;

    const refFront = Math.max(...list.map(boxFrontZ));
    for (const box of targets) {
      const delta = refFront - boxFrontZ(box);
      if (Math.abs(delta) < 0.5) continue;
      const p = placementFor(box);
      p.z_mm += delta;
      plan.moveBoxes.push({ boxId: box.id, placement: p });
    }
    return plan;
  }

  fixDoorClearance(boxes?: WorkspaceBox[]): AutoLayoutPlan {
    const list = (boxes ?? this.deps.getBoxes()).filter((b) => !b.locked);
    const plan = emptyPlan();
    const t = getManufacturingRules();
    const withDoors = list.filter((b) => b.portaTipo && b.portaTipo !== "sem_porta");
    const sorted = [...withDoors].sort((a, b) => a.posicaoX_mm - b.posicaoX_mm);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const prevW = Math.max(1, prev.dimensoes?.largura ?? 600);
      const currW = Math.max(1, curr.dimensoes?.largura ?? 600);
      const minCenterDist = (prevW + currW) / 2 + t.doorClearanceMinMm;
      const actual = curr.posicaoX_mm - prev.posicaoX_mm;
      if (actual >= minCenterDist) continue;
      const p = placementFor(curr);
      p.x_mm = prev.posicaoX_mm + minCenterDist;
      plan.moveBoxes.push({ boxId: curr.id, placement: p });
    }
    return plan;
  }

  fixGavetaClearance(boxes?: WorkspaceBox[]): AutoLayoutPlan {
    const list = (boxes ?? this.deps.getBoxes()).filter((b) => !b.locked);
    const plan = emptyPlan();
    const t = getManufacturingRules();
    const withDrawers = list.filter((b) => (b.gavetas ?? 0) > 0);

    for (const box of withDrawers) {
      const neighbors = list.filter(
        (o) =>
          o.id !== box.id &&
          Math.hypot(o.posicaoX_mm - box.posicaoX_mm, (o.posicaoZ_mm ?? 0) - boxCenterZ(box)) < 350
      );
      for (const other of neighbors) {
        const gap = Math.abs(boxFrontZ(box) - boxFrontZ(other));
        if (gap >= t.drawerClearanceMinMm) continue;
        const p = placementFor(box);
        p.z_mm += t.drawerClearanceMinMm - gap + 1;
        plan.moveBoxes.push({ boxId: box.id, placement: p });
        break;
      }
    }
    return plan;
  }

  fixWallClearance(_boxes?: WorkspaceBox[]): AutoLayoutPlan {
    const plan = emptyPlan();
    return plan;
  }
}
