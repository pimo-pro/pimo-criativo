import { describe, expect, it } from "vitest";
import { buildDivSepDrilling } from "./drilling";
import { makeDivSepTestBox, defaultSeparadorItem } from "./divSepTestHelpers";

describe("divSep lateral piece bounds", () => {
  it("clamp SEP↔lateral cavilha quando centerY do módulo > altura da peça", () => {
    const box = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 720, profundidade: 541 },
      profundidadeExterna: 541,
      separadores: [defaultSeparadorItem({ positionMm: 471 })],
    });
    const { getExtraHoles } = buildDivSepDrilling(box, box.panelIds!);
    const raw = getExtraHoles("lateral_esquerda");
    expect(raw.some((h) => h.y > 481)).toBe(true);
    const clamped = getExtraHoles("lateral_esquerda", undefined, { larguraMm: 722, alturaMm: 481 });
    expect(clamped.every((h) => h.y <= 481.2)).toBe(true);
    expect(clamped.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(raw.some((h) => h.y > 481) && clamped.every((h) => h.y <= 481.2)).toBe(true);
  });
});
