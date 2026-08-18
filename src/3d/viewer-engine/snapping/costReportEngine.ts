import type { IntelligentDesignerEngine } from "./intelligentDesignerEngine";
import { CostEstimatorEngine } from "./costEstimatorEngine";
import { CostVariationEngine } from "./costVariationEngine";
import type {
  CostChangeInput,
  CostDesignComparison,
  CostFullReport,
  CostImpactEstimate,
  CostScanContext,
  CostScanResult,
  CostStyleComparison,
  CostSuggestion,
  CostUiSummary,
} from "./costTypes";
import type { DesignVariantId } from "./intelligentDesignerTypes";

export type CostReportEngineDeps = {
  getContext: () => CostScanContext;
  getDesigner: () => IntelligentDesignerEngine;
  getSeedBoxId: () => string;
};

/**
 * Relatórios de custo e comparações A/B/C, estilos e variações.
 */
export class CostReportEngine {
  private readonly deps: CostReportEngineDeps;
  private readonly estimator = new CostEstimatorEngine();
  private variationEngine: CostVariationEngine;
  private lastScan: CostScanResult | null = null;
  private lastDesignComparison: CostDesignComparison | null = null;
  private lastStyleComparison: CostStyleComparison | null = null;

  constructor(deps: CostReportEngineDeps) {
    this.deps = deps;
    this.variationEngine = new CostVariationEngine({
      getDesigner: () => deps.getDesigner(),
      getScan: () => this.lastScan ?? this.scanProject(),
      seedBoxId: () => deps.getSeedBoxId(),
    });
  }

  static ensure(current: CostReportEngine | null, deps: CostReportEngineDeps): CostReportEngine {
    return current ?? new CostReportEngine(deps);
  }

  scanProject(): CostScanResult {
    const scan = this.estimator.scanProject(this.deps.getContext());
    this.lastScan = scan;
    return scan;
  }

  score(): number {
    return this.scanProject().economyScore;
  }

  generateCostReport(): CostFullReport {
    const scan = this.scanProject();
    const seedBoxId = this.deps.getSeedBoxId();
    const designComparison = seedBoxId ? this.compareDesignsCost(seedBoxId) : null;
    const styleComparison = this.compareStylesCost();
    const ui = this.summarizeCostForUI(scan, designComparison, styleComparison);

    return {
      ...ui,
      categoryBreakdown: scan.categoryBreakdown,
      textReport: this.formatTextReport(scan, designComparison, styleComparison),
    };
  }

  summarizeCostForUI(
    scan?: CostScanResult,
    designComparison?: CostDesignComparison | null,
    styleComparison?: CostStyleComparison | null
  ): CostUiSummary {
    const s = scan ?? this.lastScan ?? this.scanProject();
    const designs = designComparison ?? this.lastDesignComparison;
    const styles = styleComparison ?? this.lastStyleComparison;

    return {
      totalRelativeCost: s.totalRelativeCost,
      economyScore: s.economyScore,
      summary: `Custo relativo total: ${s.totalRelativeCost} un. | Economia: ${s.economyScore}/100`,
      moduleBreakdown: s.moduleBreakdown,
      wallBreakdown: s.wallBreakdown,
      designComparison: designs,
      styleComparison: styles,
      recommendations: s.recommendations,
      scannedAt: s.scannedAt,
    };
  }

