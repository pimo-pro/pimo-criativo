import { describe, expect, it } from "vitest";
import { cutlistToPieces } from "../core/cutlayout/cutLayoutEngine";
import {
  buildCutLayoutProPartName,
  cutlistItemsWithCutLayoutProNames,
  piecePrefixForCutLayoutPro,
} from "../core/cutlayout/cutLayoutProPieceNaming";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { isDrawerPieceTipo } from "../services/drawerCutlistAdapter";
import { buildDrillFilesForProject } from "../core/drill/drillExport";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "./drawerCertificationTestHelpers";

const EXPECTED_DRAWER_PREFIXES: Record<string, string> = {
  gaveta_frente_int: "gav_frent_int",
  gaveta_frente_ext: "gav_frent_ext",
  gaveta_frente: "gav_frent",
  gaveta_lat_esq: "gav_lat_esq",
  gaveta_lat_dir: "gav_lat_dir",
  gaveta_fundo: "gav_fun",
  gaveta_traseira: "gav_cost",
};

describe("Certificação CNC — peças de gaveta", () => {
  it("prefixos Layout PRO corretos por tipo", () => {
    for (const [tipo, prefix] of Object.entries(EXPECTED_DRAWER_PREFIXES)) {
      expect(piecePrefixForCutLayoutPro({ tipo })).toBe(prefix);
    }
  });

  it("nome CNC composto boxPrefix_piecePrefix", () => {
    const name = buildCutLayoutProPartName(
      { tipo: "gaveta_frente_ext", nome: "Gaveta 1 - Frente" },
      "Módulo 1",
      "Projeto Teste"
    );
    expect(name).toMatch(/_gav_frent_ext$/);
  });

  it("espessura, orientação e dimensões corretas na cutlist industrial", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const drawerPieces = cutlist.filter((p) => isDrawerPieceTipo(p.tipo));

    expect(drawerPieces).toHaveLength(5);
    expect(new Set(drawerPieces.map((p) => p.tipo)).size).toBe(5);

    const frontExt = drawerPieces.find((p) => p.tipo === "gaveta_frente_ext");
    expect(frontExt?.espessura).toBe(19);
    expect(frontExt?.nome).toBe("gaveta_frente_ext");
    expect(frontExt?.metadata?.industrialLabel).toBeUndefined();
    expect(frontExt?.grainDirection).toBe("YY");
    expect(frontExt?.dimensoes.largura).toBe(596);
    expect(frontExt?.dimensoes.altura).toBeGreaterThan(0);

    const lat = drawerPieces.find((p) => p.tipo === "gaveta_lat_esq");
    expect(lat?.espessura).toBe(16);
    expect(lat?.nome).toBe("gaveta_lat_esq");
    expect(lat?.grainDirection).toBe("XX");
    expect(lat?.dimensoes.altura).toBeLessThan(frontExt!.dimensoes.altura);

    const fundo = drawerPieces.find((p) => p.tipo === "gaveta_fundo");
    expect(fundo?.espessura).toBe(10);
    expect(fundo?.nome).toBe("gaveta_fundo");

    const costas = drawerPieces.find((p) => p.tipo === "gaveta_traseira");
    expect(costas?.espessura).toBe(16);
    expect(costas?.nome).toBe("gaveta_traseira");
  });

  it("furos corrediça — diâmetro, profundidade, offsets e face B", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const lat = cutlist.find((p) => p.tipo === "gaveta_lat_esq");
    const holes = lat?.drillHoles?.filter((h) => h.holeType === "corredica") ?? [];

    // Modelo industrial: corrediças só no módulo — peças da gaveta sem Ø5
    expect(holes).toHaveLength(0);
    const all = lat?.drillHoles ?? [];
    expect(all.every((h) => h.diameter !== 5)).toBe(true);
    expect(all.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(all.some((h) => h.holeSubtype === "groove")).toBe(true);

    const left = cutlist.find((p) => p.tipo === "gaveta_lat_esq");
    const right = cutlist.find((p) => p.tipo === "gaveta_lat_dir");
    if (left?.drillHoles?.length && right?.drillHoles?.length) {
      const leftCav = left.drillHoles.filter((h) => h.holeType === "cavilha");
      const rightCav = right.drillHoles.filter((h) => h.holeType === "cavilha");
      expect(leftCav.map((h) => h.y).sort()).toEqual(rightCav.map((h) => h.y).sort());
    }
  });

  it("caixa metálica — sem laterais/fundo/traseira e sem furos laterais", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      drawerCount: 1,
      metalBoxType: "Blum Metabox",
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const drawerPieces = cutlist.filter((p) => isDrawerPieceTipo(p.tipo));
    expect(drawerPieces.map((p) => p.tipo).sort()).toEqual([
      "gaveta_frente_ext",
      "gaveta_frente_int",
      "gaveta_fundo",
      "gaveta_traseira",
    ]);
    expect(drawerPieces[0].drillHoles?.length ?? 0).toBeGreaterThan(0);
  });

  it("cutlistToPieces + nomes PRO geram partName estável", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 400,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers, { nome: "Base 01" });
    const raw = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) => isDrawerPieceTipo(p.tipo));
    const renamed = cutlistItemsWithCutLayoutProNames(raw, "NP001", { [box.id]: box.nome });
    const pieces = cutlistToPieces(
      renamed.map((item) => ({
        id: item.id,
        nome: item.nome,
        tipo: item.tipo,
        boxId: item.boxId,
        dimensoes: item.dimensoes,
        espessura: item.espessura,
        drillHoles: item.drillHoles,
        quantidade: item.quantidade,
      }))
    );

    expect(pieces.length).toBeGreaterThan(0);
    pieces.forEach((p) => {
      expect(p.partName).toMatch(/_gav_(frent_ext|lat_esq|lat_dir|fun|cost)$/);
      expect(p.largura_mm).toBeGreaterThan(0);
      expect(p.altura_mm).toBeGreaterThan(0);
    });
  });

  it("peças de gaveta expõem drillHoles prontos para export CNC", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 2,
    });
    const box = minimalBoxWithDrawers(layers);
    const items = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) => isDrawerPieceTipo(p.tipo));

    const withHoles = items.filter((p) => (p.drillHoles?.length ?? 0) > 0);
    expect(withHoles.length).toBeGreaterThanOrEqual(4);
    withHoles.forEach((item) => {
      item.drillHoles!.forEach((h) => {
        // Rasgos (groove) não têm diâmetro circular — excluir da verificação de diameter.
        if (h.holeSubtype !== "groove") {
          expect(h.diameter).toBeGreaterThan(0);
        }
        expect(h.depth).toBeGreaterThan(0);
        expect(["A", "B", undefined]).toContain(h.face);
      });
    });
  });

  it("frente externa usa espessura do corpo do móvel", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      boxThickness: 18,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers, { espessura: 18 });
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const front = cutlist.find((p) => p.tipo === "gaveta_frente_ext");
    expect(front?.espessura).toBe(18);
  });

  it("exporta XML de furação para peças de gaveta com drillHoles", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers, { nome: "Modulo_A" });
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const xmlFiles = buildDrillFilesForProject(cutlist, {
      projectName: "Teste",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    const drawerXml = xmlFiles.filter(
      (f) => f.partName.includes("gaveta_") || /gav_/.test(f.partName)
    );
    expect(drawerXml.length).toBeGreaterThanOrEqual(2);
    drawerXml.forEach((f) => {
      expect(f.xml).toContain("KDTPanelFormat");
      expect(f.xml).toContain("<CAD>");
    });
  });
});
