import { describe, expect, it } from "vitest";
import { cutlistToPieces } from "../core/cutlayout/cutLayoutEngine";
import { expandPieces, groupByMaterialAndThickness } from "../core/cutlayout/utils/cutLayoutUtils";
import {
  getCutlistItemNestingGroupKey,
  getCutPieceNestingGroupKey,
} from "../core/cnc/industrialNestingGroup";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "./drawerCertificationTestHelpers";

describe("Nesting industrial — integração gavetas com corpo", () => {
  it("frente de gaveta 19 mm agrupa com painéis do corpo na mesma chapa lógica", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const frontItem = cutlist.find((p) => p.tipo === "gaveta_frente_ext");
    const bodyLateralItem = cutlist.find((p) => p.tipo === "lateral_esquerda");
    expect(frontItem).toBeDefined();
    expect(bodyLateralItem).toBeDefined();
    expect(frontItem?.espessura).toBe(19);
    expect(bodyLateralItem?.espessura).toBe(19);

    const frontKey = getCutlistItemNestingGroupKey(frontItem!);
    const bodyKey = getCutlistItemNestingGroupKey(bodyLateralItem!);
    expect(frontKey).toBe(bodyKey);

    const pieces = expandPieces(cutlistToPieces(cutlist));
    const grouped = groupByMaterialAndThickness(pieces);
    expect(grouped.get(frontKey)?.length).toBeGreaterThan(1);
  });

  it("laterais/traseira 16 mm ficam no grupo 16 mm (separado do corpo 19 mm)", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const drawerSide = cutlist.find((p) => p.tipo === "gaveta_lat_esq");
    const bodyPanel = cutlist.find((p) => p.tipo === "lateral_esquerda");
    expect(drawerSide?.espessura).toBe(16);
    expect(bodyPanel?.espessura).toBe(19);
    expect(getCutlistItemNestingGroupKey(drawerSide!)).not.toBe(
      getCutlistItemNestingGroupKey(bodyPanel!)
    );
  });

  it("corpo e laterais de gaveta 16 mm partilham grupo quando a caixa usa espessura 16 mm", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
      boxThickness: 16,
    });
    const box = minimalBoxWithDrawers(layers, { espessura: 16 });
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const drawerLat = cutlist.find((p) => p.tipo === "gaveta_lat_esq");
    const bodyLateral = cutlist.find((p) => p.tipo === "lateral_esquerda");
    expect(bodyLateral?.espessura).toBe(16);
    expect(drawerLat?.espessura).toBe(16);
    expect(getCutlistItemNestingGroupKey(bodyLateral!)).toBe(
      getCutlistItemNestingGroupKey(drawerLat!)
    );

    const pieces = cutlistToPieces(cutlist);
    const bodyPiece = pieces.find((p) => p.partName === bodyLateral?.nome);
    const sidePiece = pieces.find((p) => p.partName === drawerLat?.nome);
    expect(bodyPiece).toBeDefined();
    expect(sidePiece).toBeDefined();
    expect(getCutPieceNestingGroupKey(bodyPiece!)).toBe(getCutPieceNestingGroupKey(sidePiece!));
  });
});
