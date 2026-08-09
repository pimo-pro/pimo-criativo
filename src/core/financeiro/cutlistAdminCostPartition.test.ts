import { describe, expect, it } from "vitest";

import { isCarcassPanelForAdminCost, isDoorPieceForAdminCost } from "./cutlistAdminCostPartition";
import { classifyFinanceiroCustoKey } from "./financeiroUnificado";
import { FINANCEIRO_PIECE_MATERIAL_KEYS } from "./financeiroUnificadoTypes";
import {
  CUSTO_MONTAGEM_POR_GAVETA_DEFAULT_EUR,
  computeMontagemGavetasEur,
  resolveCustoMontagemPorGavetaEur,
} from "./drawerAssemblyCost";

describe("cutlistAdminCostPartition — Painéis inclui portas e madeira de gavetas", () => {
  it("classifica folhas de porta de módulo como Painéis", () => {
    for (const tipo of ["porta_simples", "porta_dupla", "porta_correr", "porta_inferior", "porta_superior"]) {
      expect(isDoorPieceForAdminCost(tipo)).toBe(true);
      expect(isCarcassPanelForAdminCost(tipo)).toBe(true);
      expect(classifyFinanceiroCustoKey(tipo)).toBe("paineis");
    }
  });

  it("classifica carcaça como Painéis", () => {
    for (const tipo of ["lateral_esquerda", "cima", "fundo", "COSTA", "prateleira", "separador"]) {
      expect(isCarcassPanelForAdminCost(tipo)).toBe(true);
      expect(isDoorPieceForAdminCost(tipo)).toBe(false);
      expect(classifyFinanceiroCustoKey(tipo)).toBe("paineis");
    }
  });

  it("classifica madeira de gaveta como Painéis (Fase 2)", () => {
    for (const tipo of [
      "gaveta_frente_ext",
      "gaveta_frente",
      "gaveta_lat_esq",
      "gaveta_lat_dir",
      "gaveta_traseira",
      "gaveta_fundo",
    ]) {
      expect(isCarcassPanelForAdminCost(tipo)).toBe(true);
      expect(classifyFinanceiroCustoKey(tipo)).toBe("paineis");
    }
  });

  it("classifica remate/rodapé como Painéis (sem linha de madeira própria)", () => {
    for (const tipo of ["remate", "rodape", "roda_pe", "rodapé"]) {
      expect(classifyFinanceiroCustoKey(tipo)).toBe("paineis");
      expect(isCarcassPanelForAdminCost(tipo)).toBe(true);
    }
  });

  it("reserva bucket portas para tipos de divisão", () => {
    expect(classifyFinanceiroCustoKey("porta_divisao")).toBe("portas");
    expect(isCarcassPanelForAdminCost("porta_divisao")).toBe(false);
  });

  it("por_chapas_reais não inclui gavetas na suppress de material", () => {
    expect(FINANCEIRO_PIECE_MATERIAL_KEYS).toEqual(["paineis", "portas", "remates"]);
    expect(FINANCEIRO_PIECE_MATERIAL_KEYS).not.toContain("gavetas");
  });
});

describe("drawerAssemblyCost — montagem por gaveta", () => {
  it("default de fábrica é 15 EUR", () => {
    expect(CUSTO_MONTAGEM_POR_GAVETA_DEFAULT_EUR).toBe(15);
    expect(resolveCustoMontagemPorGavetaEur(null)).toBeGreaterThanOrEqual(0);
  });

  it("legado 22 EUR → resolve para 15 EUR", () => {
    expect(resolveCustoMontagemPorGavetaEur(22)).toBe(15);
  });

  it("total = N × tarifa override", () => {
    const boxes = [
      {
        drawersLayer: [{ id: "d1" }, { id: "d2" }] as never[],
      },
      { gavetas: 1, drawersLayer: [] },
    ];
    const r = computeMontagemGavetasEur(boxes, 15);
    expect(r.gavetasCount).toBe(3);
    expect(r.custoUnitario).toBe(15);
    expect(r.total).toBe(45);
  });
});
