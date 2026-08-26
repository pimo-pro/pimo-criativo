import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { CutListItemComPreco } from "../types";
import { buildCncFromCutlistItems, getFastCncLayoutOptions } from "../cnc/cncPipeline";
import { buildCutLayoutPdf } from "../cutlayout/cutLayoutPdf";
import { computeChapasReal } from "./computeChapasReal";
import {
  MDB_LAMINADO_CANONICAL_ID,
  MDB_LAMINADO_SHEET_HF_MM,
  MDB_LAMINADO_SHEET_LF_MM,
  listOfficialMaterials,
} from "../materials/materials.api";
import { getMaterialByIdOrLabel, setIndustrialMaterialsReadOverride } from "../materials/service";
import type { MaterialRecord } from "../materials/types";
import { PANEL_DEFAULTS } from "../panel/panelConstants";

function pdfToLatin1Text(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("latin1");
}

function makeItem(
  overrides: Partial<CutListItemComPreco> & {
    nome: string;
    material: string;
    materialId: string;
    espessura: number;
    largura: number;
    altura: number;
    tipo?: string;
  }
): CutListItemComPreco {
  const esp = overrides.espessura;
  return {
    id: overrides.id ?? overrides.nome,
    nome: overrides.nome,
    quantidade: overrides.quantidade ?? 1,
    dimensoes: {
      largura: overrides.largura,
      altura: overrides.altura,
      profundidade: esp,
    },
    espessura: esp,
    material: overrides.material,
    materialId: overrides.materialId,
    tipo: overrides.tipo ?? "lateral",
    boxId: overrides.boxId ?? "box-1",
    precoUnitario: 0,
    precoTotal: 0,
  };
}

/** Peça MDB que cabe na área útil 3640×610 (chapa 3660×630 com margem CNC 10 mm). */
const TAMPO_MDB = makeItem({
  nome: "TAMPO",
  material: "MDB Laminado 30",
  materialId: MDB_LAMINADO_CANONICAL_ID,
  tipo: "remate",
  espessura: 30,
  largura: 1800,
  altura: 500,
});

const LATERAL_MDF19 = makeItem({
  nome: "Lat_MDF",
  material: "MDF Branco 19",
  materialId: "mdf_branco-19",
  tipo: "lateral",
  espessura: 19,
  largura: 800,
  altura: 400,
});

function parseUnmHeader(tcn: string): { dl: number; dh: number; ds: number } {
  const m = tcn.match(/::UNm\s+DL=(\d+)\s+DH=(\d+)\s+DS=(\d+)/);
  if (!m) throw new Error("Header ::UNm DL/DH/DS não encontrado.");
  return { dl: Number(m[1]), dh: Number(m[2]), ds: Number(m[3]) };
}

function officialMaterialsAsCrud(): MaterialRecord[] {
  return listOfficialMaterials()
    .filter((m) => m.industrial && m.industrialDefaults)
    .map((m) => ({
      id: m.canonicalId,
      label: m.label,
      categoryId: "industrial",
      espessura: Number(m.industrialDefaults?.espessuraPadrao),
      precoPorM2: Number(m.industrialDefaults?.custo_m2 ?? 0),
      sheetWidthMm: Number(m.industrialDefaults?.larguraChapa),
      sheetHeightMm: Number(m.industrialDefaults?.alturaChapa),
      sheetThicknessMm: Number(m.industrialDefaults?.espessuraPadrao),
      industrialMaterialId: m.canonicalId,
    }));
}

