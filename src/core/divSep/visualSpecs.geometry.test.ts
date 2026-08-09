import { describe, expect, it } from "vitest";
import {
  resolveDivisorLinkedHeightMm,
  resolveSeparadorBottomY,
} from "./coupling";
import {
  getDivSepInternalDims,
  resolveDivisorDimensions,
  resolveSeparadorDimensions,
} from "./dimensions";
import {
  defaultDivisorItem,
  defaultSeparadorItem,
  DIV_SEP_ESPESSURA,
  makeDivSepTestBox,
  roundMm,
} from "./divSepTestHelpers";
import { getDivSepMeshSpecs, type DivSepMeshSpec } from "./visualSpecs";

type AabbY = { yMin: number; yMax: number };

function absYRangeFromSpec(spec: DivSepMeshSpec, heightM: number): AabbY {
  const halfH = spec.size[1]! / 2;
  const centerAbsMm = (spec.pos[1]! + heightM / 2) * 1000;
  return {
    yMin: centerAbsMm - halfH * 1000,
    yMax: centerAbsMm + halfH * 1000,
  };
}

function yOverlapMm(a: AabbY, b: AabbY): number {
  return Math.max(0, Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin));
}

function assertLinkedDivFlushWithSep(
  box: ReturnType<typeof makeDivSepTestBox>,
  sep: ReturnType<typeof defaultSeparadorItem>,
  div: ReturnType<typeof defaultDivisorItem>
): void {
  const heightM = box.dimensoes.altura / 1000;
  const widthM = box.dimensoes.largura / 1000;
  const depthM = (box.profundidadeExterna ?? box.dimensoes.profundidade) / 1000;
  const thicknessM = DIV_SEP_ESPESSURA / 1000;

  const internal = getDivSepInternalDims(box);
  const fundoTopY = internal.espessura;
  const sepBottomY = resolveSeparadorBottomY(box, sep);
  const dims = resolveDivisorDimensions(box, div);
  const linkedH = resolveDivisorLinkedHeightMm(box, div, sep);

  expect(dims.alturaMm).toBe(sepBottomY - fundoTopY);
  expect(dims.alturaMm).toBe(linkedH);
  expect(roundMm(fundoTopY + dims.alturaMm)).toBe(roundMm(sepBottomY));
  expect(roundMm(sepBottomY - (fundoTopY + dims.alturaMm))).toBe(0);

  const specs = getDivSepMeshSpecs(box, widthM, heightM, depthM, thicknessM);
  const sepSpec = specs.find((s) => s.name === `divsep-sep-${sep.id}`);
  const divSpec = specs.find((s) => s.name === `divsep-div-${div.id}`);
  expect(sepSpec).toBeDefined();
  expect(divSpec).toBeDefined();

  const sepY = absYRangeFromSpec(sepSpec!, heightM);
  const divY = absYRangeFromSpec(divSpec!, heightM);

  expect(roundMm(divY.yMax)).toBe(roundMm(sepY.yMin));
  expect(yOverlapMm(divY, sepY)).toBe(0);
  expect(roundMm(sepY.yMin)).toBe(roundMm(sepBottomY));
}

