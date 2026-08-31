import { describe, expect, it } from "vitest";
import { generateDrawerGroup, drawerGroupToLayerItems } from "../core/drawers";
import { settingsDefaults } from "../core/settings/settingsSchema";
import { extractDrawerCutlistFromLayerItems } from "../services/drawerCutlistAdapter";

describe("Drawer Rules — caixas metálicas", () => {
  it("caixa metálica remove laterais de madeira; fundo e traseira mantêm-se", () => {
    const settings = {
      ...settingsDefaults.gavetas,
      gavetaTipoCaixaMetalica: "Blum Legrabox" as const,
      gavetaAlturaCaixaMetalicaMm: 128,
      gavetaProfundidadesCompativeisMm: [500, 550],
    };
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 300,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "metal-box",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settings.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settings,
    });
    const [layer] = drawerGroupToLayerItems(group);
    const cutlist = extractDrawerCutlistFromLayerItems([layer], "MDF");

    expect(layer.metalBoxType).toBe("Blum Legrabox");
    expect(layer.leftSideWidth).toBe(0);
    expect(cutlist.map((item) => item.tipo)).toEqual([
      "gaveta_frente_int",
      "gaveta_frente_ext",
      "gaveta_fundo",
      "gaveta_traseira",
    ]);
    expect(cutlist[0].metadata?.drawerHardware).toBeTruthy();
  });

  it("drawer PRO usa caixa metálica genérica quando não há tipo explícito", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 300,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "pro-box",
      drawerCount: 1,
      drawerType: "pro",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
    });
    const [layer] = drawerGroupToLayerItems(group);

    expect(layer.drawerType).toBe("pro");
    expect(layer.metalBoxType).toBe("Genérica");
  });
});
