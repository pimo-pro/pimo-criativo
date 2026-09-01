import { useMemo, useState } from "react";
import Panel from "../../ui/Panel";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import type { CostUiSummary } from "../../../3d/viewer-engine/snapping/costTypes";

export function CostEstimatorPanel() {
  const { project } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const seedBoxId = project.selectedWorkspaceBoxId ?? project.workspaceBoxes[0]?.id ?? "";
  const workspaceBoxCount = project.workspaceBoxes.length;
  const reportSourceKey = `${seedBoxId}:${workspaceBoxCount}`;
  const autoReport = useMemo(() => {
    if (!viewerApi?.costEstimator || !seedBoxId) return null;
    void workspaceBoxCount;
    return viewerApi.costEstimator.summarizeForUI(seedBoxId);
  }, [viewerApi, seedBoxId, workspaceBoxCount]);
  const [pinnedReport, setPinnedReport] = useState<{
    key: string;
    report: CostUiSummary;
  } | null>(null);
  const report =
    pinnedReport?.key === reportSourceKey ? pinnedReport.report : autoReport;
  const [textReport, setTextReport] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onRefresh = () => {
    if (!seedBoxId || !viewerApi?.costEstimator) return;
    const next = viewerApi.costEstimator.summarizeForUI(seedBoxId);
    setPinnedReport({ key: reportSourceKey, report: next });
    setStatus("Estimativa atualizada.");
  };

  const onCheaper = () => {
    if (!seedBoxId) return;
    const ok = viewerApi?.costEstimator?.suggestCheaper?.(seedBoxId);
    setStatus(ok ? "Preview da versão económica ativo." : "Não foi possível gerar alternativa.");
  };

  const onPremium = () => {
    if (!seedBoxId) return;
    const ok = viewerApi?.costEstimator?.suggestPremium?.(seedBoxId);
    setStatus(ok ? "Preview da versão premium ativo." : "Não foi possível gerar alternativa.");
  };

  const onExport = () => {
    if (!seedBoxId || !viewerApi?.costEstimator) return;
    const full = viewerApi.costEstimator.generateCostReport(seedBoxId);
    setTextReport(full.textReport);
    setPinnedReport({ key: reportSourceKey, report: full });
    setStatus("Relatório de custo gerado.");
  };

  const economyColor =
    report && report.economyScore >= 75
      ? "var(--success, #22c55e)"
      : report && report.economyScore >= 50
        ? "var(--warning, #f59e0b)"
        : "var(--danger, #ef4444)";

  return (
    <Panel title="Intelligent Cost Estimator — Estimativa de Custo">
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
        Custo relativo heurístico (não é preço real). Integrado com Designer Inteligente e Auto-Manufacturing AI.
      </p>

      {!seedBoxId && (
        <p style={{ fontSize: 11, color: "var(--warning, #f59e0b)", marginBottom: 8 }}>
          Selecione um módulo para comparações A/B/C e sugestões de custo.
        </p>
      )}

      {report && (
        <>
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
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Custo total estimado</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{report.totalRelativeCost} un.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Economia</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: economyColor }}>{report.economyScore}/100</div>
            </div>
          </div>

          {report.wallBreakdown.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Por parede</div>
              {report.wallBreakdown.map((w) => (
                <div key={w.wallId} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  {w.wallLabel}: {w.relativeCost} un. ({w.moduleCount} mód.)
                </div>
              ))}
            </div>
          )}

          {report.moduleBreakdown.length > 0 && (
            <div style={{ marginBottom: 8, maxHeight: 100, overflowY: "auto" }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Por módulo (top)</div>
              {report.moduleBreakdown.slice(0, 5).map((m) => (
                <div key={m.boxId} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  {m.label}: {m.relativeCost} un.
                </div>
              ))}
            </div>
          )}

          {report.designComparison && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Comparação A/B/C</div>
              {report.designComparison.designs.map((d) => (
                <div key={d.designId} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  {d.label}: {d.relativeCost} un.
                  {d.designId === report.designComparison!.cheapestId ? " ★ económico" : ""}
                  {d.designId === report.designComparison!.premiumId ? " ◆ premium" : ""}
                </div>
              ))}
            </div>
          )}

          {report.styleComparison && (
            <div style={{ marginBottom: 8, maxHeight: 90, overflowY: "auto" }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Estilos</div>
              {report.styleComparison.styles.slice(0, 5).map((s) => (
                <div key={s.styleId} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  {s.label}: {s.relativeCost} un.
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <button type="button" className="button button-sm" disabled={!seedBoxId} onClick={onRefresh}>
          Atualizar
        </button>
        <button type="button" className="button button-sm" disabled={!seedBoxId} onClick={onCheaper}>
          Versão mais económica
        </button>
        <button type="button" className="button button-sm" disabled={!seedBoxId} onClick={onPremium}>
          Versão mais premium
        </button>
        <button type="button" className="button button-primary button-sm" disabled={!seedBoxId} onClick={onExport}>
          Gerar relatório de custo
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
            maxHeight: 160,
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
