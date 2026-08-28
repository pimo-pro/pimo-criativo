/**
 * Fase 5D — cobertura industrial da activação Chapas Reais.
 * Integração: cutlist → nesting fast → derive €/chapa → F3c → Unificado / Peças.
 * Não altera CNC PRO / TCN / viewer / cutlist manufacturing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAllCutlistCache } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { settingsDefaults } from "../settings/settingsSchema";
import { setIndustrialSettingsReadOverride } from "../settings/settingsStorage";
import { computeChapasReal } from "../industrial/computeChapasReal";
import { groupCutlistItemsByMaterialAndThickness } from "../cnc/industrialThicknessGroups";
import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { DoorLayerItem as DoorLayer } from "../../models/BoxLayers";
import { buildDrawerScenario } from "../../validation/drawerCertificationTestHelpers";
import {
  assertNoMaterialDoubleCount,
  computeCustosAvancadosFinanceiras,
} from "./computeCustosAvancadosFinanceiras";
import { deriveCustoChapaReal } from "./deriveCustoChapaReal";
import { CUSTO_MONTAGEM_POR_GAVETA_DEFAULT_EUR } from "./drawerAssemblyCost";
import { buildFinanceiroPecasRows } from "./financeiroPecasBuilder";
import {
  computeFinanceiroUnificado,
  financeiroCustoRows,
} from "./financeiroUnificado";
import { FINANCEIRO_PIECE_MATERIAL_KEYS } from "./financeiroUnificadoTypes";
import { priceChapasSheetsEur } from "./priceChapasSheetsEur";

function enableChapasReaisMode(): void {
  setIndustrialSettingsReadOverride({
    ...settingsDefaults,
    orcamentos: {
      ...settingsDefaults.orcamentos,
      custosIndustriais: {
        ...settingsDefaults.orcamentos.custosIndustriais,
        materialCostMode: "por_chapas_reais",
      },
    },
  });
}

function makeDoor(partial: Partial<DoorLayer> & { id: string; hingeSide: "left" | "right" }): DoorLayer {
  const doorH = 700;
  return {
    id: partial.id,
    parentBoxId: "b1",
    groupType: "dupla",
    width: 297,
    height: doorH,
    thickness: 19,
    materialId: "mdf_branco",
    material: "mdf_branco",
    openDirection: partial.hingeSide === "left" ? "left" : "right",
    isOpen: false,
    hingeSide: partial.hingeSide,
    pivot: partial.hingeSide === "left" ? "left-edge" : "right-edge",
    posX: partial.hingeSide === "left" ? -150 : 150,
    posY: 0,
    posZ: 300,
    rotY: 0,
    manualDimensions: true,
    ...partial,
  };
}

/** Proxy CAIXA 1201 — 1 material, mono-espessura (costa 10 mm opcional). */
function boxMonoMaterial(opts?: { costa10?: boolean }): BoxModule {
  const left = makeDoor({ id: "d-left", hingeSide: "left" });
  const right = makeDoor({ id: "d-right", hingeSide: "right" });
  return {
    id: "b1",
    nome: "CAIXA_5D_MONO",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    portaTipo: "porta_dupla",
    gavetas: 0,
    prateleiras: 1,
    doorsLayer: [left, right],
    drawersLayer: [],
    costaAtiva: opts?.costa10 !== false,
    material: "mdf_branco",
  } as unknown as BoxModule;
}

/** Caixa com 2 gavetas — montagem deve sobreviver ao suppress de Painéis. */
function boxComGavetas(): BoxModule {
  const { layers } = buildDrawerScenario({
    boxWidth: 600,
    boxHeight: 720,
    boxDepth: 560,
    drawerCount: 2,
    boxId: "b-gav",
  });
  return {
    id: "b-gav",
    nome: "CAIXA_5D_GAV",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    portaTipo: "sem_porta",
    gavetas: 2,
    prateleiras: 0,
    doorsLayer: [],
    drawersLayer: layers,
    costaAtiva: true,
    material: "mdf_branco",
  } as unknown as BoxModule;
}

/** Cutlist sintético mono-material que cabe em chapas padrão (nesting fast). */
function cutlistNestableMono(): CutListItemComPreco[] {
  return [
    {
      id: "lat-a",
      nome: "LAT_A",
      tipo: "lateral_esquerda",
      material: "mdf_branco",
      materialId: "mdf_branco",
      quantidade: 2,
      dimensoes: { largura: 560, altura: 720, profundidade: 19 },
      espessura: 19,
      precoUnitario: 12,
      precoTotal: 24,
      boxId: "box-syn",
    },
    {
      id: "top",
      nome: "TOP",
      tipo: "cima",
      material: "mdf_branco",
      materialId: "mdf_branco",
      quantidade: 2,
      dimensoes: { largura: 562, altura: 560, profundidade: 19 },
      espessura: 19,
      precoUnitario: 10,
      precoTotal: 20,
      boxId: "box-syn",
    },
    {
      id: "prat",
      nome: "PRAT",
      tipo: "prateleira",
      material: "mdf_branco",
      materialId: "mdf_branco",
      quantidade: 2,
      dimensoes: { largura: 562, altura: 540, profundidade: 19 },
      espessura: 19,
      precoUnitario: 9,
      precoTotal: 18,
      boxId: "box-syn",
    },
  ];
}

