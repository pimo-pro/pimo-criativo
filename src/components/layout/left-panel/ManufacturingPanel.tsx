import { useCallback, useMemo, useState } from "react";
import Panel from "../../ui/Panel";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import type { ManufacturingUiReport } from "../../../3d/viewer-engine/snapping/manufacturingTypes";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--danger, #ef4444)",
  warning: "var(--warning, #f59e0b)",
  info: "var(--text-muted)",
};

export function ManufacturingPanel() {
  const { viewerApi } = usePimoViewerContext();
  const viewerKey = viewerApi?.manufacturing ? "ready" : "none";
  const autoReport = useMemo(() => {
    if (!viewerApi?.manufacturing) return null;
    const ui = viewerApi.manufacturing.generateReport();
    return {
      score: ui.score,
      readyForProduction: ui.readyForProduction,
      summary: ui.summary,
      conflicts: ui.conflicts,
      suggestions: ui.suggestions,
      scannedAt: ui.scannedAt,
    };
  }, [viewerApi]);
  const [pinnedReport, setPinnedReport] = useState<{
    key: string;
    report: ManufacturingUiReport;
  } | null>(null);
  const report =
    pinnedReport?.key === viewerKey ? pinnedReport.report : autoReport;
  const [textReport, setTextReport] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const pinReport = useCallback(
    (next: ManufacturingUiReport) => {
      setPinnedReport({ key: viewerKey, report: next });
    },
    [viewerKey]
  );

  const refresh = useCallback(() => {
    const ui = viewerApi?.manufacturing?.getReport?.();
    if (ui) pinReport(ui);
  }, [viewerApi, pinReport]);

  const onScan = () => {
    const full = viewerApi?.manufacturing?.generateReport?.();
    if (!full) return;
    pinReport({
      score: full.score,
      readyForProduction: full.readyForProduction,
      summary: full.summary,
      conflicts: full.conflicts,
      suggestions: full.suggestions,
      scannedAt: full.scannedAt,
    });
    setTextReport(null);
    setStatus("Análise concluída.");
  };

  const onPreviewFix = () => {
    const ok = viewerApi?.manufacturing?.previewFixes?.();
    setStatus(
      ok
        ? "Preview de correções ativo. Use o menu ou «aceitar layout sugerido»."
        : "Sem correções de posição para preview."
    );
    refresh();
  };

  const onApplyFix = () => {
    const ok = viewerApi?.manufacturing?.applySuggestedFixes?.();
    setStatus(ok ? "Correções aplicadas." : "Não foi possível aplicar correções.");
    onScan();
  };

  const onAutoFix = () => {
    const result = viewerApi?.manufacturing?.autoFix?.();
    if (!result) return;
    setStatus(result.message);
    onScan();
  };

  const onExportReport = () => {
    const full = viewerApi?.manufacturing?.generateReport?.();
    if (!full) return;
    setTextReport(full.textReport);
    setStatus("Relatório gerado.");
  };

  const scoreColor =
    report && report.score >= 85
      ? "var(--success, #22c55e)"
      : report && report.score >= 60
        ? "var(--warning, #f59e0b)"
        : "var(--danger, #ef4444)";

  return (
    <Panel title="Auto-Manufacturing AI — Verificação Industrial">
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
        Análise somente leitura do projeto 3D. Correções usam Smart Align &amp; Snap — sem alterar produção industrial.
      </p>

      {report && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            background: "var(--surface-elevated, rgba(15,23,42,0.45))",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: `3px solid ${scoreColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              color: scoreColor,
            }}
          >
            {report.score}
          </div>
          <div style={{ flex: 1, fontSize: 11, lineHeight: 1.45 }}>
            <strong style={{ color: report.readyForProduction ? "var(--success, #22c55e)" : "var(--warning, #f59e0b)" }}>
              {report.readyForProduction ? "Pronto para fabricar" : "Revisão necessária"}
            </strong>
            <div style={{ color: "var(--text-muted)", marginTop: 4 }}>{report.summary}</div>
          </div>
        </div>
      )}

      {report && report.conflicts.length > 0 && (
        <div style={{ marginBottom: 10, maxHeight: 160, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Conflitos</div>
          {report.conflicts.map((c) => (
            <div
              key={c.id}
              style={{
                fontSize: 11,
                lineHeight: 1.4,
                marginBottom: 6,
                paddingLeft: 8,
                borderLeft: `3px solid ${SEVERITY_COLOR[c.severity] ?? "var(--text-muted)"}`,
              }}
            >
              <strong>{c.title}</strong>
              <div style={{ color: "var(--text-muted)" }}>{c.detail}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <button type="button" className="button button-sm" onClick={onScan}>
          Verificar projeto
        </button>
        <button type="button" className="button button-sm" onClick={onPreviewFix}>
          Corrigir automaticamente
        </button>
        <button type="button" className="button button-primary button-sm" onClick={onApplyFix}>
          Aplicar correções sugeridas
        </button>
        <button type="button" className="button button-sm" onClick={onAutoFix}>
          Auto-fix direto
        </button>
        <button type="button" className="button button-sm" onClick={onExportReport}>
          Gerar relatório
        </button>
      </div>

      {status && (
        <p style={{ fontSize: 11, color: "var(--accent, #38bdf8)", margin: "0 0 8px" }}>{status}</p>
      )}

      {textReport && (
        <pre
          style={{
            fontSize: 10,
            lineHeight: 1.45,
            maxHeight: 180,
            overflowY: "auto",
            margin: 0,
            padding: 8,
            borderRadius: 6,
            background: "var(--surface-elevated, rgba(15,23,42,0.4))",
            whiteSpace: "pre-wrap",
          }}
        >
          {textReport}
        </pre>
      )}
    </Panel>
  );
}
