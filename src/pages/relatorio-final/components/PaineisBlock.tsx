/**
 * Bloco Painéis do Relatório Final — chapas reais editáveis (P3.19).
 * Totais do Financeiro Unificado ficam intactos; aqui edita-se só o detalhe de chapas.
 */

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  applyPrecoPorM2Edit,
  detalheFromCatalogoChapa,
  formatEurDisplay,
  listCatalogoChapas,
  recalcChapaDetalhe,
  resolveDimensoesMm,
  totalChapasDetalhe,
  type ReportFinanceiroDetalhe,
  type ReportStyle,
} from "@/core/projectReport";
import {
  reportInput,
  reportSection,
  reportSectionTitle,
  reportTable,
  reportTableWrap,
  reportTd,
  reportTh,
} from "../reportStyles";
import { R } from "../uiLabels";
import EditableModal from "./EditableModal";

type Props = {
  style: ReportStyle;
  detalhe: ReportFinanceiroDetalhe[];
  /** Total madeira do Unificado (referência). */
  totalUnificadoMadeira: number;
  onChange: (detalhe: ReportFinanceiroDetalhe[]) => void;
};

function displayQty(n: number | null | undefined): string | number {
  if (n == null || !Number.isFinite(n) || n === 0) return "";
  return n;
}

export default function PaineisBlock({
  style,
  detalhe,
  totalUnificadoMadeira,
  onChange,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const catalogo = useMemo(() => listCatalogoChapas(), []);
  const totalChapas = totalChapasDetalhe(detalhe);

  const setRows = (next: ReportFinanceiroDetalhe[]) => {
    onChange(next.map((d) => recalcChapaDetalhe(d)));
  };

  return (
    <section style={reportSection(style)} data-testid="paineis-block">
      <h2 style={reportSectionTitle}>{R.paineisTitulo}</h2>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
        {R.paineisHint}
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
              <th style={reportTh}>{R.precoTotal}</th>
              <th style={reportTh} />
            </tr>
          </thead>
          <tbody>
            {detalhe.map((d, idx) => {
              const dims = resolveDimensoesMm(d);
              return (
                <tr key={d.id}>
                  <td style={reportTd}>
                    <input
                      style={{ ...reportInput, minHeight: 32 }}
                      value={d.tipo}
                      onChange={(e) => {
                        const next = [...detalhe];
                        next[idx] = { ...d, tipo: e.target.value };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      style={{ ...reportInput, minHeight: 32, width: 90 }}
                      value={dims.L || ""}
                      placeholder="-"
                      onChange={(e) => {
                        const next = [...detalhe];
                        next[idx] = {
                          ...d,
                          comprimentoMm: Math.max(0, Number(e.target.value) || 0),
                          larguraMm: dims.A,
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      style={{ ...reportInput, minHeight: 32, width: 90 }}
                      value={dims.A || ""}
                      placeholder="-"
                      onChange={(e) => {
                        const next = [...detalhe];
                        next[idx] = {
                          ...d,
                          comprimentoMm: dims.L,
                          larguraMm: Math.max(0, Number(e.target.value) || 0),
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      style={{ ...reportInput, minHeight: 32, width: 70 }}
                      value={d.espessuraMm || ""}
                      placeholder="-"
                      onChange={(e) => {
                        const next = [...detalhe];
                        next[idx] = {
                          ...d,
                          espessuraMm: Math.max(0, Number(e.target.value) || 0),
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      style={{ ...reportInput, minHeight: 32, width: 70 }}
                      value={displayQty(d.quantidade)}
                      placeholder="-"
                      onChange={(e) => {
                        const next = [...detalhe];
                        next[idx] = {
                          ...d,
                          quantidade: Math.max(0, Number(e.target.value) || 0),
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      style={{ ...reportInput, minHeight: 32, width: 100 }}
                      value={displayQty(d.precoPorM2)}
                      placeholder="-"
                      onChange={(e) => {
                        const next = [...detalhe];
                        next[idx] = applyPrecoPorM2Edit(
                          d,
                          Math.max(0, Number(e.target.value) || 0)
                        );
                        setRows(next);
                      }}
                    />
                  </td>
                  <td style={reportTd}>{formatEurDisplay(d.total)}</td>
                  <td style={reportTd}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRows(detalhe.filter((_, i) => i !== idx))}
                    >
                      {R.remover}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {detalhe.length === 0 ? (
              <tr>
                <td style={reportTd} colSpan={8}>
                  {R.semChapas}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <Button type="button" variant="secondary" onClick={() => setAddOpen(true)}>
          {R.adicionarChapa}
        </Button>
        <div data-testid="paineis-total-chapas" style={{ fontSize: 14, fontWeight: 700 }}>
          {R.totalChapas}: {formatEurDisplay(totalChapas)}
        </div>
        <div
          data-testid="paineis-total-unificado"
          style={{ fontSize: 13, color: "var(--text-muted)" }}
        >
          {R.totalUnificadoMadeira}: {formatEurDisplay(totalUnificadoMadeira)}
        </div>
      </div>

      <EditableModal open={addOpen} title={R.escolherChapa} onClose={() => setAddOpen(false)}>
        <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {catalogo.map((opt) => (
            <button
              key={opt.id}
              type="button"
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "10px 12px",
                border: "1px solid var(--border, rgba(127,127,127,0.25))",
                borderRadius: 8,
                background: "var(--input-bg, var(--ui-color-input-bg))",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
              onClick={() => {
                const next = [...detalhe, detalheFromCatalogoChapa(opt)];
                const byEsp = new Map<number, ReportFinanceiroDetalhe>();
                for (const row of next) {
                  const esp = Math.round(Number(row.espessuraMm) || 0);
                  const prev = byEsp.get(esp);
                  if (prev && esp > 0) {
                    byEsp.set(
                      esp,
                      recalcChapaDetalhe({
                        ...prev,
                        quantidade:
                          (Number(prev.quantidade) || 0) + (Number(row.quantidade) || 0),
                      })
                    );
                  } else {
                    byEsp.set(esp || Date.now(), recalcChapaDetalhe(row));
                  }
                }
                setRows([...byEsp.values()]);
                setAddOpen(false);
              }}
            >
              <span>
                {opt.label} ({opt.espessuraMm} mm)
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {opt.precoPorM2.toFixed(2)} EUR/m²
              </span>
            </button>
          ))}
        </div>
      </EditableModal>
    </section>
  );
}
