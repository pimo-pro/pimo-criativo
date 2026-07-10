import { describe, expect, it } from "vitest";
import { cutlistToPieces, runCutLayout } from "./cutLayoutEngine";
import { cutPieceToV3 } from "../../nesting-v3/useNestingV3";
import { v3PiecesToCutPieces } from "./integration/v3ToCutPieces";
import { DEFAULT_NESTING_V3_SETTINGS } from "../../nesting-v3/nestingV3Settings";
import { finalizeIndustrialLayout } from "./integration/industrialLayoutContract";
import {
  assertHolesPlacementWithinPiece,
  assertHolesWithinLocalPieceBounds,
  computeExportHoleSheetCoords,
  holeRelativePositions,
  transformHoleLocalToPlacementOffset,
} from "./utils/holeGeomInvariant";
import { holeLocalToSheetOffsetMm } from "./layoutCoordinateSystem";
import { isRotatablePiece } from "./utils/cutLayoutUtils";

const PIECE_W = 400;
const PIECE_H = 300;

function cornerHoles() {
  return [
    { x: 10, y: 10, diameter: 5, depth: 12 },
    { x: PIECE_W - 10, y: 10, diameter: 5, depth: 12 },
    { x: 10, y: PIECE_H - 10, diameter: 5, depth: 12 },
    { x: PIECE_W - 10, y: PIECE_H - 10, diameter: 5, depth: 12 },
  ];
}

function baseCutlistItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-invariant",
    nome: "PECA_INVARIANT",
    quantidade: 1,
    dimensoes: { largura: PIECE_W, altura: PIECE_H, profundidade: 19 },
    espessura: 19,
    materialId: "mdf_branco",
    material: "MDF Branco",
    tipo: "prateleira",
    grainDirection: "XX" as const,
    boxId: "box-1",
    drillHoles: cornerHoles(),
    ...overrides,
  };
}

function runFullPipeline(overrides: Record<string, unknown> = {}) {
  const [cutPiece] = cutlistToPieces([baseCutlistItem(overrides)]);
  const v3 = cutPieceToV3(cutPiece!, 0, { lockWoodGrain: false, allowPieceRotation: true });
  const [cutFromV3] = v3PiecesToCutPieces([v3], DEFAULT_NESTING_V3_SETTINGS);
  const layout = runCutLayout([cutFromV3!], {
    largura_mm: 2800,
    altura_mm: 2070,
    espessura_mm: 19,
  }, {
    kerf_mm: 4,
    groupByThicknessOnly: true,
    minUtilizationPercent: 0.5,
    rotationPreferenceMode: "aggressive",
    useMetaHeuristics: false,
    strategyTrials: [{ strategy: "skyline", binHeuristic: "firstFit" }],
  });
  const finalized = finalizeIndustrialLayout(layout, {
    mode: "preserve-positions",
    kerfMm: 4,
    marginMm: 5,
    physicalSheet: { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19 },
  });
  return { cutPiece, v3, cutFromV3, finalized };
}

