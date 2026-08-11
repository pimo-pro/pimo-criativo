/**
 * Bloco financeiro do Relatório Final — só leitura (espelho live do Unificado ADMIN).
 * P3.19: chapas/Painéis no bloco dedicado; aqui só totais (sem €/chapa derivado).
 */

import { useState, type CSSProperties } from "react";
import {
  FINANCEIRO_REPORT_LABELS,
  financeiroCustoLinhasDisplay,
  financeiroTotaisDisplay,
  formatEurDisplay,
  madeiraTotalFromFinanceiro,
  type ProjectReportFinanceiro,
  type ReportStyle,
} from "@/core/projectReport";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import {
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
};

const totalCardStyle: CSSProperties = {
  marginTop: 16,
  padding: "22px 24px",
  borderRadius: 14,
  border: "2px solid var(--blue-light, #2563eb)",
  background:
    "linear-gradient(145deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.03) 100%)",
  textAlign: "center",
  boxShadow: "0 8px 24px rgba(37, 99, 235, 0.12)",
};

const totRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 16,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border, rgba(127,127,127,0.22))",
  background: "var(--card-bg, var(--ui-color-surface, transparent))",
};

export default function FinanceiroBlock({ style, value }: Props) {
  const [detalheAberto, setDetalheAberto] = useState(false);
  const totais = financeiroTotaisDisplay(value);
  const madeira = madeiraTotalFromFinanceiro(value);
  /** Sem Painéis/chapasReais — detalhe de chapas vive no bloco Painéis. */
  const custoLinhas = financeiroCustoLinhasDisplay(value.linhas).filter(
    (l) => l.key !== "paineis"
  );

  return (
    <section style={reportSection(style)} data-testid="financeiro-block">
      <h2 style={reportSectionTitle}>{R.financeiro}</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-muted)" }}>
        {R.financeiroHint}
      </p>

      <div
        style={{ display: "grid", gap: 10, maxWidth: 480, marginBottom: 8 }}
        data-testid="financeiro-totais-unicos"
      >
        <div style={totRowStyle} data-testid="financeiro-chapas-total">
          <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>
            {R.custoChapasReais}
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {formatEurDisplay(madeira)}
          </span>
        </div>
        <div style={totRowStyle} data-testid="financeiro-subtotal">
          <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>
            {R.subtotal}
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {formatEurDisplay(totais.subtotal)}
          </span>
        </div>
        <div style={totRowStyle} data-testid="financeiro-iva">
          <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>
            IVA ({totais.ivaPct}%)
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {formatEurDisplay(totais.ivaValor)}
          </span>
        </div>
      </div>

      <div style={totalCardStyle} data-testid="financeiro-total-destaque">
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--blue-light, #2563eb)",
            marginBottom: 8,
          }}
        >
          {R.totalProjeto}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-main, #0f172a)",
            lineHeight: 1.1,
          }}
        >
          {formatEurDisplay(totais.totalProjeto)}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          data-testid="financeiro-toggle-detalhe"
          aria-expanded={detalheAberto}
          onClick={() => setDetalheAberto((v) => !v)}
          style={{
            background: "none",
            border: "1px solid var(--border, rgba(127,127,127,0.28))",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: "pointer",
            font: "inherit",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          {detalheAberto ? R.ocultarDetalheCustos : R.mostrarDetalheCustos}
          {detalheAberto ? " ▾" : " ▸"}
        </button>

        {detalheAberto ? (
          <div style={{ marginTop: 12 }} data-testid="financeiro-detalhe-custos">
            <div style={reportTableWrap}>
              <table style={reportTable}>
                <thead>
                  <tr>
                    <th style={reportTh}>{R.linha}</th>
                    <th style={reportTh}>{R.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {custoLinhas.map((linha) => {
                    const key = linha.key as FinanceiroCustoKey;
                    const displayLabel =
                      key in FINANCEIRO_REPORT_LABELS
                        ? FINANCEIRO_REPORT_LABELS[key]
                        : linha.label;
                    return (
                      <tr key={linha.key}>
                        <td style={reportTd}>{displayLabel}</td>
                        <td style={reportTd}>{formatEurDisplay(linha.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
