import type { AutoLayoutPlan } from "../autoLayout/autoLayoutTypes";
import { ManufacturingAnalysisEngine } from "./manufacturingAnalysisEngine";
import { ManufacturingFixEngine } from "./manufacturingFixEngine";
import type {
  ManufacturingFixPlan,
  ManufacturingFullReport,
  ManufacturingScanContext,
  ManufacturingScanResult,
  ManufacturingUiReport,
} from "./manufacturingTypes";

export type ManufacturingReportEngineDeps = {
  getContext: () => ManufacturingScanContext;
  applyPlan: (plan: AutoLayoutPlan) => void;
  refinePlan?: (plan: AutoLayoutPlan) => void;
  distribute: (boxIds: string[]) => boolean;
  isSmartSnapEnabled: () => boolean;
};

/**
 * Relatórios e API pública Auto-Manufacturing AI.
 */
export class ManufacturingReportEngine {
  private readonly deps: ManufacturingReportEngineDeps;
  private readonly analysis = new ManufacturingAnalysisEngine();
  private readonly fixEngine: ManufacturingFixEngine;
  private lastScan: ManufacturingScanResult | null = null;
  private lastFixPlan: ManufacturingFixPlan | null = null;

  constructor(deps: ManufacturingReportEngineDeps) {
    this.deps = deps;
    this.fixEngine = new ManufacturingFixEngine({
      getBoxes: () => deps.getContext().boxes,
      applyPlan: deps.applyPlan,
      refinePlan: deps.refinePlan,
      distribute: deps.distribute,
      isSmartSnapEnabled: deps.isSmartSnapEnabled,
    });
  }

  scanProject(): ManufacturingScanResult {
    const scan = this.analysis.scanProject(this.deps.getContext());
    this.lastScan = scan;
    return scan;
  }

  score(): number {
    return this.analysis.score(this.deps.getContext());
  }

  generateReport(): ManufacturingFullReport {
    const scan = this.scanProject();
    const ui = this.toUiReport(scan);
    const fixPlan = this.fixEngine.buildAutoFixPlan(scan);
    this.lastFixPlan = fixPlan;

    return {
      ...ui,
      textReport: this.formatTextReport(scan, fixPlan),
      fixPlanAvailable: fixPlan !== null && (fixPlan.plan.moveBoxes.length > 0 || fixPlan.appliedFixes.length > 0),
    };
  }

  getUiReport(): ManufacturingUiReport {
    const scan = this.lastScan ?? this.scanProject();
    return this.toUiReport(scan);
  }

  buildFixPreview(): ManufacturingFixPlan | null {
    const scan = this.lastScan ?? this.scanProject();
    const plan = this.fixEngine.buildAutoFixPlan(scan);
    this.lastFixPlan = plan;
    return plan;
  }

  autoFix(): { ok: boolean; scan: ManufacturingScanResult; message: string } {
    const scan = this.lastScan ?? this.scanProject();
    const ok = this.fixEngine.applyAutoFixes(scan);
    const after = this.scanProject();
    return {
      ok,
      scan: after,
      message: ok
        ? `Correções aplicadas. Score: ${scan.score} → ${after.score}.`
        : "Nenhuma correção automática disponível para este projeto.",
    };
  }

  getLastFixPlan(): ManufacturingFixPlan | null {
    return this.lastFixPlan ?? this.fixEngine.getLastFixPlan();
  }

  private toUiReport(scan: ManufacturingScanResult): ManufacturingUiReport {
    const critical = scan.conflicts.filter((c) => c.severity === "critical").length;
    const warnings = scan.conflicts.filter((c) => c.severity === "warning").length;
    const summary =
      scan.readyForProduction
        ? `Pronto para fabricar (score ${scan.score}/100).`
        : `${scan.conflicts.length} problema(s): ${critical} crítico(s), ${warnings} aviso(s). Score ${scan.score}/100.`;

    return {
      score: scan.score,
      readyForProduction: scan.readyForProduction,
      summary,
      conflicts: scan.conflicts,
      suggestions: scan.suggestions,
      scannedAt: scan.scannedAt,
    };
  }

  private formatTextReport(scan: ManufacturingScanResult, fixPlan: ManufacturingFixPlan | null): string {
    const lines: string[] = [
      "=== Auto-Manufacturing AI — Relatório ===",
      `Score: ${scan.score}/100`,
      `Pronto para fabricar: ${scan.readyForProduction ? "SIM" : "NÃO"}`,
      `Módulos: ${scan.boxCount} | Remates: ${scan.remateCount} | Rodapés: ${scan.rodapeCount}`,
      "",
      "--- Conflitos ---",
    ];

    if (!scan.conflicts.length) {
      lines.push("Nenhum conflito detetado.");
    } else {
      for (const c of scan.conflicts) {
        lines.push(`[${c.severity.toUpperCase()}] ${c.title}`);
        lines.push(`  ${c.detail}`);
      }
    }

    lines.push("", "--- Sugestões ---");
    if (!scan.suggestions.length) {
      lines.push("Sem correções sugeridas.");
    } else {
      for (const s of scan.suggestions) {
        lines.push(`• ${s.label}: ${s.description}`);
      }
    }

    if (fixPlan) {
      lines.push("", "--- Plano de correção ---");
      lines.push(`Correções: ${fixPlan.appliedFixes.join(", ") || "distribuição flush"}`);
      lines.push(`Reposicionamentos: ${fixPlan.plan.moveBoxes.length}`);
    }

    return lines.join("\n");
  }
}
