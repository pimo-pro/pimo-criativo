import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultRulesConfig, normalizeRulesConfig, type RulesConfig } from "../src/core/rules/rulesConfig";
import { settingsDefaults, type SettingsSchema } from "../src/core/settings/settingsSchema";
import { getSettings, saveSettings } from "../src/core/settings/settingsStorage";
import { cutlistComPrecoFromBoxes } from "../src/core/manufacturing/cutlistFromBoxes";
import { cutlistToPieces, runCutLayout } from "../src/core/cutlayout/cutLayoutEngine";
import { exportCncFiles } from "../src/core/cnc/cncExport";
import { getLayoutKerfMmForCncNesting } from "../src/core/cnc/tcnLayoutKerf";

type TcnMetodo =
  | "v1_corner"
  | "v2_ramp"
  | "v3_ramp_noflip"
  | "v4_corner_noflip"
  | "v5_ramp_noanchor"
  | "v6_ramp";

type InputProject = {
  projectName?: string;
  materialId?: string;
  boxes: unknown[];
  rules?: RulesConfig;
  settings?: Partial<SettingsSchema>;
};

type W2201Point = { x: number; y: number; z: number };

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "dist", "tcn");
const METODOS: Array<{ metodo: TcnMetodo; fileLabel: string }> = [
  { metodo: "v1_corner", fileLabel: "v1" },
  { metodo: "v2_ramp", fileLabel: "v2" },
  { metodo: "v3_ramp_noflip", fileLabel: "v3" },
  { metodo: "v4_corner_noflip", fileLabel: "v4" },
  { metodo: "v5_ramp_noanchor", fileLabel: "v5" },
  { metodo: "v6_ramp", fileLabel: "v6" },
];

// Polyfill localStorage para execução Node.
const memoryStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (k in memoryStorage ? memoryStorage[k] : null),
    setItem: (k: string, v: string) => {
      memoryStorage[k] = v;
    },
    removeItem: (k: string) => {
      delete memoryStorage[k];
    },
    clear: () => {
      for (const k of Object.keys(memoryStorage)) delete memoryStorage[k];
    },
    key: (i: number) => Object.keys(memoryStorage)[i] ?? null,
    get length() {
      return Object.keys(memoryStorage).length;
    },
  } as unknown as Storage;
}

function numFromFlag(args: string[], flag: string): number | null {
  const i = args.indexOf(flag);
  if (i < 0 || i + 1 >= args.length) return null;
  const n = Number(args[i + 1]);
  return Number.isFinite(n) ? n : null;
}

