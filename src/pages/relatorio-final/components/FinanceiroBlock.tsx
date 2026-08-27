/**
 * Bloco financeiro do Relatório Final — P3.27 dinâmico.
 * Totais oficiais = Unificado (SSOT). Detalhe + overrides = camada visual.
 */
import { Fragment, useState } from "react";
import {
  FINANCEIRO_REPORT_LABELS,
  PAINEIS_ORIGEM_LABEL,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportFinanceiroLinha,
  type ReportStyle,
  type FerragemOrigemPreco,
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
import FerragensAccordion from "./FerragensAccordion";
import LinhaDetalheAccordion from "./LinhaDetalheAccordion";
import MargemGanhoRow from "./MargemGanhoRow";
import type { ReportMargemGanhoConfig } from "@/core/projectReport";

type Props = {
  style: ReportStyle;
  value: ProjectReportFinanceiro;
  onLineOverride?: (key: FinanceiroCustoKey, value: number | null) => void;
  onLinhaDetalhe?: (key: FinanceiroCustoKey, detalhe: ReportFinanceiroDetalhe[]) => void;
  /** Botão «Aplicar total visual…» → override + gravação imediata (A2). */
  onApplyVisualPersist?: (
    key: FinanceiroCustoKey,
    value: number | null
  ) => void | Promise<void>;
  saving?: boolean;
  ferragensSsotOrigem?: Record<string, FerragemOrigemPreco>;
  ferragensSugestoesProjeto?: string[];
  paineisSugestoesProjeto?: string[];
  onMargemGanhoChange?: (config: ReportMargemGanhoConfig | null) => void;
};

function formatEur(n: number): string {
  return `${(Number(n) || 0).toFixed(2)} EUR`;
}

function isCustoKey(key: ReportFinanceiroLinha["key"]): key is FinanceiroCustoKey {
  return key !== "iva" && key !== "total" && key !== "margemGanho";
}

const OVERRIDEABLE_KEYS = new Set<FinanceiroCustoKey>([
  "paineis",
  "portas",
  "gavetas",
  "ferragens",
  "orla",
  "remates",
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

export default function FinanceiroBlock({
  style,
  value,
  onLineOverride,
  onLinhaDetalhe,
  onApplyVisualPersist,
  saving = false,
  ferragensSsotOrigem,
  ferragensSugestoesProjeto,
  paineisSugestoesProjeto,
  onMargemGanhoChange,
}: Props) {
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

  const officialOf = (key: FinanceiroCustoKey): number => {
    const snap = value.officialSnapshot?.[key];
    if (typeof snap === "number" && Number.isFinite(snap)) return snap;
    return Number(value.linhas.find((l) => l.key === key)?.total) || 0;
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
              <th style={reportTh}>{R.origem}</th>
              <th style={reportTh}>{R.ajusteManual}</th>
              <th style={reportTh}>{R.total}</th>
            </tr>
          </thead>
          <tbody>
            {value.linhas
              .filter(
                (linha) =>
                  linha.key !== "chapasReais" &&
                  linha.key !== "margemGanho" &&
                  linha.key !== "iva" &&
                  linha.key !== "total"
              )
              .map((linha) => {
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
                const suspectedSticky =
                  key != null &&
                  Boolean(value.lineOverrideMeta?.[key]?.suspectedStickyEcho);
                const canOverride =
                  key != null && OVERRIDEABLE_KEYS.has(key) && Boolean(onLineOverride);
                const official = key ? officialOf(key) : linha.total;

                return (
                  <Fragment key={linha.key}>
                    <tr>
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
                        {hasOverride ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: suspectedSticky
                                ? "var(--pi-btn-danger-bg, #dc2626)"
                                : "var(--warning, #ca8a04)",
                            }}
                            title={
                              suspectedSticky
                                ? R.tooltipOverrideSuspeito
                                : R.tooltipOverride
                            }
                          >
                            {suspectedSticky
                              ? R.badgeOverrideSuspeito
                              : R.badgeOverride}
                          </span>
                        ) : key === "paineis" ? (
                          <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                            title={R.tooltipOrigemPreco}
                          >
                            {badge}
                          </span>
                        ) : (
                          <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                            title={R.tooltipValorOficial}
                          >
                            {R.badgeValorOficial}
                          </span>
                        )}
                      </td>
                      <td style={reportTd}>
                        {!canOverride || !key ? (
                          "-"
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              style={{ ...reportInput, minHeight: 32, width: 110 }}
                              value={hasOverride ? value.lineOverrides![key]! : ""}
                              placeholder={official.toFixed(2)}
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
                            {hasOverride ? (
                              <button
                                type="button"
                                disabled={saving}
                                title={R.reporAoOficialHint}
                                style={{
                                  fontSize: 11,
                                  padding: "4px 8px",
                                  cursor: saving ? "default" : "pointer",
                                  opacity: saving ? 0.6 : 1,
                                }}
                                onClick={() => onLineOverride?.(key, null)}
                              >
                                {R.reporAoOficial}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td style={reportTd}>{formatEur(linha.total)}</td>
                    </tr>

                    {key && isOpen && onLinhaDetalhe ? (
                      <tr>
                        <td style={reportTd} colSpan={4}>
                          {key === "paineis" ? (
                            <PaineisAccordion
                              detalhe={linha.detalhe ?? []}
                              totalOficial={official}
                              badgeLabel={badge}
                              paineisSugestoesProjeto={paineisSugestoesProjeto}
                              onChange={(detalhe) => onLinhaDetalhe(key, detalhe)}
                              onApplyVisualAsOverride={
                                onApplyVisualPersist
                                  ? (v) => void onApplyVisualPersist(key, v)
                                  : undefined
                              }
                              saving={saving}
                            />
                          ) : key === "ferragens" ? (
                            <FerragensAccordion
                              detalhe={linha.detalhe ?? []}
                              totalOficial={official}
                              hasOverride={hasOverride}
                              itemOverrides={value.overrides?.ferragens}
                              ferragensSsotOrigem={ferragensSsotOrigem}
                              ferragensSugestoesProjeto={ferragensSugestoesProjeto}
                              onChange={(detalhe) => onLinhaDetalhe(key, detalhe)}
                              onSyncVisualOverride={
                                onLineOverride ? (v) => onLineOverride(key, v) : undefined
                              }
                              onApplyVisualAsOverride={
                                onApplyVisualPersist
                                  ? (v) => void onApplyVisualPersist(key, v)
                                  : undefined
                              }
                              saving={saving}
                            />
                          ) : (
                            <LinhaDetalheAccordion
                              label={displayLabel}
                              detalhe={linha.detalhe ?? []}
                              totalOficial={official}
                              hasOverride={hasOverride}
                              onChange={(detalhe) => onLinhaDetalhe(key, detalhe)}
                              onApplyVisualAsOverride={
                                onApplyVisualPersist
                                  ? (v) => void onApplyVisualPersist(key, v)
                                  : undefined
                              }
                              saving={saving}
                            />
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            {onMargemGanhoChange ? (
              <MargemGanhoRow
                financeiro={value}
                margemTotal={
                  Number(value.linhas.find((l) => l.key === "margemGanho")?.total) || 0
                }
                onChange={onMargemGanhoChange}
              />
            ) : null}
            {(["iva", "total"] as const).map((rowKey) => {
              const linha = value.linhas.find((l) => l.key === rowKey);
              if (!linha) return null;
              const bold = rowKey === "total";
              return (
                <tr
                  key={rowKey}
                  style={
                    bold
                      ? { fontWeight: 700, background: "rgba(59,130,246,0.08)" }
                      : undefined
                  }
                >
                  <td style={reportTd}>{linha.label}</td>
                  <td style={reportTd}>-</td>
                  <td style={reportTd}>-</td>
                  <td style={reportTd}>{formatEur(linha.total)}</td>
                </tr>
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
        {value.officialSnapshot?.totalProjeto != null &&
        Math.abs(
          Number(value.officialSnapshot.totalProjeto) - value.totalProjeto
        ) > 0.009 ? (
          <span style={{ marginLeft: 8, fontSize: 11 }} title={R.tooltipValorOficial}>
            ({R.badgeValorOficial}: {formatEur(Number(value.officialSnapshot.totalProjeto))})
          </span>
        ) : null}
      </div>
    </section>
  );
}
