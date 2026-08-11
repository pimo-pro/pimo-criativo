/**
 * Testes unitarios dos calculos do Relatorio Final (isolados do industrial).
 * P3.17: IVA só sobre materiais (estilo ADMIN).
 */
import { describe, expect, it } from "vitest";
import { ensureFinanceiroShape, recalcFinanceiro, updateFinanceiroLinha } from "./financeReportCalc";

describe("financeReportCalc", () => {
  it("recalcula linha por quantidade x preco", () => {
    const fin = ensureFinanceiroShape(null, { paineis: 100 });
    const next = updateFinanceiroLinha(fin, "paineis", {
      quantidade: 2,
      precoUnitario: 15,
    });
    const paineis = next.linhas.find((l) => l.key === "paineis");
    expect(paineis?.total).toBe(30);
  });

  it("IVA Admin-style: so materiais; ADM fora da base", () => {
    const fin = ensureFinanceiroShape(null, { paineis: 100, adm: 50 });
    const next = recalcFinanceiro({
      ...fin,
      ivaPct: 23,
    });
    expect(next.subtotal).toBe(100);
    expect(next.ivaValor).toBe(23);
    expect(next.totalProjeto).toBe(173);
    const totalRow = next.linhas.find((l) => l.key === "total");
    expect(totalRow?.total).toBe(173);
    const ivaRow = next.linhas.find((l) => l.key === "iva");
    expect(ivaRow?.total).toBe(23);
  });

  it("mantem Total = subtotal materiais + IVA 23% (sem extras)", () => {
    const fin = ensureFinanceiroShape(null, { paineis: 100, portas: 0 });
    const next = recalcFinanceiro({
      ...fin,
      ivaPct: 23,
      linhas: fin.linhas.map((l) =>
        l.key === "paineis" ? { ...l, quantidade: 1, precoUnitario: 100, total: 100 } : l
      ),
    });
    expect(next.subtotal).toBe(100);
    expect(next.ivaValor).toBe(23);
    expect(next.totalProjeto).toBe(123);
    const totalRow = next.linhas.find((l) => l.key === "total");
    expect(totalRow?.total).toBe(123);
  });

  it("montagem e portes entram no total sem IVA", () => {
    const fin = ensureFinanceiroShape(null, {
      paineis: 100,
      montagem: 20,
      portes: 10,
    });
    const next = recalcFinanceiro({ ...fin, ivaPct: 23 });
    expect(next.subtotal).toBe(100);
    expect(next.ivaValor).toBe(23);
    expect(next.totalProjeto).toBe(153);
  });

  it("agrega detalhe na linha", () => {
    const fin = ensureFinanceiroShape(null);
    const next = updateFinanceiroLinha(fin, "ferragens", {
      detalhe: [
        {
          id: "a",
          tipo: "Dobradica",
          dimensoes: "",
          quantidade: 10,
          precoUnitario: 2,
          total: 0,
        },
        {
          id: "b",
          tipo: "Corredica",
          dimensoes: "",
          quantidade: 4,
          precoUnitario: 5,
          total: 0,
        },
      ],
    });
    const row = next.linhas.find((l) => l.key === "ferragens");
    expect(row?.total).toBe(40);
    expect(row?.quantidade).toBe(14);
  });

  it("recalcula total do projeto ao alterar detalhe ferragens", () => {
    const fin = ensureFinanceiroShape(null);
    const next = updateFinanceiroLinha(fin, "ferragens", {
      detalhe: [
        {
          id: "a",
          tipo: "Parafuso",
          dimensoes: "",
          quantidade: 100,
          precoUnitario: 0.15,
          total: 0,
        },
      ],
    });
    expect(next.subtotal).toBe(15);
    expect(next.ivaValor).toBe(3.45);
    expect(next.totalProjeto).toBe(18.45);
  });
});
