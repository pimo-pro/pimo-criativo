import { describe, expect, it } from "vitest";
import { buildDrawerSpecs } from "../3d/objects/DrawerFactory";
import { buildPanelDrillingResult } from "../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import {
  extractDrawerCutlistFromLayerItems,
  isDrawerPieceTipo,
} from "../services/drawerCutlistAdapter";
import { resolveDrawerMotionCurve, resolveDrawerAnimationDurationMs } from "../core/drawers/DrawerMotionCurves";
import { DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM } from "../core/drawers/drawerSlideDepth";
import { drawerGroupToLayerItems, generateDrawerGroup } from "../core/drawers";
import {
  buildDrawerScenario,
  DRAWER_SETTINGS,
  minimalBoxWithDrawers,
} from "./drawerCertificationTestHelpers";

describe("Certificação — consistência UI → Industrial", () => {
  it("UI nominalDepth → cutlist bodyDepth coerente", () => {
    const nominalDepthMm = 450;
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
      drawerOverrides: [{ nominalDepthMm }],
    });

    expect(layers[0].metadata?.nominalDepth).toBe(nominalDepthMm);
    expect(layers[0].bodyDepth).toBe(nominalDepthMm);

    const cutlist = extractDrawerCutlistFromLayerItems(layers, "MDF");
    const lat = cutlist.find((p) => p.tipo === "gaveta_lat_esq");
    expect(lat?.dimensoes.largura).toBe(nominalDepthMm - DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM);
    expect(layers[0].leftSideDepth).toBe(nominalDepthMm - DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM);
  });

  it("UI slideType → furação com regras da corrediça", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      drawerCount: 1,
      slideType: "Blum Tandem",
      drawerOverrides: [{ slideType: "Blum Tandem" }],
    });

    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const lat = cutlist.find((p) => p.tipo === "gaveta_lat_esq");
    // Peças da gaveta não levam furação de corrediça: apenas cavilhas + rasgo inferior.
    expect(lat?.drillHoles?.some((h) => h.holeType === "corredica") ?? false).toBe(false);

    const rules = lat?.metadata as { drawerRules?: { slideType?: string } } | undefined;
    const drilling = buildPanelDrillingResult(
      {
        tipo: "gaveta_lat_esq",
        larguraMm: layers[0].bodyDepth ?? 0,
        alturaMm: layers[0].bodyHeight ?? 0,
        espessuraMm: layers[0].sideThickness ?? 16,
        slideType: rules?.drawerRules?.slideType ?? layers[0].slideType,
      },
      defaultRulesConfig
    );
    expect(drilling.success).toBe(true);
    expect(drilling.data?.drillHoles.length).toBeGreaterThan(0);
  });

  it("UI metalBoxType → remove peças internas da cutlist", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      drawerCount: 1,
      metalBoxType: "Blum Metabox",
      drawerOverrides: [{ metalBoxType: "Blum Metabox", drawerType: "pro" }],
    });

    const cutlist = extractDrawerCutlistFromLayerItems(layers, "MDF");
    expect(cutlist.map((p) => p.tipo).sort()).toEqual([
      "gaveta_frente_ext",
      "gaveta_frente_int",
      "gaveta_fundo",
      "gaveta_traseira",
    ]);
    expect(cutlist[0].metadata?.drawerHardware?.some((h) => h.tipo === "caixa_metalica")).toBe(true);
  });

  it("UI softClose → motion curve e duração distintas", () => {
    const curveOff = resolveDrawerMotionCurve("Blum Tandem", false);
    const curveOn = resolveDrawerMotionCurve("Blum Tandem", true);
    expect(curveOn(0.5)).not.toBeCloseTo(curveOff(0.5), 1);
    expect(resolveDrawerAnimationDurationMs("Blum Tandem", true)).toBeGreaterThan(
      resolveDrawerAnimationDurationMs("Blum Tandem", false)
    );

    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      drawerCount: 1,
      softClose: true,
      drawerOverrides: [{ softClose: true }],
    });
    const [spec] = buildDrawerSpecs([layers[0]]);
    expect(spec.softClose).toBe(true);
    expect(layers[0].softClose).toBe(true);
  });

  it("UI drawerType pro → Viewer specs refletem tipo", () => {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "ui-pro",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: DRAWER_SETTINGS.gavetaProfundidadesDisponiveisMm,
      drawerSettings: DRAWER_SETTINGS,
      drawerOverrides: [{ drawerType: "pro" }],
    });
    const [layer] = drawerGroupToLayerItems(group);
    expect(layer.type).toBe("pro");
    expect(layer.drawerType).toBe("pro");

    const [spec] = buildDrawerSpecs([layer]);
    expect(spec.metalBoxType).toBeTruthy();
    expect(spec.slideType).toBeTruthy();
  });

  it("cutlist industrial completa sem peças estruturais duplicadas", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 3,
    });
    const box = minimalBoxWithDrawers(layers, { gavetas: 3 });
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const drawerPieces = cutlist.filter((p) => isDrawerPieceTipo(p.tipo));
    expect(drawerPieces).toHaveLength(15);
    const ids = new Set(drawerPieces.map((p) => p.id));
    expect(ids.size).toBe(drawerPieces.length);
  });
});
