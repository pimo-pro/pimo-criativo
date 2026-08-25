import { describe, it, expect } from "vitest";
import {
  countDobradicasForPdf,
  countParafusosCosta3x30,
  distributeCorredicaPairsByLength,
  normalizeFerragensTotaisForPdf,
  snapCorredicaLengthMm,
} from "./pdfFerragensTotaisNormalize";
import type { BoxModule, PanelDrillHole } from "../types";
import { defaultRulesConfig } from "../rules/rulesConfig";

const CORREDICA = "Corredi\u00e7a";
const DOBRADICA = "Dobradi\u00e7a";
const PE = "P\u00e9";
const PE_REF = "P\u00e9-Pl\u00e1stico";

function cups(n: number): PanelDrillHole[] {
  const holes: PanelDrillHole[] = [];
  for (let i = 0; i < n; i++) {
    holes.push({
      x: 20,
      y: 100 + i * 200,
      diameter: 35,
      depth: 13,
      holeType: "dobradica",
    });
    holes.push({
      x: 15,
      y: 90 + i * 200,
      diameter: 10,
      depth: 12,
      holeType: "dobradica_fixacao",
    });
    holes.push({
      x: 15,
      y: 110 + i * 200,
      diameter: 10,
      depth: 12,
      holeType: "dobradica_fixacao",
    });
  }
  return holes;
}

