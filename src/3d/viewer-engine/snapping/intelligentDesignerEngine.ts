import type { AutoLayoutPlan } from "../autoLayout/autoLayoutTypes";
import {
  buildWallDef,
  computeEvenPlacementsAlongInterval,
  findNearestWallId,
  getFreeIntervalsOnWall,
  moduleWidthOnWall,
  pickLongestInterval,
  placementOnWall,
} from "../autoLayout/autoLayoutRoomGeometry";
import { DesignerBehaviorStore } from "./designerBehaviorStore";
import { LayoutVariationEngine } from "./layoutVariationEngine";
import { analyzeSemanticRoom } from "./semanticRoomAnalyzer";
import type { SmartLayoutBridge } from "./smartLayoutTypes";
import {
  type DesignProfile,
  type DesignVariantId,
  type EnvironmentStyleId,
  type IntelligentDesign,
  type LayoutVariation,
  type SemanticRoomContext,
} from "./intelligentDesignerTypes";
import { buildStylePlan, getStyleProfile, type StylePlanResult } from "./styleProfileEngine";
import { getErgonomicsRules } from "./rulesRuntime";
import { formatMaterialHintForUi } from "./styleMaterialHints";

export type IntelligentDesignerDeps = {
  getBridge: () => SmartLayoutBridge | null;
  getRoomLabelHint?: () => string | undefined;
  refinePlan?: (plan: AutoLayoutPlan) => void;
};

const PROFILE_BY_ID: Record<DesignVariantId, DesignProfile> = {
  A: "functional",
  B: "minimal",
  C: "spaceOptimized",
};

const LABELS: Record<DesignVariantId, { title: string; desc: string }> = {
  A: {
    title: "Design A — Funcional",
    desc: "Fluxo de trabalho, triângulo ergonómico, alturas padrão",
  },
  B: {
    title: "Design B — Minimalista",
    desc: "Menos módulos, mais espaço livre e circulação",
  },
  C: {
    title: "Design C — Otimizado por espaço",
    desc: "Máximo armazenamento na parede principal",
  },
};

/**
 * Intelligent Designer 3.0 — geração de layouts A/B/C com ergonomia e aprendizagem.
 */
export class IntelligentDesignerEngine {
  private readonly deps: IntelligentDesignerDeps;
  private readonly behavior = new DesignerBehaviorStore();
  private readonly variations = new LayoutVariationEngine();
  private designs: IntelligentDesign[] = [];
  private variationList: LayoutVariation[] = [];
  private lastContext: SemanticRoomContext | null = null;
  private lastAppliedDesignId: DesignVariantId | null = null;
  private lastStyleId: EnvironmentStyleId | null = null;
  private readonly planHistory: AutoLayoutPlan[] = [];
  private readonly stylePlans = new Map<EnvironmentStyleId, StylePlanResult>();

  constructor(deps: IntelligentDesignerDeps) {
    this.deps = deps;
  }

  getBehaviorStore(): DesignerBehaviorStore {
    return this.behavior;
  }

  getDesigns(): IntelligentDesign[] {
    return this.designs;
  }

  getVariations(): LayoutVariation[] {
    return this.variationList;
  }

  getDesignById(id: DesignVariantId): IntelligentDesign | undefined {
    return this.designs.find((d) => d.id === id);
  }

  getLastAppliedDesignId(): DesignVariantId | null {
    return this.lastAppliedDesignId;
  }

  getLastContext(): SemanticRoomContext | null {
    return this.lastContext;
  }

  analyzeContext(): SemanticRoomContext | null {
    const bridge = this.deps.getBridge();
    if (!bridge) return null;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return null;
    const ctx = analyzeSemanticRoom({
      bounds,
      openings: bridge.getOpeningsMm(),
      boxes: bridge.getWorkspaceBoxes(),
      wallOffsetMm: bridge.getWallOffsetMm(),
      roomLabelHint: this.deps.getRoomLabelHint?.(),
    });
    this.lastContext = ctx;
    return ctx;
  }

