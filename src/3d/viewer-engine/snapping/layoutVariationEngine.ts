import type { AutoLayoutPlan } from "../autoLayout/autoLayoutTypes";
import type {
  DesignVariantId,
  IntelligentDesign,
  LayoutVariation,
  SemanticRoomContext,
  VariationKind,
} from "./intelligentDesignerTypes";
import { getVariationRules } from "./rulesRuntime";

/**
 * Gera variações automáticas a partir de um design base.
 */
export class LayoutVariationEngine {
  generateVariations(
    base: IntelligentDesign,
    context: SemanticRoomContext
  ): LayoutVariation[] {
    void context;
    const kinds: VariationKind[] = [
      "moreFreeSpace",
      "moreStorage",
      "moreSymmetry",
      "moreDepth",
    ];
    return kinds.map((kind) => ({
      kind,
      label: variationLabel(kind),
      plan: mutatePlan(base.plan, kind, base.id),
      baseDesignId: base.id,
    }));
  }
}

function variationLabel(kind: VariationKind): string {
  switch (kind) {
    case "moreFreeSpace":
      return "Mais espaço livre";
    case "moreStorage":
      return "Mais armazenamento";
    case "moreSymmetry":
      return "Mais simetria";
    case "moreDepth":
      return "Mais profundidade";
  }
}

function mutatePlan(
  plan: AutoLayoutPlan,
  kind: VariationKind,
  baseId: DesignVariantId
): AutoLayoutPlan {
  const out: AutoLayoutPlan = {
    cloneBoxes: plan.cloneBoxes.map((c) => ({
      sourceId: c.sourceId,
      placement: { ...c.placement },
    })),
    moveBoxes: plan.moveBoxes.map((m) => ({
      boxId: m.boxId,
      placement: { ...m.placement },
    })),
    shelfUpdates: plan.shelfUpdates.map((s) => ({ ...s })),
  };

  switch (kind) {
    case "moreFreeSpace":
      if (out.cloneBoxes.length > 0) out.cloneBoxes.pop();
      spreadPlacements(out, getVariationRules().moreFreeSpaceSpread);
      break;
    case "moreStorage":
      if (out.cloneBoxes.length > 0) {
        const last = out.cloneBoxes[out.cloneBoxes.length - 1]!;
        out.cloneBoxes.push({ sourceId: last.sourceId, placement: { ...last.placement } });
      }
      break;
    case "moreSymmetry":
      mirrorPlacementsAroundCenter(out);
      break;
    case "moreDepth": {
      const nudge = getVariationRules().moreDepthNudgeMm;
      for (const m of out.moveBoxes) nudgeTowardRoomCenter(m.placement, nudge);
      for (const c of out.cloneBoxes) nudgeTowardRoomCenter(c.placement, nudge);
      break;
    }
  }

  void baseId;
  return out;
}

function spreadPlacements(plan: AutoLayoutPlan, factor: number): void {
  if (plan.moveBoxes.length < 2) return;
  const axis = dominantAxis(plan);
  const centers = plan.moveBoxes.map((m) => m.placement[axis]);
  const mid = centers.reduce((a, b) => a + b, 0) / centers.length;
  for (const m of plan.moveBoxes) {
    const delta = (m.placement[axis] - mid) * (factor - 1);
    m.placement[axis] += delta;
  }
  for (const c of plan.cloneBoxes) {
    const delta = (c.placement[axis] - mid) * (factor - 1);
    c.placement[axis] += delta;
  }
}

function mirrorPlacementsAroundCenter(plan: AutoLayoutPlan): void {
  const axis = dominantAxis(plan);
  const all = [...plan.moveBoxes.map((m) => m.placement), ...plan.cloneBoxes.map((c) => c.placement)];
  if (!all.length) return;
  const mid =
    all.reduce((s, p) => s + p[axis], 0) / all.length;
  for (const p of all) {
    p[axis] = mid + (mid - p[axis]);
  }
}

function nudgeTowardRoomCenter(
  placement: { x_mm: number; y_mm: number; z_mm: number },
  mm: number
): void {
  placement.z_mm += mm * 0.5;
}

function dominantAxis(plan: AutoLayoutPlan): "x_mm" | "z_mm" {
  const xs = plan.moveBoxes.map((m) => m.placement.x_mm);
  const zs = plan.moveBoxes.map((m) => m.placement.z_mm);
  const spreadX = Math.max(...xs, 0) - Math.min(...xs, 0);
  const spreadZ = Math.max(...zs, 0) - Math.min(...zs, 0);
  return spreadX >= spreadZ ? "x_mm" : "z_mm";
}