describe("pdfFerragensTotaisNormalize", () => {
  it("snapCorredicaLengthMm usa grelha 300-550", () => {
    expect(snapCorredicaLengthMm(310)).toBe(300);
    expect(snapCorredicaLengthMm(340)).toBe(350);
    expect(snapCorredicaLengthMm(520)).toBe(500);
    expect(snapCorredicaLengthMm(540)).toBe(550);
  });

  it("countParafusosCosta3x30 usa ceil por lado a cada 180mm", () => {
    expect(
      countParafusosCosta3x30([
        { tipo: "COSTA", dimensoes: { largura: 720, altura: 560 }, quantidade: 1 },
      ])
    ).toBe(16);
    expect(
      countParafusosCosta3x30([
        { tipo: "costa", dimensoes: { largura: 180, altura: 180 }, quantidade: 2 },
      ])
    ).toBe(8);
  });

  it("corredicas em pares; ignora dobradica industrial sem canecos", () => {
    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [
        { material: "Corredica Lateral Esquerda", ref: "corredica_esq", medida: "", quantidade: 2 },
        { material: "Corredica Lateral Direita", ref: "corredica_dir", medida: "", quantidade: 2 },
        { material: "Cavilha 10mm", ref: "cavilha_10x40", medida: "10mm", quantidade: 40 },
        { material: "Dobradica 35mm", ref: "dobradica_35mm", medida: "35mm", quantidade: 99 },
        { material: "Parafuso para Puxador", ref: "parafuso_puxador", medida: "M4", quantidade: 8 },
        { material: "Prego para Costa", ref: "prego_costa", medida: "2mm", quantidade: 12 },
        { material: "Suporte de Prateleira", ref: "suporte_prateleira", medida: "", quantidade: 8 },
        { material: "suportes_prateleira", ref: "\u2014", medida: "\u2014", quantidade: 4 },
        { material: "Parafuso 4x50", ref: "parafuso_4x50", medida: "4mm x 50mm", quantidade: 100 },
      ],
      cutlistItems: [{ tipo: "COSTA", dimensoes: { largura: 720, altura: 560 }, quantidade: 1 }],
      boxes: [
        {
          id: "b1",
          gavetas: 2,
          dimensoes: { largura: 600, altura: 720, profundidade: 500 },
        } as BoxModule,
      ],
    });

    const byName = Object.fromEntries(rows.map((r) => [r.material, r]));
    expect(byName["Cavilha 10mm"]?.quantidade).toBe(40);
    expect(byName[DOBRADICA]).toBeUndefined();
    expect(byName["Suporte de Prateleira"]?.quantidade).toBe(12);
    expect(byName["Parafuso 3\u00d730"]?.quantidade).toBe(16);
    expect(byName["Parafuso 3\u00d730"]?.ref).toBe("parafuso_3x30");
    expect(byName["Parafuso 3\u00d730"]?.preco).toBe(0.1);
    expect(byName["Parafuso 3\u00d730"]?.medida).toBe("3\u00d730mm");
    expect(byName["Parafuso para Puxador"]).toBeUndefined();

    const corredicas = rows.filter((r) => r.material === CORREDICA);
    expect(corredicas.reduce((s, r) => s + r.quantidade, 0)).toBe(2);
  });

  it("dobradicas = canecos holeType dobradica (ignora industrial e fixacao)", () => {
    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [
        { material: "Dobradica 35mm", ref: "dobradica_35mm", medida: "35mm", quantidade: 100 },
        { material: "dobradicas", ref: "—", medida: "—", quantidade: 50 },
      ],
      cutlistItems: [
        {
          tipo: "porta_simples",
          dimensoes: { largura: 598, altura: 918 },
          quantidade: 1,
          drillHoles: cups(3),
        },
        {
          tipo: "porta_simples",
          dimensoes: { largura: 598, altura: 758 },
          quantidade: 1,
          drillHoles: cups(2),
        },
      ],
      boxes: [],
      rules: defaultRulesConfig,
    });

    const d = rows.find((r) => r.material === DOBRADICA);
    expect(d).toMatchObject({ ref: "I-Sensys 8645i", medida: "35mm", quantidade: 5 });
    const calco00 = rows.find((r) => r.material === "Cal\u00e7o" && r.ref === "00");
    expect(calco00).toMatchObject({ medida: "37mm", quantidade: 5, preco: 0 });
    const di = rows.findIndex((r) => r.material === DOBRADICA);
    const ci = rows.findIndex((r) => r.material === "Cal\u00e7o" && r.ref === "00");
    expect(ci).toBe(di + 1);
  });

  it("ANTUNIS: 2+2+2+3+4 canecos = 13 dobradicas", () => {
    const antunisDoors = [
      { altura: 758, n: 2 },
      { altura: 758, n: 2 },
      { altura: 758, n: 2 },
      { altura: 918, n: 3 },
      { altura: 2398, n: 4 },
    ];
    const cutlistItems = antunisDoors.map((d, i) => ({
      tipo: "porta_simples" as const,
      boxId: `b${i}`,
      dimensoes: { largura: 598, altura: d.altura },
      quantidade: 1,
      drillHoles: cups(d.n),
    }));

    expect(countDobradicasForPdf(cutlistItems, [], defaultRulesConfig)).toBe(13);

    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [
        { material: "Dobradiça 35mm", ref: "dobradica_35mm", medida: "35mm", quantidade: 10 },
        { material: "dobradicas", ref: "", medida: "", quantidade: 10 },
      ],
      cutlistItems,
      boxes: [],
      rules: defaultRulesConfig,
    });

    expect(rows.find((r) => r.material === DOBRADICA)?.quantidade).toBe(13);
    expect(rows.find((r) => r.material === "Cal\u00e7o" && r.ref === "00")?.quantidade).toBe(13);
  });

  it("calco Ref 03: 1 por porta em modulo Frente Fixa", () => {
    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [],
      cutlistItems: [],
      boxes: [
        {
          id: "ff1",
          baseCabinetId: "corner-direita-inferior-v2",
          portaTipo: "porta_simples",
          doorsLayer: [{ id: "d1" }, { id: "d2" }],
        } as never,
      ],
    });
    expect(rows.find((r) => r.material === "Cal\u00e7o" && r.ref === "03")).toMatchObject({
      medida: "37mm",
      quantidade: 2,
      preco: 0,
    });
  });

  it("fallback getNumDobradicas quando porta sem drillHoles", () => {
    const n = countDobradicasForPdf(
      [
        {
          tipo: "porta_simples",
          dimensoes: { largura: 600, altura: 918 },
          quantidade: 1,
          drillHoles: [],
        },
      ],
      [],
      defaultRulesConfig
    );
    expect(n).toBe(3);
  });

  it("distributeCorredicaPairsByLength proporcao por gavetas", () => {
    const dist = distributeCorredicaPairsByLength(3, [
      { id: "a", gavetas: 2, dimensoes: { largura: 1, altura: 1, profundidade: 300 } } as BoxModule,
      { id: "b", gavetas: 1, dimensoes: { largura: 1, altura: 1, profundidade: 550 } } as BoxModule,
    ]);
    expect(dist.reduce((s, r) => s + r.qty, 0)).toBe(3);
    expect(dist.map((r) => r.lengthMm).sort()).toEqual([300, 550]);
  });

  it("inclui Pe (pe_plastico) a partir das caixas lower com pes", () => {
    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [
        { material: "Dobradica 35mm", ref: "dobradica_35mm", medida: "35mm", quantidade: 2 },
      ],
      cutlistItems: [],
      boxes: [
        {
          id: "b1",
          nome: "Base 1",
          cabinetType: "lower",
          feetEnabled: true,
          feetHeight: 100,
          dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        } as BoxModule,
        {
          id: "b2",
          nome: "Aereo",
          cabinetType: "upper",
          feetEnabled: false,
          dimensoes: { largura: 600, altura: 400, profundidade: 320 },
        } as BoxModule,
      ],
    });

    const pe = rows.find((r) => r.material === PE);
    expect(pe).toBeDefined();
    expect(pe?.ref).toBe(PE_REF);
    expect(pe?.medida).toBe("100mm");
    expect(pe?.quantidade).toBe(4);
    expect(pe?.preco).toBe(0.3);
    const paraf = rows.find((r) => r.material === "Parafuso 3\u00d730");
    expect(paraf).toMatchObject({
      ref: "parafuso_3x30",
      medida: "3\u00d730mm",
      quantidade: 16, // 4 pés × 4
      preco: 0.1,
    });
    expect(rows.find((r) => r.material === DOBRADICA)).toBeUndefined();
  });

    it("recalcula Orla no PDF (ignora ferragemOrla stale) a partir de porta", () => {
    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [],
      cutlistItems: [
        {
          id: "p1",
          tipo: "porta_simples",
          nome: "porta",
          boxId: "b1",
          quantidade: 1,
          dimensoes: { largura: 598, altura: 718, profundidade: 19 },
          espessura: 19,
          metadata: { panelId: "p1" },
        },
      ],
      boxes: [
        {
          id: "b1",
          nome: "Caixa",
          material: "mdf_branco",
          cutList: [
            {
              id: "p1",
              nome: "porta",
              tipo: "porta_simples",
              quantidade: 1,
              dimensoes: { largura: 598, altura: 718, profundidade: 19 },
              espessura: 19,
              metadata: { panelId: "p1" },
            },
          ],
          dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        } as BoxModule,
      ],
      projectMaterialId: "mdf_branco",
      orlaPresets: [
        {
          id: "pvc",
          nome: "PVC",
          tipo: "PVC",
          espessuraMm: 0.8,
          larguraMm: 23,
          cor: "#fff",
          precoPorMetro: 1.5,
        },
      ],
      // Stale: metros inventados — devem ser ignorados a favor do recalculo.
      ferragemOrla: {
        linhas: [
          {
            id: "1",
            presetId: "pvc",
            presetNome: "PVC",
            metros: 12.345,
            custo: 18.5175,
            boxId: "b1",
            boxNome: "Caixa",
            orlaMaterialId: "mdf_branco",
            orlaMaterialLabel: "MDF Branco",
            tipo: "normal",
          },
        ],
        metrosTotal: 12.345,
        custoTotal: 18.5175,
        porBox: {},
      },
    });

    const orla = rows.find((r) => /^\d+([.,]\d+)?\s*m$/i.test(String(r.medida)));
    expect(orla).toBeDefined();
    // Porta 598×718 → perímetro 2.632 m (não o stale 12.35)
    expect(orla?.quantidade).toBeCloseTo(2.632, 2);
    expect(orla?.ref).toMatch(/0\.8mm/);
    expect(orla?.material).not.toMatch(/\d+\s*mm/i);
    expect(orla?.preco).toBe(1.5);
  });

  it("prateleira gera Orla no PDF (regras oficiais restauradas)", () => {
    const rows = normalizeFerragensTotaisForPdf({
      ferragens: [],
      cutlistItems: [
        {
          tipo: "prateleira",
          boxId: "b1",
          quantidade: 1,
          dimensoes: { largura: 560, altura: 400, profundidade: 19 },
        },
      ],
      boxes: [
        {
          id: "b1",
          nome: "Caixa",
          material: "mdf_branco",
          cutList: [
            {
              id: "prat1",
              nome: "prateleira",
              tipo: "prateleira",
              quantidade: 1,
              dimensoes: { largura: 560, altura: 400, profundidade: 19 },
              espessura: 19,
              metadata: { panelId: "prat1" },
            },
          ],
          dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        } as BoxModule,
      ],
      projectMaterialId: "mdf_branco",
      orlaPresets: [
        {
          id: "pvc",
          nome: "PVC",
          tipo: "PVC",
          espessuraMm: 0.8,
          larguraMm: 23,
          cor: "#fff",
          precoPorMetro: 1.5,
        },
      ],
      ferragemOrla: { linhas: [], metrosTotal: 0, custoTotal: 0, porBox: {} },
    });

    const orla = rows.find((r) => /^\d+([.,]\d+)?\s*m$/i.test(String(r.medida)));
    expect(orla).toBeDefined();
    expect(orla?.quantidade).toBeGreaterThan(0);
  });
});
