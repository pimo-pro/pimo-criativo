import { useState } from "react";
import Button from "@/components/ui/Button";
import {
  applyFerragensDetalhe,
  makeReportId,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportMaterialLinha,
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

type Props = {
  style: ReportStyle;
  financeiro: ProjectReportFinanceiro;
  onChange: (financeiro: ProjectReportFinanceiro, materiais: ReportMaterialLinha[]) => void;
};

function formatEur(n: number): string {
  return `${(Number(n) || 0).toFixed(2)} EUR`;
}

export default function MateriaisBlock({ style, financeiro, onChange }: Props) {
  const [open, setOpen] = useState(true);
  const detalhe = financeiro.linhas.find((l) => l.key === "ferragens")?.detalhe ?? [];

  const setDetalhe = (next: ReportFinanceiroDetalhe[]) => {
    const applied = applyFerragensDetalhe(financeiro, next);
    onChange(applied.financeiro, applied.materiais);
  };

  return (
    <section style={reportSection(style)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "inherit",
          textAlign: "left",
        }}
      >
        <h2 style={{ ...reportSectionTitle, margin: 0 }}>{R.materiais}</h2>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{open ? "▾" : "▸"}</span>
      </button>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
        {R.materiaisHintFerragens}
      </p>

      {open ? (
        <>
          <div style={{ ...reportTableWrap, marginTop: 10 }}>
            <table style={reportTable}>
              <thead>
                <tr>
                  <th style={reportTh}>{R.tipo}</th>
                  <th style={reportTh}>{R.dimensoes}</th>
                  <th style={reportTh}>{R.quantidade}</th>
                  <th style={reportTh}>{R.precoUnit}</th>
                  <th style={reportTh}>{R.total}</th>
                  <th style={reportTh} />
                </tr>
              </thead>
              <tbody>
                {detalhe.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={reportTd}>
                      <input
                        style={{ ...reportInput, minHeight: 32 }}
                        value={row.tipo}
                        onChange={(e) => {
                          const next = [...detalhe];
                          next[idx] = { ...row, tipo: e.target.value };
                          setDetalhe(next);
                        }}
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        style={{ ...reportInput, minHeight: 32 }}
                        value={row.dimensoes}
                        onChange={(e) => {
                          const next = [...detalhe];
                          next[idx] = { ...row, dimensoes: e.target.value };
                          setDetalhe(next);
                        }}
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        style={{ ...reportInput, minHeight: 32, width: 90 }}
                        value={row.quantidade || ""}
                        placeholder="-"
                        onChange={(e) => {
                          const next = [...detalhe];
                          next[idx] = {
                            ...row,
                            quantidade: Math.max(0, Number(e.target.value) || 0),
                          };
                          setDetalhe(next);
                        }}
                      />
                    </td>
                    <td style={reportTd}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        style={{ ...reportInput, minHeight: 32, width: 110 }}
                        value={row.precoUnitario || ""}
                        placeholder="-"
                        onChange={(e) => {
                          const next = [...detalhe];
                          next[idx] = {
                            ...row,
                            precoUnitario: Math.max(0, Number(e.target.value) || 0),
                          };
                          setDetalhe(next);
                        }}
                      />
                    </td>
                    <td style={reportTd}>{formatEur(row.quantidade * row.precoUnitario)}</td>
                    <td style={reportTd}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setDetalhe(detalhe.filter((_, i) => i !== idx))}
                      >
                        {R.remover}
                      </Button>
                    </td>
                  </tr>
                ))}
                {detalhe.length === 0 ? (
                  <tr>
                    <td style={reportTd} colSpan={6}>
                      {R.semMateriais}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setDetalhe([
                  ...detalhe,
                  {
                    id: makeReportId("fd"),
                    tipo: "",
                    dimensoes: "",
                    quantidade: 1,
                    precoUnitario: 0,
                    total: 0,
                  },
                ])
              }
            >
              {R.adicionarLinha}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
