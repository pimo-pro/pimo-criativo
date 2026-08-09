import { describe, expect, it } from "vitest";
import { computeFinanceiroAdminCustos, defaultFinanceiroAdminSettings } from "./financeiroAdminRules";
import {
  classifyFinanceiroCustoKey,
  financeiroCustoRows,
} from "./financeiroUnificado";
import {
  normalizeFinanceiroOverrides,
  type FinanceiroUnificadoSnapshot,
} from "./financeiroUnificadoTypes";

describe("portes — escolha explícita", () => {
  it("default admin tem portes.enabled=false", () => {
    expect(defaultFinanceiroAdminSettings().portes.enabled).toBe(false);
  });

  it("fórmula devolve 0 quando portes.enabled=false", () => {
    const settings = defaultFinanceiroAdminSettings();
    const r = computeFinanceiroAdminCustos({
      subtotalMateriais: 1000,
      caixas: 2,
      pesoTotalKg: 80,
      volumeMontadoM3: 0.7,
      distanciaKm: 0,
      settings,
    });
    expect(r.portes).toBe(0);
  });

  it("fórmula calcula quando enabled=true (sem inventar se desligado)", () => {
    const settings = defaultFinanceiroAdminSettings();
    settings.portes.enabled = true;
    const r = computeFinanceiroAdminCustos({
      subtotalMateriais: 1000,
      caixas: 2,
      pesoTotalKg: 80,
      volumeMontadoM3: 0.7,
      distanciaKm: 0,
      settings,
    });
    // taxaBase 25 + 0.15*80 + 40*0.7 = 25 + 12 + 28 = 65
    expect(r.portes).toBe(65);
  });

  it("normalizeFinanceiroOverrides preserva incluirPortes", () => {
    expect(normalizeFinanceiroOverrides({ incluirPortes: true }).incluirPortes).toBe(true);
    expect(normalizeFinanceiroOverrides({ incluirPortes: false }).incluirPortes).toBe(false);
    expect(normalizeFinanceiroOverrides({}).incluirPortes).toBeUndefined();
  });
});

describe("remates — classificação e linhas UI", () => {
  it("classifica remate/rodape em Painéis (madeira única; linha Remates = 0)", () => {
    expect(classifyFinanceiroCustoKey("remate")).toBe("paineis");
    expect(classifyFinanceiroCustoKey("rodape")).toBe("paineis");
    expect(classifyFinanceiroCustoKey("lateral")).toBe("paineis");
    expect(classifyFinanceiroCustoKey("porta_simples")).toBe("paineis");
    expect(classifyFinanceiroCustoKey("porta_dupla")).toBe("paineis");
    expect(classifyFinanceiroCustoKey("porta_divisao")).toBe("portas");
    expect(classifyFinanceiroCustoKey("gaveta_frente_ext")).toBe("paineis");
    expect(classifyFinanceiroCustoKey("gaveta_lat_esq")).toBe("paineis");
    expect(classifyFinanceiroCustoKey("gaveta_fundo")).toBe("paineis");
  });

  it("financeiroCustoRows omite Remates quando custo=0", () => {
    const empty = {
      paineis: 100,
      portas: 0,
      gavetas: 0,
      ferragens: 0,
      orla: 0,
      remates: 0,
      operacoes: 0,
      desperdicio: 0,
      serragem: 0,
      chapasReais: 0,
      maoDeObra: 0,
      logistica: 0,
      operacoesAvancadas: 0,
      adm: 10,
      montagem: 50,
      portes: 0,
    };
    const snap = {
      custosEffective: empty,
      ivaPct: 23,
      ivaValor: 23,
      totalProjeto: 183,
    } as FinanceiroUnificadoSnapshot;
    const labels = financeiroCustoRows(snap).map((r) => r.label);
    expect(labels).not.toContain("Remates / Rodapés");
    expect(labels).toContain("Portes");
  });

  it("financeiroCustoRows inclui Remates quando custo>0", () => {
    const snap = {
      custosEffective: {
        paineis: 100,
        portas: 0,
        gavetas: 0,
        ferragens: 0,
        orla: 0,
        remates: 12.5,
        operacoes: 0,
        desperdicio: 0,
        serragem: 0,
        chapasReais: 0,
        maoDeObra: 0,
        logistica: 0,
        operacoesAvancadas: 0,
        adm: 0,
        montagem: 0,
        portes: 0,
      },
      ivaPct: 23,
      ivaValor: 0,
      totalProjeto: 112.5,
    } as FinanceiroUnificadoSnapshot;
    expect(financeiroCustoRows(snap).some((r) => r.label === "Remates / Rodapés")).toBe(true);
  });
});