describe("holeInvariantContract — proteção geométrica permanente", () => {
  it("TESTE A — 400×300 cantos: cutlist → V3 → nesting → export mantém posição relativa", () => {
    const expectedRel = holeRelativePositions(cornerHoles(), PIECE_W, PIECE_H);
    const { cutPiece, v3, cutFromV3, finalized } = runFullPipeline();

    assertHolesWithinLocalPieceBounds(cutPiece!.drillHoles!, PIECE_W, PIECE_H);
    expect(holeRelativePositions(cutPiece!.drillHoles!, PIECE_W, PIECE_H)).toEqual(expectedRel);

    assertHolesWithinLocalPieceBounds(v3.originalHoles, PIECE_W, PIECE_H);
    expect(holeRelativePositions(v3.originalHoles, PIECE_W, PIECE_H)).toEqual(expectedRel);

    assertHolesWithinLocalPieceBounds(cutFromV3!.drillHoles!, PIECE_W, PIECE_H);
    expect(holeRelativePositions(cutFromV3!.drillHoles!, PIECE_W, PIECE_H)).toEqual(expectedRel);

    const pl = finalized.sheets[0]!.placements[0]!;
    const source = pl.originalDrillHoles ?? pl.drillHoles ?? [];
    assertHolesWithinLocalPieceBounds(source, PIECE_W, PIECE_H);
    expect(holeRelativePositions(source, PIECE_W, PIECE_H)).toEqual(expectedRel);

    const exportCoords = computeExportHoleSheetCoords(pl);
    for (const c of exportCoords) {
      expect(c.xSheet).toBeGreaterThanOrEqual(pl.x_mm - 0.01);
      expect(c.ySheet).toBeGreaterThanOrEqual(pl.y_mm - 0.01);
      expect(c.xSheet).toBeLessThanOrEqual(pl.x_mm + pl.largura_mm + 0.01);
      expect(c.ySheet).toBeLessThanOrEqual(pl.y_mm + pl.altura_mm + 0.01);
    }
  });

  it("TESTE B — rotação 90°/180°: furos rodam com R+T da peça", () => {
    const holes = [{ x: 30, y: 40, diameter: 5, depth: 12 }];

    for (const rotacao of [90, 180] as const) {
      const plW = rotacao === 90 ? PIECE_H : PIECE_W;
      const plH = rotacao === 90 ? PIECE_W : PIECE_H;
      const placement = {
        x_mm: 100,
        y_mm: 50,
        largura_mm: plW,
        altura_mm: plH,
        rotacao,
        boxId: "box-1",
        partName: "PECA",
        metadata: { holeDesignLarguraMm: PIECE_W, holeDesignAlturaMm: PIECE_H },
        drillHoles: holes.map((h) => ({ ...h })),
        originalDrillHoles: holes.map((h) => ({ ...h })),
      };

      const finalized = finalizeIndustrialLayout(
        { sheets: [{ sheet: { largura_mm: 1000, altura_mm: 1000, espessura_mm: 19 }, placements: [placement] }] },
        { mode: "preserve-positions", kerfMm: 4, marginMm: 5, physicalSheet: { largura_mm: 1000, altura_mm: 1000, espessura_mm: 19 } }
      );
      const pl = finalized.sheets[0]!.placements[0]!;

      expect(pl.originalDrillHoles?.[0]).toMatchObject({ x: 30, y: 40 });
      expect(pl.drillHoles?.[0]).toMatchObject({ x: 30, y: 40 });

      assertHolesPlacementWithinPiece(
        pl.originalDrillHoles ?? [],
        rotacao,
        PIECE_W,
        PIECE_H,
        pl.largura_mm,
        pl.altura_mm
      );

      const expected = transformHoleLocalToPlacementOffset(30, 40, rotacao, PIECE_W, PIECE_H);
      const off = holeLocalToSheetOffsetMm(30, 40, rotacao, pl.largura_mm, pl.altura_mm, PIECE_W, PIECE_H);
      expect(off).toEqual({ sx: expected.px, sy: expected.py });

      const exportCoords = computeExportHoleSheetCoords(pl);
      expect(exportCoords[0]?.xSheet).toBeCloseTo(pl.x_mm + expected.px, 2);
      expect(exportCoords[0]?.ySheet).toBeCloseTo(pl.y_mm + expected.py, 2);
    }
  });

  it("TESTE C — veio bloqueado: furos não recalculados em cutlistToPieces", () => {
    const doorHoles = [
      { x: 50, y: 80, diameter: 35, depth: 12, holeType: "dobradica" },
      { x: 50, y: 640, diameter: 35, depth: 12, holeType: "dobradica" },
    ];
    const [wood] = cutlistToPieces([
      baseCutlistItem({
        materialId: "carvalho-19",
        material: "Carvalho 19",
        grainDirection: "YY",
        tipo: "porta_simples",
        metadata: { lockWoodGrain: true },
        dimensoes: { largura: 600, altura: 720, profundidade: 19 },
        drillHoles: doorHoles,
      }),
    ]);

    expect(wood?.largura_mm).toBe(600);
    expect(wood?.altura_mm).toBe(720);
    expect(wood?.drillHoles?.[0]).toMatchObject({ x: 50, y: 80 });
    expect(wood?.drillHoles?.[1]).toMatchObject({ x: 50, y: 640 });
    expect(isRotatablePiece(wood!)).toBe(false);

    const v3 = cutPieceToV3(wood!, 0, { lockWoodGrain: true });
    expect(v3.originalHoles[0]).toMatchObject({ x: 50, y: 80 });
    expect(v3.lockWoodGrain).toBe(true);
  });

  it("TESTE D — MDF com rotação: furos acompanham R sem deslocamento relativo", () => {
    const { finalized } = runFullPipeline({
      materialId: "mdf_branco",
      metadata: { allowPieceRotation: true },
    });
    const pl = finalized.sheets[0]!.placements[0]!;
    const relBefore = holeRelativePositions(cornerHoles(), PIECE_W, PIECE_H);
    const source = pl.originalDrillHoles ?? pl.drillHoles ?? [];
    expect(holeRelativePositions(source, PIECE_W, PIECE_H)).toEqual(relBefore);

    if (pl.rotacao === 90 || pl.rotacao === 270) {
      assertHolesPlacementWithinPiece(
        source,
        pl.rotacao,
        PIECE_W,
        PIECE_H,
        pl.largura_mm,
        pl.altura_mm
      );
    }
  });

  it("TESTE E — peça 400×186: furo x=390 valida contra designLarguraMm (não altura)", () => {
    const holes = [{ x: 390, y: 15, diameter: 5, depth: 12 }];
    const [piece] = cutlistToPieces([
      baseCutlistItem({
        dimensoes: { largura: 400, altura: 186, profundidade: 19 },
        drillHoles: holes,
      }),
    ]);
    expect(piece?.largura_mm).toBe(400);
    expect(piece?.altura_mm).toBe(186);
    expect(piece?.drillHoles?.[0]).toMatchObject({ x: 390, y: 15 });
    assertHolesWithinLocalPieceBounds(piece!.drillHoles!, 400, 186);
  });

  it("TESTE F — cutlist com eixos trocados 186×400: furo x=390 alinha dims sem mover furos", () => {
    const holes = [{ x: 390, y: 15, diameter: 5, depth: 12 }];
    const [piece] = cutlistToPieces([
      baseCutlistItem({
        dimensoes: { largura: 186, altura: 400, profundidade: 19 },
        drillHoles: holes,
      }),
    ]);
    expect(piece?.largura_mm).toBe(400);
    expect(piece?.altura_mm).toBe(186);
    expect(piece?.drillHoles?.[0]).toMatchObject({ x: 390, y: 15 });
  });
});