function strFromFlag(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

function parseW2201Point(line: string): W2201Point | null {
  const mx = line.match(/#1=([+-]?\d+(?:\.\d+)?)/);
  const my = line.match(/#2=([+-]?\d+(?:\.\d+)?)/);
  const mz = line.match(/#3=([+-]?\d+(?:\.\d+)?)/);
  if (!mx || !my || !mz) return null;
  return { x: Number(mx[1]), y: Number(my[1]), z: Number(mz[1]) };
}

function parseDs(content: string): number | null {
  const m = content.match(/DS=([+-]?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const ds = Number(m[1]);
  return Number.isFinite(ds) ? ds : null;
}

function distance2d(a: W2201Point, b: W2201Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isSamePoint(a: W2201Point, b: W2201Point): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001 && Math.abs(a.z - b.z) < 0.02;
}

function parseW2201Operations(content: string): W2201Point[][] {
  const lines = content.split(/\r?\n/);
  const ops: W2201Point[][] = [];
  let current: W2201Point[] = [];

  for (const ln of lines) {
    if (ln.startsWith("W#89{")) {
      if (current.length > 0) ops.push(current);
      current = [];
      continue;
    }
    if (ln.startsWith("W#2201{")) {
      const p = parseW2201Point(ln);
      if (p) current.push(p);
      continue;
    }
    if (current.length > 0 && ln.trim() === "") {
      ops.push(current);
      current = [];
    }
  }
  if (current.length > 0) ops.push(current);
  return ops;
}

function analyzeRamps(content: string, ds: number): {
  downRampLengths: number[];
  upRampLengths: number[];
  duplicateConsecutiveCount: number;
  zCutMatchesThickness: boolean;
} {
  const ops = parseW2201Operations(content);
  const downRampLengths: number[] = [];
  const upRampLengths: number[] = [];
  let duplicateConsecutiveCount = 0;

  for (const op of ops) {
    for (let i = 1; i < op.length; i++) {
      if (isSamePoint(op[i - 1], op[i])) duplicateConsecutiveCount += 1;
    }
    for (let i = 1; i < op.length; i++) {
      const a = op[i - 1];
      const b = op[i];
      const a0 = Math.abs(a.z) < 0.05;
      const b0 = Math.abs(b.z) < 0.05;
      const ac = Math.abs(a.z + Math.abs(ds)) < 0.05;
      const bc = Math.abs(b.z + Math.abs(ds)) < 0.05;
      if (a0 && bc) downRampLengths.push(distance2d(a, b));
      if (ac && b0) upRampLengths.push(distance2d(a, b));
    }
  }

  const zCutMatchesThickness = (() => {
    const cutZs: number[] = [];
    for (const op of ops) {
      for (const p of op) {
        if (p.z < -0.5) cutZs.push(p.z);
      }
    }
    if (cutZs.length === 0) return false;
    return cutZs.every((z) => Math.abs(z + Math.abs(ds)) < 0.05);
  })();

  return {
    downRampLengths,
    upRampLengths,
    duplicateConsecutiveCount,
    zCutMatchesThickness,
  };
}

function pieceThicknessMmForDrillCheck(it: { dimensoes?: { profundidade?: number } }): number {
  const p = Number(it.dimensoes?.profundidade);
  return Number.isFinite(p) && p > 0 ? p : 19;
}

function validateDrilling(
  items: Array<{
    tipo?: string;
    dimensoes?: { largura: number; altura: number; profundidade?: number };
    drillHoles?: Array<{ x: number; y: number; holeType?: string }>;
  }>,
  rules: RulesConfig
) {
  const expectedFront = Number(rules.furos.tecnicos.cavilha.distanciaFrente) > 0 ? Number(rules.furos.tecnicos.cavilha.distanciaFrente) : 60;
  const expectedBack = Number(rules.furos.tecnicos.cavilha.distanciaFundo) > 0 ? Number(rules.furos.tecnicos.cavilha.distanciaFundo) : 60;
  const cfgCavilhaSide = Number(rules.furos.tecnicos.cavilha.sideOffset);
  const expectedHinge = Number(rules.furos.tecnicos.dobradica.distanciaCentroDaBorda) > 0
    ? Number(rules.furos.tecnicos.dobradica.distanciaCentroDaBorda)
    : 22.5;

  const cavilhaMismatches: Array<{ piece: string; x: number; y: number }> = [];
  const hingeMismatches: Array<{ piece: string; x: number; y: number; minEdge: number }> = [];

  for (const it of items) {
    const tipo = String(it.tipo ?? "");
    const holes = it.drillHoles ?? [];
    const w = Number(it.dimensoes?.largura ?? 0);
    const h = Number(it.dimensoes?.altura ?? 0);

    if (tipo === "cima" || tipo === "fundo") {
      const expectedSide =
        Number.isFinite(cfgCavilhaSide) && cfgCavilhaSide > 0 ? cfgCavilhaSide : pieceThicknessMmForDrillCheck(it) / 2;
      for (const h0 of holes.filter((hh) => hh.holeType === "cavilha")) {
        const okX = Math.abs(h0.x - expectedSide) < 0.2 || Math.abs(h0.x - (w - expectedSide)) < 0.2;
        const okY = Math.abs(h0.y - expectedFront) < 0.2 || Math.abs(h0.y - (h - expectedBack)) < 0.2;
        if (!okX || !okY) cavilhaMismatches.push({ piece: tipo, x: h0.x, y: h0.y });
      }
    }

    if (tipo.startsWith("porta")) {
      for (const h0 of holes.filter((hh) => hh.holeType === "dobradica")) {
        const minEdge = Math.min(h0.x, w - h0.x, h0.y, h - h0.y);
        if (Math.abs(minEdge - expectedHinge) > 0.3) {
          hingeMismatches.push({ piece: tipo, x: h0.x, y: h0.y, minEdge });
        }
      }
    }
  }

  return {
    expected: {
      cavilhaFrente: expectedFront,
      cavilhaFundo: expectedBack,
      cavilhaSideOffset:
        Number.isFinite(cfgCavilhaSide) && cfgCavilhaSide > 0 ? cfgCavilhaSide : null,
      dobradicaCentro: expectedHinge,
    },
    cavilhaOk: cavilhaMismatches.length === 0,
    dobradicaOk: hingeMismatches.length === 0,
    cavilhaMismatches,
    hingeMismatches,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const projectPath = strFromFlag(args, "--project");
  if (!projectPath) {
    throw new Error("Uso: node --loader ts-node/esm scripts/export-tcn-variants.ts --project <caminho-json>");
  }

  const outDir = strFromFlag(args, "--outDir") ? resolve(strFromFlag(args, "--outDir") as string) : OUT_DIR;
  const sheetMarginOverride = numFromFlag(args, "--sheetMarginMm");
  const minSpacingOverride = numFromFlag(args, "--minSpacingMm");

  const raw = await readFile(resolve(projectPath), "utf8");
  const input = JSON.parse(raw) as InputProject;
  if (!Array.isArray(input.boxes) || input.boxes.length === 0) {
    throw new Error("Projeto inválido: campo 'boxes' ausente ou vazio.");
  }

  await mkdir(outDir, { recursive: true });

  const baseSettings = {
    ...settingsDefaults,
    ...(input.settings ?? {}),
    cnc: {
      ...settingsDefaults.cnc,
      ...(input.settings?.cnc ?? {}),
      sheetMarginMm: sheetMarginOverride ?? input.settings?.cnc?.sheetMarginMm ?? settingsDefaults.cnc.sheetMarginMm,
      minSpacingMm: minSpacingOverride ?? input.settings?.cnc?.minSpacingMm ?? settingsDefaults.cnc.minSpacingMm,
    },
  } satisfies SettingsSchema;
  saveSettings(baseSettings);

  const rules = normalizeRulesConfig(input.rules ?? defaultRulesConfig);
  const projectName = input.projectName ?? "Projeto";
  const cutlist = cutlistComPrecoFromBoxes(input.boxes as never[], rules, input.materialId, projectName);
  const pieces = cutlistToPieces(cutlist);
  if (pieces.length === 0) throw new Error("Cutlist vazia: nada para exportar.");

  const runtime = getSettings();
  const sheet = {
    largura_mm: runtime.materiais.sheetWidthMm,
    altura_mm: runtime.materiais.sheetHeightMm,
    espessura_mm: runtime.materiais.sheetThicknessMm,
    materialName: runtime.materiais.sheetName,
  };
  const layout = runCutLayout(pieces, sheet, {
    kerf_mm: getLayoutKerfMmForCncNesting(runtime),
    groupByThicknessOnly: false,
    rotationPreferenceMode: "aggressive",
    rotationWeight: 0.8,
    rotationPenalty: 0.45,
  });

  const toolRadius = Number(runtime.cnc.diametroFresaContornoMm) > 0 ? Number(runtime.cnc.diametroFresaContornoMm) / 2 : 0;
  const sheetMargin = Number(runtime.cnc.sheetMarginMm) > 0 ? Number(runtime.cnc.sheetMarginMm) : 0;
  const contourInsideSheetViolations: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const s of layout.sheets) {
    for (const p of s.placements) {
      const x0 = p.x_mm - toolRadius;
      const y0 = p.y_mm - toolRadius;
      const x1 = p.x_mm + p.largura_mm + toolRadius;
      const y1 = p.y_mm + p.altura_mm + toolRadius;
      if (
        x0 < sheetMargin - 0.001 ||
        y0 < sheetMargin - 0.001 ||
        x1 > s.sheet.largura_mm - sheetMargin + 0.001 ||
        y1 > s.sheet.altura_mm - sheetMargin + 0.001
      ) {
        contourInsideSheetViolations.push({ x0, y0, x1, y1 });
      }
    }
  }

  const drilling = validateDrilling(
    cutlist.map((c) => ({ tipo: c.tipo, dimensoes: c.dimensoes, drillHoles: c.drillHoles })),
    rules
  );

  const forensicByVariant: Record<string, unknown> = {};

  for (const v of METODOS) {
    const now = getSettings();
    saveSettings({ ...now, cnc: { ...now.cnc, tcnMetodo: v.metodo } });
    const cnc = exportCncFiles({ projectName: `piece_${v.fileLabel}` }, layout, []);
    const combined = cnc.files.map((f) => f.tcn).join("\n\n");
    const outPath = join(outDir, `peça_${v.fileLabel}.tcn`);
    await writeFile(outPath, combined, "utf8");

    const ds = parseDs(combined) ?? sheet.espessura_mm;
    const ramp = analyzeRamps(combined, ds);
    forensicByVariant[v.fileLabel] = {
      metodo: v.metodo,
      output: outPath,
      ds,
      rampDownMm: ramp.downRampLengths,
      rampUpMm: ramp.upRampLengths,
      duplicateConsecutiveXYZ: ramp.duplicateConsecutiveCount,
      zCutEqualsNegativeThickness: ramp.zCutMatchesThickness,
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    projectPath: resolve(projectPath),
    outputDir: outDir,
    sheet,
    settings: {
      minSpacingMm: getSettings().cnc.minSpacingMm,
      sheetMarginMm: getSettings().cnc.sheetMarginMm,
      diameterMm: getSettings().cnc.diametroFresaContornoMm,
      toolRadiusMm: toolRadius,
    },
    checks: {
      offsetRectFormula: "x0=x-R, y0=y-R, x1=x+w+R, y1=y+h+R",
      contourInsideSheetWithMargin: contourInsideSheetViolations.length === 0,
      contourInsideSheetViolations,
      drilling,
    },
    variants: forensicByVariant,
  };

  const reportJson = join(outDir, "forensic-report.json");
  const reportTxt = join(outDir, "forensic-report.txt");
  await writeFile(reportJson, JSON.stringify(report, null, 2), "utf8");

  const lines: string[] = [];
  lines.push("RELATORIO FORENSE TCN");
  lines.push(`Projeto: ${resolve(projectPath)}`);
  lines.push(`Saida: ${outDir}`);
  lines.push("");
  lines.push(`Chapa: ${sheet.largura_mm} x ${sheet.altura_mm} x ${sheet.espessura_mm} mm`);
  lines.push(`minSpacingMm: ${getSettings().cnc.minSpacingMm} | sheetMarginMm: ${getSettings().cnc.sheetMarginMm}`);
  lines.push(`contorno dentro da chapa + margem: ${contourInsideSheetViolations.length === 0 ? "OK" : "FALHA"}`);
  lines.push(`cavilha 60/19: ${drilling.cavilhaOk ? "OK" : "FALHA"}`);
  lines.push(`dobradica 22.5: ${drilling.dobradicaOk ? "OK" : "FALHA"}`);
  lines.push("");
  for (const [k, v] of Object.entries(forensicByVariant)) {
    const vv = v as {
      metodo: string;
      output: string;
      rampDownMm: number[];
      rampUpMm: number[];
      duplicateConsecutiveXYZ: number;
      zCutEqualsNegativeThickness: boolean;
    };
    lines.push(`VARIANTE ${k.toUpperCase()} (${vv.metodo})`);
    lines.push(`  ficheiro: ${vv.output}`);
    lines.push(`  rampa entrada (mm): ${vv.rampDownMm.map((n) => n.toFixed(2)).join(", ") || "N/A"}`);
    lines.push(`  rampa saida (mm): ${vv.rampUpMm.map((n) => n.toFixed(2)).join(", ") || "N/A"}`);
    lines.push(`  duplicados XYZ consecutivos: ${vv.duplicateConsecutiveXYZ}`);
    lines.push(`  zCut=-espessura: ${vv.zCutEqualsNegativeThickness ? "OK" : "FALHA"}`);
    lines.push("");
  }
  await writeFile(reportTxt, lines.join("\n"), "utf8");

  console.log(`TCN gerados em: ${outDir}`);
  console.log(`Relatório JSON: ${reportJson}`);
  console.log(`Relatório TXT: ${reportTxt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

