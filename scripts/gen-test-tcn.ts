/**
 * Smoke TCN — gera ficheiros com os geradores oficiais activos pós-Fase 7b:
 *   nesting_mo  → tcnGeneratorNestingMo
 *   v2_new      → tcnGeneratorV2New
 *
 * Uso: node scripts/gen-test-tcn.mjs
 * (lança este ficheiro via npx tsx)
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Polyfills Node (Vite / browser APIs usadas pelos geradores).
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

const meta = import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean; MODE?: string } };
if (!meta.env) {
  meta.env = { DEV: false, PROD: true, MODE: "production" };
} else {
  meta.env.DEV = false;
  meta.env.PROD = true;
  meta.env.MODE = meta.env.MODE ?? "production";
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const { generateTcnForPanelNestingMo } = await import("../src/core/cnc/tcnGeneratorNestingMo");
const { generateTcnForPanelV2New } = await import("../src/core/cnc/tcnGeneratorV2New");
const { settingsDefaults } = await import("../src/core/settings/settingsSchema");
const { saveSettings } = await import("../src/core/settings/settingsStorage");

saveSettings({
  ...settingsDefaults,
  cnc: { ...settingsDefaults.cnc, tcnMetodo: "nesting_mo" },
});

type SheetResult = import("../src/core/cutlayout/cutLayoutTypes").SheetResult;

const sheetResult: SheetResult = {
  sheet: {
    id: "sheet-smoke",
    largura_mm: 2800,
    altura_mm: 2070,
    espessura_mm: 19,
    materialName: "MDF Branco 19mm",
  },
  placements: [
    {
      id: "P1",
      partName: "Lateral Esq (300×1762)",
      x_mm: 10,
      y_mm: 10,
      largura_mm: 300,
      altura_mm: 1762,
      rotacao: 0,
      espessura_mm: 19,
      sheetIndex: 0,
      boxId: "box-smoke",
      drillHoles: [],
    },
    {
      id: "P2",
      partName: "Lateral Dir (300×1762)",
      x_mm: 337,
      y_mm: 10,
      largura_mm: 300,
      altura_mm: 1762,
      rotacao: 0,
      espessura_mm: 19,
      sheetIndex: 0,
      boxId: "box-smoke",
      drillHoles: [],
    },
    {
      id: "P3",
      partName: "Cima (400×300)",
      x_mm: 664,
      y_mm: 10,
      largura_mm: 400,
      altura_mm: 300,
      rotacao: 0,
      espessura_mm: 19,
      sheetIndex: 0,
      boxId: "box-smoke",
      drillHoles: [],
    },
    {
      id: "P4",
      partName: "Fundo (400×300)",
      x_mm: 1091,
      y_mm: 10,
      largura_mm: 400,
      altura_mm: 300,
      rotacao: 0,
      espessura_mm: 19,
      sheetIndex: 0,
      boxId: "box-smoke",
      drillHoles: [],
    },
  ],
};

const variants = [
  {
    id: "nesting_mo" as const,
    label: "NESTING MO",
    file: "armario_400x1800x300_nesting_mo.tcn",
    generate: () => generateTcnForPanelNestingMo(sheetResult, 3, "Armario_Smoke_MO", 2800, 2070),
  },
  {
    id: "v2_new" as const,
    label: "v2_new",
    file: "armario_400x1800x300_v2_new.tcn",
    generate: () => generateTcnForPanelV2New(sheetResult, 3, "Armario_Smoke_V2N", 2800, 2070),
  },
];

console.log("\n  PIMO TCN smoke — modos activos (nesting_mo + v2_new)\n");

for (const v of variants) {
  const tcn = v.generate();
  const outPath = join(__dirname, v.file);
  writeFileSync(outPath, tcn, "utf8");
  const lines = tcn.split("\n").length;
  const hasHeader = tcn.startsWith("TPA\\ALBATROS\\EDICAD");
  const hasSide = tcn.includes("SIDE#1{");
  console.log(`  [${v.id}] ${v.label}`);
  console.log(`    linhas=${lines} header=${hasHeader} SIDE#1=${hasSide}`);
  console.log(`    → ${outPath}`);
  if (!hasHeader || !hasSide || lines < 10) {
    throw new Error(`Saída TCN inválida para ${v.id}`);
  }
}

console.log("\n  OK — smoke nesting_mo + v2_new concluído.\n");
