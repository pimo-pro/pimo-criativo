/**
 * P3.24 / P3.26 — Adicionar chapa: detalhe visual apenas; totais oficiais intactos.
 */
import { describe, expect, it } from "vitest";
import {
  addChapaToPaineisFinanceiro,
  ensureFinanceiroShape,
  getPaineisDetalhe,
  listCatalogoChapas,
  setPaineisChapasDetalhe,
} from "./index";

describe("P3.24/P3.26 Adicionar chapa (só visualização)", () => {
  it("adiciona chapa ao detalhe Painéis e espelha em chapasReais sem alterar total SSOT", () => {
    const catalogo = listCatalogoChapas();
    expect(catalogo.length).toBeGreaterThan(0);
    const opt = catalogo[0];

    let fin = ensureFinanceiroShape(null, { paineis: 2874.88 });
    fin = addChapaToPaineisFinanceiro(fin, opt);

    const paineis = getPaineisDetalhe(fin);
    expect(paineis).toHaveLength(1);
    expect(paineis[0].tipo).toBe(opt.label);
    expect(paineis[0].total).toBeGreaterThan(0);

    const chapasReais = fin.linhas.find((l) => l.key === "chapasReais");
    expect(chapasReais?.detalhe).toHaveLength(1);
    expect(chapasReais?.total).toBe(0);

    // Total oficial preservado (não = soma do detalhe)
    const paineisLinha = fin.linhas.find((l) => l.key === "paineis");
    expect(paineisLinha?.total).toBe(2874.88);
    expect(paineisLinha?.quantidade).toBeNull();
    expect(paineisLinha?.precoUnitario).toBeNull();

    fin = addChapaToPaineisFinanceiro(fin, opt);
    expect(getPaineisDetalhe(fin)).toHaveLength(2);
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBe(2874.88);
  });

  it("setPaineisChapasDetalhe actualiza detalhe visual sem reprecificar Painéis", () => {
    const catalogo = listCatalogoChapas();
    const opt = catalogo[0];
    let fin = addChapaToPaineisFinanceiro(
      ensureFinanceiroShape(null, { paineis: 100 }),
      opt
    );
    const row = getPaineisDetalhe(fin)[0];
    fin = setPaineisChapasDetalhe(fin, [
      {
        ...row,
        comprimentoMm: Math.max(100, Math.round((row.comprimentoMm || 2800) / 2)),
      },
    ]);
    const next = getPaineisDetalhe(fin)[0];
    expect(next.total).toBeLessThan(row.total);
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBe(100);
  });
});
