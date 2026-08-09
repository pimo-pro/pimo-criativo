import { describe, expect, it } from "vitest";
import {
  defaultOrcamentosSettings,
  isOrcamentosDay1IndustrialStub,
  mergeOrcamentosSettings,
  normalizeOrcamentosSettings,
} from "./orcamentosSettings";
import { ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT } from "./chapasReaisActivation";

describe("orcamentosSettings (P3.9)", () => {
  it("defaults: chapas reais + ferragens unificadas; tarifas industriais 0 / flags off", () => {
    const d = defaultOrcamentosSettings();
    expect(d.perfuracoes.drillEurPorFuro).toBe(0);
    expect(d.custosIndustriais.enableDesperdicio).toBe(false);
    expect(d.margemGanho.enabled).toBe(false);
    expect(d.ferragens.enableUnificacao).toBe(true);
    expect(d.operacoesAvancadas.precoForo5mm).toBe(0);
    expect(d.operacoesAvancadas.precoMeQuadrilha).toBe(0);
  });

  it("default materialCostMode = por_chapas_reais (fonte única madeira)", () => {
    expect(ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT).toBe("por_chapas_reais");
    expect(defaultOrcamentosSettings().custosIndustriais.materialCostMode).toBe(
      "por_chapas_reais"
    );
    expect(
      normalizeOrcamentosSettings({}).custosIndustriais.materialCostMode
    ).toBe("por_chapas_reais");
  });

  it("legado custoMontagemPorPeca=22 → normaliza para 15 EUR", () => {
    const n = normalizeOrcamentosSettings({
      custosIndustriais: { custoMontagemPorPeca: 22 },
    });
    expect(n.custosIndustriais.custoMontagemPorPeca).toBe(15);
  });

  it("isOrcamentosDay1IndustrialStub detecta stub day-1", () => {
    expect(isOrcamentosDay1IndustrialStub(defaultOrcamentosSettings())).toBe(true);
    expect(
      isOrcamentosDay1IndustrialStub({
        custosIndustriais: {
          enableDesperdicio: true,
          enableSerragem: true,
          enableMaoDeObra: true,
          valorHoraMaquina: 35,
          serragemEurPorM2: 0.8,
        },
        perfuracoes: { drillEurPorFuro: 0.0225 },
      })
    ).toBe(false);
  });

  it("normalize fills missing operacoesAvancadas", () => {
    const n = normalizeOrcamentosSettings({
      perfuracoes: { drillEurPorFuro: 0.05 },
    });
    expect(n.operacoesAvancadas.precoForoCalcoGrupo).toBe(0);
    expect(n.ferragens.enableUnificacao).toBe(true);
  });

  it("normalize fills missing ferragens block", () => {
    const n = normalizeOrcamentosSettings({
      perfuracoes: { drillEurPorFuro: 0.05 },
    });
    expect(n.ferragens.enableUnificacao).toBe(true);
    expect(n.perfuracoes.drillEurPorFuro).toBe(0.05);
  });

  it("merge preserves enableUnificacao off", () => {
    const base = defaultOrcamentosSettings();
    const m = mergeOrcamentosSettings(base, {
      ferragens: { enableUnificacao: false },
    });
    expect(m.ferragens.enableUnificacao).toBe(false);
  });
});
