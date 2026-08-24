import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cutlistToPieces, type CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import type { CutPlacement, SheetResult } from "../cutlayout/cutLayoutTypes";
import { computeTampoAngleDegFromLengths } from "../remate/tampoAngle";
import { TAMPO_CUTOUT_DEFAULTS } from "../remate/tampoCutouts";
import { TAMPO_FIXED_WIDTH_MM } from "../remate/tampoCozinhaRules";
import {
  MDB_LAMINADO_SHEET_HF_MM,
  MDB_LAMINADO_SHEET_LF_MM,
} from "../materials/materials.api";
import { generateTcnForPanelNestingMo } from "./tcnGeneratorNestingMo";
import { generateTcnForPanelV2New } from "./tcnGeneratorV2New";
import {
  buildPlacementExteriorContourPath,
  buildPlacementInnerContourPaths,
  sanitizePlacementsForTcn,
} from "./tcnContourPaths";

const W = TAMPO_FIXED_WIDTH_MM;
const FOGAO = TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO;

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

const GOLDEN19_MO = "e0785c8fb67d98d8ba3d9bba49a18ed031ed6973e36877a00f218e8e9461921a";
const GOLDEN19_V2 = "d5d6da9bce17d4d5037b575841c77ebb86694fe9d10485ef50898f5141564731";

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

function tampoPlacement(
  piece: ReturnType<typeof cutlistToPieces>[number],
  extra: Partial<CutPlacement> = {}
): CutPlacement {
  return {
    x_mm: 10,
    y_mm: 0,
    largura_mm: piece.largura_mm,
    altura_mm: piece.altura_mm,
    rotacao: 0,
    sheetIndex: 0,
    boxId: "box-1",
    partName: "TAMPO",
    espessura_mm: 30,
    materialId: piece.materialId,
    outerPolygonMm: piece.outerPolygonMm,
    innerContours: piece.innerContours,
    ...extra,
  };
}

describe("Fase E — TCN industrial TAMPO", () => {
  it("caixaria 19 mm → TCN idêntico ao golden actual", () => {
    expect(sha256(generateTcnForPanelNestingMo(GOLDEN19_SHEET, 3, "Golden19"))).toBe(GOLDEN19_MO);
    expect(sha256(generateTcnForPanelV2New(GOLDEN19_SHEET, 3, "Golden19"))).toBe(GOLDEN19_V2);
  });

  it("TAMPO sem recorte → um path exterior (rect ou trapézio)", () => {
    const pieces = cutlistToPieces([tampoItem({})]);
    const tcn = generateTcnForPanelNestingMo(mdbSheet([tampoPlacement(pieces[0]!)]), 3, "FaseE");
    expect(countW89(tcn)).toBe(1);
    expect(tcn).toMatch(/::UNm DL=3660 DH=630 DS=30/);
  });

  it("TAMPO com milan → path exterior com aresta oblíqua", () => {
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
    const tcn = generateTcnForPanelNestingMo(mdbSheet([tampoPlacement(pieces[0]!)]), 3, "FaseE");
    expect(hasObliqueSegment(parseW2201(tcn))).toBe(true);
  });

  it("TAMPO com fogão → segundo W#89 interior", () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_FOGAO", x: 0, y: 0, width: FOGAO.width, height: FOGAO.height }],
        },
      }),
    ]);
    const tcn = generateTcnForPanelNestingMo(mdbSheet([tampoPlacement(pieces[0]!)]), 3, "FaseE");
    expect(countW89(tcn)).toBe(2);
  });

  it("TAMPO com recorte circular → path circular discretizado", () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_CIRCULAR", x: 0, y: 0, diameter: 180 }],
        },
      }),
    ]);
    const tcn = generateTcnForPanelNestingMo(mdbSheet([tampoPlacement(pieces[0]!)]), 3, "FaseE");
    expect(countW89(tcn)).toBe(2);
    expect(parseW2201(tcn).length).toBeGreaterThan(20);
  });

  it("DL=3660 DH=630 DS=30 no cabeçalho da chapa MDB", () => {
    const pieces = cutlistToPieces([tampoItem({})]);
    const tcn = generateTcnForPanelNestingMo(mdbSheet([tampoPlacement(pieces[0]!)]), 3, "FaseE");
    expect(tcn).toContain("::UNm DL=3660 DH=630 DS=30");
  });

  it("rotação 90° → polígono e recortes usam o offset dos furos", () => {
    const pieces = cutlistToPieces([
      tampoItem({
        metadata: {
          productType: "TAMPO_COZINHA",
          cutouts: [{ tipo: "TAMPO_CUTOUT_FOGAO", x: 0, y: 0, width: FOGAO.width, height: FOGAO.height }],
        },
      }),
    ]);
    const pl = tampoPlacement(pieces[0]!, {
      largura_mm: W,
      altura_mm: 1800,
      rotacao: 90,
    });
    const outer = buildPlacementExteriorContourPath(pl, 0, 30, 10, 20);
    const cut = outer.path.filter((p) => p.z < 0);
    expect(cut.some((p) => p.x === 10 && p.y === 0)).toBe(true);
    expect(cut.some((p) => p.x === 10 && p.y === 1800)).toBe(true);
    expect(cut.some((p) => p.x === 640 && p.y === 0)).toBe(true);
    const inners = buildPlacementInnerContourPaths(pl, 6, -30, 10);
    expect(inners).toHaveLength(1);
    expect(inners[0]!.path.length).toBeGreaterThan(4);
  });

  it("sanitizer TAMPO 630 na chapa 630 aplica margem 0 no eixo da largura", () => {
    const pieces = cutlistToPieces([tampoItem({})]);
    const kept = sanitizePlacementsForTcn(
      [tampoPlacement(pieces[0]!)],
      {
        largura_mm: MDB_LAMINADO_SHEET_LF_MM,
        altura_mm: MDB_LAMINADO_SHEET_HF_MM,
        espessura_mm: 30,
      },
      15,
      6,
      10
    );
    expect(kept).toHaveLength(1);
  });

  it("caixaria 19 mm sem polígono no TCN", () => {
    const tcn = generateTcnForPanelNestingMo(GOLDEN19_SHEET, 3, "Golden19");
    expect(countW89(tcn)).toBe(1);
    expect(hasObliqueSegment(parseW2201(tcn))).toBe(false);
  });
});
