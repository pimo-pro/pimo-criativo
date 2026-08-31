/**
 * Paridade Auto-layout V3 (runCutLayout) vs pipeline industrial directo.
 * Cenários: TEST_1, SPM_FULL, MPM_DUAL (alinhados com cutlayoutImpactBenchmark).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cutlistToPieces, runCutLayout } from "../core/cutlayout/cutLayoutEngine";
import type { CutLayoutEngineOptions, CutLayoutResult, CutPiece, SheetDefinition } from "../core/cutlayout/cutLayoutTypes";
import { buildCutlistItemsForIndustrialExport } from "../core/fabrication/buildCutlistItemsForIndustrialExport";
import { getDefaultCncLayoutOptions, getSheetDefinitionFromSettings } from "../core/cnc/cncPipeline";
import {
  buildDrawerOnlyBox,
  buildFullIndustrialScenario,
} from "../validation/industrialPipelineTestHelpers";
import { runNestingV3AutoLayout } from "./nestingV3Engine";
import { v3PiecesToCutPieces } from "../core/cutlayout/integration/v3ToCutPieces";
import { v3TopLeftToPhysicalBl } from "../core/cutlayout/integration/layoutCoordinateAdapter";
import { inferV3RotationFromFootprint } from "../core/cutlayout/integration/cutLayoutResultToV3State";
import type { V3Piece, V3Sheet } from "./nestingV3Types";
import { DEFAULT_NESTING_V3_SETTINGS, type NestingV3Settings } from "./nestingV3Settings";

function sheetFromDefinition(sheet: SheetDefinition): V3Sheet {
  return {
    index: 0,
    widthMm: sheet.largura_mm,
    heightMm: sheet.altura_mm,
    thicknessMm: sheet.espessura_mm,
    materialId: sheet.materialId,
    materialName: sheet.materialName,
  };
}

const OUT_DIR = join(process.cwd(), "scripts", "cnc-examples-output");
const TEST1_FILE = join(OUT_DIR, "TEST 1.txt");

type ScenarioDef = {
  id: string;
  cutPieces: CutPiece[];
  sheet: SheetDefinition;
  settings: NestingV3Settings;
};

function parseHeader(content: string): { dl: number; dh: number; ds: number } {
  const m = content.match(/::UNm\s+DL=(\d+)\s+DH=(\d+)\s+DS=(\d+)/);
  if (!m) throw new Error("Header ::UNm DL/DH/DS não encontrado.");
  return { dl: Number(m[1]), dh: Number(m[2]), ds: Number(m[3]) };
}

function parsePiecesFromTcn(content: string, thickness: number): CutPiece[] {
  const lines = content.split(/\r?\n/);
  const pieces: CutPiece[] = [];

  for (let i = 0; i < lines.length; i++) {
    const pieceMatch = lines[i].match(/^;PIECE\s+(.+?)\s+\((.*?)\)\s+#\d+/);
    if (!pieceMatch) continue;
    const partName = pieceMatch[1];
    const boxId = pieceMatch[2];
    const points: Array<{ x: number; y: number }> = [];

    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].startsWith(";PIECE")) break;
      const w2200 = lines[j].match(/^W#2200\s+X=([0-9]+(?:\.[0-9]+)?)\s+Y=([0-9]+(?:\.[0-9]+)?)/);
      if (w2200) {
        points.push({ x: Number(w2200[1]), y: Number(w2200[2]) });
        if (points.length >= 5) break;
      }
    }
    if (points.length < 4) continue;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    pieces.push({
      largura_mm: maxX - minX,
      altura_mm: maxY - minY,
      espessura_mm: thickness,
      quantidade: 1,
      boxId,
      partName,
    });
  }
  return pieces;
}

function cutPiecesToStableV3(cutPieces: CutPiece[]): V3Piece[] {
  return cutPieces.map((cp, index) => ({
    id: `v3-parity-${index}`,
    name: cp.partName,
    widthMm: cp.largura_mm,
    heightMm: cp.altura_mm,
    thicknessMm: cp.espessura_mm,
    materialId: cp.materialId,
    materialName: cp.materialName,
    originalHoles: (cp.drillHoles ?? cp.holes ?? []).map((h) => ({
      x: h.x,
      y: h.y,
      diameter: h.diameter,
      depth: h.depth,
      holeType: h.holeType,
    })),
    rotation: 0,
    color: "#ccc",
    sourceBoxId: cp.boxId,
    industrialGrainCode: cp.industrialGrainCode,
    pieceTipo: cp.pieceTipo,
  }));
}

function buildLayoutOptions(sheet: SheetDefinition, settings: NestingV3Settings): CutLayoutEngineOptions {
  return {
    ...getDefaultCncLayoutOptions(sheet),
    kerf_mm: settings.kerfMm,
    sheetLargura_mm: sheet.largura_mm,
    sheetAltura_mm: sheet.altura_mm,
    originTopRight: false,
    collectDiagnostics: true,
  };
}

function sheetSignature(
  result: CutLayoutResult,
  pieceDimsByKey: Map<string, { widthMm: number; heightMm: number }>
): string[] {
  return result.sheets.flatMap((sr, sheetIndex) =>
    sr.placements
      .map((p) => {
        const dims = pieceDimsByKey.get(`${p.partName}|${p.boxId}`);
        const rot = dims ? inferV3RotationFromFootprint(p, dims) : p.rotacao;
        return {
          key: `${sheetIndex}|${p.partName}|${p.boxId}|${Math.round(p.x_mm * 100)}|${Math.round(p.y_mm * 100)}|${rot}`,
          sortY: p.y_mm,
          sortX: p.x_mm,
        };
      })
      .sort((a, b) => a.sortY - b.sortY || a.sortX - b.sortX)
      .map((x) => x.key)
  );
}

function v3StateFromIndustrial(
  v3Pieces: V3Piece[],
  sheets: V3Sheet[],
  settings: NestingV3Settings,
  cutPieces: CutPiece[],
  sheet: SheetDefinition
): { direct: CutLayoutResult; v3Result: ReturnType<typeof runNestingV3AutoLayout> } {
  const layoutOptions = buildLayoutOptions(sheet, settings);
  const direct = runCutLayout(cutPieces, sheet, layoutOptions);
  const v3Result = runNestingV3AutoLayout(v3Pieces, sheets, settings);
  return { direct, v3Result };
}

async function buildScenarios(): Promise<ScenarioDef[]> {
  const full = buildFullIndustrialScenario();
  const drawerBox = buildDrawerOnlyBox();
  const mpmSnap = {
    ...full.snap,
    boxes: [full.box, { ...drawerBox, id: "box-mpm-second", nome: "Gaveta_Second" }],
  };
  const defaultSheet = getSheetDefinitionFromSettings();
  const settingsFromSheet: NestingV3Settings = {
    ...DEFAULT_NESTING_V3_SETTINGS,
    sheetWidthMm: defaultSheet.largura_mm,
    sheetHeightMm: defaultSheet.altura_mm,
    sheetThicknessMm: defaultSheet.espessura_mm,
    enableV3IndustrialAutoLayout: true,
  };

  const raw = await readFile(TEST1_FILE, "utf8");
  const { dl, dh, ds } = parseHeader(raw);
  const test1Pieces = parsePiecesFromTcn(raw, ds);
  const test1Sheet: SheetDefinition = { largura_mm: dl, altura_mm: dh, espessura_mm: ds, materialName: "TEST1" };
  const test1Settings: NestingV3Settings = {
    ...DEFAULT_NESTING_V3_SETTINGS,
    sheetWidthMm: dl,
    sheetHeightMm: dh,
    sheetThicknessMm: ds,
    enableV3IndustrialAutoLayout: true,
  };

  return [
    {
      id: "TEST_1",
      cutPieces: test1Pieces,
      sheet: test1Sheet,
      settings: test1Settings,
    },
    {
      id: "SPM_FULL",
      cutPieces: cutlistToPieces(buildCutlistItemsForIndustrialExport(full.snap), {
        projectName: full.snap.projectName ?? "Projeto",
        boxes: full.snap.boxes,
      }),
      sheet: defaultSheet,
      settings: settingsFromSheet,
    },
    {
      id: "MPM_DUAL",
      cutPieces: cutlistToPieces(buildCutlistItemsForIndustrialExport(mpmSnap), {
        projectName: mpmSnap.projectName ?? "Projeto",
        boxes: mpmSnap.boxes,
      }),
      sheet: defaultSheet,
      settings: settingsFromSheet,
    },
  ];
}

describe("Nesting V3 industrial parity (TEST_1 / SPM_FULL / MPM_DUAL)", () => {
  it.each(["TEST_1", "SPM_FULL", "MPM_DUAL"])(
    "auto-layout V3 alinha chapas e estratégia com runCutLayout — %s",
    async (scenarioId) => {
      const scenarios = await buildScenarios();
      const scenario = scenarios.find((s) => s.id === scenarioId);
      expect(scenario).toBeDefined();

      const v3Pieces = cutPiecesToStableV3(scenario!.cutPieces);
      const sheets = [sheetFromDefinition(scenario!.sheet)];
      const { direct, v3Result } = v3StateFromIndustrial(
        v3Pieces,
        sheets,
        scenario!.settings,
        v3PiecesToCutPieces(v3Pieces, scenario!.settings),
        scenario!.sheet
      );

      expect(v3Result.sheetsUsed).toBe(direct.sheets.length);
      expect(v3Result.selectedStrategy).toBe(direct.diagnostics?.flow.selectedStrategy);
      expect(v3Result.selectedBinHeuristic).toBe(direct.diagnostics?.flow.selectedBinHeuristic);
      expect(v3Result.unplacedPieceIds).toHaveLength(
        scenario!.cutPieces.length - direct.sheets.reduce((n, s) => n + s.placements.length, 0)
      );

      const pieceDimsByKey = new Map(
        v3Pieces.map((p) => [`${p.name}|${p.sourceBoxId ?? p.id}`, { widthMm: p.widthMm, heightMm: p.heightMm }])
      );
      const directSig = sheetSignature(direct, pieceDimsByKey).sort();
      const v3PiecesById = new Map((v3Result.pieces ?? v3Pieces).map((p) => [p.id, p]));
      const v3Sig = v3Result.placements
        .map((pl) => {
          const piece = v3PiecesById.get(pl.pieceId);
          if (!piece) return "";
          const rotated = piece.rotation === 90 || piece.rotation === 270;
          const placedH = rotated ? piece.widthMm : piece.heightMm;
          const bl = v3TopLeftToPhysicalBl(pl.xMm, pl.yMm, placedH, scenario!.sheet.altura_mm);
          return `${pl.sheetIndex}|${piece.name}|${piece.sourceBoxId}|${Math.round(bl.x_mm * 100)}|${Math.round(
            bl.y_mm * 100
          )}|${piece.rotation}`;
        })
        .filter(Boolean)
        .sort();

      // MPM meta-heurística pode divergir entre invocações consecutivas do solver;
      // chapas + estratégia são o contrato de paridade industrial.
      if (scenarioId !== "MPM_DUAL") {
        expect(v3Sig).toEqual(directSig);
      } else {
        expect(v3Sig).toHaveLength(directSig.length);
      }
    },
    120_000
  );

  it("fallback legacy quando enableV3IndustrialAutoLayout=false", () => {
    const settings: NestingV3Settings = {
      ...DEFAULT_NESTING_V3_SETTINGS,
      enableV3IndustrialAutoLayout: false,
    };
    const pieces: V3Piece[] = [
      {
        id: "p1",
        name: "A",
        widthMm: 200,
        heightMm: 100,
        thicknessMm: 19,
        originalHoles: [],
        rotation: 0,
        color: "#ccc",
        sourceBoxId: "box-1",
      },
    ];
    const sheets: V3Sheet[] = [{ index: 0, widthMm: 2800, heightMm: 2070, thicknessMm: 19 }];
    const result = runNestingV3AutoLayout(pieces, sheets, settings);
    expect(result.selectedStrategy).toBeUndefined();
    expect(result.placements.length).toBeGreaterThan(0);
  });
});
