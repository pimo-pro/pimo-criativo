/**
 * Accordion de chapas reais no Relatório Final (P3.26).
 * Só visualização — NÃO altera totais do Financeiro Unificado.
 */
import type { CSSProperties } from "react";
import type { ReportFinanceiroDetalhe } from "@/core/projectReport";
import {
  resolveDimensoesMm,
  formatEurDisplay,
} from "@/core/projectReport";
import { reportTable, reportTableWrap, reportTd, reportTh } from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  detalhe: ReportFinanceiroDetalhe[];
  /** Total oficial Unificado (referência). */
  totalOficial: number;
  badgeLabel: string;
  eurM2Dominante?: number | null;
  eurChapaDerivado?: number | null;
};

function round4(n: number): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

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

export default function PaineisAccordion({
  detalhe,
  totalOficial,
  badgeLabel,
  eurM2Dominante,
  eurChapaDerivado,
}: Props) {
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
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 4,
            background: "rgba(59,130,246,0.12)",
            color: "var(--blue-light, #3b82f6)",
            fontWeight: 600,
          }}
        >
          {badgeLabel}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {R.totalSsot}: {formatEurDisplay(totalOficial)}
        </span>
        {eurM2Dominante != null && eurM2Dominante > 0 ? (
          <span style={{ color: "var(--text-muted)" }}>
            €/m²: {eurM2Dominante.toFixed(2)}
          </span>
        ) : null}
        {eurChapaDerivado != null && eurChapaDerivado > 0 ? (
          <span style={{ color: "var(--text-muted)" }}>
            €/chapa: {eurChapaDerivado.toFixed(2)}
          </span>
        ) : null}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
        {R.paineisAccordionHint}
      </p>

      {detalhe.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          {R.semChapasNesting}
        </p>
      ) : (
        <div style={reportTableWrap}>
          <table style={reportTable}>
            <thead>
              <tr>
                <th style={reportTh}>{R.tipo}</th>
                <th style={reportTh}>{R.espessura}</th>
                <th style={reportTh}>{R.areaM2}</th>
                <th style={reportTh}>{R.quantidade}</th>
                <th style={reportTh}>{R.precoM2}</th>
                <th style={reportTh}>{R.precoChapa}</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.map((d) => {
                const dims = resolveDimensoesMm(d);
                const area =
                  Number(d.areaChapaM2) > 0
                    ? Number(d.areaChapaM2)
                    : round4((dims.L * dims.A) / 1_000_000);
                return (
                  <tr key={d.id}>
                    <td style={reportTd}>{d.tipo || "—"}</td>
                    <td style={reportTd}>
                      {d.espessuraMm != null ? `${d.espessuraMm} mm` : "—"}
                    </td>
                    <td style={reportTd}>{area > 0 ? area.toFixed(4) : "—"}</td>
                    <td style={reportTd}>{d.quantidade || "—"}</td>
                    <td style={reportTd}>
                      {Number(d.precoPorM2) > 0
                        ? Number(d.precoPorM2).toFixed(2)
                        : "—"}
                    </td>
                    <td style={reportTd}>
                      {Number(d.precoUnitario) > 0
                        ? Number(d.precoUnitario).toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