  buildDesigns(seedBoxId: string): IntelligentDesign[] {
    const bridge = this.deps.getBridge();
    const context = this.analyzeContext();
    if (!bridge || !context) return [];

    const prefs = this.behavior.getPreferences();
    const ids: DesignVariantId[] = ["A", "B", "C"];
    this.designs = ids
      .map((id) => {
        const plan = this.buildPlanForProfile({
          profile: PROFILE_BY_ID[id],
          seedBoxId,
          context,
          prefs,
        });
        if (!plan) return null;
        const ergonomicsScore = scoreErgonomics(plan, context);
        return {
          id,
          profile: PROFILE_BY_ID[id],
          label: LABELS[id].title,
          description: LABELS[id].desc,
          plan: applyErgonomicsAdjustments(plan, context),
          ergonomicsScore,
        } satisfies IntelligentDesign;
      })
      .filter((d): d is IntelligentDesign => d !== null);

    return this.designs;
  }

  generateVariations(): LayoutVariation[] {
    const base =
      this.designs.find((d) => d.id === this.lastAppliedDesignId) ?? this.designs[0];
    if (!base || !this.lastContext) return [];
    this.variationList = this.variations.generateVariations(base, this.lastContext);
    return this.variationList;
  }

  applyDesign(id: DesignVariantId): boolean {
    const design = this.getDesignById(id);
    const bridge = this.deps.getBridge();
    if (!design || !bridge) return false;
    this.pushPlanHistory(design.plan);
    bridge.applyPlan(design.plan);
    this.deps.refinePlan?.(design.plan);
    this.behavior.recordDesignChoice(id);
    this.lastAppliedDesignId = id;
    return true;
  }

  applyVariation(index: number): boolean {
    const variation = this.variationList[index];
    const bridge = this.deps.getBridge();
    if (!variation || !bridge) return false;
    this.pushPlanHistory(variation.plan);
    bridge.applyPlan(variation.plan);
    this.deps.refinePlan?.(variation.plan);
    this.behavior.recordVariationChoice(variation.kind);
    return true;
  }

  applyPlanDirect(
    plan: AutoLayoutPlan,
    meta?: {
      designId?: DesignVariantId;
      variationKind?: import("./intelligentDesignerTypes").VariationKind;
      styleId?: EnvironmentStyleId;
    }
  ): boolean {
    const bridge = this.deps.getBridge();
    if (!bridge) return false;
    this.pushPlanHistory(plan);
    bridge.applyPlan(plan);
    this.deps.refinePlan?.(plan);
    if (meta?.designId) {
      this.behavior.recordDesignChoice(meta.designId);
      this.lastAppliedDesignId = meta.designId;
    }
    if (meta?.variationKind) this.behavior.recordVariationChoice(meta.variationKind);
    if (meta?.styleId) {
      this.behavior.learnStylePreference(meta.styleId);
      this.lastStyleId = meta.styleId;
    }
    return true;
  }

  buildStyleDesign(styleId: EnvironmentStyleId, seedBoxId: string): StylePlanResult | null {
    const bridge = this.deps.getBridge();
    const context = this.analyzeContext();
    if (!bridge || !context) return null;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return null;
    const result = buildStylePlan({
      styleId,
      seedBoxId,
      context,
      bounds,
      openings: bridge.getOpeningsMm(),
      wallOffsetMm: bridge.getWallOffsetMm(),
      boxes: bridge.getWorkspaceBoxes(),
      prefs: this.behavior.getPreferences(),
    });
    if (result) this.stylePlans.set(styleId, result);
    return result;
  }

  getStyleDesign(styleId: EnvironmentStyleId): StylePlanResult | undefined {
    return this.stylePlans.get(styleId);
  }

  applyStyle(styleId: EnvironmentStyleId, seedBoxId: string): boolean {
    const result = this.stylePlans.get(styleId) ?? this.buildStyleDesign(styleId, seedBoxId);
    if (!result) return false;
    return this.applyPlanDirect(result.plan, { styleId });
  }

  explainStyle(styleId?: EnvironmentStyleId): string {
    const id = styleId ?? this.lastStyleId;
    if (!id) return "Nenhum estilo aplicado ainda. Experimente «quero estilo moderno» ou escolha no menu Estilos.";
    const profile = getStyleProfile(id);
    const result = this.stylePlans.get(id);
    const lines = [
      `Estilo ${profile.label}`,
      profile.description,
      `Composição: ${profile.compositionNotes.join(" · ")}`,
      formatMaterialHintForUi(id),
    ];
    if (result) lines.push(`Adequação ao ambiente: ${result.styleMatchScore}/100`);
    return lines.join("\n");
  }

