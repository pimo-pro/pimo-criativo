import { describe, expect, it } from "vitest";
import { cutlistToPieces } from "./cutLayoutEngine";
import { isRotatablePiece } from "./utils/cutLayoutUtils";

describe("cutlistToPieces — veio bloqueado preserva orientação viewer", () => {
  it("porta de madeira mantém largura×altura originais (não roda para optimizar)", () => {
    const [piece] = cutlistToPieces([
      {
        id: "door-1",
        nome: "PORTA",
        quantidade: 1,
        dimensoes: { largura: 600, altura: 720, profundidade: 19 },
        espessura: 19,
        materialId: "carvalho-19",
        material: "Carvalho 19",
        tipo: "porta_simples",
        grainDirection: "YY",
        boxId: "box-1",
        metadata: { lockWoodGrain: true },
      },
    ]);
    expect(piece?.largura_mm).toBe(600);
    expect(piece?.altura_mm).toBe(720);
    expect(isRotatablePiece(piece!)).toBe(false);
  });

  it("frente de gaveta de madeira mantém orientação", () => {
    const [piece] = cutlistToPieces([
      {
        id: "drawer-front-1",
        nome: "GAVETA_FRENTE",
        quantidade: 1,
        dimensoes: { largura: 564, altura: 180, profundidade: 19 },
        espessura: 19,
        materialId: "carvalho-19",
        material: "Carvalho 19",
        tipo: "gaveta_frente_ext",
        grainDirection: "YY",
        boxId: "box-1",
        metadata: { lockWoodGrain: true },
      },
    ]);
    expect(piece?.largura_mm).toBe(564);
    expect(piece?.altura_mm).toBe(180);
    expect(isRotatablePiece(piece!)).toBe(false);
  });

  it("MDF sem veio preserva dimensões e furos locais (rotação só no nesting)", () => {
    const [piece] = cutlistToPieces([
      {
        id: "shelf-1",
        nome: "PRATELEIRA",
        quantidade: 1,
        dimensoes: { largura: 400, altura: 560, profundidade: 19 },
        espessura: 19,
        materialId: "mdf_branco",
        material: "MDF Branco",
        tipo: "prateleira",
        grainDirection: "XX",
        boxId: "box-1",
        drillHoles: [{ x: 20, y: 30, diameter: 5, depth: 12 }],
      },
    ]);
    expect(piece?.largura_mm).toBe(400);
    expect(piece?.altura_mm).toBe(560);
    expect(piece?.drillHoles?.[0]).toMatchObject({ x: 20, y: 30 });
  });
});
