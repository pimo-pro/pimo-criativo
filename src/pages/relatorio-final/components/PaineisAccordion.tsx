/**
 * Accordion de chapas — P3.27 editável (camada visual).
 * Totais oficiais SSOT não são alterados; só o detalhe visual.
 */
import { useMemo, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import type { ReportFinanceiroDetalhe } from "@/core/projectReport";
import {
  formatEurDisplay,
  listCatalogoChapas,
  resolveDimensoesMm,
  calcArea,
  createEmptyChapaDetalhe,
  createManualChapaDetalhe,
  findChapaCatalogOption,
  rebuildChapaDetalhe,
  sumDetalheVisual,
} from "@/core/projectReport";
import { reportInput, reportTable, reportTableWrap, reportTd, reportTh } from "../reportStyles";
import { R } from "../uiLabels";
import ReportCatalogOrManualField from "./ReportCatalogOrManualField";

type Props = {
  detalhe: ReportFinanceiroDetalhe[];
  totalOficial: number;
  badgeLabel: string;
  onChange: (next: ReportFinanceiroDetalhe[]) => void;
  /** Tipos de chapa do nesting/projecto (sugestões datalist). */
  paineisSugestoesProjeto?: string[];
  /** Aplicar soma visual como override da linha Painéis. */
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

export default function PaineisAccordion({
  detalhe,
  totalOficial,
  badgeLabel,
  onChange,
  paineisSugestoesProjeto,
  onApplyVisualAsOverride,
  saving = false,
}: Props) {
  const catalogo = useMemo(() => listCatalogoChapas(), []);
  const [catalogPick, setCatalogPick] = useState("");
  const tipoSugestoes = useMemo(() => {
    const fromDetalhe = detalhe.map((d) => d.tipo).filter(Boolean);
    return [...catalogo.map((c) => c.label), ...fromDetalhe, ...(paineisSugestoesProjeto ?? [])];
  }, [catalogo, detalhe, paineisSugestoesProjeto]);
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
                      <ReportCatalogOrManualField
                        listId={`ch-tipo-${d.id}`}
                        value={d.tipo}
                        options={tipoSugestoes}
                        placeholder={R.nomeOuCatalogo}
                        title={R.substituirMaterial}
                        onChange={(label) => {
                          const opt = findChapaCatalogOption(label, catalogo);
                          if (opt) updateRow(idx, { materialOpt: opt });
                          else updateRow(idx, { tipo: label });
                        }}
                      />
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select
          style={{ ...reportInput, minHeight: 32, minWidth: 160 }}
          value={catalogPick}
          onChange={(e) => setCatalogPick(e.target.value)}
        >
          <option value="">{R.escolherChapaCatalogo}</option>
          {catalogo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          disabled={!catalogPick}
          onClick={() => {
            const opt = catalogo.find((c) => c.id === catalogPick);
            if (!opt) return;
            onChange([...detalhe, createEmptyChapaDetalhe(opt)]);
            setCatalogPick("");
          }}
        >
          {R.adicionarDoCatalogo}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...detalhe, createManualChapaDetalhe()])}
        >
          {R.adicionarManualmente}
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
