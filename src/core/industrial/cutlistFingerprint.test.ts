import { describe, expect, it } from "vitest";
import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import { buildCutlistFingerprint } from "./cutlistFingerprint";

function item(
  overrides: Partial<CutlistItemForPieces> & {
    largura?: number;
    altura?: number;
    espessura?: number;
  } = {}
): CutlistItemForPieces {
  const esp = overrides.espessura ?? 19;
  return {
    nome: overrides.nome ?? "Lateral",
    tipo: overrides.tipo ?? "lateral_esquerda",
    quantidade: overrides.quantidade ?? 1,
    espessura: esp,
    dimensoes: {
      largura: overrides.largura ?? 600,
      altura: overrides.altura ?? 400,
      profundidade: esp,
    },
    boxId: overrides.boxId ?? "box-1",
    material: overrides.material ?? "MDF Branco",
    materialId: overrides.materialId ?? "mdf_branco-19",
    ...overrides,
  };
}

describe("buildCutlistFingerprint", () => {
  const sheet = { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19, kerf_mm: 4.5 };

  it("é estável e independente da ordem das peças", () => {
    const a = buildCutlistFingerprint({
      items: [item({ boxId: "a" }), item({ boxId: "b", tipo: "cima" })],
      sheet,
    });
    const b = buildCutlistFingerprint({
      items: [item({ boxId: "b", tipo: "cima" }), item({ boxId: "a" })],
      sheet,
    });
    expect(a).toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
  });

  it("muda quando dimensões ou quantidade mudam", () => {
    const base = buildCutlistFingerprint({ items: [item()], sheet });
    const dim = buildCutlistFingerprint({
      items: [item({ largura: 601 })],
      sheet,
    });
    const qty = buildCutlistFingerprint({
      items: [item({ quantidade: 2 })],
      sheet,
    });
    expect(dim).not.toBe(base);
    expect(qty).not.toBe(base);
  });

  it("muda quando params de chapa / kerf mudam", () => {
    const base = buildCutlistFingerprint({ items: [item()], sheet });
    const sheet2 = buildCutlistFingerprint({
      items: [item()],
      sheet: { ...sheet, largura_mm: 2801 },
    });
    const kerf2 = buildCutlistFingerprint({
      items: [item()],
      sheet: { ...sheet, kerf_mm: 5 },
    });
    expect(sheet2).not.toBe(base);
    expect(kerf2).not.toBe(base);
  });
});
