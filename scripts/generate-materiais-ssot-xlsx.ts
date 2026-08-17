/**
 * Gera public/config/materiais-ssot.xlsx a partir dos dados actuais do projeto.
 * Uso: npx tsx scripts/generate-materiais-ssot-xlsx.ts
 * Não altera CNC / nesting / TCN / cutlist / PI.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  INDUSTRIAL_SHEET_HF_MM,
  INDUSTRIAL_SHEET_LF_MM,
  listOfficialMaterials,
} from "../src/core/materials/materials.api";
import { FERRAGENS_DEFAULT } from "../src/core/ferragens/ferragens";
import { DEFAULT_ORLA_PRESETS } from "../src/core/orla/orlaPresets";
import {
  MATERIAIS_SSOT_CHAPAS_HEADERS,
  MATERIAIS_SSOT_FREEAGENS_HEADERS,
  MATERIAIS_SSOT_ORLA_HEADERS,
  MATERIAIS_SSOT_SHEET_CHAPAS,
  MATERIAIS_SSOT_SHEET_FREEAGENS,
  MATERIAIS_SSOT_SHEET_ORLA,
} from "../src/core/catalog/materiaisSsotTypes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "config", "materiais-ssot.xlsx");

const BORDER: Partial<ExcelJS.Border> = {
  style: "thin",
  color: { argb: "FFCBD5E1" },
};

function styleHeader(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0F172A" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function styleBody(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
  });
}

function autofit(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((column) => {
    let max = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const v = cell.value == null ? "" : String(cell.value);
      max = Math.max(max, Math.min(v.length + 2, 42));
    });
    column.width = max;
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PIMO";
  workbook.created = new Date();
  workbook.description =
    "SSOT de materiais PIMO (PT-PT). Editar «Nome novo padronizado» e preços; o sistema lê este ficheiro.";

  // —— Chapas ——
  const chapas = workbook.addWorksheet(MATERIAIS_SSOT_SHEET_CHAPAS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(chapas.addRow([...MATERIAIS_SSOT_CHAPAS_HEADERS]));

  const FAMILIA_BY_CANONICAL_PREFIX: Record<string, string> = {
    mdf_branco: "MDF Branco",
    laminado_linho_cancun: "AGL LAM Linho Cancun",
    mdf_preto: "MDF Preto",
    hdf_cru: "HDF CRU",
    carvalho: "HDF FOLHEADO CARVALHO",
    agl_carvalho: "AGL CARVALHO",
    agl_branco: "AGL LAM BRANCO",
    nogueira: "HDF FOLHEADO NOGUEIRA",
    lacado: "HDF LACADO",
    mdb_laminado: "MDB Laminado",
  };

  for (const m of listOfficialMaterials().filter((x) => x.industrial)) {
    const lf = m.industrialDefaults?.larguraChapa ?? INDUSTRIAL_SHEET_LF_MM;
    const hf = m.industrialDefaults?.alturaChapa ?? INDUSTRIAL_SHEET_HF_MM;
    const areaM2 = (lf / 1000) * (hf / 1000);
    const medida = `${lf} × ${hf}`;
    const familyKey = m.canonicalId.replace(/-\d+(\.\d+)?$/, "");
    const familia =
      FAMILIA_BY_CANONICAL_PREFIX[familyKey] ??
      m.label.replace(/\s+\d+(?:[.,]\d+)?(?:\s*mm)?\s*$/i, "").trim();
    const esp = m.industrialDefaults?.espessuraPadrao ?? null;
    const precoM2 = m.industrialDefaults?.custo_m2 ?? null;
    const precoChapa =
      precoM2 != null && Number.isFinite(precoM2) ? round2(precoM2 * areaM2) : null;
    const row = chapas.addRow([
      m.label,
      familia,
      m.canonicalId,
      esp,
      medida,
      precoChapa,
      precoM2,
      "", // Preço de venda por m² — a preencher
    ]);
    styleBody(row);
  }
  autofit(chapas);

  // —— Freeagens ——
  const freeagens = workbook.addWorksheet(MATERIAIS_SSOT_SHEET_FREEAGENS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(freeagens.addRow([...MATERIAIS_SSOT_FREEAGENS_HEADERS]));

  for (const f of FERRAGENS_DEFAULT) {
    const medida =
      f.medidas?.trim() ||
      (f.espessuraMm != null
        ? f.comprimentoMm != null
          ? `${f.espessuraMm} × ${f.comprimentoMm} mm`
          : `${f.espessuraMm} mm`
        : "");
    const row = freeagens.addRow([
      f.nome,
      f.id,
      medida,
      f.precoUnitario ?? null,
      "", // Preço por metro — a preencher se aplicável
    ]);
    styleBody(row);
  }
  autofit(freeagens);

  // —— Orla ——
  const orla = workbook.addWorksheet(MATERIAIS_SSOT_SHEET_ORLA, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  styleHeader(orla.addRow([...MATERIAIS_SSOT_ORLA_HEADERS]));

  for (const o of DEFAULT_ORLA_PRESETS) {
    const row = orla.addRow([
      o.nome,
      o.id,
      o.espessuraMm ?? null,
      o.precoPorMetro ?? null,
      "", // Preço por rolo — a preencher se aplicável
    ]);
    styleBody(row);
  }
  autofit(orla);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await workbook.xlsx.writeFile(OUT);
  console.log(`Gerado: ${OUT}`);
  console.log(
    `Chapas=${listOfficialMaterials().filter((x) => x.industrial).length} · Freeagens=${FERRAGENS_DEFAULT.length} · Orla=${DEFAULT_ORLA_PRESETS.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
