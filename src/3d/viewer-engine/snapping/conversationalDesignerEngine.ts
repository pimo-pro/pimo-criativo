import type { AutoLayoutPlan } from "../autoLayout/autoLayoutTypes";
import type { IntelligentDesignerEngine } from "./intelligentDesignerEngine";
import type { DesignVariantId, VariationKind } from "./intelligentDesignerTypes";
import { DesignConversationState } from "./designConversationState";
import { parseUserIntent, type ParsedIntent } from "./intentParser";
import type { ManufacturingFullReport } from "./manufacturingTypes";
import type { CostFullReport, CostSuggestion } from "./costTypes";

export type ConversationTurnResult = {
  assistantText: string;
  intent: ParsedIntent;
  previewLabel?: string;
  previewPlan?: AutoLayoutPlan;
  applied: boolean;
  suggestion?: string;
};

export type ConversationalDesignerDeps = {
  designer: IntelligentDesignerEngine;
  conversation: DesignConversationState;
  previewPlan: (plan: AutoLayoutPlan, label: string, previewId: string) => void;
  applyPlan: (plan: AutoLayoutPlan, meta: { designId?: DesignVariantId; variationKind?: VariationKind; label: string }) => boolean;
  acceptPending: () => boolean;
  rejectPending: () => void;
  optimizeWallPreview: (wallId: number, seedBoxId: string) => boolean;
  getManufacturingReport: () => ManufacturingFullReport;
  previewManufacturingFixes: () => boolean;
  applyManufacturingFixes: () => { ok: boolean; message: string };
  getCostReport: (seedBoxId: string) => CostFullReport;
  previewCostSuggestion: (suggestion: CostSuggestion) => void;
  buildCostSuggestion: (
    tier: "cheaper" | "premium" | "balanced",
    seedBoxId: string,
    reducePercent?: number
  ) => CostSuggestion | null;
};

/**
 * Intelligent Designer 4.0 — diálogo iterativo com intenções heurísticas.
 */
export class ConversationalDesignerEngine {
  private readonly deps: ConversationalDesignerDeps;
  private variationCursor = 0;

  constructor(deps: ConversationalDesignerDeps) {
    this.deps = deps;
  }

  static ensure(
    current: ConversationalDesignerEngine | null,
    deps: ConversationalDesignerDeps
  ): ConversationalDesignerEngine {
    return current ?? new ConversationalDesignerEngine(deps);
  }

  getConversationState(): DesignConversationState {
    return this.deps.conversation;
  }

  processInput(text: string, seedBoxId: string): ConversationTurnResult {
    const conversation = this.deps.conversation;
    conversation.setSeedBoxId(seedBoxId);
    conversation.addUserMessage(text);

    const intent = parseUserIntent(text);
    const result = this.dispatchIntent(intent, seedBoxId);
    conversation.addAssistantMessage(result.assistantText, intent.kind);
    return result;
  }

  processQuickAction(action: "moreSpace" | "moreSymmetry" | "minimal" | "optimizeWall" | "variations", seedBoxId: string): ConversationTurnResult {
    const phrases: Record<typeof action, string> = {
      moreSpace: "quero mais espaço livre",
      moreSymmetry: "quero mais simetria",
      minimal: "quero estilo minimalista",
      optimizeWall: "otimiza esta parede",
      variations: "gerar variações",
    };
    return this.processInput(phrases[action], seedBoxId);
  }

