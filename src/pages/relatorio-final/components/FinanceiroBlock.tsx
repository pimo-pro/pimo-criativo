/**
 * Bloco financeiro do Relatório Final — custos dinâmicos (P3.25).
 * Preços = computeFinanceiroUnificado (SSOT ADMIN). Sem recalculo local.
 */
import { Fragment, useState, type CSSProperties } from "react";
import {
  FINANCEIRO_REPORT_LABELS,
  type ProjectReportFinanceiro,
  type ReportFinanceiroLinha,
  type ReportStyle,
} from "@/core/projectReport";
import { type FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  reportInput,
  reportLabel,
  reportSection,
  reportSectionTitle,
  reportTable,
  reportTableWrap,
  reportTd,
  reportTh,
} from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  style: ReportStyle;
  value: ProjectReportFinanceiro;
  /** P3.25: ignorado — preços são SSOT; mantido por compatibilidade de API. */
  onChange?: (next: ProjectReportFinanceiro) => void;
};

function formatEur(n: number): string {
  return `${(Number(n) || 0).toFixed(2)} EUR`;
}

function isCustoKey(key: ReportFinanceiroLinha["key"]): key is FinanceiroCustoKey {
  return key !== "iva" && key !== "total";
}

function displayQtyPrice(n: number | null | undefined): string | number {
  if (n == null || !Number.isFinite(n) || n === 0) return "";
  return n;
}

/** Painel accordion sólido (não transparente). */
const accordionPanelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  margin: "4px 0 8px",
  background: "var(--card-bg, var(--ui-color-surface, #fff))",
  border: "1px solid var(--card-border, var(--border, rgba(127,127,127,0.25)))",
  borderRadius: 8,
  color: "var(--text-main)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

export default function FinanceiroBlock({ style, value }: Props) {
  /** Accordions fechados por defeito. */
  const [openKeys, setOpenKeys] = useState<Set<FinanceiroCustoKey>>(() => new Set());

  const toggleKey = (key: FinanceiroCustoKey) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section style={reportSection(style)} data-testid="financeiro-block-ssot">
      <h2 style={reportSectionTitle}>{R.financeiro}</h2>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-muted)" }}>
        {R.financeiroHint}
      </p>

      <label style={{ display: "inline-block", marginBottom: 10 }}>
        <span style={reportLabel}>{R.ivaPct}</span>
        <input
          type="number"
          min={0}
          step={0.1}
          readOnly
          style={{ ...reportInput, width: 100 }}
          value={value.ivaPct}
        />
      </label>

      <div style={reportTableWrap}>
        <table style={reportTable}>
          <thead>
            <tr>
              <th style={reportTh}>{R.linha}</th>
              <th style={reportTh}>{R.quantidade}</th>
              <th style={reportTh}>{R.precoUnit}</th>
              <th style={reportTh}>{R.total}</th>
            </tr>
          </thead>
          <tbody>
            {value.linhas
              .filter((linha) => linha.key !== "chapasReais")
              .map((linha) => {
                const locked = linha.key === "iva" || linha.key === "total";
                const bold = linha.key === "total";
                const key = isCustoKey(linha.key) ? linha.key : null;
                const isOpen = key ? openKeys.has(key) : false;
                const displayLabel =
                  key && key in FINANCEIRO_REPORT_LABELS
                    ? FINANCEIRO_REPORT_LABELS[key]
                    : linha.label;

                return (
                  <Fragment key={linha.key}>
                    <tr
                      style={
                        bold
                          ? { fontWeight: 700, background: "rgba(59,130,246,0.08)" }
                          : undefined
                      }
                    >
                      <td style={reportTd}>
                        {key ? (
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--blue-light, #3b82f6)",
                              cursor: "pointer",
                              padding: 0,
                              font: "inherit",
                              textDecoration: "underline",
                            }}
                            onClick={() => toggleKey(key)}
                          >
                            {displayLabel}
                            {isOpen ? " \u25BE" : " \u25B8"}
                          </button>
                        ) : (
                          displayLabel
                        )}
                      </td>
                      <td style={reportTd}>
                        {locked ? (
                          "-"
                        ) : (
                          <input
                            type="number"
                            readOnly
                            style={{ ...reportInput, minHeight: 32, width: 100 }}
                            value={displayQtyPrice(linha.quantidade)}
                            placeholder="-"
                          />
                        )}
                      </td>
                      <td style={reportTd}>
                        {locked ? (
                          "-"
                        ) : (
                          <input
                            type="number"
                            readOnly
                            style={{ ...reportInput, minHeight: 32, width: 110 }}
                            value={displayQtyPrice(linha.precoUnitario)}
                            placeholder="-"
                          />
                        )}
                      </td>
                      <td style={reportTd}>{formatEur(linha.total)}</td>
                    </tr>

                    {key && isOpen ? (
                      <tr>
                        <td style={reportTd} colSpan={4}>
                          <div style={accordionPanelStyle}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                              {R.semItens} — total SSOT: {formatEur(linha.total)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
        {R.subtotal}: <strong>{formatEur(value.subtotal)}</strong>
        {" \u00b7 "}IVA: <strong>{formatEur(value.ivaValor)}</strong>
        {" \u00b7 "}
        {R.total}: <strong>{formatEur(value.totalProjeto)}</strong>
      </div>
    </section>
  );
}
