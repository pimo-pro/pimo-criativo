import { describe, expect, it } from "vitest";
import { buildPanelDrillingResult } from "../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { buildDrillFilesForProject } from "../core/drill/drillExport";
import { drawerGroupToLayerItems, generateDrawerGroup } from "../core/drawers";
import { DRAWER_BODY_DELTA_LOWEST_MM } from "../core/drawers/drawerGeometryConstants";
import { settingsDefaults } from "../core/settings/settingsSchema";
import { drawerLayerItemToCutList } from "../services/drawerCutlistAdapter";

describe("Fase 5 — frente externa + interna (metálica)", () => {
  it("cutlist madeira — 5 peças sem frente interna", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "split-wood",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const [layer] = drawerGroupToLayerItems(group);
    const cutlist = drawerLayerItemToCutList(layer, 0, "mdf_branco", "Modulo_A");
    const tipos = cutlist.map((p) => p.tipo);

    expect(cutlist).toHaveLength(5);
    expect(tipos).toContain("gaveta_frente_ext");
    expect(tipos).not.toContain("gaveta_frente_int");
    expect(tipos).not.toContain("gaveta_frente");

    const frontExt = cutlist.find((p) => p.tipo === "gaveta_frente_ext")!;
    const lat = cutlist.find((p) => p.tipo === "gaveta_lat_esq")!;
    expect(frontExt.dimensoes.altura - lat.dimensoes.altura).toBeCloseTo(
      DRAWER_BODY_DELTA_LOWEST_MM,
      5
    );
    expect(frontExt.metadata?.drawerRules).toMatchObject({ handleType: "Nenhum" });
  });

  it("furação madeira — estrutural nas laterais, puxador na ext", () => {
    const latResult = buildPanelDrillingResult(
      {
        tipo: "gaveta_lat_esq",
        larguraMm: 500,
        alturaMm: 200,
        espessuraMm: 16,
      },
      defaultRulesConfig
    );
    const extResult = buildPanelDrillingResult(
      {
        tipo: "gaveta_frente_ext",
        larguraMm: 562,
        alturaMm: 215,
        espessuraMm: 19,
        handleType: "Puxador",
        handleCenterDistanceMm: 96,
        handlePosition: "Centro",
      },
      defaultRulesConfig
    );

    const latHoles = latResult.data?.drillHoles ?? [];
    const extHoles = extResult.data?.drillHoles ?? [];
    expect(latHoles.some((h) => h.holeSubtype === "groove")).toBe(true);
    expect(extHoles.filter((h) => h.holeType === "puxador")).toHaveLength(2);
    expect(extHoles.some((h) => h.holeType === "fixacao_estrutural")).toBe(false);
  });

  it("Blum Legrabox — int + ext apenas", () => {
    const settings = {
      ...settingsDefaults.gavetas,
      gavetaTipoCaixaMetalica: "Blum Legrabox" as const,
      gavetaAlturaCaixaMetalicaMm: 128,
    };
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "split-metal",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settings.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settings,
      drawerOverrides: [{ metalBoxType: "Blum Legrabox", metalBoxHeightMm: 128, nominalDepthMm: 500 }],
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const [layer] = drawerGroupToLayerItems(group);
    layer.handleType = "Puxador";
    layer.metadata = {
      ...layer.metadata,
      handleCenterDistanceMm: 128,
      metalBoxHeightMm: 128,
    };

    const cutlist = drawerLayerItemToCutList(layer, 0, "mdf_branco", "Modulo_B");
    expect(cutlist.map((p) => p.tipo).sort()).toEqual([
      "gaveta_frente_ext",
      "gaveta_frente_int",
      "gaveta_fundo",
      "gaveta_traseira",
    ]);

    const frontInt = cutlist.find((p) => p.tipo === "gaveta_frente_int")!;
    const frontExt = cutlist.find((p) => p.tipo === "gaveta_frente_ext")!;
    const intDrilled = buildPanelDrillingResult(
      {
        tipo: frontInt.tipo,
        larguraMm: frontInt.dimensoes.largura,
        alturaMm: frontInt.dimensoes.altura,
        espessuraMm: frontInt.espessura,
        metalBoxType: "Blum Legrabox",
        metalBoxHeightMm: 128,
        metalBoxProfileId: layer.metadata?.metalBoxProfileId,
      },
      defaultRulesConfig
    );
    const extDrilled = buildPanelDrillingResult(
      {
        tipo: frontExt.tipo,
        larguraMm: frontExt.dimensoes.largura,
        alturaMm: frontExt.dimensoes.altura,
        espessuraMm: frontExt.espessura,
        handleType: "Puxador",
        handleCenterDistanceMm: 128,
        handlePosition: "Centro",
      },
      defaultRulesConfig
    );

    const metalHoles = intDrilled.data?.drillHoles.filter((h) => h.holeType === "fixacao_metalica") ?? [];
    const puxadorHoles = extDrilled.data?.drillHoles.filter((h) => h.holeType === "puxador") ?? [];
    expect(metalHoles).toHaveLength(2);
    expect(puxadorHoles).toHaveLength(2);

    const intXml = buildDrillFilesForProject(
      [{ ...frontInt, drillHoles: intDrilled.data?.drillHoles ?? [], preco: 0, precoTotal: 0 }],
      { projectName: "legrabox-int", boxes: [], workspaceBoxes: [] } as never
    )[0]?.xml;
    const extXml = buildDrillFilesForProject(
      [{ ...frontExt, drillHoles: extDrilled.data?.drillHoles ?? [], preco: 0, precoTotal: 0 }],
      { projectName: "legrabox-ext", boxes: [], workspaceBoxes: [] } as never
    )[0]?.xml;

    expect(intXml).toContain("TypeNo>1</TypeNo>");
    expect(intXml).toContain("Diameter>5.00</Diameter>");
    expect(extXml).toContain("TypeNo>1</TypeNo>");
    expect(intXml).not.toContain("puxador");
  });
});
