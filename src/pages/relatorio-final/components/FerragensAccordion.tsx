/**
 * Accordion de Ferragens — P3.28 editável (camada visual).
 * Totais oficiais SSOT não são alterados; só o detalhe visual.
 */
import { useMemo, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import type { ReportFinanceiroDetalhe, ReportFerragensOverridesMap } from "@/core/projectReport";
import {
  formatEurDisplay,
  applyFerragemCatalogOpt,
  createEmptyFerragemDetalhe,
  emitFerragensTotalVisual,
  listCatalogoFerragens,
  origemPrecoLabel,
  rebuildFerragemDetalhe,
  resolveOrigemPrecoLinha,
} from "@/core/projectReport";
import { reportInput, reportTable, reportTableWrap, reportTd, reportTh } from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  detalhe: ReportFinanceiroDetalhe[];
  totalOficial: number;
  hasOverride?: boolean;
  itemOverrides?: ReportFerragensOverridesMap;
  onChange: (next: ReportFinanceiroDetalhe[]) => void;
  onApplyVisualAsOverride?: (visualTotal: number | null) => void;
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

export default function FerragensAccordion({
  detalhe,
  totalOficial,
  hasOverride,
  itemOverrides,
  onChange,
  onApplyVisualAsOverride,
}: Props) {
  const catalogo = useMemo(() => listCatalogoFerragens(), []);
  const visualTotal = emitFerragensTotalVisual(detalhe);
  const diverges = Math.abs(visualTotal - totalOficial) > 0.009;

  const commit = (next: ReportFinanceiroDetalhe[]) => {
    onChange(next);
    if (!onApplyVisualAsOverride) return;
    const sum = emitFerragensTotalVisual(next);
    if (Math.abs(sum - totalOficial) > 0.009) onApplyVisualAsOverride(sum);
    else onApplyVisualAsOverride(null);
  };

  const updateRow = (
    idx: number,
    patch: Parameters<typeof rebuildFerragemDetalhe>[1]
  ) => {
    const next = [...detalhe];
    next[idx] = rebuildFerragemDetalhe(detalhe[idx], patch);
    commit(next);
  };

  const removeRow = (idx: number) => {
    commit(detalhe.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    commit([...detalhe, createEmptyFerragemDetalhe(catalogo[0] ?? null)]);
  };

  return (
    <div style={panelStyle} data-testid="ferragens-accordion">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          fontSize: 12,
        }}
      >
        <span style={badgeStyle("official")} title={R.tooltipValorOficial}>
          {R.badgeValorOficial}: {formatEurDisplay(totalOficial)}
        </span>
        {hasOverride ? (
          <span style={badgeStyle("override")}>{R.badgeOverride}</span>
        ) : (
          <span style={badgeStyle("info")}>SSOT</span>
        )}
        <span style={badgeStyle(diverges ? "override" : "info")} title={R.tooltipTotalVisual}>
          {R.totalVisual}: {formatEurDisplay(visualTotal)}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
        {R.ferragensAccordionHint}
      </p>

      <div style={reportTableWrap}>
        <table style={reportTable}>
          <thead>
            <tr>
              <th style={reportTh}>{R.nomeFerragem}</th>
              <th style={reportTh}>{R.quantidade}</th>
              <th style={reportTh}>{R.precoUnit}</th>
              <th style={reportTh}>{R.observacoes}</th>
              <th style={reportTh}>{R.total}</th>
              <th style={reportTh} />
            </tr>
          </thead>
          <tbody>
            {detalhe.length === 0 ? (
              <tr>
                <td style={reportTd} colSpan={6}>
                  {R.semFerragens}
                </td>
              </tr>
            ) : (
              detalhe.map((d, idx) => {
                const origem = resolveOrigemPrecoLinha(d, itemOverrides);
                const isItemOv = origem === "override" || origem === "manual";
                const selectValue =
                  catalogo.find((c) => c.id === d.ferragemId)?.nome ??
                  catalogo.find((c) => c.nome === d.tipo)?.nome ??
                  d.tipo;
                return (
                  <tr key={d.id}>
                    <td style={reportTd}>
                      <select
                        style={{ ...reportInput, minHeight: 32, minWidth: 140 }}
                        value={selectValue}
                        title={`${R.substituirFerragem} \u2014 ${R.tooltipOrigemPrecoFerragem}: ${origemPrecoLabel(origem)}`}
                        onChange={(e) => {
                          const opt = catalogo.find(
                            (c) => c.nome === e.target.value || c.id === e.target.value
                          );
                          if (opt) {
                            const next = [...detalhe];
                            next[idx] = applyFerragemCatalogOpt(d, opt);
                            commit(next);
                          } else {
                            updateRow(idx, { tipo: e.target.value });
                          }
                        }}
                      >
                        {!catalogo.some((c) => c.nome === d.tipo || c.id === d.ferragemId) ? (
                          <option value={d.tipo}>{d.tipo}</option>
                        ) : null}
                        {catalogo.map((c) => (
                          <option key={c.id} value={c.nome}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                      {isItemOv ? (
                        <div>
                          <span style={{ ...badgeStyle("override"), marginTop: 4 }}>
                            {R.badgeOverride}
                          </span>
                        </div>
                      ) : null}
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
                        title={`${R.precoUnit} (${origemPrecoLabel(origem)})`}
                        onChange={(e) =>
                          updateRow(idx, {
                            precoUnitario: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        style={{ ...reportInput, minHeight: 32, minWidth: 100 }}
                        value={d.dimensoes}
                        placeholder={R.observacoes}
                        onChange={(e) => updateRow(idx, { dimensoes: e.target.value })}
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        style={{ ...reportInput, minHeight: 32, width: 90 }}
                        value={d.total ?? ""}
                        title={R.totalVisual}
                        onChange={(e) =>
                          updateRow(idx, {
                            total: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </td>
                    <td style={reportTd}>
                      <Button type="button" variant="ghost" onClick={() => removeRow(idx)}>
                        {R.remover}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button type="button" variant="secondary" onClick={addRow}>
          {R.adicionarFerragem}
        </Button>
        {diverges && onApplyVisualAsOverride ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => onApplyVisualAsOverride(visualTotal)}
            title={R.aplicarVisualOverrideHint}
          >
            {R.aplicarVisualOverride}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
