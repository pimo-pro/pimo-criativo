import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAllCutlistCache,
  cutlistComPrecoFromBox,
} from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import type { CutListItemComPreco } from "../core/types";
import {
  defaultDivisorItem,
  defaultSeparadorItem,
  baselineHolesMissingFromExtended,
  holeSignature,
  makeDivSepTestBox,
} from "../core/divSep/divSepTestHelpers";

function findByTipo(cutlist: CutListItemComPreco[], tipo: string) {
  return cutlist.find((item) => item.tipo === tipo);
}

describe("DIV/SEP — integração industrial (cutlist + furação)", () => {
  beforeEach(() => {
    clearAllCutlistCache();
  });

  it("gera peças DIV/SEP sem industrialLabel antigo; naming unificado na etiqueta", () => {
    const box = makeDivSepTestBox({
      id: "box-divsep-labels",
      nome: "Armario_Test",
      divisores: [defaultDivisorItem({ id: "div-1" })],
      separadores: [defaultSeparadorItem({ id: "sep-1" })],
    });

    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);

    expect(cutlist.some((i) => i.tipo === "divisorio")).toBe(true);
    expect(cutlist.some((i) => i.tipo === "separador")).toBe(true);

    const div = cutlist.find((i) => i.tipo === "divisorio");
    const sep = cutlist.find((i) => i.tipo === "separador");

    expect(div?.metadata?.industrialLabel).toBeUndefined();
    expect(sep?.metadata?.industrialLabel).toBeUndefined();
    expect(div?.metadata?.divSepKind).toBe("DIV");
    expect(sep?.metadata?.divSepKind).toBe("SEP");
  });

  it("preserva altura exacta do DIV (1990.5) sem Math.round; furos LAT = positionMm", () => {
    const T = 19;
    const positionMm = 2000;
    const sep = defaultSeparadorItem({ id: "sep-exact", positionMm });
    const div = defaultDivisorItem({
      id: "div-exact",
      linkedSeparadorId: "sep-exact",
      positionMm: 400,
    });
    const box = makeDivSepTestBox({
      id: "box-divsep-exact-height",
      dimensoes: { largura: 800, altura: 2400, profundidade: 560 },
      espessura: T,
      divisores: [div],
      separadores: [sep],
    });

    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const divItem = findByTipo(cutlist, "divisorio");
    const latEsq = findByTipo(cutlist, "lateral_esquerda");

    expect(divItem).toBeDefined();
    expect(divItem?.dimensoes.altura).toBe(1990.5);
    expect(divItem?.dimensoes.altura).not.toBe(1991);

    const sepLatYs = (latEsq?.drillHoles ?? [])
      .filter((h) => typeof h.pairedHoleKey === "string" && h.pairedHoleKey.startsWith("divsep-sep-"))
      .map((h) => Math.round(h.y * 1000) / 1000);
    expect(sepLatYs.length).toBeGreaterThan(0);
    expect(new Set(sepLatYs)).toEqual(new Set([2000]));
    expect(Math.round((divItem!.dimensoes.altura + T / 2) * 1000) / 1000).toBe(2000);
  });

  it("gera cavilhas e parafusos nas peças DIV/SEP e nos painéis adjacentes", () => {
    const box = makeDivSepTestBox({
      id: "box-divsep-holes",
      divisores: [defaultDivisorItem()],
      separadores: [defaultSeparadorItem()],
    });

    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);

    const div = findByTipo(cutlist, "divisorio");
    const sep = findByTipo(cutlist, "separador");
    const cima = findByTipo(cutlist, "cima");
    const fundo = findByTipo(cutlist, "fundo");
    const latEsq = findByTipo(cutlist, "lateral_esquerda");
    const latDir = findByTipo(cutlist, "lateral_direita");

    // Peças: cavilhas de aresta 10×30 (sem parafusos na peça).
    expect(div?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(sep?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(div?.drillHoles?.some((h) => h.holeType === "parafuso")).toBe(false);
    expect(sep?.drillHoles?.some((h) => h.holeType === "parafuso")).toBe(false);

    // Receptores: faces/cavilhas; parafusos em CIMA/FUNDO (DIV sem ligação SEP).
    expect(cima?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(fundo?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(cima?.drillHoles?.some((h) => h.holeType === "parafuso")).toBe(true);
    expect(fundo?.drillHoles?.some((h) => h.holeType === "parafuso")).toBe(true);
    expect(latEsq?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(latDir?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
  });

  it("não altera furação base de CIMA, FUNDO, LATERAIS (apenas adiciona furos DIV/SEP)", () => {
    const baseBox = makeDivSepTestBox({
      id: "box-divsep-base",
      divisores: [],
      separadores: [],
    });

    const divSepBox = makeDivSepTestBox({
      id: "box-divsep-with-pieces",
      divisores: [defaultDivisorItem()],
      separadores: [defaultSeparadorItem()],
    });

    const baseCutlist = cutlistComPrecoFromBox(baseBox, defaultRulesConfig);
    const divSepCutlist = cutlistComPrecoFromBox(divSepBox, defaultRulesConfig);

    for (const tipo of ["cima", "fundo", "lateral_esquerda", "lateral_direita"] as const) {
      const baseHoles = (findByTipo(baseCutlist, tipo)?.drillHoles ?? []).map(holeSignature);
      const extendedHoles = (findByTipo(divSepCutlist, tipo)?.drillHoles ?? []).map(holeSignature);
      const missing = baselineHolesMissingFromExtended(baseHoles, extendedHoles);
      expect(extendedHoles.length).toBeGreaterThanOrEqual(baseHoles.length);
      expect(missing).toEqual([]);
    }
  });

  it("não introduz PRATELEIRA nem PORTA na cutlist desta configuração", () => {
    const box = makeDivSepTestBox({
      id: "box-divsep-no-extra-pieces",
      divisores: [defaultDivisorItem()],
      separadores: [defaultSeparadorItem()],
    });

    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const tipos = cutlist.map((i) => i.tipo);

    expect(tipos).not.toContain("prateleira");
    expect(tipos).not.toContain("porta_simples");
    expect(tipos).not.toContain("porta_dupla");
    expect(tipos).not.toContain("porta_correr");
  });

  it("cutlist base sem DIV/SEP não contém peças divisorio/separador", () => {
    const baseBox = makeDivSepTestBox({
      id: "box-divsep-empty",
      divisores: [],
      separadores: [],
    });

    const cutlist = cutlistComPrecoFromBox(baseBox, defaultRulesConfig);
    expect(cutlist.some((i) => i.tipo === "divisorio")).toBe(false);
    expect(cutlist.some((i) => i.tipo === "separador")).toBe(false);
  });
});
