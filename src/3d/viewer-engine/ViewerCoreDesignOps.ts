import type { LayoutEngine } from "./layout/LayoutEngine";
import { buildPredictiveLayoutResult } from "./snapping/predictiveLayoutEngine";
import type { IntelligentDesignerEngine } from "./snapping/intelligentDesignerEngine";
import type { DesignVariantId, EnvironmentStyleId } from "./snapping/intelligentDesignerTypes";
import { isEnvironmentStyleId } from "./snapping/styleProfileEngine";
import {
  ConversationalDesignerEngine,
  type ConversationalDesignerDeps,
} from "./snapping/conversationalDesignerEngine";
import type { DesignConversationState } from "./snapping/designConversationState";
import type { ManufacturingReportEngine } from "./snapping/manufacturingReportEngine";
import type { ManufacturingScanContext } from "./snapping/manufacturingTypes";
import type { CostReportEngine } from "./snapping/costReportEngine";
import type { CostScanContext, CostSuggestion } from "./snapping/costTypes";
import type { SmartLayoutBridge } from "./snapping/smartLayoutTypes";
import type { RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import type { RodapeVisualBridge } from "./rodape/RodapeVisualizer";
import type { SmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
import type { SmartSnapping } from "./snapping/SmartSnapping";

export type ViewerCoreDesignOpsDeps = {
  layoutEngine: LayoutEngine;
  smartAlignOverlay: SmartAlignOverlayFacade;
  designConversationState: DesignConversationState;
  smartLayoutBridge: SmartLayoutBridge | null;
  getRemateVisualBridge: () => RematePieceVisualBridge | null;
  getRodapeVisualBridge: () => RodapeVisualBridge | null;
  smartSnappingEngine: SmartSnapping;
  getConversationalDesignerEngine: () => ConversationalDesignerEngine | null;
  setConversationalDesignerEngine: (engine: ConversationalDesignerEngine) => void;
  ensureIntelligentDesigner: () => IntelligentDesignerEngine;
  ensureManufacturingReportEngine: () => ManufacturingReportEngine;
  ensureCostReportEngine: () => CostReportEngine;
  clearSmartAlignSnapOverlay: () => void;
  previewSmartWallFill: (wallId: string | number, moduleBoxId: string) => boolean;
};

export function ensureConversationalDesignerEngineImpl(
  deps: ViewerCoreDesignOpsDeps
): ConversationalDesignerEngine {
  const conversationalDeps: ConversationalDesignerDeps = {
    designer: deps.ensureIntelligentDesigner(),
    conversation: deps.designConversationState,
    previewPlan: (plan, label, previewId) => {
      const { overlay } = buildPredictiveLayoutResult(deps.layoutEngine.predictive, plan, label);
      deps.layoutEngine.predictive.previewDesigns([{ id: previewId, plan, label }]);
      deps.smartAlignOverlay.setState(overlay);
    },
    applyPlan: (plan, meta) => {
      const ok = deps.ensureIntelligentDesigner().applyPlanDirect(plan, {
        designId: meta.designId,
        variationKind: meta.variationKind,
      });
      if (ok) {
        deps.designConversationState.recordApplied({
          plan,
          label: meta.label,
          designId: meta.designId,
          variationKind: meta.variationKind,
        });
        deps.clearSmartAlignSnapOverlay();
      }
      return ok;
    },
    acceptPending: () => acceptConversationalPendingImpl(deps),
    rejectPending: () => {
      deps.layoutEngine.predictive.rejectPending();
      deps.designConversationState.clearPending();
      deps.clearSmartAlignSnapOverlay();
    },
    optimizeWallPreview: (wallId, seedBoxId) => deps.previewSmartWallFill(wallId, seedBoxId),
    getManufacturingReport: () => deps.ensureManufacturingReportEngine().generateReport(),
    previewManufacturingFixes: () => previewManufacturingFixesImpl(deps),
    applyManufacturingFixes: () => {
      const result = deps.ensureManufacturingReportEngine().autoFix();
      return { ok: result.ok, message: result.message };
    },
    getCostReport: (seedBoxId) => {
      deps.designConversationState.setSeedBoxId(seedBoxId);
      return deps.ensureCostReportEngine().generateCostReport();
    },
    previewCostSuggestion: (suggestion) => previewCostSuggestionImpl(deps, suggestion),
    buildCostSuggestion: (tier, seedBoxId, reducePercent) => {
      deps.designConversationState.setSeedBoxId(seedBoxId);
      deps.ensureCostReportEngine().scanProject();
      if (tier === "cheaper") {
        return reducePercent != null
          ? deps.ensureCostReportEngine().suggestReduceCostPercent(reducePercent)
          : deps.ensureCostReportEngine().suggestCheaperAlternative();
      }
      if (tier === "premium") return deps.ensureCostReportEngine().suggestPremiumAlternative();
      return deps.ensureCostReportEngine().suggestBalancedAlternative();
    },
  };

  const engine = ConversationalDesignerEngine.ensure(
    deps.getConversationalDesignerEngine(),
    conversationalDeps
  );
  deps.setConversationalDesignerEngine(engine);
  return engine;
}

export function generateIntelligentDesignsImpl(
  deps: ViewerCoreDesignOpsDeps,
  seedBoxId: string
): boolean {
  const designs = deps.ensureIntelligentDesigner().buildDesigns(seedBoxId);
  if (!designs.length) return false;
  const overlays = deps.layoutEngine.predictive.previewDesigns(
    designs.map((d) => ({ id: d.id, plan: d.plan, label: d.label }))
  );
  if (overlays[0]) {
    deps.smartAlignOverlay.setState(
      deps.layoutEngine.predictive.showDesignPreview(0) ?? {
        visible: false,
        mode: "predictive",
        guides: [],
      }
    );
  }
  return true;
}

export function previewIntelligentDesignImpl(
  deps: ViewerCoreDesignOpsDeps,
  id: DesignVariantId
): boolean {
  const state = deps.layoutEngine.predictive.showDesignById(id);
  if (!state) return false;
  deps.smartAlignOverlay.setState(state);
  return true;
}

export function applyIntelligentDesignImpl(
  deps: ViewerCoreDesignOpsDeps,
  id: DesignVariantId
): boolean {
  const ok = deps.ensureIntelligentDesigner().applyDesign(id);
  if (ok) deps.clearSmartAlignSnapOverlay();
  return ok;
}

export function acceptPredictiveLayoutPendingImpl(deps: ViewerCoreDesignOpsDeps): boolean {
  const pending = deps.layoutEngine.predictive.getPending();
  if (!pending) return false;
  const previews = deps.layoutEngine.predictive.getDesignPreviews();
  const activeEntry = previews[deps.layoutEngine.predictive.getActiveDesignIndex()];
  const ok = deps.layoutEngine.predictive.applyPending();
  if (ok) {
    if (activeEntry && isEnvironmentStyleId(activeEntry.id)) {
      deps.ensureIntelligentDesigner().getBehaviorStore().learnStylePreference(activeEntry.id);
    }
    deps.clearSmartAlignSnapOverlay();
  }
  return ok;
}

export function acceptConversationalPendingImpl(deps: ViewerCoreDesignOpsDeps): boolean {
  const pending = deps.layoutEngine.predictive.getPending();
  if (!pending) return false;
  const ok = acceptPredictiveLayoutPendingImpl(deps);
  if (ok) {
    deps.designConversationState.recordApplied({
      plan: pending.plan,
      label: pending.label,
    });
  }
  return ok;
}

export function previewIntelligentStyleImpl(
  deps: ViewerCoreDesignOpsDeps,
  styleId: EnvironmentStyleId,
  seedBoxId: string
): boolean {
  const result = deps.ensureIntelligentDesigner().buildStyleDesign(styleId, seedBoxId);
  if (!result) return false;
  const { overlay } = buildPredictiveLayoutResult(
    deps.layoutEngine.predictive,
    result.plan,
    result.label
  );
  deps.layoutEngine.predictive.previewDesigns([
    { id: styleId, plan: result.plan, label: result.label },
  ]);
  deps.smartAlignOverlay.setState(overlay);
  return true;
}

export function applyIntelligentStyleImpl(
  deps: ViewerCoreDesignOpsDeps,
  styleId: EnvironmentStyleId,
  seedBoxId: string
): boolean {
  const ok = deps.ensureIntelligentDesigner().applyStyle(styleId, seedBoxId);
  if (ok) deps.clearSmartAlignSnapOverlay();
  return ok;
}

export function resolveCostSeedBoxIdImpl(deps: ViewerCoreDesignOpsDeps): string {
  return (
    deps.designConversationState.getSeedBoxId() ??
    deps.smartLayoutBridge?.getWorkspaceBoxes().find((b) => !b.locked)?.id ??
    ""
  );
}

export function buildManufacturingScanContextImpl(
  deps: ViewerCoreDesignOpsDeps
): ManufacturingScanContext {
  const bridge = deps.smartLayoutBridge;
  const rodapeConfigs = deps.getRodapeVisualBridge()?.listBoxRodapeConfigs() ?? [];
  const rodapes = rodapeConfigs.flatMap((cfg) => cfg.rodapes);
  return {
    boxes: bridge?.getWorkspaceBoxes() ?? [],
    remates: deps.getRemateVisualBridge()?.listRematePieces() ?? [],
    rodapes,
    bounds: bridge?.getRoomBoundsMm() ?? null,
    openings: bridge?.getOpeningsMm() ?? [],
    wallOffsetMm: bridge?.getWallOffsetMm() ?? deps.smartSnappingEngine.getWallOffset(),
  };
}

export function buildCostScanContextImpl(deps: ViewerCoreDesignOpsDeps): CostScanContext {
  const ctx = buildManufacturingScanContextImpl(deps);
  return {
    boxes: ctx.boxes,
    remates: ctx.remates,
    rodapes: ctx.rodapes,
    bounds: ctx.bounds,
    openings: ctx.openings,
    wallOffsetMm: ctx.wallOffsetMm,
  };
}

export function previewCostSuggestionImpl(
  deps: ViewerCoreDesignOpsDeps,
  suggestion: CostSuggestion
): void {
  const { overlay } = buildPredictiveLayoutResult(
    deps.layoutEngine.predictive,
    suggestion.plan,
    suggestion.label
  );
  deps.layoutEngine.predictive.previewDesigns([
    { id: `cost-${suggestion.kind}`, plan: suggestion.plan, label: suggestion.label },
  ]);
  deps.smartAlignOverlay.setState(overlay);
}

export function previewCostSuggestionByTierImpl(
  deps: ViewerCoreDesignOpsDeps,
  seedBoxId: string,
  tier: "cheaper" | "premium" | "balanced"
): boolean {
  deps.designConversationState.setSeedBoxId(seedBoxId);
  deps.ensureCostReportEngine().scanProject();
  const suggestion =
    tier === "cheaper"
      ? deps.ensureCostReportEngine().suggestCheaperAlternative()
      : tier === "premium"
        ? deps.ensureCostReportEngine().suggestPremiumAlternative()
        : deps.ensureCostReportEngine().suggestBalancedAlternative();
  if (!suggestion) return false;
  previewCostSuggestionImpl(deps, suggestion);
  return true;
}

export function previewManufacturingFixesImpl(deps: ViewerCoreDesignOpsDeps): boolean {
  const fixPlan = deps.ensureManufacturingReportEngine().buildFixPreview();
  if (!fixPlan || !fixPlan.plan.moveBoxes.length) return false;
  const { overlay } = buildPredictiveLayoutResult(
    deps.layoutEngine.predictive,
    fixPlan.plan,
    fixPlan.label
  );
  deps.layoutEngine.predictive.previewDesigns([
    { id: "manufacturing-fix", plan: fixPlan.plan, label: fixPlan.label },
  ]);
  deps.smartAlignOverlay.setState(overlay);
  return true;
}

export function applyManufacturingSuggestedFixesImpl(deps: ViewerCoreDesignOpsDeps): boolean {
  const pending = deps.layoutEngine.predictive.getPending();
  if (pending?.label.includes("Auto-Manufacturing")) {
    return acceptPredictiveLayoutPendingImpl(deps);
  }
  const result = deps.ensureManufacturingReportEngine().autoFix();
  return result.ok;
}

export function generateIntelligentVariationsImpl(deps: ViewerCoreDesignOpsDeps): boolean {
  const variations = deps.ensureIntelligentDesigner().generateVariations();
  if (!variations.length) return false;
  const overlays = deps.layoutEngine.predictive.previewDesigns(
    variations.map((v, i) => ({
      id: `V${i + 1}`,
      plan: v.plan,
      label: v.label,
    }))
  );
  if (overlays[0]) {
    deps.smartAlignOverlay.setState(
      deps.layoutEngine.predictive.showDesignPreview(0) ?? {
        visible: false,
        mode: "predictive",
        guides: [],
      }
    );
  }
  return true;
}
