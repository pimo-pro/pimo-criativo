/**
 * Testes unitarios dos calculos do Relatorio Final (isolados do industrial).
 * P3.17: IVA só sobre materiais (estilo ADMIN).
 * P3.26: totais oficiais (paineis/orla/portas/remates) não são reprecificados pelo detalhe.
 */
import { describe, expect, it } from "vitest";
import {
  ensureFinanceiroShape,
  recalcFinanceiro,
  recalcLinha,
  updateFinanceiroLinha,
} from "./financeReportCalc";

describe("financeReportCalc", () => {
  it("P3.26: qty×preço em Painéis NÃO altera total oficial", () => {
    const fin = ensureFinanceiroShape(null, { paineis: 2874.88 });
    const next = updateFinanceiroLinha(fin, "paineis", {
      quantidade: 16,
      precoUnitario: 253.58,
    });
    const paineis = next.linhas.find((l) => l.key === "paineis");
    expect(paineis?.total).toBe(2874.88);
    expect(paineis?.quantidade).toBeNull();
    expect(paineis?.precoUnitario).toBeNull();
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

  it("agrega detalhe na linha ferragens (não locked)", () => {
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

  it("P3.26: detalhe de chapas em Painéis não sobrescreve total SSOT", () => {
    const fin = ensureFinanceiroShape(null, { paineis: 2874.88 });
    const lined = recalcLinha({
      key: "paineis",
      label: "Painéis",
      quantidade: null,
      precoUnitario: null,
      total: 2874.88,
      detalhe: [
        {
          id: "ch1",
          tipo: "MDF",
          dimensoes: "2800 x 2070 mm",
          comprimentoMm: 2800,
          larguraMm: 2070,
          espessuraMm: 19,
          quantidade: 16,
          precoPorM2: 43.75,
          precoUnitario: 253.58,
          total: 4057.28,
        },
      ],
    });
    expect(lined.total).toBe(2874.88);
    expect(lined.quantidade).toBeNull();
    expect(lined.precoUnitario).toBeNull();
    expect(lined.detalhe.length).toBe(1);
  });

  it("P3.26: orla / portas / remates locked", () => {
    for (const key of ["orla", "portas", "remates"] as const) {
      const fin = ensureFinanceiroShape(null, { [key]: key === "orla" ? 134.13 : 0 });
      const next = updateFinanceiroLinha(fin, key, {
        quantidade: 10,
        precoUnitario: 99,
        detalhe: [
          {
            id: "x",
            tipo: "x",
            dimensoes: "",
            quantidade: 10,
            precoUnitario: 99,
            total: 990,
          },
        ],
      });
      const row = next.linhas.find((l) => l.key === key);
      expect(row?.total).toBe(key === "orla" ? 134.13 : 0);
      expect(row?.quantidade).toBeNull();
    }
  });
});