  private dispatchIntent(intent: ParsedIntent, seedBoxId: string): ConversationTurnResult {
    const designer = this.deps.designer;

    switch (intent.kind) {
      case "accept": {
        const applied = this.deps.acceptPending();
        void this.deps.conversation.getLastApplied();
        return {
          intent,
          applied,
          assistantText: applied
            ? "Layout aplicado e refinado com Smart Align & Snap."
            : "Não há layout pendente para aceitar. Peça primeiro um design ou variação.",
          suggestion: applied ? designer.suggestNextAction() : undefined,
        };
      }
      case "reject": {
        this.deps.rejectPending();
        this.deps.conversation.clearPending();
        return { intent, applied: false, assistantText: "Preview cancelado. Pode pedir outra opção." };
      }
      case "explain": {
        const explanation = designer.explainDecision(intent.designId);
        return { intent, applied: false, assistantText: explanation, suggestion: designer.suggestNextAction() };
      }
      case "undo": {
        const restored = designer.restorePreviousDesign();
        return {
          intent,
          applied: restored,
          assistantText: restored
            ? "Restaurei o design anterior."
            : "Não há design anterior guardado nesta sessão.",
        };
      }
      case "showAlternative": {
        this.variationCursor += 1;
        const variations = designer.generateVariations();
        if (!variations.length) {
          designer.buildDesigns(seedBoxId);
          const rebuilt = designer.generateVariations();
          if (!rebuilt.length) {
            return { intent, applied: false, assistantText: "Gere primeiro um layout (A/B/C) para mostrar alternativas." };
          }
        }
        const list = designer.getVariations();
        const idx = this.variationCursor % Math.max(1, list.length);
        const v = list[idx]!;
        this.deps.previewPlan(v.plan, v.label, `V${idx + 1}`);
        this.deps.conversation.setPendingPreview(v.label);
        return {
          intent,
          applied: false,
          assistantText: `Mostro a alternativa: ${v.label}. Diga "aceitar" para aplicar.`,
          previewLabel: v.label,
          previewPlan: v.plan,
          suggestion: "Diga «aceitar» ou «rejeitar».",
        };
      }
      case "generateVariations": {
        if (!designer.getDesigns().length) designer.buildDesigns(seedBoxId);
        const variations = designer.generateVariations();
        if (!variations.length) {
          return { intent, applied: false, assistantText: "Não consegui gerar variações. Selecione um módulo base na sala." };
        }
        const v = variations[0]!;
        this.deps.previewPlan(v.plan, v.label, "V1");
        this.deps.conversation.setPendingPreview(v.label);
        return {
          intent,
          applied: false,
          assistantText: `Criei ${variations.length} variações. Preview: ${v.label}.`,
          previewLabel: v.label,
          previewPlan: v.plan,
          suggestion: designer.suggestNextAction(),
        };
      }
      case "optimizeWall": {
        const wallId = intent.targetWallId ?? 0;
        const ok = this.deps.optimizeWallPreview(wallId, seedBoxId);
        const pct = designer.estimateWallOptimizationPercent(wallId);
        return {
          intent,
          applied: false,
          assistantText: ok
            ? `Preview de otimização da parede ${wallLabel(wallId)} (~${pct}% melhor aproveitamento).`
            : `Não foi possível otimizar a parede ${wallLabel(wallId)}.`,
          suggestion: "Diga «aceitar» para aplicar ou peça outra parede.",
        };
      }
      case "refine": {
        const ok = designer.refineLastLayout();
        return {
          intent,
          applied: ok,
          assistantText: ok ? "Refinei o layout com encaixe magnético unificado." : "Não há layout aplicado para refinar.",
        };
      }
      case "costCheck": {
        const report = this.deps.getCostReport(seedBoxId);
        const topModules = report.moduleBreakdown
          .slice(0, 3)
          .map((m) => `• ${m.label}: ${m.relativeCost} un.`)
          .join("\n");
        return {
          intent,
          applied: false,
          assistantText: `Estimativa de custo (escala relativa):\nTotal: ${report.totalRelativeCost} un. | Economia: ${report.economyScore}/100\n\n${topModules || "Sem módulos."}\n\n${report.summary}`,
          suggestion: report.recommendations[0] ?? "Peça «versão mais barata» ou «comparar custos».",
        };
      }
      case "costCompare": {
        const report = this.deps.getCostReport(seedBoxId);
        const designLines =
          report.designComparison?.designs
            .map((d) => `• ${d.label}: ${d.relativeCost} un.`)
            .join("\n") ?? "";
        const styleLines =
          report.styleComparison?.styles
            .slice(0, 4)
            .map((s) => `• ${s.label}: ${s.relativeCost} un.`)
            .join("\n") ?? "";
        return {
          intent,
          applied: false,
          assistantText: `Comparação de custos:\n\nDesigns:\n${designLines}\n\nEstilos (amostra):\n${styleLines}\n\n${report.designComparison?.summary ?? ""}`,
          suggestion: "Diga «quero versão mais barata» para preview de otimização.",
        };
      }
      case "costSuggest":
      case "costOptimize": {
        const tier = intent.costTier ?? "cheaper";
        const suggestion = this.deps.buildCostSuggestion(tier, seedBoxId, intent.costReducePercent);
        if (!suggestion) {
          return {
            intent,
            applied: false,
            assistantText: "Não consegui gerar alternativa de custo. Verifique o módulo base.",
          };
        }
        this.deps.previewCostSuggestion(suggestion);
        this.deps.conversation.setPendingPreview(suggestion.label);
        const savings =
          suggestion.savingsPercent != null ? ` Poupança estimada ~${suggestion.savingsPercent}%.` : "";
        const premium =
          suggestion.premiumPercent != null ? ` Acréscimo estimado ~${suggestion.premiumPercent}%.` : "";
        return {
          intent,
          applied: false,
          assistantText: `${suggestion.label}\n${suggestion.description}\nCusto estimado: ${suggestion.estimatedCost} un. (economia ${suggestion.economyScore}/100).${savings}${premium}\n\nDiga «aceitar» para aplicar.`,
          previewLabel: suggestion.label,
          previewPlan: suggestion.plan,
          suggestion: designer.suggestNextAction(),
        };
      }
      case "manufacturingReady": {
        const report = this.deps.getManufacturingReport();
        return {
          intent,
          applied: false,
          assistantText: report.readyForProduction
            ? `Sim — score ${report.score}/100. O projeto parece pronto para fabricar.\n${report.summary}`
            : `Ainda não — score ${report.score}/100.\n${report.conflicts.length} conflito(s) detetado(s). Diga «corrigir para fabricar» para aplicar correções.`,
          suggestion: report.readyForProduction
            ? "Pode pedir «gerar relatório» ou «otimiza para produção»."
            : "Experimente «corrigir para fabricar» ou «verificar produção».",
        };
      }
      case "manufacturingCheck": {
        const report = this.deps.getManufacturingReport();
        const conflictLines = report.conflicts
          .slice(0, 5)
          .map((c) => `• [${c.severity}] ${c.title}`)
          .join("\n");
        const more = report.conflicts.length > 5 ? `\n… e mais ${report.conflicts.length - 5}.` : "";
        return {
          intent,
          applied: false,
          assistantText: `Verificação industrial (somente leitura):\nScore ${report.score}/100 — ${report.readyForProduction ? "pronto" : "atenção necessária"}.\n\n${conflictLines || "Sem conflitos críticos."}${more}`,
          suggestion: report.suggestions[0]?.label ?? "Diga «corrigir para fabricar» para preview de correções.",
        };
      }
      case "manufacturingFix": {
        const fixPlan = this.deps.getManufacturingReport();
        const preview = this.deps.previewManufacturingFixes();
        if (!preview) {
          const applied = this.deps.applyManufacturingFixes();
          return {
            intent,
            applied: applied.ok,
            assistantText: applied.message,
            suggestion: designer.suggestNextAction(),
          };
        }
        this.deps.conversation.setPendingPreview("Correções Auto-Manufacturing");
        return {
          intent,
          applied: false,
          assistantText: `Preview de correções gerado (score atual ${fixPlan.score}/100). Diga «aceitar» para aplicar ou «rejeitar» para cancelar.`,
          suggestion: "Após aceitar, o layout será refinado com Smart Align & Snap.",
        };
      }
      case "applyStyle": {
        const styleId = intent.styleId ?? "modern";
        const result = designer.buildStyleDesign(styleId, seedBoxId);
        if (!result) {
          return { intent, applied: false, assistantText: "Não consegui gerar o estilo. Verifique o módulo base e a sala." };
        }
        this.deps.previewPlan(result.plan, result.label, styleId);
        this.deps.conversation.setPendingPreview(result.label);
        return {
          intent,
          applied: false,
          assistantText: `${result.label}: ${result.description}\n${result.compositionSummary}\nAdequação: ${result.styleMatchScore}/100.\n\nMateriais sugeridos (somente leitura):\n${result.materialHintLabel}\n\nDiga «aceitar» para aplicar.`,
          previewLabel: result.label,
          previewPlan: result.plan,
          suggestion: designer.suggestNextAction(),
        };
      }
      case "applyDesign": {
        const id = intent.designId ?? "A";
        if (!designer.getDesigns().length) designer.buildDesigns(seedBoxId);
        const design = designer.getDesignById(id);
        if (!design) {
          return { intent, applied: false, assistantText: `Não consegui gerar o Design ${id}. Verifique o módulo selecionado.` };
        }
        this.deps.previewPlan(design.plan, design.label, id);
        this.deps.conversation.setPendingPreview(design.label);
        return {
          intent,
          applied: false,
          assistantText: `${design.label}: ${design.description} (ergonomia ${design.ergonomicsScore}/100). Diga «aceitar» para aplicar.`,
          previewLabel: design.label,
          previewPlan: design.plan,
          suggestion: designer.suggestNextAction(),
        };
      }
      case "variation":
      case "adjustment": {
        if (!designer.getDesigns().length) designer.buildDesigns(seedBoxId);
        const kind = intent.variationKind ?? "moreFreeSpace";
        const variation = designer.applyVariationPreview(kind);
        if (!variation) {
          return { intent, applied: false, assistantText: "Não consegui criar essa variação. Tente «gerar variações» primeiro." };
        }
        this.deps.previewPlan(variation.plan, variation.label, kind);
        this.deps.conversation.setPendingPreview(variation.label);
        const explain = intent.moduleKeyword
          ? `Ajustei a disposição considerando «${intent.moduleKeyword}».`
          : `Variação «${variation.label}» pronta em preview.`;
        return {
          intent,
          applied: false,
          assistantText: `${explain} Diga «aceitar» para aplicar.`,
          previewLabel: variation.label,
          previewPlan: variation.plan,
          suggestion: designer.suggestNextAction(),
        };
      }
      default:
        return {
          intent,
          applied: false,
          assistantText:
            "Não percebi bem. Experimente: «mais espaço», «estilo minimalista», «design B», «porquê?», «mostra outra opção» ou «aceitar».",
          suggestion: "Use os botões rápidos abaixo.",
        };
    }
  }
}

function wallLabel(wallId: number): string {
  return ["frente", "direita", "fundo", "esquerda"][wallId] ?? String(wallId);
}