  applyVariationPreview(kind: import("./intelligentDesignerTypes").VariationKind): LayoutVariation | null {
    if (!this.variationList.length) this.generateVariations();
    const match = this.variationList.find((v) => v.kind === kind) ?? this.variationList[0];
    return match ?? null;
  }

  restorePreviousDesign(): boolean {
    if (this.planHistory.length < 2) return false;
    this.planHistory.pop();
    const previous = this.planHistory[this.planHistory.length - 1];
    if (!previous) return false;
    const bridge = this.deps.getBridge();
    if (!bridge) return false;
    bridge.applyPlan(previous);
    this.deps.refinePlan?.(previous);
    return true;
  }

  explainDecision(designId?: DesignVariantId): string {
    const id = designId ?? this.lastAppliedDesignId ?? "A";
    const design = this.getDesignById(id);
    const ctx = this.lastContext;
    if (!design) {
      return "Ainda não há design gerado. Peça «gerar layouts» ou escolha um estilo (minimalista, funcional).";
    }

    const lines: string[] = [design.label, design.description, ""];
    if (ctx?.roomType === "kitchen") {
      lines.push(
        "• Coloquei os módulos na parede principal para manter o triângulo de trabalho (lavatório–forno–frigorífico) eficiente.",
        `• Altura base recomendada: ${getErgonomicsRules().baseCabinetHeightMm} mm.`,
        `• Distância mínima entre zonas de trabalho: ${getErgonomicsRules().workTriangleMinMm} mm.`
      );
    }
    if (design.profile === "minimal") {
      lines.push("• Reduzi o número de módulos para aumentar circulação e espaço livre.");
    } else if (design.profile === "spaceOptimized") {
      lines.push("• Maximizei o armazenamento ao longo da parede com maior comprimento útil.");
    } else {
      lines.push("• Priorizei fluxo ergonómico e continuidade visual na parede principal.");
    }
    lines.push(`• Pontuação de ergonomia: ${design.ergonomicsScore}/100.`);
    if (ctx?.hints.length) lines.push(`• Contexto: ${ctx.hints[0]}`);
    return lines.join("\n");
  }

  suggestNextAction(): string {
    const ctx = this.lastContext;
    if (this.lastStyleId) {
      const alt = this.lastStyleId === "modern" ? "nórdico" : "moderno";
      return `Quer experimentar o estilo ${alt}? Diga «quero estilo ${alt}».`;
    }
    if (!ctx) return "Quer gerar layouts A/B/C para comparar opções?";
    if (ctx.secondaryWallId !== ctx.primaryWallId) {
      const pct = this.estimateWallOptimizationPercent(ctx.secondaryWallId);
      return `Quer também otimizar a parede lateral? Posso melhorar o aproveitamento em ~${pct}%.`;
    }
    if (this.behavior.getPreferences().preferFreeSpace > 0.6) {
      return "Com base nas suas preferências, sugiro experimentar «mais espaço livre».";
    }
    return "Diga «mostra outra opção» ou «refinar» para ajustar o encaixe magnético.";
  }

  estimateWallOptimizationPercent(wallId: number): number {
    const bridge = this.deps.getBridge();
    const ctx = this.lastContext;
    if (!bridge || !ctx) return 12;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return 12;
    const boxes = bridge.getWorkspaceBoxes();
    const onWall = boxes.filter(
      (b) => findNearestWallId(b, bounds, bridge.getWallOffsetMm()) === wallId
    ).length;
    const base = 8 + Math.min(18, Math.max(0, 6 - onWall) * 3);
    return base;
  }

  refineLastLayout(): boolean {
    const design = this.lastAppliedDesignId
      ? this.getDesignById(this.lastAppliedDesignId)
      : this.designs[0];
    if (!design) return false;
    this.deps.refinePlan?.(design.plan);
    this.behavior.recordRefinement();
    return true;
  }

  learnPreferencesSummary(): string {
    return this.behavior.applyLearnedWeights();
  }