describe("Fase A — chapa MDB Laminado 30 (3660×630×30)", () => {
  beforeEach(() => {
    setIndustrialMaterialsReadOverride(officialMaterialsAsCrud());
  });

  afterEach(() => {
    setIndustrialMaterialsReadOverride(null);
  });
  it("pipeline CNC: TAMPO usa 3660×630×30 e caixaria 19 mm permanece 2800×2070", () => {
    const bundle = buildCncFromCutlistItems(
      { projectName: "FaseA_MDB" },
      [TAMPO_MDB, LATERAL_MDF19],
      undefined,
      getFastCncLayoutOptions()
    );
    expect(bundle?.layoutResult.sheets.length).toBeGreaterThanOrEqual(2);

    const mdbSheets = bundle!.layoutResult.sheets.filter(
      (s) =>
        s.sheet.largura_mm === MDB_LAMINADO_SHEET_LF_MM &&
        s.sheet.altura_mm === MDB_LAMINADO_SHEET_HF_MM
    );
    const mdfSheets = bundle!.layoutResult.sheets.filter(
      (s) => s.sheet.largura_mm === PANEL_DEFAULTS.largura_mm && s.sheet.altura_mm === PANEL_DEFAULTS.altura_mm
    );
    expect(mdbSheets.length).toBeGreaterThanOrEqual(1);
    expect(mdbSheets[0]!.sheet.espessura_mm).toBe(30);
    expect(mdfSheets.length).toBeGreaterThanOrEqual(1);
    expect(mdfSheets[0]!.sheet.espessura_mm).toBe(19);

    const files = bundle!.cnc?.files ?? [];
    expect(files.length).toBeGreaterThanOrEqual(2);
    const unms = files.map((f) => parseUnmHeader(f.tcn));
    expect(unms.some((u) => u.dl === 3660 && u.dh === 630 && u.ds === 30)).toBe(true);
    expect(unms.some((u) => u.dl === 2800 && u.dh === 2070 && u.ds === 19)).toBe(true);
    expect(files.some((f) => f.tcn.includes("::UNm DL=3660 DH=630 DS=30"))).toBe(true);
  });

  it("PDF: cabeçalho do grupo MDB mostra 3660×630×30; MDF 19 mm mostra 2800×2070", async () => {
    const bundle = buildCncFromCutlistItems(
      { projectName: "FaseA_MDB_PDF" },
      [TAMPO_MDB, LATERAL_MDF19],
      undefined,
      getFastCncLayoutOptions()
    );
    expect(bundle?.layoutResult.sheets.length).toBeGreaterThanOrEqual(2);

    const doc = await buildCutLayoutPdf(bundle!.layoutResult, { projectName: "FaseA_MDB_PDF" });
    const text = pdfToLatin1Text(doc.output("arraybuffer"));
    expect(text).toContain("3660");
    expect(text).toContain("630");
    expect(text).toMatch(/30\s*mm/);
    expect(text).toContain("2800");
    expect(text).toContain("2070");
  });

  it("computeChapasReal: grupo MDB não herda a chapa global 2800×2070", () => {
    const summary = computeChapasReal(
      [TAMPO_MDB, LATERAL_MDF19],
      "FaseA_Chapas",
      [{ id: "box-1", nome: "Caixa 1" }]
    );
    expect(summary.mode).toBe("estimado");
    const mdb = summary.sheets.filter(
      (s) => s.sheetLarguraMm === MDB_LAMINADO_SHEET_LF_MM && s.sheetAlturaMm === MDB_LAMINADO_SHEET_HF_MM
    );
    const mdf = summary.sheets.filter(
      (s) => s.sheetLarguraMm === PANEL_DEFAULTS.largura_mm && s.sheetAlturaMm === PANEL_DEFAULTS.altura_mm
    );
    expect(mdb.length).toBeGreaterThanOrEqual(1);
    expect(mdb[0]!.espessuraMm).toBe(30);
    expect(mdf.length).toBeGreaterThanOrEqual(1);
    expect(mdf[0]!.espessuraMm).toBe(19);
  });
});

describe("Fase A — CRUD mdb_laminado-30 sincroniza 3660×630×30", () => {
  function createMemoryStorage(): Storage {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, String(v));
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      key: (i: number) => [...map.keys()][i] ?? null,
    };
  }

  beforeEach(() => {
    setIndustrialMaterialsReadOverride(null);
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    setIndustrialMaterialsReadOverride(null);
    vi.unstubAllGlobals();
  });

  it("registo antigo 2800×2070 é forçado para a chapa oficial MDB", async () => {
    localStorage.setItem("pimo_materials_crud_data_version", "10");
    localStorage.setItem(
      "pimo_materials_crud_v1",
      JSON.stringify([
        {
          id: "stale-mdb",
          label: "MDB Laminado 30",
          categoryId: "industrial",
          espessura: 19,
          precoPorM2: 30,
          sheetWidthMm: 2800,
          sheetHeightMm: 2070,
          sheetThicknessMm: 19,
          industrialMaterialId: MDB_LAMINADO_CANONICAL_ID,
        },
      ])
    );

    vi.resetModules();
    const { listMaterials: listMaterialsFresh } = await import("../materials/service");
    const mdb = listMaterialsFresh().find((m) => m.industrialMaterialId === MDB_LAMINADO_CANONICAL_ID);
    expect(mdb).toBeDefined();
    expect(mdb!.sheetWidthMm).toBe(MDB_LAMINADO_SHEET_LF_MM);
    expect(mdb!.sheetHeightMm).toBe(MDB_LAMINADO_SHEET_HF_MM);
    expect(mdb!.sheetThicknessMm).toBe(30);
    expect(mdb!.espessura).toBe(30);
  });

  it("catálogo oficial já expõe 3660×630×30 para mdb_laminado-30", () => {
    const fallback = getMaterialByIdOrLabel(MDB_LAMINADO_CANONICAL_ID);
    expect(fallback?.sheetWidthMm).toBe(3660);
    expect(fallback?.sheetHeightMm).toBe(630);
    expect(fallback?.sheetThicknessMm).toBe(30);
  });
});
