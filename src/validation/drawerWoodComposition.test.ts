import { describe, expect, it } from "vitest";
import { buildDrillFilesForProject } from "../core/drill/drillExport";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { DRAWER_BODY_DELTA_LOWEST_MM } from "../core/drawers/drawerGeometryConstants";
import { DRAWER_PIECE_INDUSTRIAL_TOKEN } from "../core/drawers/drawerIndustrialLabels";
import {
  drawerLayerItemToCutList,
  isDrawerPieceTipo,
} from "../services/drawerCutlistAdapter";
import { drawerGroupToLayerItems, generateDrawerGroup } from "../core/drawers";
import { settingsDefaults } from "../core/settings/settingsSchema";
import { buildDrawerScenario, minimalBoxWithDrawers } from "./drawerCertificationTestHelpers";

const WOOD_DRAWER_PIECES = [
  "gaveta_frente_ext",
  "gaveta_lat_esq",
  "gaveta_lat_dir",
  "gaveta_traseira",
  "gaveta_fundo",
] as const;

describe("Composição industrial — gaveta de madeira (5 peças)", () => {
  it("cutlist com exactamente 5 peças, espessuras e tokens corretos", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "wood-comp",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const [layer] = drawerGroupToLayerItems(group);
    const cutlist = drawerLayerItemToCutList(layer, 0, "mdf_branco-19", "Modulo_A");

    expect(cutlist).toHaveLength(5);
    expect(cutlist.map((p) => p.tipo).sort()).toEqual([...WOOD_DRAWER_PIECES].sort());
    expect(cutlist.some((p) => p.tipo === "gaveta_frente_int")).toBe(false);
    expect(cutlist.some((p) => p.tipo === "gaveta_frente")).toBe(false);

    const byTipo = Object.fromEntries(cutlist.map((p) => [p.tipo, p]));
    expect(byTipo.gaveta_lat_esq?.espessura).toBe(16);
    expect(byTipo.gaveta_lat_dir?.espessura).toBe(16);
    expect(byTipo.gaveta_traseira?.espessura).toBe(16);
    expect(byTipo.gaveta_fundo?.espessura).toBe(10);
    expect(byTipo.gaveta_frente_ext?.espessura).toBe(19);

    expect(byTipo.gaveta_frente_ext!.dimensoes.altura).toBeGreaterThan(
      byTipo.gaveta_lat_esq!.dimensoes.altura
    );
    expect(
      byTipo.gaveta_frente_ext!.dimensoes.altura - byTipo.gaveta_lat_esq!.dimensoes.altura
    ).toBeCloseTo(DRAWER_BODY_DELTA_LOWEST_MM, 5);

    for (const piece of cutlist) {
      const token = DRAWER_PIECE_INDUSTRIAL_TOKEN[piece.tipo as keyof typeof DRAWER_PIECE_INDUSTRIAL_TOKEN];
      expect(piece.nome).toMatch(new RegExp(`_${token}_01$`));
    }

    expect(cutlist).toMatchSnapshot();
  });

  it("XML — só peças reais da gaveta de madeira", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) =>
      isDrawerPieceTipo(p.tipo)
    );
    expect(cutlist).toHaveLength(5);

    const xmlFiles = buildDrillFilesForProject(cutlist, {
      projectName: "WoodDrawer",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    const drawerXml = xmlFiles.filter((f) => f.partName.includes("gav_"));
    expect(drawerXml.length).toBeGreaterThanOrEqual(2);
    expect(drawerXml.every((f) => !f.partName.includes("gav_frent_int"))).toBe(true);
    expect(drawerXml.some((f) => f.partName.includes("gav_lat"))).toBe(true);
  });
});
