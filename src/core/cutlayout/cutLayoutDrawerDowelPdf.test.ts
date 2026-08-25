/**
 * Garante que o layout PDF usa as mesmas cavilhas SSOT que o XML (drillExport).
 * Modelo golden XML_COMPLITO: face Y=15/H?38 Depth13; aresta Y=15/H?35 Depth30.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cutlistToPieces } from "./cutLayoutEngine";
import { buildCutLayoutPdf, holesForPdf } from "./cutLayoutPdf";
import { applyRotationGeometryToSheets } from "./utils/cutLayoutGeomRotation";
import { computeDrawerLateralStructuralHoles } from "../drawers/drilling/DrawerDrillingRules";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco } from "../types";
import type { CutPlacement } from "./cutLayoutTypes";

const LAT = { largura: 500, altura: 150, espessura: 16 } as const;

function latItem(side: "esq" | "dir"): CutListItemComPreco {
  const tipo = side === "esq" ? "gaveta_lat_esq" : "gaveta_lat_dir";
  const drilling = buildPanelDrillingResult(
    {
      tipo,
      larguraMm: LAT.largura,
      alturaMm: LAT.altura,
      espessuraMm: LAT.espessura,
    },
    defaultRulesConfig
  );
  expect(drilling.success).toBe(true);
  return {
    id: tipo,
    nome: tipo,
    tipo,
    quantidade: 1,
    dimensoes: {
      largura: LAT.largura,
      altura: LAT.altura,
      profundidade: LAT.espessura,
    },
    espessura: LAT.espessura,
    material: "MDF Branco 16",
    materialId: "mdf_branco",
    drillHoles: drilling.data!.drillHoles,
    precoUnitario: 0,
    precoTotal: 0,
  };
}

describe("layout PDF — cavilhas SSOT (golden)", () => {
  it("cutlistToPieces NAO descarta cavilhas de aresta (topDrillable=false)", () => {
    const pieces = cutlistToPieces([latItem("esq")]);
    expect(pieces).toHaveLength(1);
    const holes = pieces[0]!.drillHoles ?? [];
    const cavilhas = holes.filter((h) => h.holeType === "cavilha");
    expect(cavilhas.length).toBe(4);
    const ys = [...new Set(cavilhas.map((h) => h.y))].sort((a, b) => a - b);
    expect(ys).toEqual([15, 112, 115]); // face 15/112 + aresta 15/115
    const face = cavilhas.filter((h) => h.topDrillable);
    const edge = cavilhas.filter((h) => !h.topDrillable);
    expect(face.every((h) => h.depth === 13)).toBe(true);
    expect(edge.every((h) => h.depth === 30)).toBe(true);
  });

  it("applyRotationGeometryToSheets preserva furos de aresta X=0/L", () => {
    const piecesEsq = cutlistToPieces([latItem("esq")]);
    const piecesDir = cutlistToPieces([latItem("dir")]);
    const plEsq: CutPlacement = {
      x_mm: 50,
      y_mm: 50,
      largura_mm: LAT.largura,
      altura_mm: LAT.altura,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      pieceNumber: 1,
      partName: "LAT_ESQ",
      drillHoles: piecesEsq[0]!.drillHoles,
    };
    const plDir: CutPlacement = {
      ...plEsq,
      boxId: "box-2",
      pieceNumber: 2,
      partName: "LAT_DIR",
      drillHoles: piecesDir[0]!.drillHoles,
    };
    applyRotationGeometryToSheets([
      {
        sheet: { largura_mm: 2800, altura_mm: 2070, espessura_mm: 16 },
        placements: [plEsq, plDir],
      },
    ]);
    const esqCav = (plEsq.originalDrillHoles ?? []).filter((h) => h.holeType === "cavilha");
    const dirCav = (plDir.originalDrillHoles ?? []).filter((h) => h.holeType === "cavilha");
    expect(esqCav.some((h) => h.x === LAT.largura && !h.topDrillable)).toBe(true);
    expect(dirCav.some((h) => h.x === 0 && !h.topDrillable)).toBe(true);
    expect(esqCav.some((h) => h.y === 115)).toBe(true);
  });

  it("holesForPdf inclui Y golden e profundidades 13/30", () => {
    const structural = computeDrawerLateralStructuralHoles({
      ...LAT,
      side: "esq",
    });
    const cavilhas = structural.filter((h) => h.tipo === "cavilha");
    const pl: CutPlacement = {
      x_mm: 100,
      y_mm: 100,
      largura_mm: LAT.largura,
      altura_mm: LAT.altura,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      pieceNumber: 1,
      partName: "LAT",
      originalDrillHoles: cavilhas.map((h) => ({
        x: h.x,
        y: h.y,
        diameter: h.diametro,
        depth: h.profundidade,
        holeType: h.tipo,
        topDrillable: h.topDrillable === true,
      })),
    };
    const pdfHoles = holesForPdf(
      pl,
      { largura_mm: 2800, altura_mm: 2070, espessura_mm: 16 },
      false
    );
    expect(pdfHoles).toHaveLength(4);
    expect([...new Set(pdfHoles.map((h) => h.y))].sort((a, b) => a - b)).toEqual([15, 112, 115]);
    expect(pdfHoles.some((h) => h.depth === 13)).toBe(true);
    expect(pdfHoles.some((h) => h.depth === 30)).toBe(true);
  });

  it("LAT_DIR espelho: aresta em X=0", () => {
    const pieces = cutlistToPieces([latItem("dir")]);
    const cavilhas = (pieces[0]!.drillHoles ?? []).filter((h) => h.holeType === "cavilha");
    const atZero = cavilhas.filter((h) => h.x === 0);
    expect(atZero.length).toBe(2);
    expect(atZero.map((h) => h.y).sort((a, b) => a - b)).toEqual([15, 115]);
  });

  it("gera PDF de evidencia com cavilhas golden (layout_gaveta_cavilhas_ssot.pdf)", async () => {
    const outDir = resolve(process.cwd(), "tmp");
    mkdirSync(outDir, { recursive: true });

    const pieces = cutlistToPieces([latItem("esq"), latItem("dir")]);
    const placements: CutPlacement[] = pieces.map((p, i) => ({
      x_mm: 50 + i * (LAT.largura + 40),
      y_mm: 80,
      largura_mm: p.largura_mm,
      altura_mm: p.altura_mm,
      rotacao: 0,
      sheetIndex: 0,
      boxId: `box-${i}`,
      pieceNumber: i + 1,
      partName: i === 0 ? "gav_lat_esq" : "gav_lat_dir",
      drillHoles: p.drillHoles,
    }));

    const sheet = {
      largura_mm: 2800,
      altura_mm: 2070,
      materialId: "mdf_branco",
      materialName: "MDF Branco 16",
      espessura_mm: LAT.espessura,
    };
    applyRotationGeometryToSheets([{ sheet, placements }]);

    const evidence = placements.map((pl) => ({
      part: pl.partName,
      pdfCavilhas: holesForPdf(pl, sheet, false)
        .filter((h) => h.holeType === "cavilha")
        .map((h) => ({ x: h.x, y: h.y, depth: h.depth })),
    }));
    writeFileSync(resolve(outDir, "layout_gaveta_cavilhas_ssot.json"), JSON.stringify(evidence, null, 2));

    const doc = await buildCutLayoutPdf(
      { sheets: [{ sheet, placements }] },
      { projectName: "Evidencia cavilhas golden" }
    );
    doc.save(resolve(outDir, "layout_gaveta_cavilhas_ssot.pdf"));

    expect(evidence[0]!.pdfCavilhas.some((h) => h.y === 115 && h.depth === 30)).toBe(true);
    expect(
      evidence[1]!.pdfCavilhas.filter((h) => h.x === 0).map((h) => h.y).sort((a, b) => a - b)
    ).toEqual([15, 115]);
  });
});
