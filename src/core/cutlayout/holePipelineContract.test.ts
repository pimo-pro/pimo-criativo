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
import { getHingeYPositions, getNumDobradicas } from "../rules/rulesConfig";
import { clearHingeDrillingTraceLog } from "../../modules/drilling/hingeDrillingTrace";

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

  it("TESTE 7 — peça 758×598: oy=-42 (legado) nunca gera yLocal=640", () => {
    const result = buildPanelDrillingResult(
      {
        tipo: "lateral_esquerda",
        larguraMm: 758,
        alturaMm: 598,
        espessuraMm: 19,
        hingeSide: "left",
        hingePositionsMm: [-42],
        openingHeightMm: 720,
        portaTipo: "porta_simples",
        doorsLayerCount: 1,
      },
      defaultRulesConfig
    );
    const holes = result.data?.drillHoles ?? [];
    expect(holes.every((h) => h.y <= 598.2)).toBe(true);
    expect(holes.some((h) => Math.abs(h.y - 640) < 1)).toBe(false);

    const doorResult = buildPanelDrillingResult(
      {
        tipo: "porta_simples",
        larguraMm: 758,
        alturaMm: 598,
        espessuraMm: 19,
        hingeSide: "left",
        openingHeightMm: 720,
        bottomGapMm: 61,
        portaTipo: "porta_simples",
        doorsLayerCount: 1,
      },
      defaultRulesConfig
    );
    const doorHoles = doorResult.data?.drillHoles ?? [];
    expect(doorHoles.every((h) => h.y <= 598.2)).toBe(true);

    const [piece] = cutlistToPieces([
      {
        id: "p-758x598",
        nome: "PECA",
        quantidade: 1,
        dimensoes: { largura: 758, altura: 598, profundidade: 19 },
        espessura: 19,
        materialId: "mdf_branco",
        tipo: "lateral_esquerda",
        drillHoles: holes,
      },
    ]);
    const v3 = cutPieceToV3(piece!, 0);
    expect(v3.originalHoles.every((h) => h.y <= 598.2)).toBe(true);
  });

  it("TESTE 8 — peça 758×598: todas combinações dobradiça nunca produzem yLocal > 598", () => {
    clearHingeDrillingTraceLog();
    const pieceW = 758;
    const pieceH = 598;
    const assertHingeBounds = (holes: { x: number; y: number }[]) => {
      for (const h of holes) {
        expect(h.y).toBeLessThanOrEqual(pieceH + 0.2);
        expect(h.y).toBeGreaterThanOrEqual(-0.2);
        expect(h.x).toBeLessThanOrEqual(pieceW + 0.2);
        expect(h.x).toBeGreaterThanOrEqual(-0.2);
      }
      expect(holes.some((h) => h.y > pieceH)).toBe(false);
      expect(holes.some((h) => Math.abs(h.y - 658) < 1)).toBe(false);
    };

    const lateralBase = {
      tipo: "lateral_esquerda" as const,
      larguraMm: pieceW,
      alturaMm: pieceH,
      espessuraMm: 19,
      hingeSide: "left" as const,
      openingHeightMm: 720,
      portaTipo: "porta_simples" as const,
      doorsLayerCount: 1,
    };

    const confusedLarguraOffsets = getHingeYPositions(
      pieceW,
      getNumDobradicas(pieceW, defaultRulesConfig),
      defaultRulesConfig
    );
    expect(confusedLarguraOffsets.some((o) => o > pieceH)).toBe(true);

    const cases: Array<{ label: string; input: Parameters<typeof buildPanelDrillingResult>[0] }> = [
      {
        label: "offsets getHingeYPositions(largura=758) — confusão largura/altura",
        input: { ...lateralBase, hingePositionsMm: confusedLarguraOffsets },
      },
      {
        label: "offset global 658 do vão (fora da peça 598)",
        input: { ...lateralBase, hingePositionsMm: [658] },
      },
      {
        label: "offset global 658 + bottomGap 61",
        input: { ...lateralBase, hingePositionsMm: [658], bottomGapMm: 61 },
      },
      {
        label: "offsets legado porta [-42,120,450,620]",
        input: { ...lateralBase, hingePositionsMm: [-42, 120, 450, 620] },
      },
      {
        label: "sem offsets — recálculo por altura da peça",
        input: { ...lateralBase },
      },
      {
        label: "porta 758×598 hinge left",
        input: {
          tipo: "porta_simples",
          larguraMm: pieceW,
          alturaMm: pieceH,
          espessuraMm: 19,
          hingeSide: "left",
          openingHeightMm: 720,
          bottomGapMm: 61,
          portaTipo: "porta_simples",
          doorsLayerCount: 1,
        },
      },
      {
        label: "lateral direita com offsets globais empilhados",
        input: {
          ...lateralBase,
          tipo: "lateral_direita",
          hingeSide: "right",
          hingePositionsMm: [100, 379, 658, 720],
        },
      },
    ];

    for (const { label, input } of cases) {
      const result = buildPanelDrillingResult(input, defaultRulesConfig);
      expect(result.success, label).toBe(true);
      const holes = result.data?.drillHoles ?? [];
      assertHingeBounds(holes);
    }

    const [piece] = cutlistToPieces([
      {
        id: "lat-758x598-contract",
        nome: "LAT",
        quantidade: 1,
        dimensoes: { largura: pieceW, altura: pieceH, profundidade: 19 },
        espessura: 19,
        materialId: "mdf_branco",
        tipo: "lateral_esquerda",
        drillHoles:
          buildPanelDrillingResult(
            { ...lateralBase, hingePositionsMm: confusedLarguraOffsets },
            defaultRulesConfig
          ).data?.drillHoles ?? [],
      },
    ]);
    expect(piece?.drillHoles?.every((h) => h.y <= pieceH + 0.2)).toBe(true);
    const v3 = cutPieceToV3(piece!, 0);
    expect(v3.originalHoles.every((h) => h.y <= pieceH + 0.2)).toBe(true);
  });

  it("TESTE 9 — v3ToCutPieces descarta yLocal=658 legado (758×598) sem lançar invariant", () => {
    const pieceW = 758;
    const pieceH = 598;
    const staleV3 = {
      id: "stale-lat",
      name: "LAT",
      widthMm: pieceW,
      heightMm: pieceH,
      thicknessMm: 19,
      materialId: "mdf_branco",
      originalHoles: [
        { x: 575.5, y: 658, diameter: 5, depth: 12, holeType: "dobradica_fixacao" as const },
        { x: 100, y: 100, diameter: 5, depth: 12, holeType: "prateleira" as const },
      ],
      rotation: 0 as const,
      color: "#ccc",
    };
    const [cut] = v3PiecesToCutPieces([staleV3 as never], DEFAULT_NESTING_V3_SETTINGS);
    expect(cut?.drillHoles?.some((h) => h.y > pieceH + 0.2)).toBe(false);
    expect(cut?.drillHoles?.some((h) => h.holeType === "dobradica_fixacao")).toBe(false);
    expect(cut?.drillHoles?.some((h) => h.holeType === "prateleira")).toBe(true);
  });

  it("TESTE 10 — port_esq 760×498: prateleira lateral legada (60,750.5) nunca chega ao invariant", () => {
    const pieceW = 760;
    const pieceH = 498;
    const contaminated: Array<{
      x: number;
      y: number;
      diameter: number;
      depth: number;
      holeType: "prateleira" | "dobradica_fixacao";
    }> = [
      { x: 60, y: 750.5, diameter: 5, depth: 13, holeType: "prateleira" },
      { x: 730, y: 100, diameter: 10, depth: 12, holeType: "dobradica_fixacao" },
    ];
    const [piece] = cutlistToPieces([
      {
        id: "port-esq-contract",
        nome: "port_esq",
        quantidade: 1,
        dimensoes: { largura: pieceW, altura: pieceH, profundidade: 19 },
        espessura: 19,
        materialId: "mdf_branco",
        tipo: "porta_simples",
        metadata: { industrialLabel: "port_esq" },
        drillHoles: contaminated,
      },
    ]);
    expect(piece?.drillHoles?.some((h) => h.holeType === "prateleira")).toBe(false);
    expect(piece?.drillHoles?.every((h) => h.y <= pieceH + 0.2)).toBe(true);
    const v3 = cutPieceToV3(piece!, 0);
    expect(v3.originalHoles.every((h) => h.y <= pieceH + 0.2)).toBe(true);
    const [roundTrip] = v3PiecesToCutPieces(
      [
        {
          ...v3,
          originalHoles: [
            ...v3.originalHoles,
            { x: 60, y: 750.5, diameter: 5, depth: 13, holeType: "prateleira" as const },
          ],
        },
      ],
      DEFAULT_NESTING_V3_SETTINGS
    );
    expect(roundTrip?.drillHoles?.some((h) => h.holeType === "prateleira")).toBe(false);
    expect(roundTrip?.drillHoles?.every((h) => h.y <= pieceH + 0.2)).toBe(true);
  });

  it("TESTE 11 — lateral 722×481: furo SEP/cavilha legado (421,489.8) nunca rebenta invariant", () => {
    const pieceW = 722;
    const pieceH = 481;
    const contaminated: Array<{
      x: number;
      y: number;
      diameter: number;
      depth: number;
      holeType: "cavilha" | "prateleira" | "corredica";
    }> = [
      { x: 421, y: 489.8, diameter: 10, depth: 30, holeType: "cavilha" },
      { x: 60, y: 100, diameter: 5, depth: 13, holeType: "prateleira" },
    ];
    const [piece] = cutlistToPieces([
      {
        id: "lat-722x481-contract",
        nome: "LAT",
        quantidade: 1,
        dimensoes: { largura: pieceW, altura: pieceH, profundidade: 19 },
        espessura: 19,
        materialId: "mdf_branco",
        tipo: "lateral_esquerda",
        drillHoles: contaminated,
      },
    ]);
    expect(piece?.drillHoles?.every((h) => h.y <= pieceH + 0.2)).toBe(true);
    expect(piece?.drillHoles?.some((h) => Math.abs(h.x - 421) < 1 && h.y > pieceH)).toBe(false);
    const v3 = cutPieceToV3(piece!, 0);
    expect(v3.originalHoles.every((h) => h.y <= pieceH + 0.2)).toBe(true);
    const [roundTrip] = v3PiecesToCutPieces(
      [
        {
          ...v3,
          originalHoles: [
            ...v3.originalHoles,
            { x: 421, y: 489.8, diameter: 10, depth: 30, holeType: "cavilha" as const },
          ],
        },
      ],
      DEFAULT_NESTING_V3_SETTINGS
    );
    expect(roundTrip?.drillHoles?.every((h) => h.y <= pieceH + 0.2)).toBe(true);
    expect(roundTrip?.drillHoles?.some((h) => h.y > pieceH + 0.2)).toBe(false);
  });
});