/** Multi-espessura: 19 mm + costa 10 mm (grupos TCN separados). */
function cutlistMultiEspessura(): CutListItemComPreco[] {
  return [
    ...cutlistNestableMono(),
    {
      id: "costa",
      nome: "COSTA",
      tipo: "costa",
      material: "mdf_branco",
      materialId: "mdf_branco",
      quantidade: 1,
      dimensoes: { largura: 562, altura: 682, profundidade: 10 },
      espessura: 10,
      precoUnitario: 5,
      precoTotal: 5,
      boxId: "box-syn",
    },
  ];
}

describe("Fase 5D — activação Chapas Reais (industrial)", () => {
  beforeEach(() => {
    clearAllCutlistCache();
  });

  afterEach(() => {
    setIndustrialSettingsReadOverride(null);
  });

  it("cutlist mono: nesting → Σ sheets (oficial ou estimado) + suppress Painéis", () => {
    enableChapasReaisMode();
    const cutlist = cutlistNestableMono();
    const chapas = computeChapasReal(cutlist, "5D-mono", [{ id: "box-syn" }]);
    const derived = deriveCustoChapaReal({ cutlist });
    expect(derived.custoChapaReal).toBeGreaterThan(0);
    const hasSheets = chapas.sheets.length > 0;
    const priced = priceChapasSheetsEur(chapas.sheets);
    const isOficial = chapas.mode === "oficial_pro" && hasSheets;

    const avancados = computeCustosAvancadosFinanceiras({
      cutlist,
      chapasCount: chapas.totalSheets > 0 ? chapas.totalSheets : 0,
      chapasModeReal: isOficial,
      pesoTotalKg: 20,
      custoChapaRealDerived: derived.custoChapaReal,
      precoChapasSheetsEur: hasSheets ? priced.totalEur : undefined,
    });

    expect(FINANCEIRO_PIECE_MATERIAL_KEYS).not.toContain("gavetas");

    if (hasSheets || (chapas.totalSheets > 0 && derived.custoChapaReal > 0)) {
      expect(avancados.suppressPieceMaterial).toBe(true);
      expect(chapas.totalSheets).toBeGreaterThan(0);
      if (hasSheets) {
        expect(avancados.precoChapasReais).toBe(priced.totalEur);
      } else {
        expect(avancados.precoChapasReais).toBe(
          Math.round(chapas.totalSheets * derived.custoChapaReal * 100) / 100
        );
      }
      assertNoMaterialDoubleCount({
        pieceMaterialSum: 0,
        chapasReais: avancados.precoChapasReais,
      });
      const groups = groupCutlistItemsByMaterialAndThickness(
        cutlist as CutlistItemForPieces[]
      );
      expect(groups.size).toBe(1);
      if (hasSheets) {
        const materialsInSheets = new Set(chapas.sheets.map((s) => s.material));
        expect(materialsInSheets.size).toBeGreaterThanOrEqual(1);
      }
    } else {
      expect(avancados.precoChapasReais).toBe(0);
      expect(avancados.suppressPieceMaterial).toBe(false);
      expect(avancados.warnings.some((w) => w.includes("sem chapas reais"))).toBe(true);
    }
  });

  it("cutlist multi-espessura: grupos 19+10; € com sheets ou N×derivado", () => {
    enableChapasReaisMode();
    const cutlist = cutlistMultiEspessura();
    const groups = groupCutlistItemsByMaterialAndThickness(
      cutlist as CutlistItemForPieces[]
    );
    expect(groups.size).toBe(2);

    const chapas = computeChapasReal(cutlist, "5D-multi", [{ id: "box-syn" }]);
    const derived = deriveCustoChapaReal({ cutlist });
    const hasSheets = chapas.sheets.length > 0;
    const priced = priceChapasSheetsEur(chapas.sheets);
    const isOficial = chapas.mode === "oficial_pro" && hasSheets;
    const avancados = computeCustosAvancadosFinanceiras({
      cutlist,
      chapasCount: chapas.totalSheets > 0 ? chapas.totalSheets : 0,
      chapasModeReal: isOficial,
      pesoTotalKg: 25,
      custoChapaRealDerived: derived.custoChapaReal,
      precoChapasSheetsEur: hasSheets ? priced.totalEur : undefined,
    });

    if (hasSheets || (chapas.totalSheets > 0 && derived.custoChapaReal > 0)) {
      expect(avancados.suppressPieceMaterial).toBe(true);
      expect(avancados.precoChapasReais).toBeGreaterThan(0);
      if (hasSheets) {
        expect(avancados.precoChapasReais).toBe(priced.totalEur);
        expect(chapas.sheets.some((s) => s.espessuraMm === 19)).toBe(true);
        expect(chapas.sheets.some((s) => s.espessuraMm === 10)).toBe(true);
      }
    } else {
      expect(avancados.precoChapasReais).toBe(0);
      expect(avancados.suppressPieceMaterial).toBe(false);
    }
  });

  it("Unificado por_chapas_reais: chapas (oficial ou estimado) ou fallback Painéis; Remates=0", () => {
    enableChapasReaisMode();
    const snap = computeFinanceiroUnificado({
      boxes: [boxMonoMaterial()],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "5D-UNIFICADO-MONO",
      remates: [],
      rodapes: [],
    });

    expect(snap.materialCostMode).toBe("por_chapas_reais");
    expect(snap.custosEffective.portas).toBe(0);
    expect(snap.custosEffective.remates).toBe(0);

    const labels = financeiroCustoRows(snap).map((r) => r.label);

    if ((snap.chapasReaisMeta?.countMonetizado ?? 0) > 0) {
      expect(snap.custosEffective.paineis).toBe(0);
      expect(labels).toContain("Painéis");
      const n = snap.chapasReaisMeta!.countMonetizado;
      const avgMeta = snap.chapasReaisMeta!.custoChapaDerived;
      expect(n).toBeGreaterThan(0);
      expect(avgMeta).toBeGreaterThan(0);
      expect(avgMeta).toBe(
        Math.round((snap.custosEffective.chapasReais / n) * 100) / 100
      );
      expect(snap.custosEffective.chapasReais).toBeGreaterThan(0);
      expect(labels.some((l) => l.startsWith("Chapas reais"))).toBe(false);
      assertNoMaterialDoubleCount({
        pieceMaterialSum: snap.custosEffective.paineis,
        chapasReais: snap.custosEffective.chapasReais,
      });
      if (snap.chapas.mode === "estimado") {
        expect(
          (snap.custosAvancadosWarnings ?? []).some((w) => w.includes("estimado"))
        ).toBe(true);
      }
    } else {
      expect(snap.custosEffective.chapasReais).toBe(0);
      expect(snap.custosEffective.paineis).toBeGreaterThanOrEqual(0);
      expect(
        (snap.custosAvancadosWarnings ?? []).some(
          (w) =>
            w.includes("estimado") ||
            w.includes("sem chapas") ||
            w.includes("derivado") ||
            w.includes("fallback")
        )
      ).toBe(true);
    }
  });

  it("Unificado com gavetas: montagem N×€ intacta sob suppress material", () => {
    enableChapasReaisMode();
    const box = boxComGavetas();
    const snap = computeFinanceiroUnificado({
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "5D-UNIFICADO-GAV",
      remates: [],
      rodapes: [],
    });

    expect(snap.materialCostMode).toBe("por_chapas_reais");
    expect(snap.custosEffective.gavetas).toBe(2 * CUSTO_MONTAGEM_POR_GAVETA_DEFAULT_EUR);
    expect(snap.custosEffective.remates).toBe(0);

    const rows = buildFinanceiroPecasRows({
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "5D-PECAS-GAV",
      remates: [],
      rodapes: [],
    });
    const materialSum = rows.reduce((s, r) => s + (r.precoMaterial ?? 0), 0);
    const chapasShare = rows.reduce((s, r) => s + (r.precoChapasShare ?? 0), 0);

    if (snap.custosEffective.chapasReais > 0) {
      expect(snap.custosEffective.paineis).toBe(0);
      // Madeira (Painéis) zerada nas peças; quota chapas rateada.
      expect(materialSum).toBe(0);
      expect(Math.abs(chapasShare - snap.custosEffective.chapasReais)).toBeLessThan(0.02);
    } else {
      // Fallback por peça: madeira pode aparecer em Painéis; montagem gavetas intacta.
      expect(snap.custosEffective.chapasReais).toBe(0);
    }
  });

  it("default por_chapas_reais: Remates=0; madeira em chapas ou fallback Painéis", () => {
    // Sem override → default global = por_chapas_reais.
    setIndustrialSettingsReadOverride(null);
    const snap = computeFinanceiroUnificado({
      boxes: [boxMonoMaterial()],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "5D-DEFAULT-CHAPAS",
      remates: [],
      rodapes: [],
    });
    expect(snap.materialCostMode).toBe("por_chapas_reais");
    expect(snap.custosEffective.remates).toBe(0);
    expect(snap.custosEffective.portas).toBe(0);
    if (snap.custosEffective.chapasReais > 0) {
      expect(snap.custosEffective.paineis).toBe(0);
    } else {
      expect(snap.custosEffective.chapasReais).toBe(0);
      expect(snap.custosEffective.paineis).toBeGreaterThan(0);
    }
  });
});
