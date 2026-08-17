import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  INDUSTRIAL_SHEET_HF_MM,
  INDUSTRIAL_SHEET_LF_MM,
  listIndustrialMaterialFamilyOptions,
  listOfficialMaterials,
  resolveCostaMaterial,
  resolveMaterial,
} from "./materials.api";
import { INITIAL_MATERIAL_PRESETS } from "./presets";
import { MATERIAIS_PBR_OPCOES, getMaterial } from "../manufacturing/materials";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { makeDivSepTestBox } from "../divSep/divSepTestHelpers";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { buildRemateCutlistItems } from "../remate/remateCutlist";
import type { RematePiece } from "../remate/rematePieceTypes";
import { shouldApplyTampoRules } from "../remate/tampoCozinhaRules";
import { setCentralPricingCacheForTests, getBuiltinCentralPricing } from "../pricing/centralPricingConfig";
import { computeChapasReal } from "../industrial/computeChapasReal";
import type { CutListItemComPreco } from "../types";

vi.mock("./service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./service")>();
  return {
    ...actual,
    listMaterials: vi.fn(() => []),
  };
});

import { listMaterials } from "./service";
import { getPrecoPorMaterial } from "../pricing/pricing";

const VARIANTS = [
  { id: "agl_branco-8", alias: "AGL_BRANCO-8", mm: 8, price: 6 },
  { id: "agl_branco-10", alias: "AGL_BRANCO-10", mm: 10, price: 7 },
  { id: "agl_branco-16", alias: "AGL_BRANCO-16", mm: 16, price: 6.5 },
  { id: "agl_branco-19", alias: "AGL_BRANCO-19", mm: 19, price: 7.5 },
] as const;

function remateTampoAgl19(): RematePiece {
  return {
    id: "tampo-agl-19",
    tipo: "TAMPO",
    width: 1000,
    height: 1000,
    depth: 19,
    materialPresetId: "agl_branco-19",
    position: { xMm: 0, yMm: 0, zMm: 0 },
    rotation: { xRad: 0, yRad: 0, zRad: 0 },
    followBox: false,
    name: "Tampo AGL LAM BRANCO",
  };
}

describe("AGL LAM BRANCO — registo industrial", () => {
  beforeEach(() => {
    setCentralPricingCacheForTests(getBuiltinCentralPricing());
    vi.mocked(listMaterials).mockReturnValue([]);
  });

  afterEach(() => {
    setCentralPricingCacheForTests(null);
    vi.clearAllMocks();
  });

  it("resolve as 4 variantes com chapa 2800×2070, Ind e preços oficiais", () => {
    for (const v of VARIANTS) {
      const byId = resolveMaterial(v.id);
      const byAlias = resolveMaterial(v.alias);
      expect(byId).not.toBeNull();
      expect(byAlias?.canonicalId).toBe(v.id);
      expect(byId!.industrial).toBe(true);
      expect(byId!.viewerMaterialId).toBe("agl_branco");
      expect(byId!.industrialDefaults).toEqual({
        espessuraPadrao: v.mm,
        custo_m2: v.price,
        larguraChapa: INDUSTRIAL_SHEET_LF_MM,
        alturaChapa: INDUSTRIAL_SHEET_HF_MM,
        densidade: 720,
      });
    }
    expect(resolveMaterial("AGL_BRANCO")?.canonicalId).toBe("agl_branco-19");
    expect(resolveMaterial("AGL LAM BRANCO")?.canonicalId).toBe("agl_branco-19");
  });

  it("aparece no catálogo oficial, famílias industriais e PBR", () => {
    const ids = listOfficialMaterials().map((m) => m.canonicalId);
    expect(ids).toEqual(expect.arrayContaining(VARIANTS.map((v) => v.id)));
    expect(listIndustrialMaterialFamilyOptions().some((f) => f.familyKey === "agl_branco")).toBe(
      true
    );
    expect(INITIAL_MATERIAL_PRESETS.some((p) => p.id === "agl_branco")).toBe(true);
    expect(MATERIAIS_PBR_OPCOES.some((o) => o.id === "agl_branco")).toBe(true);
    const preset = INITIAL_MATERIAL_PRESETS.find((p) => p.id === "agl_branco");
    expect(preset?.color).toBe("#f2f0eb");
    expect(preset?.textureUrl).toMatch(/mdf-branco/);
  });

  it("preço cutlist usa industrialDefaults (não MDF_BRANCO_10)", () => {
    for (const v of VARIANTS) {
      expect(getPrecoPorMaterial(v.id, v.mm)).toBe(v.price);
      expect(getPrecoPorMaterial(v.alias, v.mm)).toBe(v.price);
    }
  });

  it("caixa AGL_BRANCO-16: cutlist com espessura 16 e 6,5 €/m²", () => {
    const box = makeDivSepTestBox({
      material: "agl_branco-16",
      espessura: 16,
    });
    const items = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const lateral = items.find((i) => i.tipo === "lateral_esquerda");
    expect(lateral).toBeTruthy();
    expect(lateral!.espessura).toBe(16);
    expect(lateral!.material).toMatch(/AGL LAM BRANCO/i);
    expect(getPrecoPorMaterial(lateral!.material, lateral!.espessura)).toBe(6.5);
    expect(lateral!.precoUnitario).toBeGreaterThan(0);
  });

  it("tampo AGL_BRANCO-19: cutlist com espessura 19 e 7,5 €/m² sem regras TAMPO_COZINHA", () => {
    expect(shouldApplyTampoRules({ materialPresetId: "agl_branco-19" })).toBe(false);
    const items = buildRemateCutlistItems([remateTampoAgl19()], []);
    expect(items).toHaveLength(1);
    expect(items[0]!.espessura).toBe(19);
    expect(items[0]!.material).toMatch(/AGL LAM BRANCO/i);
    expect(items[0]!.precoUnitario).toBeCloseTo(7.5, 5);
  });

  it("nesting usa chapa 2800×2070", () => {
    const industrial = getMaterial("agl_branco-16");
    expect(industrial.larguraChapa).toBe(2800);
    expect(industrial.alturaChapa).toBe(2070);
    expect(resolveCostaMaterial("agl_branco-16").materialId).toBe("agl_branco-10");

    const piece: CutListItemComPreco = {
      id: "p1",
      nome: "Lat_AGL",
      quantidade: 1,
      dimensoes: { largura: 800, altura: 720, profundidade: 16 },
      espessura: 16,
      material: "AGL LAM BRANCO 16",
      materialId: "agl_branco-16",
      tipo: "lateral_esquerda",
      boxId: "box-1",
      precoUnitario: 0,
      precoTotal: 0,
    };
    const chapas = computeChapasReal([piece], "AGL Branco", [{ id: "box-1" }]);
    expect(chapas.sheets.length).toBeGreaterThan(0);
    expect(chapas.sheets[0]!.sheetLarguraMm).toBe(2800);
    expect(chapas.sheets[0]!.sheetAlturaMm).toBe(2070);
  });
});
