import { describe, expect, it } from "vitest";
import { buildDrillFilesForProject } from "../core/drill/drillExport";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { isDrawerPieceTipo } from "../services/drawerCutlistAdapter";
import { buildDrawerScenario, minimalBoxWithDrawers } from "./drawerCertificationTestHelpers";

function countDrawerXml(xmlFiles: { partName: string; machineTarget?: string }[]): number {
  return xmlFiles.filter(
    (f) =>
      f.machineTarget === "drill" &&
      (f.partName.includes("gaveta_") || /gav_/.test(f.partName))
  ).length;
}

describe("XML industrial — contagem exacta por gaveta", () => {
  it("gaveta de madeira — só peças com furação geram XML (máx. 5)", () => {
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

    const withDrilling = cutlist.filter((p) => (p.drillHoles?.length ?? 0) > 0);
    const xmlFiles = buildDrillFilesForProject(cutlist, {
      projectName: "WoodXmlCount",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    expect(countDrawerXml(xmlFiles)).toBe(withDrilling.length);
    expect(countDrawerXml(xmlFiles)).toBeLessThanOrEqual(5);
    expect(xmlFiles.every((f) => !f.partName.includes("gav_frent_int"))).toBe(true);
    expect(new Set(xmlFiles.map((f) => f.filenameBase)).size).toBe(xmlFiles.length);
  });

  it("gaveta metálica — só peças com furação geram XML (máx. 4)", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      boxThickness: 19,
      drawerCount: 1,
      metalBoxType: "Blum Metabox",
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) =>
      isDrawerPieceTipo(p.tipo)
    );
    expect(cutlist).toHaveLength(4);

    const withDrilling = cutlist.filter((p) => (p.drillHoles?.length ?? 0) > 0);
    const xmlFiles = buildDrillFilesForProject(cutlist, {
      projectName: "MetalXmlCount",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    expect(countDrawerXml(xmlFiles)).toBe(withDrilling.length);
    expect(countDrawerXml(xmlFiles)).toBeLessThanOrEqual(4);
    expect(xmlFiles.some((f) => f.partName.includes("gav_lat"))).toBe(false);
    expect(new Set(xmlFiles.map((f) => f.filenameBase)).size).toBe(xmlFiles.length);
  });
});
