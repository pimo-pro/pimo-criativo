import { describe, expect, it } from "vitest";
import {
  autoLinkDivisorsToSeparador,
  buildAutoDivisorItem,
  buildAutoSeparadorItem,
  chooseSeparadorAncoraFromDivs,
  applyDivisorLinkUpdate,
  applySeparadorAncoraUpdate,
} from "./autoLink";
import { resolveSeparadorDimensions } from "./dimensions";
import {
  defaultDivisorItem,
  defaultSeparadorItem,
  makeDivSepTestBox,
} from "./divSepTestHelpers";

describe("autoLink DIV/SEP — Fase D", () => {
  it("addDivisor com SEP existente: liga automaticamente em baixo", () => {
    const sep = defaultSeparadorItem({ id: "sep-1", positionMm: 400 });
    const box = makeDivSepTestBox({ separadores: [sep] });
    const div = buildAutoDivisorItem(box, "div-new");
    expect(div.linkedSeparadorId).toBe("sep-1");
    expect(div.posicaoRelativaAoSep).toBe("baixo");
    expect(div.alturaMm).toBeUndefined();
  });

  it("addDivisor sem SEP: sem ligação", () => {
    const box = makeDivSepTestBox({ separadores: [] });
    const div = buildAutoDivisorItem(box, "div-free");
    expect(div.linkedSeparadorId).toBeUndefined();
  });

  it("addSeparador com DIV: escolhe âncora esquerda ou direita (não corta DIV)", () => {
    const div = defaultDivisorItem({ id: "div-1", positionMm: 200 });
    const box = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      divisores: [div],
    });
    const ancora = chooseSeparadorAncoraFromDivs(box);
    expect(ancora === "esquerda" || ancora === "direita").toBe(true);

    const sep = buildAutoSeparadorItem(box, "sep-new");
    expect(sep.ancoraHorizontal).toBe(ancora);
    expect(sep.larguraMm).toBeUndefined();

    const dims = resolveSeparadorDimensions({ ...box, separadores: [sep] }, sep);
    const internalW = 600 - 19 * 2;
    expect(dims.larguraMm).toBeLessThan(internalW - 2);
  });

  it("addSeparador sem DIV: âncora completo", () => {
    const box = makeDivSepTestBox({ divisores: [] });
    const sep = buildAutoSeparadorItem(box, "sep-full");
    expect(sep.ancoraHorizontal).toBe("completo");
  });

  it("autoLinkDivisorsToSeparador liga DIV livres ao novo SEP", () => {
    const free = defaultDivisorItem({ id: "div-free", positionMm: 281 });
    const linked = defaultDivisorItem({
      id: "div-linked",
      linkedSeparadorId: "sep-old",
      positionMm: 400,
    });
    const manual = defaultDivisorItem({
      id: "div-manual",
      alturaMm: 300,
      positionMm: 150,
    });
    const result = autoLinkDivisorsToSeparador([free, linked, manual], "sep-new");
    expect(result[0]!.linkedSeparadorId).toBe("sep-new");
    expect(result[0]!.posicaoRelativaAoSep).toBe("baixo");
    expect(result[1]!.linkedSeparadorId).toBe("sep-old");
    expect(result[2]!.linkedSeparadorId).toBeUndefined();
    expect(result[2]!.alturaMm).toBe(300);
  });

  it("applySeparadorAncoraUpdate limpa larguraMm ao mudar âncora", () => {
    const sep = defaultSeparadorItem({
      id: "sep-a",
      larguraMm: 200,
      ancoraHorizontal: "completo",
    });
    const next = applySeparadorAncoraUpdate(sep, { ancoraHorizontal: "direita" });
    expect(next.ancoraHorizontal).toBe("direita");
    expect(next.larguraMm).toBeUndefined();
  });

  it("applyDivisorLinkUpdate limpa alturaMm e default baixo ao ligar", () => {
    const div = defaultDivisorItem({ id: "div-a", alturaMm: 500 });
    const next = applyDivisorLinkUpdate(div, { linkedSeparadorId: "sep-1" });
    expect(next.linkedSeparadorId).toBe("sep-1");
    expect(next.alturaMm).toBeUndefined();
    expect(next.posicaoRelativaAoSep).toBe("baixo");
  });
});
