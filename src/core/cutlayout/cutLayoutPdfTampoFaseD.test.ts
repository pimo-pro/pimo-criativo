import { describe, expect, it } from "vitest";
import { cutlistToPieces, type CutlistItemForPieces } from "./cutLayoutEngine";
import { buildCutLayoutPdf, placementPdfDrawOps } from "./cutLayoutPdf";
import { computeTampoAngleDegFromLengths } from "../remate/tampoAngle";
import { TAMPO_CUTOUT_DEFAULTS } from "../remate/tampoCutouts";
import { TAMPO_FIXED_WIDTH_MM } from "../remate/tampoCozinhaRules";
import {
  MDB_LAMINADO_SHEET_HF_MM,
  MDB_LAMINADO_SHEET_LF_MM,
} from "../materials/materials.api";

const W = TAMPO_FIXED_WIDTH_MM;
const FOGAO = TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO;

function pdfToLatin1Text(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("latin1");
}

function hasObliqueEdge(points: Array<{ x: number; y: number }>): boolean {
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return true;
  }
  return false;
}

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

describe("Fase D — PDF industrial TAMPO", () => {
  it("TAMPO com milan → path com aresta oblíqua", () => {
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
    const ops = placementPdfDrawOps({
      x_mm: 0,
      y_mm: 0,
      largura_mm: pieces[0]!.largura_mm,
      altura_mm: pieces[0]!.altura_mm,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "TAMPO",
      outerPolygonMm: pieces[0]!.outerPolygonMm,
    });
    const poly = ops.find((op) => op.kind === "polygon");
    expect(poly?.kind).toBe("polygon");
    if (poly?.kind !== "polygon") return;
    expect(poly.points).toHaveLength(4);
    expect(hasObliqueEdge(poly.points)).toBe(true);
    expect(ops.some((op) => op.kind === "inner-rect" || op.kind === "inner-circle")).toBe(false);
  });

  it("TAMPO com fogão → rect interior no sítio correcto", () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_FOGAO", x: 0, y: 0, width: FOGAO.width, height: FOGAO.height }],
        },
      }),
    ]);
    const ops = placementPdfDrawOps({
      x_mm: 0,
      y_mm: 0,
      largura_mm: 1800,
      altura_mm: W,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "TAMPO",
      outerPolygonMm: pieces[0]!.outerPolygonMm,
      innerContours: pieces[0]!.innerContours,
    });
    const inner = ops.find((op) => op.kind === "inner-rect");
    expect(inner).toEqual({
      kind: "inner-rect",
      x: 620,
      y: 70,
      w: 560,
      h: 490,
    });
  });

  it("TAMPO circular → círculo interior no centro", () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_CIRCULAR", x: 0, y: 0, diameter: 180 }],
        },
      }),
    ]);
    const ops = placementPdfDrawOps({
      x_mm: 0,
      y_mm: 0,
      largura_mm: 1800,
      altura_mm: W,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "TAMPO",
      outerPolygonMm: pieces[0]!.outerPolygonMm,
      innerContours: pieces[0]!.innerContours,
    });
    const circle = ops.find((op) => op.kind === "inner-circle");
    expect(circle).toEqual({ kind: "inner-circle", cx: 900, cy: 315, r: 90 });
  });

  it("TAMPO sem cutouts → só polígono exterior", () => {
    const pieces = cutlistToPieces([tampoItem({})]);
    const ops = placementPdfDrawOps({
      x_mm: 0,
      y_mm: 0,
      largura_mm: 1800,
      altura_mm: W,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "TAMPO",
      outerPolygonMm: pieces[0]!.outerPolygonMm,
      innerContours: pieces[0]!.innerContours,
    });
    expect(ops.filter((op) => op.kind === "polygon")).toHaveLength(1);
    expect(ops.some((op) => op.kind === "inner-rect" || op.kind === "inner-circle")).toBe(false);
  });

  it("caixaria 19 mm → rect actual, sem polígono", () => {
    const pieces = cutlistToPieces([
      {
        nome: "Lat_MDF",
        tipo: "lateral",
        quantidade: 1,
        espessura: 19,
        dimensoes: { largura: 800, altura: 400, profundidade: 19 },
        materialId: "mdf_branco-19",
        boxId: "box-1",
      },
    ]);
    const p = pieces[0]!;
    const ops = placementPdfDrawOps({
      x_mm: 10,
      y_mm: 10,
      largura_mm: p.largura_mm,
      altura_mm: p.altura_mm,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      partName: p.partName,
      outerPolygonMm: p.outerPolygonMm,
      innerContours: p.innerContours,
    });
    expect(ops).toEqual([{ kind: "rect", x: 0, y: 0, w: 800, h: 400 }]);
  });

  it("rotação 90° → polígono e recortes usam o mesmo offset dos furos", () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_FOGAO", x: 0, y: 0, width: FOGAO.width, height: FOGAO.height }],
        },
      }),
    ]);
    const pl = {
      x_mm: 10,
      y_mm: 10,
      largura_mm: W,
      altura_mm: 1800,
      rotacao: 90,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "TAMPO",
      outerPolygonMm: pieces[0]!.outerPolygonMm,
      innerContours: pieces[0]!.innerContours,
    };
    const ops = placementPdfDrawOps(pl);
    const poly = ops.find((op) => op.kind === "polygon");
    expect(poly?.kind).toBe("polygon");
    if (poly?.kind === "polygon") {
      expect(poly.points[0]).toEqual({ x: 0, y: 1800 });
    }
    const inner = ops.find((op) => op.kind === "inner-rect");
    expect(inner).toBeDefined();
    expect(inner?.kind).toBe("inner-rect");
  });

  it("PDF da chapa MDB mostra 3660×630×30 e gera sem erro", async () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_FOGAO", x: 0, y: 0, width: FOGAO.width, height: FOGAO.height }],
        },
      }),
    ]);
    const p = pieces[0]!;
    const doc = await buildCutLayoutPdf(
      {
        sheets: [
          {
            sheet: {
              largura_mm: MDB_LAMINADO_SHEET_LF_MM,
              altura_mm: MDB_LAMINADO_SHEET_HF_MM,
              espessura_mm: 30,
              materialName: "MDB Laminado 30",
            },
            placements: [
              {
                x_mm: 10,
                y_mm: 10,
                largura_mm: p.largura_mm,
                altura_mm: p.altura_mm,
                rotacao: 0,
                sheetIndex: 0,
                boxId: "box-1",
                partName: "TAMPO",
                outerPolygonMm: p.outerPolygonMm,
                innerContours: p.innerContours,
              },
            ],
          },
        ],
      },
      { projectName: "FaseD_TAMPO" }
    );
    const text = pdfToLatin1Text(doc.output("arraybuffer"));
    expect(text).toContain("3660");
    expect(text).toContain("630");
    expect(text).toMatch(/30\s*mm/);
  });
});