describe("SEP/DIV geometry — encaixe rosto a rosto (gap 0)", () => {
  it("altura industrial = sepBottomY − FUNDO.topY sem folga", () => {
    const sep = defaultSeparadorItem({ id: "sep-geo", positionMm: 600 });
    const div = defaultDivisorItem({
      id: "div-geo",
      linkedSeparadorId: "sep-geo",
      positionMm: 281,
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 720, profundidade: 560 },
      separadores: [sep],
      divisores: [div],
    });
    assertLinkedDivFlushWithSep(box, sep, div);
  });

  it("Viewer: divTop = sepBottom e AABB sem overlap em Y", () => {
    const sep = defaultSeparadorItem({ id: "sep-view", positionMm: 400 });
    const div = defaultDivisorItem({
      id: "div-view",
      linkedSeparadorId: "sep-view",
      positionMm: 200,
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      separadores: [sep],
      divisores: [div],
    });
    assertLinkedDivFlushWithSep(box, sep, div);
  });

  it("após mover o SEP, altura e Viewer continuam com gap 0", () => {
    const sepBase = defaultSeparadorItem({ id: "sep-move", positionMm: 350 });
    const div = defaultDivisorItem({
      id: "div-move",
      linkedSeparadorId: "sep-move",
      positionMm: 281,
    });

    for (const positionMm of [250, 400, 550, 620]) {
      const sep = { ...sepBase, positionMm };
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        separadores: [sep],
        divisores: [div],
      });
      assertLinkedDivFlushWithSep(box, sep, div);

      const sepDims = resolveSeparadorDimensions(box, sep);
      expect(sepDims.alturaMm).toBe(DIV_SEP_ESPESSURA);
    }
  });

  it("DIV acima do SEP: base no topo do SEP, topo na CIMA, sem overlap", () => {
    const sep = defaultSeparadorItem({ id: "sep-cima", positionMm: 300 });
    const div = defaultDivisorItem({
      id: "div-cima",
      linkedSeparadorId: "sep-cima",
      posicaoRelativaAoSep: "cima",
      positionMm: 281,
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      separadores: [sep],
      divisores: [div],
    });

    const internal = getDivSepInternalDims(box);
    const sepTopY = resolveSeparadorBottomY(box, sep) + resolveSeparadorDimensions(box, sep).alturaMm;
    const cimaBottomY = internal.espessura + internal.alturaInterna;
    const dims = resolveDivisorDimensions(box, div);
    const linkedH = resolveDivisorLinkedHeightMm(box, div, sep);

    expect(dims.alturaMm).toBe(cimaBottomY - sepTopY);
    expect(dims.alturaMm).toBe(linkedH);

    const heightM = box.dimensoes.altura / 1000;
    const specs = getDivSepMeshSpecs(
      box,
      box.dimensoes.largura / 1000,
      heightM,
      0.56,
      DIV_SEP_ESPESSURA / 1000
    );
    const sepSpec = specs.find((s) => s.name === `divsep-sep-${sep.id}`)!;
    const divSpec = specs.find((s) => s.name === `divsep-div-${div.id}`)!;
    const sepY = absYRangeFromSpec(sepSpec, heightM);
    const divY = absYRangeFromSpec(divSpec, heightM);

    expect(roundMm(divY.yMin)).toBe(roundMm(sepY.yMax));
    expect(yOverlapMm(divY, sepY)).toBe(0);
    expect(roundMm(divY.yMax)).toBe(roundMm(cimaBottomY));
  });

  it("DIV completo + SEP: auto-converte altura (não atravessa)", () => {
    const sep = defaultSeparadorItem({ id: "sep-auto", positionMm: 400 });
    const div = defaultDivisorItem({
      id: "div-auto",
      positionMm: 281,
      // sem linkedSeparadorId
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      separadores: [sep],
      divisores: [div],
    });
    const internal = getDivSepInternalDims(box);
    const dims = resolveDivisorDimensions(box, div);
    expect(dims.alturaMm).toBeLessThan(internal.alturaInterna);
    expect(roundMm(dims.alturaMm)).toBe(
      roundMm(resolveSeparadorBottomY(box, sep) - internal.espessura)
    );
  });

  it("SEP ancora direita: largura parcial e mesh ancorada à LAT dir", () => {
    const div = defaultDivisorItem({ id: "div-anc", positionMm: 281 });
    const sep = defaultSeparadorItem({
      id: "sep-anc",
      positionMm: 400,
      ancoraHorizontal: "direita",
    });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      divisores: [div],
      separadores: [sep],
    });
    const internal = getDivSepInternalDims(box);
    const dims = resolveSeparadorDimensions(box, sep);
    expect(dims.larguraMm).toBeLessThan(internal.larguraInterna - 2);

    const heightM = 0.9;
    const specs = getDivSepMeshSpecs(box, 0.6, heightM, 0.56, DIV_SEP_ESPESSURA / 1000);
    const sepSpec = specs.find((s) => s.name === `divsep-sep-${sep.id}`)!;
    const halfW = dims.larguraMm / 2000;
    const centerAbsMm = (sepSpec.pos[0]! + 0.6 / 2) * 1000;
    const rightEdge = centerAbsMm + halfW * 1000;
    expect(roundMm(rightEdge)).toBe(roundMm(internal.espessura + internal.larguraInterna));
  });
});
