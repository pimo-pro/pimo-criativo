import { describe, expect, it } from "vitest";
import {
  assertNoDuplicateIndustrialModeIds,
  INDUSTRIAL_DRILL_TIPOS,
  INDUSTRIAL_MODE_IDS,
  INDUSTRIAL_MODELS,
  INDUSTRIAL_ORLA_SIDES,
  isIndustrialDrillTipo,
  resolveActiveIndustrialModels,
  resolveIndustrialPieceLabel,
} from "./industrialModelsRegistry";
import {
  assertNoDuplicateIndustrialRuleIds,
  INDUSTRIAL_RULE_IDS,
  INDUSTRIAL_RULES,
  getIndustrialRuleById,
} from "./industrialRulesRegistry";
import {
  DEFAULT_INDUSTRIAL_ADMIN_SETTINGS,
  getIndustrialAdminSettings,
  isIndustrialModeRuntimeEnabled,
  resetIndustrialAdminSettings,
} from "./industrialSettings";
import { HINGE_COMPENSATION_MM } from "../innerCabinet/hingeCompensation40";
import { DRAWER_FRONT_LATERAL_GAP_MM } from "../drawers/drawerGeometryConstants";
import { GAVETA_PORTA_SEP_NOME_INDUSTRIAL, GAVETA_PORTA_SEP_PRODUCT_MODE_ID } from "../productModes/gavetaPortaSepLayout";

describe("industrialAdminRegistry Fase E", () => {
  it("regista exactamente os 4 modos industriais sem duplicação", () => {
    expect(INDUSTRIAL_MODELS).toHaveLength(4);
    expect([...INDUSTRIAL_MODE_IDS].sort()).toEqual(
      [
        "cx_gav_cavita",
        "gaveta_porta_sep_prateleiras",
        "inner_cabinet_a1",
        "wardrobe_sep_parcial_gavetas",
      ].sort()
    );
    expect(() => assertNoDuplicateIndustrialModeIds()).not.toThrow();
  });

  it("declara adapters e regras por modo", () => {
    for (const mode of INDUSTRIAL_MODELS) {
      expect(mode.adapters.length).toBeGreaterThan(0);
      expect(mode.rules.length).toBeGreaterThan(0);
      expect(mode.nomeTecnico).toBe(mode.id);
      expect(mode.nomeIndustrial.length).toBeGreaterThan(0);
    }
    const allAdapters = INDUSTRIAL_MODELS.flatMap((m) => m.adapters);
    expect(allAdapters).toEqual(expect.arrayContaining(["cxGavCutlistAdapter", "a1CutlistAdapter"]));
    expect(
      INDUSTRIAL_MODELS.find((m) => m.id === GAVETA_PORTA_SEP_PRODUCT_MODE_ID)?.nomeIndustrial
    ).toBe(GAVETA_PORTA_SEP_NOME_INDUSTRIAL);
  });

  it("consolida todas as regras industriais sem duplicação", () => {
    expect(() => assertNoDuplicateIndustrialRuleIds()).not.toThrow();
    expect(INDUSTRIAL_RULE_IDS).toEqual(
      expect.arrayContaining([
        "folga_2mm_gaveta_porta",
        "sep_parcial_div_so_cavilha",
        "profundidade_ssot",
        "compensacao_40mm",
        "naming_industrial",
        "orla_industrial",
        "routing_drill_cnc",
        "gavetas_europeias_internas",
        "furos_cx_gav_10x30_10x13",
      ])
    );
    expect(INDUSTRIAL_RULES).toHaveLength(INDUSTRIAL_RULE_IDS.length);
    expect(getIndustrialRuleById("compensacao_40mm")?.valuesMm?.compensacaoMm).toBe(
      HINGE_COMPENSATION_MM
    );
    expect(getIndustrialRuleById("folga_2mm_gaveta_porta")?.valuesMm?.gavetaFrenteMm).toBe(
      DRAWER_FRONT_LATERAL_GAP_MM
    );
  });

  it("DRILL/orla/labels industriais no registo único", () => {
    expect(isIndustrialDrillTipo("cx_gav_lat_dir")).toBe(true);
    expect(isIndustrialDrillTipo("a1_cx_comp_40")).toBe(true);
    expect(INDUSTRIAL_DRILL_TIPOS).toEqual(
      expect.arrayContaining(["cx_gav_fun", "a1_cx_cima", "a1_cx_comp_40"])
    );
    expect(INDUSTRIAL_ORLA_SIDES.cx_gav_fun).toEqual([]);
    expect(INDUSTRIAL_ORLA_SIDES.a1_cx_lat_dir).toEqual(["front"]);
    expect(INDUSTRIAL_ORLA_SIDES.a1_cx_comp_40).toEqual(["front", "back"]);
    expect(resolveIndustrialPieceLabel("cx_gav_cima")).toBe("CX GAV cima");
    expect(resolveIndustrialPieceLabel("a1_cx_comp_40")).toBe("A1 compensador 40 mm");
  });

  it("settings ADMIN: defaults activos; runtime não desliga modos nesta fase", () => {
    resetIndustrialAdminSettings();
    const s = getIndustrialAdminSettings();
    expect(s).toMatchObject(DEFAULT_INDUSTRIAL_ADMIN_SETTINGS);
    for (const id of INDUSTRIAL_MODE_IDS) {
      expect(s.modesEnabled[id]).toBe(true);
      expect(isIndustrialModeRuntimeEnabled(id)).toBe(true);
    }
    expect(s.folgasMm.gavetaFrenteMm).toBe(2);
    expect(s.compensacoesMm.hingeSideMm).toBe(40);
    expect(s.alturasPadraoMm.a1HeightMm).toBe(400);
  });

  it("resolveActiveIndustrialModels: gates independentes sem conflito", () => {
    expect(resolveActiveIndustrialModels({ baseCabinetId: "base-600-1porta" })).toEqual([]);
    expect(
      resolveActiveIndustrialModels({ baseCabinetId: "cx_gav_cavita" }).map((m) => m.id)
    ).toEqual(["cx_gav_cavita"]);
    expect(
      resolveActiveIndustrialModels({
        baseCabinetId: "base-1800-roupeiro-h-2400-wardrobe_sep_parcial_gavetas_dir_inner_cabinet_a1",
      }).map((m) => m.id)
    ).toEqual(["wardrobe_sep_parcial_gavetas", "inner_cabinet_a1"]);
  });
});
