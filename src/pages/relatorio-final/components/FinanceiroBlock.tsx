import { Fragment, useMemo, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import {
  applyPrecoPorMetroEdit,
  detalheFromCatalogoChapa,
  listCatalogoChapas,
  makeReportId,
  recalcChapaDetalhe,
  recalcFinanceiro,
  recalcOrlaDetalhe,
  resolveDimensoesMm,
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

function emptyDetalheRow(label = ""): ReportFinanceiroDetalhe {
  return {
    id: makeReportId("fd"),
    tipo: label,
    dimensoes: "",
    quantidade: 1,
    precoUnitario: 0,
    total: 0,
  };
}

/** Se não houver detalhe, cria linha a partir do total da linha-mãe. */
function detailOrSeed(linha: ReportFinanceiroLinha): ReportFinanceiroDetalhe[] {
  // Portas / Remates: sem madeira no modo industrial — nunca inventar detalhe.
  if (linha.key === "portas" || linha.key === "remates") return [];
  if ((linha.detalhe?.length ?? 0) > 0) return linha.detalhe;
  const total = Number(linha.total) || 0;
  if (!(total > 0) && linha.quantidade == null && linha.precoUnitario == null) return [];
  const quantidade =
    linha.quantidade != null && linha.quantidade > 0
      ? linha.quantidade
      : 1;
  const precoUnitario =
    linha.precoUnitario != null && linha.precoUnitario > 0
      ? linha.precoUnitario
      : Math.round((total / quantidade) * 100) / 100;
  return [
    {
      id: makeReportId("fd"),
      tipo: linha.label,
      dimensoes: linha.key === "orla" ? "m" : "",
      quantidade,
      precoUnitario,
      total: Math.round(quantidade * precoUnitario * 100) / 100,
    },
  ];
}

export default function FinanceiroBlock({ style, value, onChange }: Props) {
  const [openKeys, setOpenKeys] = useState<Set<FinanceiroCustoKey>>(() => new Set());
  const [addChapaOpen, setAddChapaOpen] = useState(false);
  const catalogo = useMemo(() => listCatalogoChapas(), []);

  const paineisLinha = value.linhas.find((l) => l.key === "paineis");

  const toggleKey = (key: FinanceiroCustoKey) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setDetalhe = (key: FinanceiroCustoKey, detalhe: ReportFinanceiroDetalhe[]) => {
    const mapped =
      key === "paineis"
        ? detalhe.map((d) => recalcChapaDetalhe(d))
        : key === "orla"
          ? detalhe.map((d) => recalcOrlaDetalhe(d))
          : detalhe.map((d) => ({
              ...d,
              total:
                Math.round(
                  (Math.max(0, Number(d.quantidade) || 0) *
                    (Math.max(0, Number(d.precoUnitario) || 0))) *
                    100
                ) / 100,
            }));
    onChange(updateFinanceiroLinha(value, key, { detalhe: mapped }));
  };

  const setPaineisDetalhe = (detalhe: ReportFinanceiroDetalhe[]) => {
    setDetalhe("paineis", detalhe);
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
              const key = isCustoKey(linha.key) ? linha.key : null;
              const isOpen = key ? openKeys.has(key) : false;
              const isPaineis = key === "paineis";
              const isOrla = key === "orla";
              const detalhe = key ? detailOrSeed(linha) : [];

              return (
                <Fragment key={linha.key}>
                  <tr
                    style={bold ? { fontWeight: 700, background: "rgba(59,130,246,0.08)" } : undefined}
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
                          onClick={() => {
                            if (
                              key !== "portas" &&
                              key !== "remates" &&
                              !isOpen &&
                              (linha.detalhe?.length ?? 0) === 0 &&
                              detalhe.length > 0
                            ) {
                              setDetalhe(key, detalhe);
                            }
                            toggleKey(key);
                          }}
                        >
                          {linha.label}
                          {isOpen ? " ▾" : " ▸"}
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

                  {key && isOpen ? (
                    <tr>
                      <td style={reportTd} colSpan={4}>
                        <div style={accordionPanelStyle}>
                          {isPaineis ? (
                            <>
                              <div style={reportTableWrap}>
                                <table style={reportTable}>
                                  <thead>
                                    <tr>
                                      <th style={reportTh}>{R.tipo}</th>
                                      <th style={reportTh}>{R.comprimentoMm}</th>
                                      <th style={reportTh}>{R.larguraMm}</th>
                                      <th style={reportTh}>{R.espessura}</th>
                                      <th style={reportTh}>{R.quantidade}</th>
                                      <th style={reportTh}>{R.precoPorMetroEur}</th>
                                      <th style={reportTh}>{R.precoTotal}</th>
                                      <th style={reportTh} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(paineisLinha?.detalhe ?? detalhe).map((d, idx) => {
                                      const dims = resolveDimensoesMm(d);
                                      const rows = paineisLinha?.detalhe ?? detalhe;
                                      return (
                                        <tr key={d.id}>
                                          <td style={reportTd}>
                                            <input
                                              style={{ ...reportInput, minHeight: 32 }}
                                              value={d.tipo}
                                              onChange={(e) => {
                                                const next = [...rows];
                                                next[idx] = { ...d, tipo: e.target.value };
                                                setPaineisDetalhe(next);
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
                                                const next = [...rows];
                                                next[idx] = {
                                                  ...d,
                                                  comprimentoMm: Math.max(
                                                    0,
                                                    Number(e.target.value) || 0
                                                  ),
                                                  larguraMm: dims.A,
                                                };
                                                setPaineisDetalhe(next);
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
                                                const next = [...rows];
                                                next[idx] = {
                                                  ...d,
                                                  comprimentoMm: dims.L,
                                                  larguraMm: Math.max(
                                                    0,
                                                    Number(e.target.value) || 0
                                                  ),
                                                };
                                                setPaineisDetalhe(next);
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
                                                const next = [...rows];
                                                next[idx] = {
                                                  ...d,
                                                  espessuraMm: Math.max(0, Number(e.target.value) || 0),
                                                };
                                                setPaineisDetalhe(next);
                                              }}
                                            />
                                          </td>
                                          <td style={reportTd}>
                                            <input
                                              type="number"
                                              min={0}
                                              style={{ ...reportInput, minHeight: 32, width: 70 }}
                                              value={displayQtyPrice(d.quantidade)}
                                              placeholder="-"
                                              onChange={(e) => {
                                                const next = [...rows];
                                                next[idx] = {
                                                  ...d,
                                                  quantidade: Math.max(0, Number(e.target.value) || 0),
                                                };
                                                setPaineisDetalhe(next);
                                              }}
                                            />
                                          </td>
                                          <td style={reportTd}>
                                            <input
                                              type="number"
                                              min={0}
                                              step={0.01}
                                              style={{ ...reportInput, minHeight: 32, width: 100 }}
                                              value={displayQtyPrice(
                                                d.precoPorMetro ?? d.precoUnitario
                                              )}
                                              placeholder="-"
                                              onChange={(e) => {
                                                const next = [...rows];
                                                next[idx] = applyPrecoPorMetroEdit(
                                                  d,
                                                  Math.max(0, Number(e.target.value) || 0)
                                                );
                                                setPaineisDetalhe(next);
                                              }}
                                            />
                                          </td>
                                          <td style={reportTd}>
                                            {formatEur(
                                              (Number(d.quantidade) || 0) *
                                                (Number(d.precoUnitario) || 0)
                                            )}
                                          </td>
                                          <td style={reportTd}>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              onClick={() =>
                                                setPaineisDetalhe(rows.filter((_, i) => i !== idx))
                                              }
                                            >
                                              {R.remover}
                                            </Button>
                                          </td>
                                        </tr>
                                      );
                                    })}
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
                            </>
                          ) : isOrla ? (
                            <>
                              <div style={reportTableWrap}>
                                <table style={reportTable}>
                                  <thead>
                                    <tr>
                                      <th style={reportTh}>{R.tipoOrla}</th>
                                      <th style={reportTh}>{R.quantidadeM}</th>
                                      <th style={reportTh}>{R.precoPorMetro}</th>
                                      <th style={reportTh}>{R.precoTotal}</th>
                                      <th style={reportTh} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalhe.map((d, idx) => (
                                      <tr key={d.id}>
                                        <td style={reportTd}>
                                          <input
                                            style={{ ...reportInput, minHeight: 32 }}
                                            value={d.tipo}
                                            onChange={(e) => {
                                              const next = [...detalhe];
                                              next[idx] = { ...d, tipo: e.target.value };
                                              setDetalhe("orla", next);
                                            }}
                                          />
                                        </td>
                                        <td style={reportTd}>
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            style={{ ...reportInput, minHeight: 32, width: 110 }}
                                            value={displayQtyPrice(d.quantidade)}
                                            placeholder="-"
                                            onChange={(e) => {
                                              const next = [...detalhe];
                                              next[idx] = {
                                                ...d,
                                                quantidade: Math.max(0, Number(e.target.value) || 0),
                                              };
                                              setDetalhe("orla", next);
                                            }}
                                          />
                                        </td>
                                        <td style={reportTd}>
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            style={{ ...reportInput, minHeight: 32, width: 110 }}
                                            value={displayQtyPrice(d.precoUnitario)}
                                            placeholder="-"
                                            onChange={(e) => {
                                              const next = [...detalhe];
                                              next[idx] = {
                                                ...d,
                                                precoUnitario: Math.max(
                                                  0,
                                                  Number(e.target.value) || 0
                                                ),
                                              };
                                              setDetalhe("orla", next);
                                            }}
                                          />
                                        </td>
                                        <td style={reportTd}>
                                          {formatEur(
                                            (Number(d.quantidade) || 0) *
                                              (Number(d.precoUnitario) || 0)
                                          )}
                                        </td>
                                        <td style={reportTd}>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() =>
                                              setDetalhe(
                                                "orla",
                                                detalhe.filter((_, i) => i !== idx)
                                              )
                                            }
                                          >
                                            {R.remover}
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                    {detalhe.length === 0 ? (
                                      <tr>
                                        <td style={reportTd} colSpan={5}>
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
                                onClick={() =>
                                  setDetalhe("orla", [
                                    ...detalhe,
                                    {
                                      ...emptyDetalheRow("Orla"),
                                      dimensoes: "m",
                                    },
                                  ])
                                }
                              >
                                {R.adicionarTipo}
                              </Button>
                            </>
                          ) : (
                            <>
                              <div style={reportTableWrap}>
                                <table style={reportTable}>
                                  <thead>
                                    <tr>
                                      <th style={reportTh}>{R.tipo}</th>
                                      <th style={reportTh}>{R.dimensoes}</th>
                                      <th style={reportTh}>{R.quantidade}</th>
                                      <th style={reportTh}>{R.precoUnit}</th>
                                      <th style={reportTh}>{R.precoTotal}</th>
                                      <th style={reportTh} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalhe.map((d, idx) => (
                                      <tr key={d.id}>
                                        <td style={reportTd}>
                                          <input
                                            style={{ ...reportInput, minHeight: 32 }}
                                            value={d.tipo}
                                            onChange={(e) => {
                                              const next = [...detalhe];
                                              next[idx] = { ...d, tipo: e.target.value };
                                              setDetalhe(key, next);
                                            }}
                                          />
                                        </td>
                                        <td style={reportTd}>
                                          <input
                                            style={{ ...reportInput, minHeight: 32 }}
                                            value={d.dimensoes}
                                            onChange={(e) => {
                                              const next = [...detalhe];
                                              next[idx] = { ...d, dimensoes: e.target.value };
                                              setDetalhe(key, next);
                                            }}
                                          />
                                        </td>
                                        <td style={reportTd}>
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            style={{ ...reportInput, minHeight: 32, width: 100 }}
                                            value={displayQtyPrice(d.quantidade)}
                                            placeholder="-"
                                            onChange={(e) => {
                                              const next = [...detalhe];
                                              next[idx] = {
                                                ...d,
                                                quantidade: Math.max(0, Number(e.target.value) || 0),
                                              };
                                              setDetalhe(key, next);
                                            }}
                                          />
                                        </td>
                                        <td style={reportTd}>
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            style={{ ...reportInput, minHeight: 32, width: 110 }}
                                            value={displayQtyPrice(d.precoUnitario)}
                                            placeholder="-"
                                            onChange={(e) => {
                                              const next = [...detalhe];
                                              next[idx] = {
                                                ...d,
                                                precoUnitario: Math.max(
                                                  0,
                                                  Number(e.target.value) || 0
                                                ),
                                              };
                                              setDetalhe(key, next);
                                            }}
                                          />
                                        </td>
                                        <td style={reportTd}>
                                          {formatEur(
                                            (Number(d.quantidade) || 0) *
                                              (Number(d.precoUnitario) || 0)
                                          )}
                                        </td>
                                        <td style={reportTd}>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() =>
                                              setDetalhe(
                                                key,
                                                detalhe.filter((_, i) => i !== idx)
                                              )
                                            }
                                          >
                                            {R.remover}
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                    {detalhe.length === 0 ? (
                                      <tr>
                                        <td style={reportTd} colSpan={6}>
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
                                onClick={() =>
                                  setDetalhe(key, [...detalhe, emptyDetalheRow(linha.label)])
                                }
                              >
                                {R.adicionarTipo}
                              </Button>
                            </>
                          )}
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
                const byEsp = new Map<number, ReportFinanceiroDetalhe>();
                for (const d of next) {
                  const esp = Math.round(Number(d.espessuraMm) || 0);
                  const prev = byEsp.get(esp);
                  if (prev && esp > 0) {
                    byEsp.set(
                      esp,
                      recalcChapaDetalhe({
                        ...prev,
                        quantidade: (Number(prev.quantidade) || 0) + (Number(d.quantidade) || 0),
                      })
                    );
                  } else {
                    byEsp.set(esp || Date.now(), recalcChapaDetalhe(d));
                  }
                }
                setPaineisDetalhe([...byEsp.values()]);
                setAddChapaOpen(false);
                setOpenKeys((prev) => new Set(prev).add("paineis"));
              }}
            >
              <span>
                {opt.label} ({opt.espessuraMm} mm)
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {opt.precoPorMetro.toFixed(2)} EUR/m
              </span>
            </button>
          ))}
        </div>
      </EditableModal>
    </section>
  );
}
