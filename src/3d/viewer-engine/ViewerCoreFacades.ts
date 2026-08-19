import type { AutoStackShelvesOptions } from "./autoLayout/autoLayoutTypes";
import type { LayoutEngine } from "./layout/LayoutEngine";
import type { DesignVariantId, EnvironmentStyleId } from "./snapping/intelligentDesignerTypes";
import type { IntelligentDesignerEngine } from "./snapping/intelligentDesignerEngine";
import type { ConversationalDesignerEngine } from "./snapping/conversationalDesignerEngine";
import type {
  ConversationEntry,
  DesignConversationState,
} from "./snapping/designConversationState";
import type { ConversationTurnResult } from "./snapping/conversationalDesignerEngine";
import { listStyleProfiles } from "./snapping/styleProfileEngine";
import type { ManufacturingReportEngine } from "./snapping/manufacturingReportEngine";
import type { ManufacturingFullReport, ManufacturingUiReport } from "./snapping/manufacturingTypes";
import type { CostReportEngine } from "./snapping/costReportEngine";
import type { CostChangeInput, CostFullReport, CostUiSummary } from "./snapping/costTypes";

export type ViewerCoreAutoLayoutFacade = {
  fillWallWithModule: (_wallId: string | number, _moduleBoxId: string) => boolean;
  extendAlongWallFromBox: (_boxId: string) => boolean;
  distributeBoxesEvenly: (_boxIds: string[]) => boolean;
  autoStackShelvesInBox: (_boxId: string, _options: AutoStackShelvesOptions) => boolean;
};

export type ViewerCoreSmartLayoutFacade = {
  autoWallFill: (_wallId: string | number, _moduleBoxId: string) => boolean;
  previewAutoWallFill: (_wallId: string | number, _moduleBoxId: string) => boolean;
  autoRoomFill: (_seedBoxId?: string) => boolean;
  autoDistribute: (_boxIds: string[]) => boolean;
  autoStackShelves: (_boxId: string, _options: AutoStackShelvesOptions) => boolean;
  applyPredictiveLayout: () => boolean;
  rejectPredictiveLayout: () => void;
  hasPredictiveLayout: () => boolean;
};

export type ViewerCoreIntelligentDesignerFacade = {
  generateDesigns: (_seedBoxId: string) => boolean;
  generateVariations: () => boolean;
  previewDesign: (_id: DesignVariantId) => boolean;
  applyDesign: (_id: DesignVariantId) => boolean;
  refineLayout: () => boolean;
  learnPreferences: () => string;
  explainDecision: (_id?: DesignVariantId) => string;
  previewStyle: (_styleId: EnvironmentStyleId, _seedBoxId: string) => boolean;
  applyStyle: (_styleId: EnvironmentStyleId, _seedBoxId: string) => boolean;
  explainStyle: (_styleId?: EnvironmentStyleId) => string;
  listStyles: () => Array<{ id: EnvironmentStyleId; label: string }>;
};

export type ViewerCoreConversationalDesignerFacade = {
  sendMessage: (_text: string, _seedBoxId: string) => ConversationTurnResult;
  quickAction: (
    _action: "moreSpace" | "moreSymmetry" | "minimal" | "optimizeWall" | "variations",
    _seedBoxId: string
  ) => ConversationTurnResult;
  getHistory: () => ConversationEntry[];
  explain: () => string;
};

export type ViewerCoreManufacturingFacade = {
  generateReport: () => ManufacturingFullReport;
  getReport: () => ManufacturingUiReport;
  autoFix: () => { ok: boolean; message: string; score: number };
  score: () => number;
  previewFixes: () => boolean;
  applySuggestedFixes: () => boolean;
};

