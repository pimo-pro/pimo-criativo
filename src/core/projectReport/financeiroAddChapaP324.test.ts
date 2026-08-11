/**
 * P3.24 — Adicionar chapa + espelho chapasReais + totais Painéis.
 */
import { describe, expect, it } from "vitest";
import {
  addChapaToPaineisFinanceiro,
  ensureFinanceiroShape,
  getPaineisDetalhe,
  listCatalogoChapas,
  setPaineisChapasDetalhe,
} from "./index";

describe("P3.24 Adicionar chapa", () => {
  it("adiciona chapa ao detalhe Painéis e espelha em chapasReais", () => {
    const catalogo = listCatalogoChapas();
    expect(catalogo.length).toBeGreaterThan(0);
    const opt = catalogo[0];

    let fin = ensureFinanceiroShape(null);
    fin = addChapaToPaineisFinanceiro(fin, opt);

    const paineis = getPaineisDetalhe(fin);
    expect(paineis).toHaveLength(1);
    expect(paineis[0].tipo).toBe(opt.label);
    expect(paineis[0].total).toBeGreaterThan(0);

    const chapasReais = fin.linhas.find((l) => l.key === "chapasReais");
    expect(chapasReais?.detalhe).toHaveLength(1);
    expect(chapasReais?.total).toBe(0);

    const paineisLinha = fin.linhas.find((l) => l.key === "paineis");
    expect(paineisLinha?.total).toBe(paineis[0].total);

    fin = addChapaToPaineisFinanceiro(fin, opt);
    expect(getPaineisDetalhe(fin)).toHaveLength(2);
  });

  it("setPaineisChapasDetalhe recalcula totais das chapas", () => {
    const catalogo = listCatalogoChapas();
    const opt = catalogo[0];
    let fin = addChapaToPaineisFinanceiro(ensureFinanceiroShape(null), opt);
    const row = getPaineisDetalhe(fin)[0];
    fin = setPaineisChapasDetalhe(fin, [
      {
        ...row,
        comprimentoMm: Math.max(100, Math.round((row.comprimentoMm || 2800) / 2)),
      },
    ]);
    const next = getPaineisDetalhe(fin)[0];
    expect(next.total).toBeLessThan(row.total);
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBe(next.total);
  });
});
