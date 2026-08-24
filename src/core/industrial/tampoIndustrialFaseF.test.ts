/**
 * Fase F — fecho industrial do TAMPO.
 * Produção oficial: PDF (milan + recortes) + TCN (polígono + interiores).
 * XML excluído por design (`tipo: "remate"`). Sem Three.js / Viewer.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cutlistToPieces, runCutLayout } from "../cutlayout/cutLayoutEngine";
import { buildCutLayoutPdf, placementPdfDrawOps } from "../cutlayout/cutLayoutPdf";
import type { CutPlacement, SheetResult } from "../cutlayout/cutLayoutTypes";
import { getFastCncLayoutOptions } from "../cnc/cncPipeline";
import { generateTcnForPanelNestingMo } from "../cnc/tcnGeneratorNestingMo";
import { generateTcnForPanelV2New } from "../cnc/tcnGeneratorV2New";
import {
  buildCncXmlFilesForProject,
  buildDrillFilesForProject,
  buildDrillStationXmlFilesForProject,
} from "../drill/drillExport";
import { resolveXmlMachineTarget } from "../drill/xmlMachineRouting";
import {
  MDB_LAMINADO_SHEET_HF_MM,
  MDB_LAMINADO_SHEET_LF_MM,
} from "../materials/materials.api";
import { calcularPrecoCutList } from "../pricing/pricing";
import { computeTampoAngleDegFromLengths } from "../remate/tampoAngle";
import { createTampoCutout } from "../remate/tampoCutouts";
import { applyTampoIndustrialDefaults, TAMPO_FIXED_WIDTH_MM } from "../remate/tampoCozinhaRules";
import { buildRemateCutlistItems } from "../remate/remateCutlist";
import type { RematePiece } from "../remate/rematePieceTypes";
import type { CutListItemComPreco } from "../types";
import { defaultRulesConfig } from "../rules/rulesConfig";

const W = TAMPO_FIXED_WIDTH_MM;
const FRONT_MM = 1995;
const BACK_MM = 2303;
const ENVELOPE_MM = Math.max(FRONT_MM, BACK_MM);

const GOLDEN19_MO = "e0785c8fb67d98d8ba3d9bba49a18ed031ed6973e36877a00f218e8e9461921a";
const GOLDEN19_V2 = "d5d6da9bce17d4d5037b575841c77ebb86694fe9d10485ef50898f5141564731";

const INDUSTRIAL_SOURCES = [
  "../cnc/tcnContourPaths.ts",
  "../cnc/tcnGeneratorNestingMo.ts",
  "../cnc/tcnGeneratorV2New.ts",
  "../cnc/cncPipeline.ts",
  "../cutlayout/cutLayoutPdf.ts",
  "../cutlayout/cutLayoutEngine.ts",
  "../remate/tampoIndustrialGeometry.ts",
  "../remate/remateCutlist.ts",
  "../drill/xmlMachineRouting.ts",
  "../drill/drillExport.ts",
  "../pricing/pricing.ts",
] as const;

const GOLDEN19_SHEET: SheetResult = {
  sheet: { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19, materialName: "MDF" },
  placements: [
    {
      x_mm: 10,
      y_mm: 10,
      largura_mm: 800,
      altura_mm: 400,
      rotacao: 0,
      sheetIndex: 0,
      boxId: "box-1",
      partName: "Lat_MDF",
      espessura_mm: 19,
    },
  ],
};

const xmlProject = {
  projectName: "FaseF_TAMPO",
  boxes: [],
  rules: defaultRulesConfig,
};

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function countW89(tcn: string): number {
  return (tcn.match(/W#89\{/g) ?? []).length;
}

function parseW2201(tcn: string): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const re = /W#2201\{\s*::WTl #8015=0 #1=([-\d.]+) #2=([-\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tcn))) {
    out.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  return out;
}

function hasObliqueSegment(pts: Array<{ x: number; y: number }>): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return true;
  }
  return false;
}

function pdfToLatin1Text(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("latin1");
}

function makeTampoRemate(): RematePiece {
  const angleDeg = computeTampoAngleDegFromLengths(FRONT_MM, BACK_MM, W);
  return applyTampoIndustrialDefaults({
    id: "tampo-fase-f",
    name: "TAMPO",
    width: ENVELOPE_MM,
    height: W,
    depth: 30,
    materialPresetId: "mdb_laminado-30",
    followBox: false,
    position: { xMm: 0, yMm: 0, zMm: 0 },
    rotation: { xRad: 0, yRad: 0, zRad: 0 },
    tipo: "TAMPO",
    angleConfig: { frontLengthMm: FRONT_MM, backLengthMm: BACK_MM, angleDeg },
    cutouts: [
      createTampoCutout("TAMPO_CUTOUT_FOGAO", { x: -350, y: 0 }),
      createTampoCutout("TAMPO_CUTOUT_CIRCULAR", { x: 450, y: 0 }),
    ],
  });
}

function tampoPlacement(piece: ReturnType<typeof cutlistToPieces>[number]): CutPlacement {
  return {
    x_mm: 10,
    y_mm: 0,
    largura_mm: piece.largura_mm,
    altura_mm: piece.altura_mm,
    rotacao: 0,
    sheetIndex: 0,
    boxId: piece.boxId || "box-1",
    partName: piece.partName,
    espessura_mm: 30,
    materialId: piece.materialId,
    outerPolygonMm: piece.outerPolygonMm,
    innerContours: piece.innerContours,
  };
}

function mdbSheet(placements: CutPlacement[]): SheetResult {
  return {
    sheet: {
      largura_mm: MDB_LAMINADO_SHEET_LF_MM,
      altura_mm: MDB_LAMINADO_SHEET_HF_MM,
      espessura_mm: 30,
      materialName: "MDB Laminado 30",
    },
    placements,
  };
}

function lateral19Item(): CutListItemComPreco {
  return {
    id: "lat-1",
    nome: "Lat_MDF",
    tipo: "lateral",
    quantidade: 1,
    dimensoes: { largura: 800, altura: 400, profundidade: 19 },
    espessura: 19,
    material: "MDF Branco 19",
    materialId: "mdf_branco-19",
    boxId: "box-1",
    precoUnitario: 0,
    precoTotal: 0,
  };
}

describe("Fase F — fecho industrial TAMPO", () => {
  it("integração: cutlist AABB → PDF polígono+recortes → TCN poligonal → sem XML", async () => {
    const remate = makeTampoRemate();
    const cutlist = buildRemateCutlistItems([remate], []);
    expect(cutlist).toHaveLength(1);
    const item = cutlist[0]!;
    expect(item.tipo).toBe("remate");
    expect(item.dimensoes.largura).toBe(ENVELOPE_MM);
    expect(item.dimensoes.altura).toBe(W);
    expect(item.espessura).toBe(30);
    expect(item.metadata?.productType).toBe("TAMPO_COZINHA");
    expect(item.metadata?.tampoAngle).toEqual(
      expect.objectContaining({ frontLengthMm: FRONT_MM, backLengthMm: BACK_MM })
    );
    expect(item.metadata?.cutouts).toHaveLength(2);

    const withoutCutouts = calcularPrecoCutList([
      {
        ...item,
        metadata: { ...item.metadata, cutouts: undefined, cutoutOperations: undefined },
      },
    ]);
    expect(item.precoUnitario).toBe(withoutCutouts[0]!.precoUnitario);
    const halfLen = calcularPrecoCutList([
      { ...item, dimensoes: { ...item.dimensoes, largura: ENVELOPE_MM / 2 } },
    ]);
    expect(item.precoUnitario).toBeCloseTo(halfLen[0]!.precoUnitario * 2, 1);

    const pieces = cutlistToPieces(cutlist);
    expect(pieces).toHaveLength(1);
    const piece = pieces[0]!;
    expect(piece.largura_mm).toBe(ENVELOPE_MM);
    expect(piece.altura_mm).toBe(W);
    expect(piece.outerPolygonMm).toHaveLength(4);
    expect(piece.innerContours).toHaveLength(2);
    expect(piece.innerContours!.some((c) => c.innerCircle)).toBe(true);

    const pl = tampoPlacement(piece);
    const ops = placementPdfDrawOps(pl);
    expect(ops.some((op) => op.kind === "polygon")).toBe(true);
    expect(ops.some((op) => op.kind === "inner-rect")).toBe(true);
    expect(ops.some((op) => op.kind === "inner-circle")).toBe(true);
    const poly = ops.find((op) => op.kind === "polygon");
    if (poly?.kind === "polygon") {
      expect(hasObliqueSegment(poly.points)).toBe(true);
    }

    const sheet = mdbSheet([pl]);
    const pdf = await buildCutLayoutPdf({ sheets: [sheet] }, { projectName: "FaseF_TAMPO" });
    const pdfText = pdfToLatin1Text(pdf.output("arraybuffer"));
    expect(pdfText).toContain("3660");
    expect(pdfText).toContain("630");
    expect(pdfText).toMatch(/30\s*mm/);

    const tcn = generateTcnForPanelNestingMo(sheet, 3, "FaseF_TAMPO");
    expect(tcn).toContain("::UNm DL=3660 DH=630 DS=30");
    expect(countW89(tcn)).toBe(3);
    expect(hasObliqueSegment(parseW2201(tcn))).toBe(true);

    expect(resolveXmlMachineTarget(item)).toBeNull();
    expect(buildDrillFilesForProject(cutlist, xmlProject as never)).toEqual([]);
    expect(buildCncXmlFilesForProject(cutlist, xmlProject as never)).toEqual([]);
    expect(buildDrillStationXmlFilesForProject(cutlist, xmlProject as never)).toEqual([]);
  });

  it("regressão caixaria 19 mm: packing AABB, PDF rect, TCN golden", async () => {
    const item = lateral19Item();
    const priced = calcularPrecoCutList([item]);
    const doubleLen = calcularPrecoCutList([
      { ...item, dimensoes: { ...item.dimensoes, largura: 1600 } },
    ]);
    expect(doubleLen[0]!.precoUnitario).toBeCloseTo(priced[0]!.precoUnitario * 2, 1);

    const pieces = cutlistToPieces(priced);
    expect(pieces[0]!.outerPolygonMm).toBeUndefined();
    expect(pieces[0]!.innerContours).toBeUndefined();
    expect(pieces[0]!.largura_mm).toBe(800);
    expect(pieces[0]!.altura_mm).toBe(400);

    const layout = runCutLayout(
      pieces,
      { largura_mm: 2800, altura_mm: 2070, espessura_mm: 19, materialName: "MDF" },
      getFastCncLayoutOptions({ largura_mm: 2800, altura_mm: 2070, espessura_mm: 19 })
    );
    expect(layout.sheets.length).toBeGreaterThan(0);
    expect(layout.sheets[0]!.sheet.largura_mm).toBe(2800);
    expect(layout.sheets[0]!.sheet.altura_mm).toBe(2070);
    expect(layout.sheets[0]!.placements[0]!.largura_mm).toBe(800);
    expect(layout.sheets[0]!.placements[0]!.altura_mm).toBe(400);

    const ops = placementPdfDrawOps(GOLDEN19_SHEET.placements[0]!);
    expect(ops).toEqual([{ kind: "rect", x: 0, y: 0, w: 800, h: 400 }]);
    const pdf = await buildCutLayoutPdf({ sheets: [GOLDEN19_SHEET] }, { projectName: "FaseF_19" });
    const pdfText = pdfToLatin1Text(pdf.output("arraybuffer"));
    expect(pdfText).toContain("2800");
    expect(pdfText).toContain("2070");
    expect(pdfText).toMatch(/19\s*mm/);

    expect(sha256(generateTcnForPanelNestingMo(GOLDEN19_SHEET, 3, "Golden19"))).toBe(GOLDEN19_MO);
    expect(sha256(generateTcnForPanelV2New(GOLDEN19_SHEET, 3, "Golden19"))).toBe(GOLDEN19_V2);
  });

  it("indústria não importa Three.js nem o Viewer", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const rel of INDUSTRIAL_SOURCES) {
      const src = readFileSync(join(here, rel), "utf8");
      expect(src, rel).not.toMatch(/from\s+["']three["']/);
      expect(src, rel).not.toMatch(/from\s+["']three\//);
      expect(src, rel).not.toMatch(/from\s+["'][^"']*\/3d\//);
      expect(src, rel).not.toMatch(/TampoPieceVisualizer/);
    }
  });
});
