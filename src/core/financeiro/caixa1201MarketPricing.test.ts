import { describe, it, expect } from "vitest";
import { computeFinanceiroUnificado } from "./financeiroUnificado";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { getPrecoPorMaterial } from "../pricing/pricing";
import { calcularCustoPainel } from "../manufacturing/boxManufacturing";
import { getMaterial } from "../manufacturing/materials";
import type { BoxModule } from "../types";
import type { DoorLayerItem as DoorLayer } from "../../models/BoxLayers";

/**
 * Proxy CAIXA 1201: modulo 600x720x560, porta dupla, 1 prateleira, sem gavetas.
 * Modelo industrial: madeira = chapas reais (ou fallback Painéis); Remates/Portas = 0;
 * Gavetas = N×15; ferragens unificadas (catálogo).
 */
describe("CAIXA 1201 — precos de mercado", () => {
  it("costa 10mm usa 20 EUR/m2; 19mm usa 31 EUR/m2", () => {
    expect(getPrecoPorMaterial("mdf_branco", 19)).toBe(31);
    expect(getPrecoPorMaterial("mdf_branco", 10)).toBe(20);
    expect(getPrecoPorMaterial("mdf_branco-10", 10)).toBe(20);
    const costa = calcularCustoPainel(
      {
        id: "c",
        tipo: "costa",
        largura_mm: 600,
        altura_mm: 700,
        espessura_mm: 10,
        quantidade: 1,
        material: "mdf_branco",
        custo: 0,
      } as never,
      getMaterial("mdf_branco")
    );
    expect(costa).toBeCloseTo(0.6 * 0.7 * 20, 2);
  });

  it("snapshot financeiro: madeira = Σ sheets estimado (N×€ documentado)", () => {
    const doorH = 700;
    const leftDoor: DoorLayer = {
      id: "d-left",
      parentBoxId: "b1",
      groupType: "dupla",
      width: 297,
      height: doorH,
      thickness: 19,
      materialId: "mdf_branco",
      material: "mdf_branco",
      openDirection: "left",
      isOpen: false,
      hingeSide: "left",
      pivot: "left-edge",
      posX: -150,
      posY: 0,
      posZ: 300,
      rotY: 0,
      manualDimensions: true,
    };
    const rightDoor: DoorLayer = {
      ...leftDoor,
      id: "d-right",
      openDirection: "right",
      hingeSide: "right",
      pivot: "right-edge",
      posX: 150,
    };

    const box = {
      id: "b1",
      nome: "CAIXA 1201",
      dimensoes: { largura: 600, altura: 720, profundidade: 560 },
      espessura: 19,
      portaTipo: "porta_dupla",
      gavetas: 0,
      prateleiras: 1,
      doorsLayer: [leftDoor, rightDoor],
      drawersLayer: [],
      costaAtiva: true,
      material: "mdf_branco",
    } as unknown as BoxModule;

    const snap = computeFinanceiroUnificado({
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "CAIXA 1201",
      remates: [],
      rodapes: [],
    });

    const c = snap.custosEffective;
    const madeira = (Number(c.paineis) || 0) + (Number(c.chapasReais) || 0);
    const total = Number(snap.totalProjeto) || Number(snap.subtotalComAdmin) || 0;

    const diag = JSON.stringify({
      paineis: c.paineis,
      chapasReais: c.chapasReais,
      madeira,
      remates: c.remates,
      portas: c.portas,
      orla: c.orla,
      ferragens: c.ferragens,
      operacoes: c.operacoes,
      operacoesAvancadas: c.operacoesAvancadas,
      desperdicio: c.desperdicio,
      montagem: c.montagem,
      adm: c.adm,
      subtotal: snap.subtotal,
      subtotalComAdmin: snap.subtotalComAdmin,
      totalProjeto: snap.totalProjeto,
      materialCostMode: snap.materialCostMode,
      chapasMode: snap.chapas.mode,
      chapasCount: snap.chapas.count,
      countMonetizado: snap.chapasReaisMeta?.countMonetizado,
      custoChapaDerived: snap.chapasReaisMeta?.custoChapaDerived,
      ops: snap.operacoesBreakdown,
    });

    // --- Madeira preliminar (Estimado) ---
    // Nesting fast deste módulo → N=2 sheets (19mm carcaça/portas + 10mm costa).
    // Painéis = Σ (área_chapa × €/m²) via priceChapasSheetsEur = 295.60 €
    // (equivale a média meta 147.80 €/chapa × 2; sem factor de segurança).
    // Official TCN/PRO, quando existir, substitui este preliminar com o mesmo motor.
    expect(snap.materialCostMode, diag).toBe("por_chapas_reais");
    expect(snap.chapas.mode, diag).toBe("estimado");
    expect(snap.chapas.count, diag).toBe(2);
    expect(snap.chapasReaisMeta?.countMonetizado, diag).toBe(2);
    expect(c.paineis, diag).toBe(0);
    expect(c.chapasReais, diag).toBeCloseTo(295.6, 2);
    expect(madeira, diag).toBeCloseTo(295.6, 2);
    expect(snap.chapasReaisMeta?.custoChapaDerived, diag).toBeCloseTo(147.8, 2);

    // Remates/Portas: madeira nas chapas — linha = 0
    expect(c.remates, diag).toBe(0);
    expect(c.portas, diag).toBe(0);

    expect(c.orla, diag).toBeGreaterThan(0.5);
    expect(c.orla, diag).toBeLessThan(40);
    expect(c.ferragens, diag).toBeGreaterThan(7);
    expect(c.ferragens, diag).toBeLessThan(30);
    expect(c.operacoes, diag).toBeGreaterThan(2);
    expect(c.operacoes, diag).toBeLessThan(12);
    expect(c.operacoesAvancadas ?? 0, diag).toBeLessThan(3);
    expect(c.desperdicio, diag).toBeGreaterThan(0);
    expect(c.adm, diag).toBeGreaterThan(0);
    expect(c.adm / Math.max(1e-6, snap.subtotal), diag).toBeCloseTo(0.05, 2);

    // Total documentado deste caso (IVA 23% sobre subtotal materiais):
    // subtotal≈331.22 + ADM≈16.56 + montagem≈7.34 + IVA≈76.18 ≈ 431.30
    expect(total, diag).toBeCloseTo(431.3, 0);
    expect(snap.ivaPct, diag).toBe(23);
  });
});