  private pushPlanHistory(plan: AutoLayoutPlan): void {
    this.planHistory.push(clonePlan(plan));
    if (this.planHistory.length > 10) this.planHistory.shift();
  }

  private buildPlanForProfile(params: {
    profile: DesignProfile;
    seedBoxId: string;
    context: SemanticRoomContext;
    prefs: ReturnType<DesignerBehaviorStore["getPreferences"]>;
  }): AutoLayoutPlan | null {
    const bridge = this.deps.getBridge();
    if (!bridge) return null;
    const bounds = bridge.getRoomBoundsMm();
    if (!bounds) return null;

    const boxes = bridge.getWorkspaceBoxes();
    const module = boxes.find((b) => b.id === params.seedBoxId);
    if (!module || module.locked) return null;

    const wallId = params.context.primaryWallId;
    const wall = buildWallDef(wallId, bounds, bridge.getWallOffsetMm());
    if (!wall) return null;

    const moduleW = moduleWidthOnWall(module, wall);
    const intervals = getFreeIntervalsOnWall(wall, bridge.getOpeningsMm(), moduleW);
    const interval = pickLongestInterval(intervals);
    if (!interval) return null;

    const span = interval.end - interval.start;
    let count = Math.max(1, Math.floor(span / moduleW));

    if (params.profile === "minimal") {
      count = Math.max(1, count - 1);
      if (params.prefs.preferFreeSpace > 0.6) count = Math.max(1, count - 1);
    } else if (params.profile === "spaceOptimized") {
      if (params.prefs.preferStorage > 0.55) count = Math.max(1, count);
    } else {
      count = Math.max(1, Math.min(count, Math.floor(span / (moduleW + getErgonomicsRules().wallModuleGapMinMm))));
    }

    const centers = computeEvenPlacementsAlongInterval(interval.start, interval.end, moduleW, count);

    const plan: AutoLayoutPlan = { cloneBoxes: [], moveBoxes: [], shelfUpdates: [] };
    const baseY =
      params.context.roomType === "kitchen"
        ? bounds.minY_mm + getErgonomicsRules().baseCabinetHeightMm / 2
        : module.posicaoY_mm ?? module.dimensoes.altura / 2;

    centers.forEach((along, idx) => {
      const placement = placementOnWall(wall, along, module, bounds);
      placement.y_mm = baseY;
      if (idx === 0) {
        plan.moveBoxes.push({ boxId: params.seedBoxId, placement });
      } else {
        plan.cloneBoxes.push({ sourceId: params.seedBoxId, placement });
      }
    });

    return plan;
  }
}

function scoreErgonomics(plan: AutoLayoutPlan, context: SemanticRoomContext): number {
  let score = 70;
  const moduleCount = plan.moveBoxes.length + plan.cloneBoxes.length;
  if (context.roomType === "kitchen") {
    if (moduleCount >= 3) score += 15;
    if (moduleCount > 6) score -= 10;
  }
  if (context.obstacleCount > 0 && moduleCount > 0) score += 5;
  return Math.max(0, Math.min(100, score));
}

function applyErgonomicsAdjustments(
  plan: AutoLayoutPlan,
  context: SemanticRoomContext
): AutoLayoutPlan {
  if (context.roomType !== "kitchen" || plan.moveBoxes.length < 3) return plan;
  const sorted = [...plan.moveBoxes].sort((a, b) => a.placement.x_mm - b.placement.x_mm);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = Math.abs(last.placement.x_mm - first.placement.x_mm);
  if (span < getErgonomicsRules().workTriangleMinMm && sorted.length >= 3) {
    const mid = sorted[Math.floor(sorted.length / 2)]!;
    mid.placement.x_mm = (first.placement.x_mm + last.placement.x_mm) / 2;
  }
  return plan;
}

function clonePlan(plan: AutoLayoutPlan): AutoLayoutPlan {
  return {
    cloneBoxes: plan.cloneBoxes.map((c) => ({ sourceId: c.sourceId, placement: { ...c.placement } })),
    moveBoxes: plan.moveBoxes.map((m) => ({ boxId: m.boxId, placement: { ...m.placement } })),
    shelfUpdates: plan.shelfUpdates.map((s) => ({ ...s })),
  };
}
