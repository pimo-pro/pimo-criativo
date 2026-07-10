import { describe, expect, it } from "vitest";
import { cutlistToPieces } from "./cutLayoutEngine";
import { v3PiecesToCutPieces } from "./integration/v3ToCutPieces";
import { cutPieceToV3 } from "../../nesting-v3/useNestingV3";
import { DEFAULT_NESTING_V3_SETTINGS } from "../../nesting-v3/nestingV3Settings";
import {
  applyRotationGeometryToSheets,
  assertHolesWithinLocalPieceBounds,
  holeRelativePositions,
} from "./utils/cutLayoutGeomRotation";
import { holeLocalToSheetOffsetMm } from "./layoutCoordinateSystem";
import { finalizeIndustrialLayout } from "./integration/industrialLayoutContract";
import { isRotatablePiece } from "./utils/cutLayoutUtils";
import { createCaixaForno } from "../moveis/generators/caixaFornoGenerator";
import { convertWorkspaceToBox } from "../../context/projectState";
import type { WorkspaceBox } from "../types";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { getParafusoDistanceFromCavilhaMm } from "../divSep/cavilhaRules";

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
    id: "p-base",
    nome: "PECA_BASE",
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

describe("holePipelineContract — anti-regressão furos locais", () => {
  it("TESTE 1 — cutlist → V3 → cutPieces mantém posição relativa dos 4 furos", () => {
    const sourceHoles = cornerHoles();
    const expectedRel = holeRelativePositions(sourceHoles, PIECE_W, PIECE_H);

    const [cutPiece] = cutlistToPieces([baseCutlistItem()]);
    expect(cutPiece?.drillHoles).toHaveLength(4);
    assertHolesWithinLocalPieceBounds(cutPiece!.drillHoles!, PIECE_W, PIECE_H);
    expect(holeRelativePositions(cutPiece!.drillHoles!, PIECE_W, PIECE_H)).toEqual(expectedRel);

    const v3 = cutPieceToV3(cutPiece!, 0, { lockWoodGrain: false, allowPieceRotation: true });
    expect(v3.originalHoles).toHaveLength(4);
    expect(holeRelativePositions(v3.originalHoles, PIECE_W, PIECE_H)).toEqual(expectedRel);

    const [roundTrip] = v3PiecesToCutPieces([v3], DEFAULT_NESTING_V3_SETTINGS);
    expect(holeRelativePositions(roundTrip!.drillHoles!, PIECE_W, PIECE_H)).toEqual(expectedRel);
  });

  it("TESTE 2 — rotação 90° e 180° aplica R aos furos (originalDrillHoles intactos)", () => {
    const holes = [{ x: 10, y: 20, diameter: 5, depth: 12 }];

    for (const rotacao of [90, 180] as const) {
      const sheets = [
        {
          sheet: { largura_mm: 1000, altura_mm: 1000, espessura_mm: 19 },
          placements: [
            {
              x_mm: 50,
              y_mm: 50,
              largura_mm: rotacao === 90 ? PIECE_H : PIECE_W,
              altura_mm: rotacao === 90 ? PIECE_W : PIECE_H,
              rotacao,
              boxId: "box-1",
              partName: "PECA",
              drillHoles: holes.map((h) => ({ ...h })),
            },
          ],
        },
      ];

      applyRotationGeometryToSheets(sheets);
      const pl = sheets[0]!.placements[0]!;
      expect(pl.originalDrillHoles?.[0]).toMatchObject({ x: 10, y: 20 });

      const off = holeLocalToSheetOffsetMm(10, 20, rotacao, pl.largura_mm, pl.altura_mm, PIECE_W, PIECE_H);
      const absX = pl.x_mm + off.sx;
      const absY = pl.y_mm + off.sy;
      expect(absX).toBeGreaterThanOrEqual(pl.x_mm);
      expect(absY).toBeGreaterThanOrEqual(pl.y_mm);
      expect(absX).toBeLessThanOrEqual(pl.x_mm + pl.largura_mm);
      expect(absY).toBeLessThanOrEqual(pl.y_mm + pl.altura_mm);
    }
  });

  it("TESTE 3 — material com veio: furos não são recalculados na cutlist", () => {
    const holes = cornerHoles();
    const [wood] = cutlistToPieces([
      baseCutlistItem({
        materialId: "carvalho-19",
        material: "Carvalho 19",
        grainDirection: "YY",
        tipo: "porta_simples",
        metadata: { lockWoodGrain: true },
        dimensoes: { largura: 600, altura: 720, profundidade: 19 },
        drillHoles: [
          { x: 50, y: 80, diameter: 35, depth: 12, holeType: "dobradica" },
          { x: 50, y: 640, diameter: 35, depth: 12, holeType: "dobradica" },
        ],
      }),
    ]);

    expect(wood?.largura_mm).toBe(600);
    expect(wood?.altura_mm).toBe(720);
    expect(wood?.drillHoles?.[0]).toMatchObject({ x: 50, y: 80 });
    expect(wood?.drillHoles?.[1]).toMatchObject({ x: 50, y: 640 });
    expect(isRotatablePiece(wood!)).toBe(false);

    const relBefore = holeRelativePositions(holes, PIECE_W, PIECE_H);
    const [mdfLocked] = cutlistToPieces([
      baseCutlistItem({
        metadata: { lockWoodGrain: true },
        drillHoles: holes,
      }),
    ]);
    expect(holeRelativePositions(mdfLocked!.drillHoles!, PIECE_W, PIECE_H)).toEqual(relBefore);
  });

  it("TESTE 4 — MDF com rotação permitida: furos acompanham R no finalize", () => {
    const holes = [{ x: 30, y: 40, diameter: 5, depth: 12 }];
    const input = {
      sheets: [
        {
          sheet: { largura_mm: 500, altura_mm: 500, espessura_mm: 19 },
          placements: [
            {
              x_mm: 10,
              y_mm: 10,
              largura_mm: PIECE_H,
              altura_mm: PIECE_W,
              rotacao: 90,
              sheetIndex: 0,
              boxId: "box-1",
              partName: "MDF",
              drillHoles: holes.map((h) => ({ ...h })),
            },
          ],
        },
      ],
    };

    const out = finalizeIndustrialLayout(input, {
      mode: "preserve-positions",
      kerfMm: 4,
      marginMm: 5,
      physicalSheet: { largura_mm: 500, altura_mm: 500, espessura_mm: 19 },
    });

    const pl = out.sheets[0]!.placements[0]!;
    expect(pl.originalDrillHoles?.[0]).toMatchObject({ x: 30, y: 40 });
    const off = holeLocalToSheetOffsetMm(30, 40, 90, pl.largura_mm, pl.altura_mm, PIECE_W, PIECE_H);
    expect(off).toEqual({ sx: 40, sy: PIECE_W - 30 });
  });

  it("TESTE 5 — caixa-forno-sep1: parafuso lateral (x=-30) filtrado antes do invariant", () => {
    const parafusoDist = getParafusoDistanceFromCavilhaMm();
    const cfg = createCaixaForno({ id: "forno-sep-diag" });
    const box = convertWorkspaceToBox({
      ...cfg,
      models: [],
      posicaoX_mm: 0,
      posicaoY_mm: 1275,
      rotacaoY_90: false,
      tipoBorda: "reta",
      locked: false,
      drawersLayer: [],
    } as WorkspaceBox);
    const items = cutlistComPrecoFromBox(box, defaultRulesConfig, "mdf_branco");
    const sepCutlist = items.find(
      (i) => i.tipo === "separador" && String(i.metadata?.panelId ?? "").includes("sep1")
    );
    expect(sepCutlist).toBeDefined();
    const larguraSep = sepCutlist!.dimensoes.largura;
    const alturaSep = sepCutlist!.dimensoes.altura;
    const ssotHoles = sepCutlist!.drillHoles ?? [];
    expect(ssotHoles.some((h) => h.holeType === "cavilha" && h.topDrillable === false)).toBe(true);
    expect(ssotHoles.some((h) => h.holeType === "parafuso" && h.x === -parafusoDist)).toBe(true);

    const pieces = cutlistToPieces(items);
    const sepPiece = pieces.find((p) => String(p.metadata?.panelId ?? "").includes("sep1"));
    expect(sepPiece).toBeDefined();
    expect(sepPiece!.largura_mm).toBe(larguraSep);
    expect(sepPiece!.altura_mm).toBe(alturaSep);
    expect(sepPiece!.drillHoles ?? []).toEqual([]);

    const v3 = cutPieceToV3(sepPiece!, 0);
    expect(v3.originalHoles).toEqual([]);
    const [roundTrip] = v3PiecesToCutPieces([v3], DEFAULT_NESTING_V3_SETTINGS);
    expect(roundTrip!.drillHoles ?? []).toEqual([]);
  });

  it("TESTE 6 — lateral 758×598: offsets herdados do vão não produzem yLocal > altura", () => {
    const result = buildPanelDrillingResult(
      {
        tipo: "lateral_esquerda",
        larguraMm: 758,
        alturaMm: 598,
        espessuraMm: 19,
        hingeSide: "left",
        hingePositionsMm: [-42, 120, 450, 620],
        openingHeightMm: 720,
        portaTipo: "porta_simples",
        doorsLayerCount: 1,
      },
      defaultRulesConfig
    );
    expect(result.success).toBe(true);
    const holes = result.data?.drillHoles ?? [];
    expect(holes.length).toBeGreaterThan(0);
    for (const h of holes) {
      expect(h.y).toBeLessThanOrEqual(598.2);
      expect(h.y).toBeGreaterThanOrEqual(-0.2);
      expect(h.x).toBeLessThanOrEqual(758.2);
      expect(h.x).toBeGreaterThanOrEqual(-0.2);
    }
    expect(holes.some((h) => h.y > 598)).toBe(false);

    const [piece] = cutlistToPieces([
      {
        id: "lat-regress",
        nome: "LAT",
        quantidade: 1,
        dimensoes: { largura: 758, altura: 598, profundidade: 19 },
        espessura: 19,
        materialId: "mdf_branco",
        tipo: "lateral_esquerda",
        drillHoles: holes,
      },
    ]);
    expect(piece?.drillHoles?.every((h) => h.y <= 598.2)).toBe(true);
  });
});
