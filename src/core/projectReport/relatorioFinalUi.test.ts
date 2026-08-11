/**
 * P3.18 — Asserts mínimos de apresentação do Relatório Final (sem alterar totais).
 */
import { describe, expect, it } from "vitest";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import {
  financeiroCustoLinhasDisplay,
  financeiroTotaisDisplay,
  formatEurDisplay,
} from "./financeiroDisplay";
import { buildLiveReportFinanceiro, snapshotToReportFinanceiro } from "./financeiroFromUnificado";
import { buildRelatorioPainelContagens } from "./relatorioPainelContagens";
import { emptyFinanceiro, emptyProducao, type ProjectReport } from "./types";

describe("P3.18 financeiroDisplay", () => {
  it("exclui IVA/Total/chapasReais das linhas de detalhe (sem duplicação visual)", () => {
    const custos = Object.fromEntries(FINANCEIRO_CUSTO_KEYS.map((k) => [k, 0])) as Record<
      (typeof FINANCEIRO_CUSTO_KEYS)[number],
      number
    >;
    custos.paineis = 100;
    custos.chapasReais = 0;
    custos.adm = 10;
    const snap = {
      caixas: 1,
      pecasTotais: 0,
      areaTotalM2: 0,
      pesoTotalKg: 0,
      areaTotalMontadoM3: 0,
      chapas: { count: 0, mode: "estimado" as const },
      desperdicioTotalM2: 0,
      serragemTotalM2: 0,
      ferragensTotais: 0,
      orlaTotalM: 0,
      custosComputed: custos,
      custosEffective: custos,
      custoKeysOverridden: [] as [],
      ivaPct: 23,
      distanciaKm: 0,
      subtotal: 100,
      subtotalComAdmin: 110,
      ivaValor: 23,
      totalProjeto: 133,
      overrides: {},
      adminSettings: {} as never,
    };
    const fin = snapshotToReportFinanceiro(snap as never);
    const linhas = financeiroCustoLinhasDisplay(fin.linhas);
    expect(linhas.some((l) => l.key === "iva")).toBe(false);
    expect(linhas.some((l) => l.key === "total")).toBe(false);
    expect(linhas.some((l) => l.key === "chapasReais")).toBe(false);
    expect(linhas.some((l) => l.key === "paineis")).toBe(true);

    const totais = financeiroTotaisDisplay(fin);
    expect(totais.subtotal).toBe(100);
    expect(totais.ivaValor).toBe(23);
    expect(totais.totalProjeto).toBe(133);
    expect(formatEurDisplay(totais.totalProjeto)).toBe("133.00 EUR");
  });

  it("Total exibido = Total Unificado (alinhamento)", () => {
    const box = {
      id: "b1",
      nome: "Caixa",
      dimensoes: { largura: 600, altura: 720, profundidade: 560 },
      espessura: 19,
      portaTipo: "sem_porta",
      gavetas: 0,
      prateleiras: 1,
      doorsLayer: [],
      drawersLayer: [],
      costaAtiva: true,
      material: "mdf_branco",
    } as unknown as BoxModule;

    const project = {
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "P3.18",
      remates: [],
      rodapes: [],
    };
    const snap = computeFinanceiroUnificado(project);
    const report = buildLiveReportFinanceiro(project as never, []);
    const totais = financeiroTotaisDisplay(report);
    expect(totais.totalProjeto).toBe(Math.round(snap.totalProjeto * 100) / 100);
    expect(totais.ivaValor).toBe(Math.round(snap.ivaValor * 100) / 100);
    expect(totais.subtotal).toBe(Math.round(snap.subtotal * 100) / 100);
  });
});

describe("P3.18 painel contagens", () => {
  it("conta caixas/peças/módulos/portas/gavetas sem tempo", () => {
    const report = {
      producao: {
        ...emptyProducao(),
        caixas: [
          { id: "1", nome: "A", dimensoes: "", tipo: "caixa" },
          { id: "2", nome: "B", dimensoes: "", tipo: "caixa" },
        ],
        pecas: [
          {
            id: "p1",
            ref: "P1",
            peca: "PORTA_ESQ",
            material: "",
            matRef: "",
            qtd: 1,
            comp: 0,
            larg: 0,
            esp: 0,
            cnc: "",
            drill: "",
            o2: "",
            o3: "",
            o4: "",
            o5: "",
            f2: "",
            f3: "",
            f4: "",
            f5: "",
            g: "",
            observacoes: "",
            noEtq: "",
            temErro: false,
            notasErro: "",
            propostaCorrecao: "",
          },
          {
            id: "p2",
            ref: "G1",
            peca: "GAV_FRENTE_EXT_01",
            material: "",
            matRef: "",
            qtd: 2,
            comp: 0,
            larg: 0,
            esp: 0,
            cnc: "",
            drill: "",
            o2: "",
            o3: "",
            o4: "",
            o5: "",
            f2: "",
            f3: "",
            f4: "",
            f5: "",
            g: "",
            observacoes: "",
            noEtq: "",
            temErro: false,
            notasErro: "",
            propostaCorrecao: "",
          },
        ],
      },
      financeiro: emptyFinanceiro(),
    } as ProjectReport;

    const c = buildRelatorioPainelContagens(report);
    expect(c.caixas).toBe(2);
    expect(c.modulos).toBe(2);
    expect(c.portas).toBe(1);
    expect(c.gavetas).toBe(2);
    expect(c.pecas).toBe(3);
    expect("tempo" in c).toBe(false);
  });
});
