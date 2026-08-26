import { useMemo } from "react";
import { useProject } from "../../context/useProject";
import { useMaterials } from "../../hooks/useMaterials";
import { useAuth } from "../../auth/useAuth";
import { hasFullAccess } from "../../auth/rbac";
import { canShowSectionPrices } from "../../admin/industrialSectionsConfig";
import Panel from "../ui/Panel";
import Button from "../ui/Button";
import { useIndustrialBottomPdf } from "../../hooks/useIndustrialBottomPdf";
import {
  computeFinanceiroUnificado,
  financeiroCustoRows,
  financeiroMetricRows,
} from "../../core/financeiro";
import {
  financeiroChapasBadgeLabel,
  financeiroChapasEstimadoHint,
  isChapasModeEstimado,
  isChapasModeOficial,
} from "../../core/financeiro/financeiroChapasModeLabels";
import { formatCurrency } from "../../utils/formatting";
import type { FinanceiroChapasMode } from "../../core/financeiro/financeiroUnificadoTypes";

const chapasBadgeStyle = (mode: FinanceiroChapasMode): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontWeight: 600,
  color: isChapasModeOficial(mode) || mode === "real" ? "#16a34a" : "#ea580c",
});

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: 12,
  minWidth: 0,
};

const microMuted: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", margin: 0 };

export default function FinanceiroUnificadoPanel({ embedded }: { embedded?: boolean } = {}) {
  const { project } = useProject();
  const { materials } = useMaterials();
  const { hasPermission } = useAuth();
  const isAdmin = hasFullAccess(hasPermission);
  const showPrices =
    canShowSectionPrices("resumoFinanceiro", isAdmin) ||
    canShowSectionPrices("totaisProjeto", isAdmin);
  const { exportResumoFinanceiroPdf } = useIndustrialBottomPdf();

  const snap = useMemo(
    () =>
      computeFinanceiroUnificado(
        {
          boxes: project.boxes,
          rules: project.rules,
          materialId: project.materialId,
          projectName: project.projectName,
          remates: project.remates,
          rodapes: project.rodapes,
          extractedPartsByBoxId: project.extractedPartsByBoxId,
          industrialPieceEdits: project.industrialPieceEdits,
          ferragemOrla: project.ferragemOrla,
          orlaPresets: project.orlaPresets,
          financeiroOverrides: project.financeiroOverrides,
          financeiroAdminSettings: project.financeiroAdminSettings,
        },
        materials
      ),
    [project, materials]
  );

  const metricRows = useMemo(() => financeiroMetricRows(snap), [snap]);
  const custoRows = useMemo(() => financeiroCustoRows(snap), [snap]);
  const boxesEmpty = (project.boxes ?? []).length === 0;

  return (
    <Panel title={embedded ? undefined : "Financeiro — Painel Unificado"}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Button
          type="button"
          variant="secondary"
          disabled={boxesEmpty}
          onClick={() => void exportResumoFinanceiroPdf()}
        >
          Gerar PDF
        </Button>
      </div>

      {boxesEmpty ? (
        <p style={microMuted}>Adicione caixas para visualizar o financeiro unificado.</p>
      ) : (
        <div style={gridStyle} className="financeiro-unificado-grid">
          <div style={cardStyle}>
            <h3 className="bottom-info-hub__card-title" style={{ marginTop: 0 }}>
              Quantidades
            </h3>
            <div className="data-list">
              {metricRows.map(([label, value]) => {
                const isChapas = label.startsWith("Nº de chapas");
                return (
                  <div key={label} className="data-list__row">
                    <span className="data-list__label">{label}</span>
                    <span className="data-list__value">
                      {isChapas ? (
                        <span style={chapasBadgeStyle(snap.chapas.mode)}>
                          {value}
                          <span style={{ fontSize: 11, fontWeight: 600 }}>
                            {financeiroChapasBadgeLabel(snap.chapas.mode)}
                          </span>
                        </span>
                      ) : (
                        value
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {isChapasModeEstimado(snap.chapas.mode) ||
            (snap.custosAvancadosWarnings && snap.custosAvancadosWarnings.length > 0) ? (
              <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                {isChapasModeEstimado(snap.chapas.mode) ? (
                  <p style={{ ...microMuted, color: "#ea580c", fontWeight: 600 }}>
                    {financeiroChapasEstimadoHint()}
                  </p>
                ) : null}
                {(snap.custosAvancadosWarnings ?? []).slice(0, 4).map((w) => (
                  <p key={w} style={{ ...microMuted, lineHeight: 1.4 }}>
                    {w}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <div style={cardStyle}>
            <h3 className="bottom-info-hub__card-title" style={{ marginTop: 0 }}>
              Custos {isAdmin ? "(ADMIN)" : ""}
            </h3>
            {showPrices ? (
              <div className="data-list">
                {custoRows.map((row) => (
                  <div
                    key={row.label}
                    className={`data-list__row${row.total ? " data-list__row--total" : ""}`}
                  >
                    <span className="data-list__label">{row.label}</span>
                    <span
                      className={`data-list__value${row.total ? " data-list__value--accent" : ""}`}
                    >
                      {row.emBreve || row.valor == null
                        ? "em breve"
                        : formatCurrency(row.valor)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={microMuted}>Preços visíveis apenas para administradores.</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 720px) {
          .financeiro-unificado-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Panel>
  );
}
