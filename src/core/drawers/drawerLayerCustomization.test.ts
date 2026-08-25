import { describe, expect, it } from "vitest";
import {
  resolveDrawerFrontHeightMm,
  resolveDrawerFrontPieceLabel,
  resolveDrawerGroupPrefix,
  resolveDrawerPieceIndustrialLabel,
} from "./drawerLayerCustomization";
import type { DrawerLayerItem } from "../../models/BoxLayers";
import { drawerLayerItemToCutList } from "../../services/drawerCutlistAdapter";
import { buildDrillFilesForProject } from "../drill/drillExport";
import { buildPanelDrillingResult } from "../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { CutListItemComPreco } from "../types";

const baseDrawer = (): DrawerLayerItem => ({
  id: "d1",
  parentBoxId: "box1",
  width: 598,
  height: 200,
  depth: 540,
  frontThickness: 19,
  bodyWidth: 548,
  bodyHeight: 200,
  bodyDepth: 521,
  leftSideWidth: 16,
  leftSideHeight: 200,
  leftSideDepth: 521,
  rightSideWidth: 16,
  rightSideHeight: 200,
  rightSideDepth: 521,
  backWidth: 516,
  backHeight: 200,
  bottomWidth: 516,
  bottomDepth: 521,
  openDirection: "pull",
  isOpen: false,
  pullDistanceMm: 521,
  posX: 0,
  posY: 0,
  posZ: 0,
  rotY: 0,
});

describe("drawerLayerCustomization", () => {
  it("resolveDrawerFrontHeightMm — override ou corpo", () => {
    const item = baseDrawer();
    expect(resolveDrawerFrontHeightMm(item)).toBe(200);
    item.metadata = { frontHeightMm: 220 };
    expect(resolveDrawerFrontHeightMm(item)).toBe(220);
  });

  it("resolveDrawerGroupPrefix — nome customizado (sanitizeIndustrialToken)", () => {
    const item = baseDrawer();
    item.metadata = { drawerGroupName: "Gaveta Superior" };
    expect(resolveDrawerGroupPrefix(item, "Modulo_A")).toBe("gaveta_superior");
  });

  it("resolveDrawerFrontPieceLabel — nome customizado da frente", () => {
    const item = baseDrawer();
    item.metadata = { frontPieceName: "FRENTE_ESPECIAL_01" };
    expect(resolveDrawerFrontPieceLabel(item, "Modulo_A", 1)).toBe("frente_especial_01");
  });

  it("resolveDrawerPieceIndustrialLabel — laterais usam tipo SSOT", () => {
    const item = baseDrawer();
    item.metadata = { drawerGroupName: "GAV_SUP" };
    expect(resolveDrawerPieceIndustrialLabel(item, "Modulo_A", "gaveta_lat_esq", 1)).toBe(
      "gaveta_lat_esq"
    );
  });
});

describe("cutlist + XML com personalização", () => {
  it("altura e nomes personalizados propagam para cutlist e XML", () => {
    const item: DrawerLayerItem = {
      ...baseDrawer(),
      height: 220,
      metadata: {
        frontHeightMm: 220,
        drawerGroupName: "GAV_SUP",
        frontPieceName: "FRENTE_PERSO",
      },
    };

    const cutlist = drawerLayerItemToCutList(item, 0, "mdf_branco-19", "Modulo_A");
    const front = cutlist.find((p) => p.tipo === "gaveta_frente_ext");
    const lat = cutlist.find((p) => p.tipo === "gaveta_lat_esq");

    expect(front?.nome).toBe("FRENTE_PERSO");
    expect(front?.dimensoes.altura).toBe(220);
    expect(lat?.nome).toBe("gaveta_lat_esq");

    const drilling = buildPanelDrillingResult(
      {
        tipo: "gaveta_frente_ext",
        larguraMm: front!.dimensoes.largura,
        alturaMm: front!.dimensoes.altura,
        espessuraMm: front!.espessura,
        handleType: "Puxador",
        handleCenterDistanceMm: 96,
        handlePosition: "Centro",
      },
      defaultRulesConfig
    );
    expect(drilling.success).toBe(true);

    const cutItem: CutListItemComPreco = {
      id: "front-perso",
      nome: front!.nome,
      tipo: "gaveta_frente_ext",
      quantidade: 1,
      dimensoes: front!.dimensoes,
      espessura: front!.espessura,
      material: "mdf",
      drillHoles: drilling.data!.drillHoles,
      precoUnitario: 0,
      precoTotal: 0,
      metadata: front!.metadata,
    };

    const xml = buildDrillFilesForProject([cutItem], {
      projectName: "Teste",
      boxes: [],
      rules: defaultRulesConfig,
    })[0].xml;

    expect(xml).toContain("<PanelWidth>220.00</PanelWidth>");
    expect(xml).toContain("<Y1>110.00</Y1>");
  });
});
