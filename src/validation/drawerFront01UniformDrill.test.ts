/**
 * GAV_FRENTE_EXT_01/02/03 — furação DRILL (rasgo do fundo + cavilhas).
 * P3.12: todas as frentes partilham o padrão elev+sideH−13 (22 mm à cavilha superior)
 * e cavilhas elev+15 / elev+(sideH−35) — coerência industrial 01≡02≡03.
 */
import { describe, expect, it } from "vitest";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { buildDrillStationXmlFilesForProject } from "../core/drill/drillExport";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "./drawerCertificationTestHelpers";

describe("GAV_FRENTE_EXT_01/02/03 — furação DRILL", () => {
  it("frentes 1/2/3: mesma distância cavilha superior → rasgo (= 22 mm); padrão uniforme", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 900,
      boxDepth: 560,
      drawerCount: 3,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const fronts = cutlist
      .filter((p) => p.tipo === "gaveta_frente_ext")
      .sort(
        (a, b) =>
          (Number(a.metadata?.drawerIndex) || 0) - (Number(b.metadata?.drawerIndex) || 0)
      );

    expect(fronts).toHaveLength(3);
    expect(fronts[0]!.nome).toMatch(/_gav_frent_ext_01$/);
    expect(fronts[1]!.nome).toMatch(/_gav_frent_ext_02$/);
    expect(fronts[2]!.nome).toMatch(/_gav_frent_ext_03$/);

    const distances: number[] = [];
    for (const front of fronts) {
      const groove = front.drillHoles?.find((h) => h.holeSubtype === "groove");
      const cavYs = (front.drillHoles ?? [])
        .filter((h) => h.holeType === "cavilha")
        .map((h) => h.y);
      expect(groove).toBeDefined();
      expect(cavYs.length).toBeGreaterThanOrEqual(2);
      const upperCav = Math.max(...cavYs);
      const dist = groove!.y - upperCav;
      expect(dist).toBeCloseTo(22, 5);
      distances.push(dist);
    }
    expect(new Set(distances.map((d) => d.toFixed(3))).size).toBe(1);

    const drill = buildDrillStationXmlFilesForProject(cutlist, {
      projectName: "FRONT01_UNIFORM",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    const frontXmls = drill.filter(
      (f) => f.partName.includes("gav_frent") && f.machineTarget === "drill"
    );
    expect(frontXmls.length).toBeGreaterThanOrEqual(3);
    expect(frontXmls.every((f) => f.zipPath.includes("drill/"))).toBe(true);
  });
});
