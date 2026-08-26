/**
 * Accordion genérico de detalhe financeiro (P3.27) — camada visual.
 * Adicionar / remover / editar qty × preço sem alterar o SSOT Unificado.
 */
import type { CSSProperties } from "react";
import Button from "@/components/ui/Button";
import type { ReportFinanceiroDetalhe } from "@/core/projectReport";
import {
  formatEurDisplay,
  createEmptyItemDetalhe,
  rebuildItemDetalhe,
  sumDetalheVisual,
} from "@/core/projectReport";
import { reportInput, reportTable, reportTableWrap, reportTd, reportTh } from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  label: string;
  detalhe: ReportFinanceiroDetalhe[];
  totalOficial: number;
  hasOverride?: boolean;
  onChange: (next: ReportFinanceiroDetalhe[]) => void;
  onApplyVisualAsOverride?: (visualTotal: number) => void;
  saving?: boolean;
};

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  margin: "4px 0 8px",
  background: "var(--card-bg, var(--ui-color-surface, #fff))",
  border: "1px solid var(--card-border, var(--border, rgba(127,127,127,0.25)))",
  borderRadius: 8,
  color: "var(--text-main)",
};

const badgeStyle = (kind: "official" | "override" | "info"): CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  fontWeight: 600,
  fontSize: 11,
  background:
    kind === "override"
      ? "rgba(234,179,8,0.18)"
      : kind === "official"
        ? "rgba(34,197,94,0.15)"
        : "rgba(59,130,246,0.12)",
  color:
    kind === "override"
      ? "var(--warning, #ca8a04)"
      : kind === "official"
        ? "var(--success, #16a34a)"
        : "var(--blue-light, #3b82f6)",
});

export default function LinhaDetalheAccordion({
  label,
  detalhe,
  totalOficial,
  hasOverride,
  onChange,
  onApplyVisualAsOverride,
  saving = false,
}: Props) {
  const visualTotal = sumDetalheVisual(detalhe);
  const diverges = detalhe.length > 0 && Math.abs(visualTotal - totalOficial) > 0.009;

  const updateRow = (
    idx: number,
    patch: Parameters<typeof rebuildItemDetalhe>[1]
  ) => {
    const next = [...detalhe];
    next[idx] = rebuildItemDetalhe(detalhe[idx], patch);
    onChange(next);
  };

  return (
    <div style={panelStyle} data-testid={`linha-detalhe-${label}`}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
        <span style={badgeStyle("official")} title={R.tooltipValorOficial}>
          {R.badgeValorOficial}: {formatEurDisplay(totalOficial)}
        </span>
        {hasOverride ? (
          <span style={badgeStyle("override")}>{R.badgeOverride}</span>
        ) : (
          <span style={badgeStyle("info")}>SSOT</span>
        )}
        {detalhe.length > 0 ? (
          <span style={badgeStyle(diverges ? "override" : "info")}>
            {R.totalVisual}: {formatEurDisplay(visualTotal)}
          </span>
        ) : null}
      </div>

      <div style={reportTableWrap}>
        <table style={reportTable}>
          <thead>
            <tr>
              <th style={reportTh}>{R.tipo}</th>
              <th style={reportTh}>{R.quantidade}</th>
              <th style={reportTh}>{R.precoUnit}</th>
              <th style={reportTh}>{R.total}</th>
              <th style={reportTh} />
            </tr>
          </thead>
          <tbody>
            {detalhe.length === 0 ? (
              <tr>
                <td style={reportTd} colSpan={5}>
                  {R.semItens}
                </td>
              </tr>
            ) : (
              detalhe.map((d, idx) => (
                <tr key={d.id}>
                  <td style={reportTd}>
                    <input
                      style={{ ...reportInput, minHeight: 32 }}
                      value={d.tipo}
                      onChange={(e) => updateRow(idx, { tipo: e.target.value })}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      style={{ ...reportInput, minHeight: 32, width: 80 }}
                      value={d.quantidade || ""}
                      onChange={(e) =>
                        updateRow(idx, {
                          quantidade: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      style={{ ...reportInput, minHeight: 32, width: 90 }}
                      value={d.precoUnitario ?? ""}
                      onChange={(e) =>
                        updateRow(idx, {
                          precoUnitario: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      style={{ ...reportInput, minHeight: 32, width: 90 }}
                      value={d.total ?? ""}
                      onChange={(e) =>
                        updateRow(idx, {
                          total: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td style={reportTd}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onChange(detalhe.filter((_, i) => i !== idx))}
                    >
                      {R.remover}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...detalhe, createEmptyItemDetalhe(label)])}
        >
          {R.adicionarItem}
        </Button>
        {diverges && onApplyVisualAsOverride ? (
          <Button
            type="button"
            variant="primary"
            disabled={saving}
            onClick={() => onApplyVisualAsOverride(visualTotal)}
            title={R.aplicarVisualOverrideHint}
          >
            {saving ? R.aGuardar : R.aplicarVisualOverride}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
