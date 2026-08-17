import { describe, expect, it } from "vitest";
import { cutlistToPieces, type CutlistItemForPieces } from "./cutLayoutEngine";
import { applyRotationGeometryToSheets } from "./utils/cutLayoutGeomRotation";
import { computeTampoAngleDegFromLengths } from "../remate/tampoAngle";
import { TAMPO_CUTOUT_DEFAULTS } from "../remate/tampoCutouts";
import { TAMPO_FIXED_WIDTH_MM } from "../remate/tampoCozinhaRules";

const W = TAMPO_FIXED_WIDTH_MM;
const FOGAO = TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO;

function tampoItem(
  overrides: Partial<CutlistItemForPieces> & { metadata?: Record<string, unknown> }
): CutlistItemForPieces {
  return {
    nome: "TAMPO",
    tipo: "remate",
    quantidade: 1,
    espessura: 30,
    dimensoes: { largura: 1800, altura: W, profundidade: 30 },
    materialId: "mdb_laminado-30",
    material: "MDB Laminado 30",
    boxId: "box-1",
    ...overrides,
    metadata: {
      productType: "TAMPO_COZINHA",
      ...(overrides.metadata ?? {}),
    },
  };
}

describe("Fase C — ponte cutlist → CutPiece (TAMPO)", () => {
  it("TAMPO com fogão → innerContours contém 1 rect; AABB inalterado", () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_FOGAO", x: 0, y: 0, width: FOGAO.width, height: FOGAO.height }],
        },
      }),
    ]);
    expect(pieces).toHaveLength(1);
    const p = pieces[0]!;
    expect(p.largura_mm).toBe(1800);
    expect(p.altura_mm).toBe(W);
    expect(p.innerContours).toHaveLength(1);
    expect(p.innerContours![0]).toEqual({
      x_mm: 620,
      y_mm: 70,
      largura_mm: 560,
      altura_mm: 490,
    });
    expect(p.outerPolygonMm).toHaveLength(4);
  });

  it("TAMPO sem cutouts → innerContours undefined", () => {
    const pieces = cutlistToPieces([tampoItem({})]);
    expect(pieces[0]!.innerContours).toBeUndefined();
    expect(pieces[0]!.largura_mm).toBe(1800);
    expect(pieces[0]!.altura_mm).toBe(W);
    expect(pieces[0]!.outerPolygonMm).toEqual([
      { x: 0, y: 0 },
      { x: 1800, y: 0 },
      { x: 1800, y: W },
      { x: 0, y: W },
    ]);
  });

  it("TAMPO com milan → outerPolygonMm trapézio; AABB inalterado", () => {
    const angleDeg = computeTampoAngleDegFromLengths(1995, 2303, W);
    const pieces = cutlistToPieces([
      tampoItem({
        dimensoes: { largura: 1995, altura: W, profundidade: 30 },
        metadata: {
          productType: "TAMPO_COZINHA",
          tampoAngle: { frontLengthMm: 1995, backLengthMm: 2303, angleDeg },
        },
      }),
    ]);
    const p = pieces[0]!;
    expect(p.largura_mm).toBe(1995);
    expect(p.altura_mm).toBe(W);
    expect(p.outerPolygonMm).toHaveLength(4);
    expect(p.outerPolygonMm![0]!.x).toBeCloseTo(0, 5);
    expect(p.outerPolygonMm![0]!.y).toBeCloseTo(0, 5);
    expect(p.outerPolygonMm![1]!.x).toBeCloseTo(2303, 5);
    expect(p.outerPolygonMm![1]!.y).toBeCloseTo(0, 5);
    expect(p.outerPolygonMm![2]!.x).toBeCloseTo(1995, 5);
    expect(p.outerPolygonMm![2]!.y).toBeCloseTo(W, 5);
    expect(p.outerPolygonMm![3]!.x).toBeCloseTo(0, 5);
    expect(p.outerPolygonMm![3]!.y).toBeCloseTo(W, 5);
  });

  it("caixaria 19 mm → sem outerPolygonMm; AABB actual preservado", () => {
    const pieces = cutlistToPieces([
      {
        nome: "Lat_MDF",
        tipo: "lateral",
        quantidade: 1,
        espessura: 19,
        dimensoes: { largura: 800, altura: 400, profundidade: 19 },
        materialId: "mdf_branco-19",
        material: "MDF Branco 19",
        boxId: "box-1",
      },
    ]);
    expect(pieces[0]!.outerPolygonMm).toBeUndefined();
    expect(pieces[0]!.innerContours).toBeUndefined();
    expect(pieces[0]!.largura_mm).toBe(800);
    expect(pieces[0]!.altura_mm).toBe(400);
  });

  it("remate sem productType TAMPO → fallback AABB sem polígono", () => {
    const pieces = cutlistToPieces([
      {
        nome: "Remate",
        tipo: "remate",
        quantidade: 1,
        espessura: 19,
        dimensoes: { largura: 1200, altura: 80, profundidade: 19 },
        materialId: "mdf_branco-19",
        boxId: "box-1",
      },
    ]);
    expect(pieces[0]!.outerPolygonMm).toBeUndefined();
    expect(pieces[0]!.innerContours).toBeUndefined();
    expect(pieces[0]!.largura_mm).toBe(1200);
    expect(pieces[0]!.altura_mm).toBe(80);
  });

  it("rotação 90° aplica a mesma transformação de furos ao outerPolygonMm", () => {
    const pieces = cutlistToPieces([tampoItem({})]);
    const poly = pieces[0]!.outerPolygonMm!;
    const sheets = [
      {
        sheet: { largura_mm: 3660, altura_mm: 2070, espessura_mm: 30 },
        placements: [
          {
            x_mm: 10,
            y_mm: 10,
            largura_mm: W,
            altura_mm: 1800,
            rotacao: 90,
            sheetIndex: 0,
            boxId: "box-1",
            partName: "TAMPO",
            outerPolygonMm: poly.map((pt) => ({ ...pt })),
            innerContours: [{ x_mm: 620, y_mm: 70, largura_mm: 560, altura_mm: 490 }],
          },
        ],
      },
    ];
    applyRotationGeometryToSheets(sheets);
    const placed = sheets[0]!.placements[0]!;
    expect(placed.outerPolygonMm![0]).toEqual({ x: 0, y: 1800 });
    expect(placed.innerContours).toHaveLength(1);
  });
});
