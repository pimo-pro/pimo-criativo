import { Fragment, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  detalheFromCatalogoChapa,
  listCatalogoChapas,
  makeReportId,
  recalcChapaDetalhe,
  recalcFinanceiro,
  updateFinanceiroLinha,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportFinanceiroLinha,
  type ReportStyle,
} from "@/core/projectReport";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
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
import EditableModal from "./EditableModal";

type Props = {
  style: ReportStyle;
  value: ProjectReportFinanceiro;
  onChange: (next: ProjectReportFinanceiro) => void;
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

export default function FinanceiroBlock({ style, value, onChange }: Props) {
  const [openKey, setOpenKey] = useState<FinanceiroCustoKey | null>(null);
  const [paineisOpen, setPaineisOpen] = useState(false);
  const [addChapaOpen, setAddChapaOpen] = useState(false);
  const catalogo = useMemo(() => listCatalogoChapas(), []);

  const openLinha = openKey && openKey !== "paineis" ? value.linhas.find((l) => l.key === openKey) : null;
  const paineisLinha = value.linhas.find((l) => l.key === "paineis");

  const setDetalhe = (key: FinanceiroCustoKey, detalhe: ReportFinanceiroDetalhe[]) => {
    onChange(updateFinanceiroLinha(value, key, { detalhe }));
  };

  const setPaineisDetalhe = (detalhe: ReportFinanceiroDetalhe[]) => {
    setDetalhe(
      "paineis",
      detalhe.map((d) => recalcChapaDetalhe(d))
    );
  };

  const onLinhaClick = (key: FinanceiroCustoKey) => {
    if (key === "paineis") {
      setPaineisOpen((v) => !v);
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
  };

  return (
    <section style={reportSection(style)}>
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
          style={{ ...reportInput, width: 100 }}
          value={value.ivaPct}
          onChange={(e) =>
            onChange(
              recalcFinanceiro({
                ...value,
                ivaPct: Math.max(0, Number(e.target.value) || 0),
              })
            )
          }
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
            {value.linhas.map((linha) => {
              const locked = linha.key === "iva" || linha.key === "total";
              const bold = linha.key === "total";
              const isPaineis = linha.key === "paineis";
              return (
                <Fragment key={linha.key}>
                  <tr
                    style={bold ? { fontWeight: 700, background: "rgba(59,130,246,0.08)" } : undefined}
                  >
                    <td style={reportTd}>
                      {isCustoKey(linha.key) ? (
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
                          onClick={() => onLinhaClick(linha.key as FinanceiroCustoKey)}
                        >
                          {linha.label}
                          {isPaineis ? (paineisOpen ? " ▾" : " ▸") : ""}
                        </button>
                      ) : (
                        linha.label
                      )}
                    </td>
                    <td style={reportTd}>
                      {locked ? (
                        "-"
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          style={{ ...reportInput, minHeight: 32, width: 100 }}
                          value={displayQtyPrice(linha.quantidade)}
                          placeholder="-"
                          onChange={(e) => {
                            const raw = e.target.value;
                            const quantidade = raw === "" ? null : Math.max(0, Number(raw) || 0);
                            onChange(
                              updateFinanceiroLinha(value, linha.key as FinanceiroCustoKey, {
                                quantidade,
                              })
                            );
                          }}
                        />
                      )}
                    </td>
                    <td style={reportTd}>
                      {locked ? (
                        "-"
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          style={{ ...reportInput, minHeight: 32, width: 110 }}
                          value={displayQtyPrice(linha.precoUnitario)}
                          placeholder="-"
                          onChange={(e) => {
                            const raw = e.target.value;
                            const precoUnitario = raw === "" ? null : Math.max(0, Number(raw) || 0);
                            onChange(
                              updateFinanceiroLinha(value, linha.key as FinanceiroCustoKey, {
                                precoUnitario,
                              })
                            );
                          }}
                        />
                      )}
                    </td>
                    <td style={reportTd}>{formatEur(linha.total)}</td>
                  </tr>
                  {isPaineis && paineisOpen ? (
                    <tr>
                      <td style={reportTd} colSpan={4}>
                        <div style={{ display: "grid", gap: 10, padding: "8px 0" }}>
                          <div style={reportTableWrap}>
                            <table style={reportTable}>
                              <thead>
                                <tr>
                                  <th style={reportTh}>{R.tipo}</th>
                                  <th style={reportTh}>{R.medida}</th>
                                  <th style={reportTh}>{R.espessura}</th>
                                  <th style={reportTh}>{R.quantidade}</th>
                                  <th style={reportTh}>{R.precoChapa}</th>
                                  <th style={reportTh}>{R.precoTotal}</th>
                                  <th style={reportTh} />
                                </tr>
                              </thead>
                              <tbody>
                                {(paineisLinha?.detalhe ?? []).map((d, idx) => (
                                  <tr key={d.id}>
                                    <td style={reportTd}>
                                      <input
                                        style={{ ...reportInput, minHeight: 32 }}
                                        value={d.tipo}
                                        onChange={(e) => {
                                          const detalhe = [...(paineisLinha?.detalhe ?? [])];
                                          detalhe[idx] = { ...d, tipo: e.target.value };
                                          setPaineisDetalhe(detalhe);
                                        }}
                                      />
                                    </td>
                                    <td style={reportTd}>
                                      <input
                                        style={{ ...reportInput, minHeight: 32 }}
                                        value={d.dimensoes}
                                        onChange={(e) => {
                                          const detalhe = [...(paineisLinha?.detalhe ?? [])];
                                          detalhe[idx] = {
                                            ...d,
                                            dimensoes: e.target.value,
                                          };
                                          setPaineisDetalhe(detalhe);
                                        }}
                                      />
                                    </td>
                                    <td style={reportTd}>
                                      <input
                                        type="number"
                                        min={0}
                                        style={{ ...reportInput, minHeight: 32, width: 80 }}
                                        value={d.espessuraMm || ""}
                                        placeholder="-"
                                        onChange={(e) => {
                                          const detalhe = [...(paineisLinha?.detalhe ?? [])];
                                          detalhe[idx] = {
                                            ...d,
                                            espessuraMm: Math.max(0, Number(e.target.value) || 0),
                                          };
                                          setPaineisDetalhe(detalhe);
                                        }}
                                      />
                                    </td>
                                    <td style={reportTd}>
                                      <input
                                        type="number"
                                        min={0}
                                        style={{ ...reportInput, minHeight: 32, width: 80 }}
                                        value={d.quantidade || ""}
                                        placeholder="-"
                                        onChange={(e) => {
                                          const detalhe = [...(paineisLinha?.detalhe ?? [])];
                                          detalhe[idx] = {
                                            ...d,
                                            quantidade: Math.max(0, Number(e.target.value) || 0),
                                          };
                                          setPaineisDetalhe(detalhe);
                                        }}
                                      />
                                    </td>
                                    <td style={reportTd}>
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        style={{ ...reportInput, minHeight: 32, width: 100 }}
                                        value={displayQtyPrice(d.precoUnitario)}
                                        placeholder="-"
                                        onChange={(e) => {
                                          const detalhe = [...(paineisLinha?.detalhe ?? [])];
                                          detalhe[idx] = {
                                            ...d,
                                            precoPorM2: undefined,
                                            precoUnitario: Math.max(0, Number(e.target.value) || 0),
                                          };
                                          setPaineisDetalhe(detalhe);
                                        }}
                                      />
                                    </td>
                                    <td style={reportTd}>
                                      {formatEur(
                                        (Number(d.quantidade) || 0) * (Number(d.precoUnitario) || 0)
                                      )}
                                    </td>
                                    <td style={reportTd}>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() =>
                                          setPaineisDetalhe(
                                            (paineisLinha?.detalhe ?? []).filter((_, i) => i !== idx)
                                          )
                                        }
                                      >
                                        {R.remover}
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                                {(paineisLinha?.detalhe?.length ?? 0) === 0 ? (
                                  <tr>
                                    <td style={reportTd} colSpan={7}>
                                      {R.semItens}
                                    </td>
                                  </tr>
                                ) : null}
                              </tbody>
                            </table>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setAddChapaOpen(true)}
                          >
                            {R.adicionarChapa}
                          </Button>
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

      <EditableModal
        open={!!openLinha && !!openKey}
        title={`${R.detalhe} \u2014 ${openLinha?.label ?? ""}`}
        onClose={() => setOpenKey(null)}
      >
        {openLinha && openKey ? (
          <div style={{ display: "grid", gap: 10 }}>
            {(openLinha.detalhe ?? []).map((d, idx) => (
              <div
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr auto",
                  gap: 6,
                }}
              >
                <input
                  style={reportInput}
                  placeholder={R.tipo}
                  value={d.tipo}
                  onChange={(e) => {
                    const detalhe = [...openLinha.detalhe];
                    detalhe[idx] = { ...d, tipo: e.target.value };
                    setDetalhe(openKey, detalhe);
                  }}
                />
                <input
                  style={reportInput}
                  placeholder={R.dimensoes}
                  value={d.dimensoes}
                  onChange={(e) => {
                    const detalhe = [...openLinha.detalhe];
                    detalhe[idx] = { ...d, dimensoes: e.target.value };
                    setDetalhe(openKey, detalhe);
                  }}
                />
                <input
                  type="number"
                  min={0}
                  style={reportInput}
                  placeholder="Qtd"
                  value={displayQtyPrice(d.quantidade)}
                  onChange={(e) => {
                    const detalhe = [...openLinha.detalhe];
                    detalhe[idx] = {
                      ...d,
                      quantidade: Math.max(0, Number(e.target.value) || 0),
                    };
                    setDetalhe(openKey, detalhe);
                  }}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  style={reportInput}
                  placeholder={R.preco}
                  value={displayQtyPrice(d.precoUnitario)}
                  onChange={(e) => {
                    const detalhe = [...openLinha.detalhe];
                    detalhe[idx] = {
                      ...d,
                      precoUnitario: Math.max(0, Number(e.target.value) || 0),
                    };
                    setDetalhe(openKey, detalhe);
                  }}
                />
                <div style={{ alignSelf: "center", fontSize: 13 }}>{formatEur(d.total)}</div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDetalhe(openKey, openLinha.detalhe.filter((_, i) => i !== idx))}
                >
                  {R.remover}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setDetalhe(openKey, [
                  ...(openLinha.detalhe ?? []),
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
              {R.adicionarTipo}
            </Button>
          </div>
        ) : null}
      </EditableModal>

      <EditableModal
        open={addChapaOpen}
        title={R.escolherChapa}
        onClose={() => setAddChapaOpen(false)}
      >
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
                const next = [
                  ...(paineisLinha?.detalhe ?? []),
                  detalheFromCatalogoChapa(opt),
                ];
                // Dedupe por espessura: se ja existe, soma quantidade
                const byEsp = new Map<number, ReportFinanceiroDetalhe>();
                for (const d of next) {
                  const esp = Math.round(Number(d.espessuraMm) || 0);
                  const prev = byEsp.get(esp);
                  if (prev && esp > 0) {
                    byEsp.set(esp, recalcChapaDetalhe({
                      ...prev,
                      quantidade: (Number(prev.quantidade) || 0) + (Number(d.quantidade) || 0),
                    }));
                  } else {
                    byEsp.set(esp || Date.now(), recalcChapaDetalhe(d));
                  }
                }
                setPaineisDetalhe([...byEsp.values()]);
                setAddChapaOpen(false);
              }}
            >
              <span>
                {opt.label} ({opt.espessuraMm} mm)
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {opt.precoPorM2.toFixed(2)} EUR/m2
              </span>
            </button>
          ))}
        </div>
      </EditableModal>
    </section>
  );
}