export type ViewerCoreCostEstimatorFacade = {
  generateCostReport: (_seedBoxId?: string) => CostFullReport;
  summarizeForUI: (_seedBoxId?: string) => CostUiSummary;
  score: () => number;
  compareDesigns: (
    _seedBoxId: string
  ) => import("./snapping/costTypes").CostDesignComparison;
  compareStyles: () => import("./snapping/costTypes").CostStyleComparison;
  estimateChangeImpact: (
    _change: CostChangeInput
  ) => import("./snapping/costTypes").CostImpactEstimate;
  suggestCheaper: (_seedBoxId: string) => boolean;
  suggestPremium: (_seedBoxId: string) => boolean;
  suggestBalanced: (_seedBoxId: string) => boolean;
};

export type ViewerCoreFacades = {
  autoLayout: ViewerCoreAutoLayoutFacade;
  smartLayout: ViewerCoreSmartLayoutFacade;
  intelligentDesigner: ViewerCoreIntelligentDesignerFacade;
  conversationalDesigner: ViewerCoreConversationalDesignerFacade;
  manufacturing: ViewerCoreManufacturingFacade;
  costEstimator: ViewerCoreCostEstimatorFacade;
};

export type ViewerCoreFacadesDeps = {
  layoutEngine: LayoutEngine;
  designConversationState: DesignConversationState;

  previewSmartWallFill: (_wallId: string | number, _moduleBoxId: string) => boolean;
  acceptPredictiveLayoutPending: () => boolean;
  clearSmartAlignSnapOverlay: () => void;

  ensureIntelligentDesigner: () => IntelligentDesignerEngine;
  generateIntelligentDesigns: (_seedBoxId: string) => boolean;
  generateIntelligentVariations: () => boolean;
  previewIntelligentDesign: (_id: DesignVariantId) => boolean;
  applyIntelligentDesign: (_id: DesignVariantId) => boolean;
  previewIntelligentStyle: (_styleId: EnvironmentStyleId, _seedBoxId: string) => boolean;
  applyIntelligentStyle: (_styleId: EnvironmentStyleId, _seedBoxId: string) => boolean;

  ensureConversationalDesignerEngine: () => ConversationalDesignerEngine;

  ensureManufacturingReportEngine: () => ManufacturingReportEngine;
  previewManufacturingFixes: () => boolean;
  applyManufacturingSuggestedFixes: () => boolean;

  ensureCostReportEngine: () => CostReportEngine;
  previewCostSuggestionByTier: (_seedBoxId: string, _tier: "cheaper" | "premium" | "balanced") => boolean;
};

