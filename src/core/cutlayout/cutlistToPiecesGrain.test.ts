import { describe, expect, it } from "vitest";
import { cutlistToPieces, runCutLayout } from "./cutLayoutEngine";
import { isRotatablePiece } from "./utils/cutLayoutUtils";
import { v3PiecesToCutPieces } from "./integration/v3ToCutPieces";
import { cutPieceToV3 } from "../../nesting-v3/useNestingV3";
import { DEFAULT_NESTING_V3_SETTINGS } from "../../nesting-v3/nestingV3Settings";
import { getOrientations } from "./scoring/rotationScoring";
import { isNestingRotationLocked } from "../materials/nestingGrainLock";

/**
 * Contrato industrial definitivo — Material de madeira (veio).
 * Qualquer alteração que permita rotação ou swap L↔A em madeira deve falhar aqui.
 */
const woodDoorCutlistItem = {
  nome: "Porta 01",
  quantidade: 1,
  dimensoes: { largura: 596, altura: 716, profundidade: 19 },
  espessura: 19,
  materialId: "carvalho",
  material: "Carvalho",
  tipo: "porta_simples",
  grainDirection: "YY" as const,
  boxId: "box-1",
  drillHoles: [] as [],
  metadata: { lockWoodGrain: true },
};

describe("cutlistToPieces — veio de madeira", () => {
  it("preserva largura×altura de porta alta em material de madeira (sem swap L↔A)", () => {
    const pieces = cutlistToPieces([woodDoorCutlistItem]);

    expect(pieces).toHaveLength(1);
    expect(pieces[0].largura_mm).toBe(596);
    expect(pieces[0].altura_mm).toBe(716);
    expect(pieces[0].grainDirection).toBe("width");
    expect(isRotatablePiece(pieces[0])).toBe(false);
  });

  it("preserva dimensões de remate em madeira (comportamento existente)", () => {
    const pieces = cutlistToPieces([
      {
        nome: "Remate DIR",
        quantidade: 1,
        dimensoes: { largura: 100, altura: 720, profundidade: 19 },
        espessura: 19,
        materialId: "carvalho",
        material: "Carvalho",
        tipo: "remate",
        grainDirection: "XX",
        boxId: "box-1",
        drillHoles: [],
        metadata: { lockWoodGrain: true, remateId: "r1" },
      },
    ]);

    expect(pieces[0].largura_mm).toBe(100);
    expect(pieces[0].altura_mm).toBe(720);
    expect(isRotatablePiece(pieces[0])).toBe(false);
  });

  it("ainda normaliza peças MDF sem bloqueio de veio (largura = maior dimensão)", () => {
    const pieces = cutlistToPieces([
      {
        nome: "Lateral",
        quantidade: 1,
        dimensoes: { largura: 481, altura: 720, profundidade: 19 },
        espessura: 19,
        materialId: "mdf_branco",
        material: "MDF Branco",
        tipo: "lateral_esquerda",
        grainDirection: "XX",
        boxId: "box-1",
        drillHoles: [],
      },
    ]);

    expect(pieces[0].largura_mm).toBe(720);
    expect(pieces[0].altura_mm).toBe(481);
  });
});

