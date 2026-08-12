/**
 * Accordion de chapas — P3.27 editável (camada visual).
 * Totais oficiais SSOT não são alterados; só o detalhe visual.
 */
import { useMemo, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import type { ReportFinanceiroDetalhe, CatalogoChapaOption } from "@/core/projectReport";
import {
  formatEurDisplay,
  listCatalogoChapas,
  resolveDimensoesMm,
  calcArea,
  createEmptyChapaDetalhe,
  rebuildChapaDetalhe,
  sumDetalheVisual,
} from "@/core/projectReport";
import { reportInput, reportTable, reportTableWrap, reportTd, reportTh } from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  detalhe: ReportFinanceiroDetalhe[];
  totalOficial: number;
  badgeLabel: string;
  onChange: (next: ReportFinanceiroDetalhe[]) => void;
  /** Aplicar soma visual como override da linha Painéis. */
  onApplyVisualAsOverride?: (visualTotal: number) => void;
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

export default function PaineisAccordion({
  detalhe,
  totalOficial,
  badgeLabel,
  onChange,
  onApplyVisualAsOverride,
}: Props) {
  const catalogo = useMemo(() => listCatalogoChapas(), []);
  const visualTotal = sumDetalheVisual(detalhe);
  const diverges = Math.abs(visualTotal - totalOficial) > 0.009;

  const updateRow = (idx: number, patch: Parameters<typeof rebuildChapaDetalhe>[1]) => {
    const next = [...detalhe];
    next[idx] = rebuildChapaDetalhe(detalhe[idx], patch);
    onChange(next);
  };

  const removeRow = (idx: number) => {
    onChange(detalhe.filter((_, i) => i !== idx));
  };

  const addRow = (opt?: CatalogoChapaOption) => {
    onChange([...detalhe, createEmptyChapaDetalhe(opt ?? catalogo[0] ?? null)]);
  };

  return (
    <div style={panelStyle} data-testid="paineis-accordion">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          fontSize: 12,
        }}
      >
        <span style={badgeStyle("info")} title={R.tooltipOrigemPreco}>
          {badgeLabel}
        </span>
        <span style={badgeStyle("official")} title={R.tooltipValorOficial}>
          {R.badgeValorOficial}: {formatEurDisplay(totalOficial)}
        </span>
        <span
          style={badgeStyle(diverges ? "override" : "info")}
          title={R.tooltipTotalVisual}
        >
          {R.totalVisualChapas}: {formatEurDisplay(visualTotal)}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
        {R.paineisAccordionHint}
      </p>

      <div style={reportTableWrap}>
        <table style={reportTable}>
          <thead>
            <tr>
              <th style={reportTh}>{R.tipo}</th>
              <th style={reportTh}>{R.comprimentoMm}</th>
              <th style={reportTh}>{R.larguraMm}</th>
              <th style={reportTh}>{R.espessura}</th>
              <th style={reportTh}>{R.quantidade}</th>
              <th style={reportTh}>{R.precoM2}</th>
              <th style={reportTh}>{R.precoChapa}</th>
              <th style={reportTh}>{R.total}</th>
              <th style={reportTh} />
            </tr>
          </thead>
          <tbody>
            {detalhe.length === 0 ? (
              <tr>
                <td style={reportTd} colSpan={9}>
                  {R.semChapasNesting}
                </td>
              </tr>
            ) : (
              detalhe.map((d, idx) => {
                const dims = resolveDimensoesMm(d);
                const area = calcArea(dims.L, dims.A);
                return (
                  <tr key={d.id}>
                    <td style={reportTd}>
                      <select
                        style={{ ...reportInput, minHeight: 32, minWidth: 120 }}
                        value={d.tipo}
                        title={R.substituirMaterial}
                        onChange={(e) => {
                          const opt = catalogo.find((c) => c.label === e.target.value);
                          if (opt) updateRow(idx, { materialOpt: opt });
                          else updateRow(idx, { tipo: e.target.value });
                        }}
                      >
                        {!catalogo.some((c) => c.label === d.tipo) ? (
                          <option value={d.tipo}>{d.tipo}</option>
                        ) : null}
                        {catalogo.map((c) => (
                          <option key={c.id} value={c.label}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        style={{ ...reportInput, minHeight: 32, width: 80 }}
                        value={dims.L || ""}
                        onChange={(e) =>
                          updateRow(idx, {
                            comprimentoMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        style={{ ...reportInput, minHeight: 32, width: 80 }}
                        value={dims.A || ""}
                        onChange={(e) =>
                          updateRow(idx, {
                            larguraMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        style={{ ...reportInput, minHeight: 32, width: 64 }}
                        value={d.espessuraMm ?? ""}
                        onChange={(e) =>
                          updateRow(idx, {
                            espessuraMm: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {area > 0 ? `${area.toFixed(3)} m²` : ""}
                      </div>
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        style={{ ...reportInput, minHeight: 32, width: 64 }}
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
                        style={{ ...reportInput, minHeight: 32, width: 72 }}
                        value={d.precoPorM2 ?? ""}
                        onChange={(e) =>
                          updateRow(idx, {
                            precoPorM2: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        style={{ ...reportInput, minHeight: 32, width: 72 }}
                        value={d.precoUnitario ?? ""}
                        title={R.precoChapa}
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
                        style={{ ...reportInput, minHeight: 32, width: 80 }}
                        value={d.total ?? ""}
                        title={R.totalVisualChapas}
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
        <Button type="button" variant="secondary" onClick={() => addRow()}>
          {R.adicionarChapa}
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
