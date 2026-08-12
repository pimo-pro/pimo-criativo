/**
 * Bloco financeiro do Relatório Final — custos dinâmicos (P3.26).
 * Totais = computeFinanceiroUnificado (SSOT ADMIN). Detalhe = só visualização.
 * Overrides manuais não recalculam a base Unificado.
 */
import { Fragment, useState, type CSSProperties } from "react";
import {
  FINANCEIRO_REPORT_LABELS,
  PAINEIS_ORIGEM_LABEL,
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
import PaineisAccordion from "./PaineisAccordion";

type Props = {
  style: ReportStyle;
  value: ProjectReportFinanceiro;
  /**
   * Override manual de linha (não altera o motor Unificado).
   * null = remover override.
   */
  onLineOverride?: (key: FinanceiroCustoKey, value: number | null) => void;
};

function formatEur(n: number): string {
  return `${(Number(n) || 0).toFixed(2)} EUR`;
}

function isCustoKey(key: ReportFinanceiroLinha["key"]): key is FinanceiroCustoKey {
  return key !== "iva" && key !== "total";
}

/** Keys editáveis como override manual (não portas/remates/chapasReais/iva/total). */
const OVERRIDEABLE_KEYS = new Set<FinanceiroCustoKey>([
  "paineis",
  "gavetas",
  "ferragens",
  "orla",
  "operacoes",
  "desperdicio",
  "serragem",
  "maoDeObra",
  "logistica",
  "operacoesAvancadas",
  "adm",
  "montagem",
  "portes",
]);

const accordionPanelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  margin: "4px 0 8px",
  background: "var(--card-bg, var(--ui-color-surface, #fff))",
  border: "1px solid var(--card-border, var(--border, rgba(127,127,127,0.25)))",
  borderRadius: 8,
  color: "var(--text-main)",
};

export default function FinanceiroBlock({ style, value, onLineOverride }: Props) {
  const [openKeys, setOpenKeys] = useState<Set<FinanceiroCustoKey>>(() => new Set());

  const toggleKey = (key: FinanceiroCustoKey) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const badge =
    value.paineisOrigem && value.paineisOrigem in PAINEIS_ORIGEM_LABEL
      ? PAINEIS_ORIGEM_LABEL[value.paineisOrigem]
      : PAINEIS_ORIGEM_LABEL.chapas_reais_m2_area;

  const paineisLinha = value.linhas.find((l) => l.key === "paineis");
  const firstChapa = paineisLinha?.detalhe?.[0];
  const eurM2 = firstChapa?.precoPorM2 ?? null;
  const eurChapa = firstChapa?.precoUnitario ?? null;

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
              <th style={reportTh}>{R.origem}</th>
              <th style={reportTh}>{R.ajusteManual}</th>
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
                const hasOverride =
                  key != null &&
                  value.lineOverrides != null &&
                  Object.prototype.hasOwnProperty.call(value.lineOverrides, key);
                const canOverride =
                  key != null && OVERRIDEABLE_KEYS.has(key) && Boolean(onLineOverride);

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
                        {key === "paineis" ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {badge}
                          </span>
                        ) : locked ? (
                          "-"
                        ) : hasOverride ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {R.overrideManual}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            SSOT
                          </span>
                        )}
                      </td>
                      <td style={reportTd}>
                        {locked || !canOverride || !key ? (
                          "-"
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            style={{ ...reportInput, minHeight: 32, width: 110 }}
                            value={
                              hasOverride
                                ? value.lineOverrides![key]!
                                : ""
                            }
                            placeholder={linha.total.toFixed(2)}
                            title={R.ajusteManualHint}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw.trim() === "") {
                                onLineOverride?.(key, null);
                                return;
                              }
                              const n = Number(raw);
                              if (Number.isFinite(n) && n >= 0) {
                                onLineOverride?.(key, n);
                              }
                            }}
                          />
                        )}
                      </td>
                      <td style={reportTd}>{formatEur(linha.total)}</td>
                    </tr>

                    {key && isOpen ? (
                      <tr>
                        <td style={reportTd} colSpan={4}>
                          {key === "paineis" ? (
                            <PaineisAccordion
                              detalhe={paineisLinha?.detalhe ?? []}
                              totalOficial={paineisLinha?.total ?? 0}
                              badgeLabel={badge}
                              eurM2Dominante={eurM2}
                              eurChapaDerivado={eurChapa}
                            />
                          ) : (
                            <div style={accordionPanelStyle}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 13,
                                  color: "var(--text-muted)",
                                }}
                              >
                                {R.semItens} — total SSOT: {formatEur(linha.total)}
                              </p>
                            </div>
                          )}
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