  compareDesignsCost(seedBoxId: string): CostDesignComparison {
    const scan = this.lastScan ?? this.scanProject();
    const designer = this.deps.getDesigner();
    if (!designer.getDesigns().length) designer.buildDesigns(seedBoxId);

    const designs = (["A", "B", "C"] as DesignVariantId[]).map((id) => {
      const design = designer.getDesignById(id);
      const base = design
        ? this.estimator.estimatePlanCost(design.plan, scan, 1)
        : scan.totalRelativeCost;
      return this.estimator.estimateDesignCost(id, base);
    });

    const sorted = [...designs].sort((a, b) => a.relativeCost - b.relativeCost);
    const cheapestId = sorted[0]!.designId;
    const premiumId = sorted[sorted.length - 1]!.designId;

    const result: CostDesignComparison = {
      current: designs.find((d) => d.designId === designer.getLastAppliedDesignId()) ?? null,
      designs,
      cheapestId,
      premiumId,
      summary: `Mais económico: Design ${cheapestId} (${sorted[0]!.relativeCost} un.). Mais premium: Design ${premiumId} (${sorted[sorted.length - 1]!.relativeCost} un.).`,
    };
    this.lastDesignComparison = result;
    return result;
  }

  compareStylesCost(): CostStyleComparison {
    const scan = this.lastScan ?? this.scanProject();
    const styles = this.estimator.estimateStyleCosts(scan.totalRelativeCost);
    const sorted = [...styles].sort((a, b) => a.relativeCost - b.relativeCost);
    const result: CostStyleComparison = {
      styles,
      cheapestId: sorted[0]!.styleId,
      premiumId: sorted[sorted.length - 1]!.styleId,
      summary: `Estilo mais económico: ${sorted[0]!.label}. Mais premium: ${sorted[sorted.length - 1]!.label}.`,
    };
    this.lastStyleComparison = result;
    return result;
  }

  estimateChangeImpact(change: CostChangeInput): CostImpactEstimate {
    const scan = this.lastScan ?? this.scanProject();
    return this.estimator.estimateChangeImpact(scan, change);
  }

  suggestCheaperAlternative(): CostSuggestion | null {
    return this.variationEngine.suggestCheaperAlternative();
  }

  suggestPremiumAlternative(): CostSuggestion | null {
    return this.variationEngine.suggestPremiumAlternative();
  }

  suggestBalancedAlternative(): CostSuggestion | null {
    return this.variationEngine.suggestBalancedAlternative();
  }

  suggestReduceCostPercent(percent: number): CostSuggestion | null {
    return this.variationEngine.suggestReduceCostPercent(percent);
  }

  getLastSuggestion() {
    return this.variationEngine.getLastSuggestion();
  }

  private formatTextReport(
    scan: CostScanResult,
    designs: CostDesignComparison | null,
    styles: CostStyleComparison | null
  ): string {
    const lines: string[] = [
      "=== Intelligent Cost Estimator — Relatório ===",
      `Custo relativo total: ${scan.totalRelativeCost} un. (escala heurística, não preço real)`,
      `Score de economia: ${scan.economyScore}/100`,
      "",
      "--- Por categoria ---",
    ];

    for (const c of scan.categoryBreakdown) {
      lines.push(`${c.category}: ${c.relativeCost} un. (${c.percent}%)`);
    }

    lines.push("", "--- Por parede ---");
    for (const w of scan.wallBreakdown) {
      lines.push(`${w.wallLabel}: ${w.relativeCost} un. (${w.moduleCount} módulos)`);
    }

    lines.push("", "--- Top módulos ---");
    for (const m of scan.moduleBreakdown.slice(0, 5)) {
      lines.push(`• ${m.label}: ${m.relativeCost} un.`);
    }

    if (designs) {
      lines.push("", "--- Comparação A/B/C ---", designs.summary);
      for (const d of designs.designs) {
        lines.push(`  ${d.label}: ${d.relativeCost} un. (economia ${d.economyScore}/100)`);
      }
    }

    if (styles) {
      lines.push("", "--- Comparação de estilos ---", styles.summary);
      for (const s of styles.styles) {
        lines.push(`  ${s.label}: ${s.relativeCost} un.`);
      }
    }

    if (scan.recommendations.length) {
      lines.push("", "--- Recomendações ---");
      for (const r of scan.recommendations) lines.push(`• ${r}`);
    }

    return lines.join("\n");
  }
}