export function createViewerCoreFacades(deps: ViewerCoreFacadesDeps): ViewerCoreFacades {
  const autoLayout: ViewerCoreAutoLayoutFacade = {
    fillWallWithModule: (wallId, moduleBoxId) => deps.layoutEngine.fillWallWithModule(wallId, moduleBoxId),
    extendAlongWallFromBox: (boxId) => deps.layoutEngine.extendAlongWallFromBox(boxId),
    distributeBoxesEvenly: (boxIds) => deps.layoutEngine.distributeBoxesEvenly(boxIds),
    autoStackShelvesInBox: (boxId, options) => deps.layoutEngine.autoStackShelvesInBox(boxId, options),
  };

  const smartLayout: ViewerCoreSmartLayoutFacade = {
    autoWallFill: (wallId, moduleBoxId) => deps.layoutEngine.autoWallFill(wallId, moduleBoxId),
    previewAutoWallFill: (wallId, moduleBoxId) => deps.previewSmartWallFill(wallId, moduleBoxId),
    autoRoomFill: (seedBoxId) => deps.layoutEngine.autoRoomFill(seedBoxId),
    autoDistribute: (boxIds) => deps.layoutEngine.autoDistribute(boxIds),
    autoStackShelves: (boxId, options) => deps.layoutEngine.autoStackShelves(boxId, options),
    applyPredictiveLayout: () => deps.acceptPredictiveLayoutPending(),
    rejectPredictiveLayout: () => {
      deps.layoutEngine.predictive.rejectPending();
      deps.clearSmartAlignSnapOverlay();
    },
    hasPredictiveLayout: () => deps.layoutEngine.predictive.getPending() !== null,
  };

  const intelligentDesigner: ViewerCoreIntelligentDesignerFacade = {
    generateDesigns: (seedBoxId) => deps.generateIntelligentDesigns(seedBoxId),
    generateVariations: () => deps.generateIntelligentVariations(),
    previewDesign: (id) => deps.previewIntelligentDesign(id),
    applyDesign: (id) => deps.applyIntelligentDesign(id),
    refineLayout: () => deps.ensureIntelligentDesigner().refineLastLayout(),
    learnPreferences: () => deps.ensureIntelligentDesigner().learnPreferencesSummary(),
    explainDecision: (id) => deps.ensureIntelligentDesigner().explainDecision(id),
    previewStyle: (styleId, seedBoxId) => deps.previewIntelligentStyle(styleId, seedBoxId),
    applyStyle: (styleId, seedBoxId) => deps.applyIntelligentStyle(styleId, seedBoxId),
    explainStyle: (styleId) => deps.ensureIntelligentDesigner().explainStyle(styleId),
    listStyles: () => listStyleProfiles().map((p) => ({ id: p.id, label: p.label })),
  };

  const conversationalDesigner: ViewerCoreConversationalDesignerFacade = {
    sendMessage: (text, seedBoxId) => deps.ensureConversationalDesignerEngine().processInput(text, seedBoxId),
    quickAction: (action, seedBoxId) => deps.ensureConversationalDesignerEngine().processQuickAction(action, seedBoxId),
    getHistory: () => deps.designConversationState.getHistory(),
    explain: () => {
      const engine = deps.ensureIntelligentDesigner();
      return engine.explainDecision(engine.getLastAppliedDesignId() ?? undefined);
    },
  };

  const manufacturing: ViewerCoreManufacturingFacade = {
    generateReport: () => deps.ensureManufacturingReportEngine().generateReport(),
    getReport: () => deps.ensureManufacturingReportEngine().getUiReport(),
    score: () => deps.ensureManufacturingReportEngine().score(),
    autoFix: () => {
      const result = deps.ensureManufacturingReportEngine().autoFix();
      return { ok: result.ok, message: result.message, score: result.scan.score };
    },
    previewFixes: () => deps.previewManufacturingFixes(),
    applySuggestedFixes: () => deps.applyManufacturingSuggestedFixes(),
  };

  const costEstimator: ViewerCoreCostEstimatorFacade = {
    generateCostReport: (seedBoxId) => {
      if (seedBoxId) deps.designConversationState.setSeedBoxId(seedBoxId);
      return deps.ensureCostReportEngine().generateCostReport();
    },
    summarizeForUI: (seedBoxId) => {
      if (seedBoxId) deps.designConversationState.setSeedBoxId(seedBoxId);
      return deps.ensureCostReportEngine().summarizeCostForUI();
    },
    score: () => deps.ensureCostReportEngine().score(),
    compareDesigns: (seedBoxId) => {
      deps.designConversationState.setSeedBoxId(seedBoxId);
      return deps.ensureCostReportEngine().compareDesignsCost(seedBoxId);
    },
    compareStyles: () => deps.ensureCostReportEngine().compareStylesCost(),
    estimateChangeImpact: (change) => deps.ensureCostReportEngine().estimateChangeImpact(change),
    suggestCheaper: (seedBoxId) => deps.previewCostSuggestionByTier(seedBoxId, "cheaper"),
    suggestPremium: (seedBoxId) => deps.previewCostSuggestionByTier(seedBoxId, "premium"),
    suggestBalanced: (seedBoxId) => deps.previewCostSuggestionByTier(seedBoxId, "balanced"),
  };

  return { autoLayout, smartLayout, intelligentDesigner, conversationalDesigner, manufacturing, costEstimator };
}

