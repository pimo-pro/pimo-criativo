/**
 * Fase G — Validação industrial final DIV/SEP (khaled-pro).
 * Critérios: não-atravessamento, furos, multi-DIV/SEP, wardrobe, viewer↔cutlist.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAllCutlistCache,
  cutlistComPrecoFromBox,
} from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { getDivSepMeshSpecs, type DivSepMeshSpec } from "./visualSpecs";
import {
  resolveDivisorLinkedHeightMm,
  resolveSeparadorBottomY,
  resolveSeparadorTopY,
} from "./coupling";
import {
  getDivSepInternalDims,
  resolveDivisorDimensions,
  resolveSeparadorDimensions,
  resolveSeparadorLeftXAbsMm,
  resolveDivisorCenterX,
} from "./dimensions";
import { buildDivSepDrilling } from "./drilling";
import { DIV_SEP_TEST_RULES, defaultDivisorItem, defaultSeparadorItem, makeDivSepTestBox, roundMm } from "./divSepTestHelpers";
import { buildPartialSepToDivItems, isPartialSepCavilhaOnly } from "../wardrobe/partialSepToDiv";
import { CAVILHA_FACE_DEPTH_MM } from "../drill/cavilha10x40Rule";

type Aabb = { xMin: number; xMax: number; yMin: number; yMax: number };

function absAabbFromSpec(spec: DivSepMeshSpec, widthM: number, heightM: number): Aabb {
  const halfX = (spec.size[0]! / 2) * 1000;
  const halfY = (spec.size[1]! / 2) * 1000;
  const cx = (spec.pos[0]! + widthM / 2) * 1000;
  const cy = (spec.pos[1]! + heightM / 2) * 1000;
  return {
    xMin: cx - halfX,
    xMax: cx + halfX,
    yMin: cy - halfY,
    yMax: cy + halfY,
  };
}

function overlap1d(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

describe("Fase G — validação industrial final DIV/SEP", () => {
  beforeEach(() => {
    clearAllCutlistCache();
  });

  it("1) DIV nunca atravessa SEP (abaixo e acima)", () => {
    const sep = defaultSeparadorItem({ id: "sep-g1", positionMm: 500 });
    const divBaixo = defaultDivisorItem({
      id: "div-baixo",
      linkedSeparadorId: "sep-g1",
      posicaoRelativaAoSep: "baixo",
      positionMm: 250,
    });
    const divCima = defaultDivisorItem({
      id: "div-cima",
      linkedSeparadorId: "sep-g1",
      posicaoRelativaAoSep: "cima",
      positionMm: 450,
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 800, altura: 1600, profundidade: 560 },
      separadores: [sep],
      divisores: [divBaixo, divCima],
    });

    const W = 0.8;
    const H = 1.6;
    const specs = getDivSepMeshSpecs(box, W, H, 0.56, 0.019);
    const sepSpec = specs.find((s) => s.name === `divsep-sep-${sep.id}`)!;
    const sepAabb = absAabbFromSpec(sepSpec, W, H);

    for (const div of [divBaixo, divCima]) {
      const divSpec = specs.find((s) => s.name === `divsep-div-${div.id}`)!;
      const divAabb = absAabbFromSpec(divSpec, W, H);
      const yOverlap = overlap1d(divAabb.yMin, divAabb.yMax, sepAabb.yMin, sepAabb.yMax);
      expect(roundMm(yOverlap)).toBe(0);

      if (div.posicaoRelativaAoSep === "baixo") {
        expect(roundMm(divAabb.yMax)).toBe(roundMm(sepAabb.yMin));
      } else {
        expect(roundMm(divAabb.yMin)).toBe(roundMm(sepAabb.yMax));
      }
    }
  });

  it("2) SEP parcial nunca corta o DIV (âncora direita)", () => {
    const div = defaultDivisorItem({ id: "div-g2", positionMm: 300 });
    const sep = defaultSeparadorItem({
      id: "sep-g2",
      positionMm: 500,
      ancoraHorizontal: "direita",
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 800, altura: 1200, profundidade: 560 },
      divisores: [div],
      separadores: [sep],
    });

    const internal = getDivSepInternalDims(box);
    const divCx = resolveDivisorCenterX(box, div);
    const divHalf = internal.espessura / 2;
    const divRight = divCx + divHalf;
    const sepLeft = resolveSeparadorLeftXAbsMm(box, sep);
    const sepDims = resolveSeparadorDimensions(box, sep);

    expect(sepDims.larguraMm).toBeLessThan(internal.larguraInterna - 2);
    expect(sepLeft).toBeGreaterThanOrEqual(divRight - 0.5);

    const W = 0.8;
    const H = 1.2;
    const specs = getDivSepMeshSpecs(box, W, H, 0.56, 0.019);
    const sepAabb = absAabbFromSpec(specs.find((s) => s.name.includes(sep.id))!, W, H);
    const divAabb = absAabbFromSpec(specs.find((s) => s.name.includes(div.id))!, W, H);
    const xOverlap = overlap1d(sepAabb.xMin, sepAabb.xMax, divAabb.xMin, divAabb.xMax);
    expect(roundMm(xOverlap)).toBe(0);
  });

  it("3) Furos correctos em completo / ligado abaixo / ligado acima", () => {
    const rules = DIV_SEP_TEST_RULES;

    // Completo (sem SEP)
    const boxFull = makeDivSepTestBox({
      divisores: [defaultDivisorItem({ id: "div-full" })],
      separadores: [],
    });
    const full = buildDivSepDrilling(boxFull, boxFull.panelIds, rules);
    expect(full.getExtraHoles("cima").filter((h) => h.holeType === "cavilha").length).toBeGreaterThan(0);
    expect(full.getExtraHoles("fundo").filter((h) => h.holeType === "cavilha").length).toBeGreaterThan(0);

    // Abaixo
    const sep = defaultSeparadorItem({ id: "sep-f", positionMm: 400 });
    const divBaixo = defaultDivisorItem({
      id: "div-b",
      linkedSeparadorId: "sep-f",
      posicaoRelativaAoSep: "baixo",
      positionMm: 281,
    });
    const boxBaixo = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      separadores: [sep],
      divisores: [divBaixo],
    });
    const drillBaixo = buildDivSepDrilling(boxBaixo, boxBaixo.panelIds, rules);
    expect(drillBaixo.getExtraHoles("cima").filter((h) => h.holeType === "cavilha").length).toBe(0);
    expect(drillBaixo.getExtraHoles("fundo").filter((h) => h.holeType === "cavilha").length).toBeGreaterThan(0);
    const sepFaceB = drillBaixo
      .getExtraHoles("separador", boxBaixo.panelIds!.separadores![0])
      .filter((h) => h.topDrillable === true && h.face === "B");
    expect(sepFaceB.length).toBeGreaterThan(0);
    expect(sepFaceB.every((h) => roundMm(h.depth) === CAVILHA_FACE_DEPTH_MM)).toBe(true);

    // Acima
    const divCima = defaultDivisorItem({
      id: "div-c",
      linkedSeparadorId: "sep-f",
      posicaoRelativaAoSep: "cima",
      positionMm: 281,
    });
    const boxCima = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      separadores: [sep],
      divisores: [divCima],
    });
    const drillCima = buildDivSepDrilling(boxCima, boxCima.panelIds, rules);
    expect(drillCima.getExtraHoles("fundo").filter((h) => h.holeType === "cavilha").length).toBe(0);
    expect(drillCima.getExtraHoles("cima").filter((h) => h.holeType === "cavilha").length).toBeGreaterThan(0);
    const sepFaceA = drillCima
      .getExtraHoles("separador", boxCima.panelIds!.separadores![0])
      .filter((h) => h.topDrillable === true && h.face === "A");
    expect(sepFaceA.length).toBeGreaterThan(0);
  });

  it("4) Multi-DIV (2 baixo + 1 cima) funcional", () => {
    const sep = defaultSeparadorItem({ id: "sep-multi", positionMm: 600 });
    const d1 = defaultDivisorItem({
      id: "d1",
      linkedSeparadorId: "sep-multi",
      posicaoRelativaAoSep: "baixo",
      positionMm: 200,
    });
    const d2 = defaultDivisorItem({
      id: "d2",
      linkedSeparadorId: "sep-multi",
      posicaoRelativaAoSep: "baixo",
      positionMm: 400,
    });
    const d3 = defaultDivisorItem({
      id: "d3",
      linkedSeparadorId: "sep-multi",
      posicaoRelativaAoSep: "cima",
      positionMm: 550,
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 900, altura: 1600, profundidade: 560 },
      separadores: [sep],
      divisores: [d1, d2, d3],
    });

    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    expect(cutlist.filter((i) => i.tipo === "divisorio").length).toBe(3);
    expect(cutlist.filter((i) => i.tipo === "separador").length).toBe(1);

    const sepTop = resolveSeparadorTopY(box, sep);
    const sepBottom = resolveSeparadorBottomY(box, sep);
    expect(roundMm(resolveDivisorDimensions(box, d1).alturaMm)).toBe(
      roundMm(resolveDivisorLinkedHeightMm(box, d1, sep))
    );
    expect(roundMm(resolveDivisorDimensions(box, d3).alturaMm)).toBe(
      roundMm(resolveDivisorLinkedHeightMm(box, d3, sep))
    );
    expect(resolveDivisorDimensions(box, d1).alturaMm).toBe(sepBottom - getDivSepInternalDims(box).espessura);
    expect(resolveDivisorDimensions(box, d3).alturaMm).toBe(
      getDivSepInternalDims(box).espessura + getDivSepInternalDims(box).alturaInterna - sepTop
    );

    const { getExtraHoles } = buildDivSepDrilling(box, box.panelIds, DIV_SEP_TEST_RULES);
    const sepHoles = getExtraHoles("separador", box.panelIds!.separadores![0]);
    expect(sepHoles.filter((h) => h.face === "B" && h.topDrillable).length).toBeGreaterThan(0);
    expect(sepHoles.filter((h) => h.face === "A" && h.topDrillable).length).toBeGreaterThan(0);
  });

  it("5) Multi-SEP funcional", () => {
    const sep1 = defaultSeparadorItem({ id: "sep-a", positionMm: 300 });
    const sep2 = defaultSeparadorItem({
      id: "sep-b",
      positionMm: 700,
      ancoraHorizontal: "esquerda",
    });
    const div1 = defaultDivisorItem({
      id: "div-a",
      linkedSeparadorId: "sep-a",
      positionMm: 250,
    });
    const div2 = defaultDivisorItem({
      id: "div-b",
      linkedSeparadorId: "sep-b",
      posicaoRelativaAoSep: "cima",
      positionMm: 500,
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 800, altura: 1600, profundidade: 560 },
      separadores: [sep1, sep2],
      divisores: [div1, div2],
    });

    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    expect(cutlist.filter((i) => i.tipo === "separador").length).toBe(2);
    expect(cutlist.filter((i) => i.tipo === "divisorio").length).toBe(2);

    const drill = buildDivSepDrilling(box, box.panelIds, DIV_SEP_TEST_RULES);
    const face1 = drill.getExtraHoles("separador", box.panelIds!.separadores![0]).filter((h) => h.topDrillable);
    const face2 = drill.getExtraHoles("separador", box.panelIds!.separadores![1]).filter((h) => h.topDrillable);
    expect(face1.every((h) => h.face === "B")).toBe(true);
    expect(face2.every((h) => h.face === "A")).toBe(true);
  });

  it("6) Wardrobe parcial continua correcto", () => {
    const built = buildPartialSepToDivItems({
      baseCabinetId: "base-1800-roupeiro-h-2400-wardrobe_sep_parcial_gavetas_dir_inner_cabinet_a1",
      widthMm: 1800,
      heightMm: 2400,
      depthMm: 560,
      feetHeightMm: 100,
      espessuraMm: 19,
    });
    expect(isPartialSepCavilhaOnly(built.sep)).toBe(true);
    expect(built.sep.ancoraHorizontal).toBe("direita");
    expect(built.div.linkedSeparadorId).toBe(built.sep.id);
    expect(built.div.posicaoRelativaAoSep).toBe("baixo");
    expect(built.sepWidthMm).toBeGreaterThan(0);

    const box = makeDivSepTestBox({
      dimensoes: { largura: 1800, altura: 2400, profundidade: 560 },
      divisores: [built.div],
      separadores: [built.sep],
    });
    const dims = resolveDivisorDimensions(box, built.div);
    expect(dims.alturaMm).toBeLessThan(getDivSepInternalDims(box).alturaInterna);
    const sepLeft = resolveSeparadorLeftXAbsMm(box, built.sep);
    const divCx = resolveDivisorCenterX(box, built.div);
    expect(sepLeft).toBeGreaterThanOrEqual(divCx - 0.5);
  });

  it("7) Viewer e cutlist alinhados (altura DIV + gap 0)", () => {
    const T = 19;
    const sep = defaultSeparadorItem({ id: "sep-align", positionMm: 800 });
    const div = defaultDivisorItem({
      id: "div-align",
      linkedSeparadorId: "sep-align",
      positionMm: 350,
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 700, altura: 1400, profundidade: 560 },
      espessura: T,
      separadores: [sep],
      divisores: [div],
    });

    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const divItem = cutlist.find((i) => i.tipo === "divisorio")!;
    const expectedH = resolveDivisorDimensions(box, div).alturaMm;
    expect(divItem.dimensoes.altura).toBe(expectedH);

    const H = 1.4;
    const W = 0.7;
    const specs = getDivSepMeshSpecs(box, W, H, 0.56, T / 1000);
    const sepSpec = specs.find((s) => s.name.includes(sep.id))!;
    const divSpec = specs.find((s) => s.name.includes(div.id))!;
    const sepAabb = absAabbFromSpec(sepSpec, W, H);
    const divAabb = absAabbFromSpec(divSpec, W, H);

    expect(roundMm(divSpec.size[1]! * 1000)).toBe(roundMm(expectedH));
    expect(roundMm(divAabb.yMax)).toBe(roundMm(sepAabb.yMin));
    expect(roundMm(sepAabb.yMin - divAabb.yMax)).toBe(0);
  });
});