describe("pipeline industrial madeira — integração", () => {
  it("cutlistToPieces → V3 → v3ToCutPieces mantém dimensões e bloqueio", () => {
    const [cutPiece] = cutlistToPieces([woodDoorCutlistItem]);
    const v3 = cutPieceToV3(cutPiece!, 0, { lockWoodGrain: true });
    const [layoutPiece] = v3PiecesToCutPieces([v3], DEFAULT_NESTING_V3_SETTINGS);

    expect(v3.widthMm).toBe(596);
    expect(v3.heightMm).toBe(716);
    expect(v3.lockWoodGrain).toBe(true);
    expect(layoutPiece.largura_mm).toBe(596);
    expect(layoutPiece.altura_mm).toBe(716);
    expect(layoutPiece.grainDirection).toBe("width");
    expect(isRotatablePiece(layoutPiece)).toBe(false);
    expect(getOrientations(layoutPiece, { rotationWeight: 0, rotationPenalty: 0, rotationPreferenceMode: "auto" }, isRotatablePiece)).toEqual([
      { w: 596, h: 716, rotation: 0 },
    ]);
  });

  it("runCutLayout coloca portas de madeira sempre com rotacao=0", () => {
    const doors = cutlistToPieces([
      { ...woodDoorCutlistItem, nome: "Porta A", metadata: { lockWoodGrain: true } },
      { ...woodDoorCutlistItem, nome: "Porta B", metadata: { lockWoodGrain: true } },
    ]);
    const result = runCutLayout(doors, {
      largura_mm: 2800,
      altura_mm: 2070,
      espessura_mm: 19,
    });

    const placements = result.sheets.flatMap((s) => s.placements);
    expect(placements.length).toBe(2);
    for (const pl of placements) {
      expect(pl.rotacao).toBe(0);
      expect(pl.largura_mm).toBe(596);
      expect(pl.altura_mm).toBe(716);
    }
  });

  it("remate madeira XX preserva orientação em todo o pipeline", () => {
    const [cutPiece] = cutlistToPieces([
      {
        nome: "Remate DIR",
        quantidade: 1,
        dimensoes: { largura: 100, altura: 720, profundidade: 19 },
        espessura: 19,
        materialId: "carvalho",
        material: "Carvalho",
        tipo: "remate",
        grainDirection: "XX",
        boxId: "box-1",
        drillHoles: [],
        metadata: { lockWoodGrain: true, remateId: "r1" },
      },
    ]);
    const v3 = cutPieceToV3(cutPiece!, 0, { lockWoodGrain: true });
    const [layoutPiece] = v3PiecesToCutPieces([v3], DEFAULT_NESTING_V3_SETTINGS);

    expect(layoutPiece.largura_mm).toBe(100);
    expect(layoutPiece.altura_mm).toBe(720);
    expect(isRotatablePiece(layoutPiece)).toBe(false);
  });

  it("contrato definitivo: três barreiras activas no fluxo cutlist → layout", () => {
    const [cutPiece] = cutlistToPieces([woodDoorCutlistItem]);

    expect(cutPiece.largura_mm).toBe(596);
    expect(cutPiece.altura_mm).toBe(716);
    expect(cutPiece.metadata?.lockWoodGrain).toBe(true);

    const v3 = cutPieceToV3(cutPiece!, 0, { lockWoodGrain: true });
    const [layoutPiece] = v3PiecesToCutPieces([v3], DEFAULT_NESTING_V3_SETTINGS);
    expect(
      isNestingRotationLocked({
        materialId: layoutPiece.materialId,
        industrialGrainCode: layoutPiece.industrialGrainCode,
        pieceTipo: layoutPiece.pieceTipo,
        allowPieceRotation: layoutPiece.metadata?.allowPieceRotation as boolean | undefined,
        lockWoodGrain: layoutPiece.metadata?.lockWoodGrain as boolean | undefined,
      })
    ).toBe(true);
    expect(isRotatablePiece(layoutPiece)).toBe(false);
    expect(getOrientations(layoutPiece, { rotationWeight: 0, rotationPenalty: 0, rotationPreferenceMode: "auto" }, isRotatablePiece)).toHaveLength(1);

    const layout = runCutLayout([layoutPiece], {
      largura_mm: 2800,
      altura_mm: 2070,
      espessura_mm: 19,
    });
    const pl = layout.sheets[0]?.placements[0];
    expect(pl?.rotacao).toBe(0);
    expect(pl?.largura_mm).toBe(596);
    expect(pl?.altura_mm).toBe(716);
  });

  it("allowPieceRotation true libera rotação mas mantém L×A originais", () => {
    const [cutPiece] = cutlistToPieces([
      {
        ...woodDoorCutlistItem,
        metadata: { lockWoodGrain: true, allowPieceRotation: true },
      },
    ]);

    expect(cutPiece.largura_mm).toBe(596);
    expect(cutPiece.altura_mm).toBe(716);
    expect(isRotatablePiece(cutPiece)).toBe(true);
    const orientations = getOrientations(
      cutPiece,
      { rotationWeight: 0, rotationPenalty: 0, rotationPreferenceMode: "auto" },
      isRotatablePiece
    );
    expect(orientations.some((o) => o.rotation === 90)).toBe(true);
    expect(orientations.some((o) => o.w === 596 && o.h === 716 && o.rotation === 0)).toBe(true);
  });
});
