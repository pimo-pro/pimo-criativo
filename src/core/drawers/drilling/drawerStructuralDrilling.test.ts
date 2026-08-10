import { describe, expect, it } from "vitest";
import {
  computeDrawerCostaStructuralHoles,
  computeDrawerFrenteIntStructuralHoles,
  computeDrawerLateralStructuralHoles,
} from "./DrawerDrillingRules";
import { calculateTechnicalDrillingsForPiece } from "../../drilling/drillingService";
import { defaultRulesConfig } from "../../rules/rulesConfig";
import { buildPanelDrillingResult } from "../../../modules/drilling/drillingAdapter";
import { buildDrillFilesForProject } from "../../drill/drillExport";
import { cutlistComPrecoFromBox } from "../../manufacturing/cutlistFromBoxes";
import { isDrawerPieceTipo } from "../../../services/drawerCutlistAdapter";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "../../../validation/drawerCertificationTestHelpers";
import { DRAWER_DOWEL_EDGE_DEPTH_MM } from "./drawerDowelInterlock";

/** Dimensões de referência alinhadas com XML_COMPLITO. */
const LATERAL = { largura: 521, altura: 150, espessura: 16 } as const;
const COSTA = { largura: 489, altura: 112.5, espessura: 16 } as const; // lat × factor (25% → 0,75)
const FRENTE = { largura: 598, altura: 178, espessura: 19 } as const;

describe("Furação estrutural de gaveta (TechnicalDrillHole) — golden XML_COMPLITO", () => {
  it("lateral — 6 furos (2 face + 2 aresta + 2 rasgos)", () => {
    const holes = computeDrawerLateralStructuralHoles({
      ...LATERAL,
      side: "esq",
    });

    expect(holes).toHaveLength(6);

    const face = holes.filter((h) => h.tipo === "cavilha" && h.topDrillable);
    expect(face).toHaveLength(2);
    expect(face.every((h) => h.diametro === 10 && h.profundidade === 13 && h.face === "cima")).toBe(
      true
    );
    expect(face.every((h) => h.x === LATERAL.espessura / 2)).toBe(true);
    expect(face.map((h) => h.y).sort((a, b) => a - b)).toEqual([15, 112]); // 150−38

    const edge = holes.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    expect(edge).toHaveLength(2);
    expect(edge.every((h) => h.profundidade === DRAWER_DOWEL_EDGE_DEPTH_MM)).toBe(true);
    expect(edge.every((h) => h.x === LATERAL.largura && h.face === "tras")).toBe(true);
    expect(edge.map((h) => h.y).sort((a, b) => a - b)).toEqual([15, 115]); // 150−35

    const grooves = holes.filter((h) => h.holeSubtype === "groove");
    expect(grooves).toHaveLength(2);
    expect(grooves.map((g) => [g.y, g.grooveWidth, g.profundidade])).toEqual([
      [LATERAL.altura - 13, 13, 3],
      [LATERAL.altura - 23, 11, 10],
    ]);
  });

  it("lateral esq — aresta X=L face tras; face X=T/2", () => {
    const holes = computeDrawerLateralStructuralHoles({
      ...LATERAL,
      side: "esq",
    });
    const edge = holes.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    const face = holes.filter((h) => h.tipo === "cavilha" && h.topDrillable);
    expect(edge.every((h) => h.x === LATERAL.largura)).toBe(true);
    expect(face.every((h) => h.x === LATERAL.espessura / 2)).toBe(true);
  });

  it("lateral dir — espelho KDT (aresta X=0 face frente)", () => {
    const holes = computeDrawerLateralStructuralHoles({
      ...LATERAL,
      side: "dir",
    });

    expect(holes).toHaveLength(6);
    const edge = holes.filter((h) => h.tipo === "cavilha" && !h.topDrillable);
    expect(edge).toHaveLength(2);
    expect(edge.every((h) => h.x === 0 && h.face === "frente" && h.profundidade === 30)).toBe(true);
    expect(edge.map((h) => h.y).sort((a, b) => a - b)).toEqual([15, 115]);

    const face = holes.filter((h) => h.tipo === "cavilha" && h.topDrillable);
    expect(face.every((h) => h.x === LATERAL.largura - LATERAL.espessura / 2)).toBe(true);
  });

  it("lateral esq/dir — Y e rasgo iguais; X espelhado", () => {
    const esq = computeDrawerLateralStructuralHoles({ ...LATERAL, side: "esq" });
    const dir = computeDrawerLateralStructuralHoles({ ...LATERAL, side: "dir" });
    expect(esq.map((h) => h.y)).toEqual(dir.map((h) => h.y));
    expect(esq.filter((h) => h.holeSubtype === "groove").map((h) => h.y)).toEqual(
      dir.filter((h) => h.holeSubtype === "groove").map((h) => h.y)
    );
  });

  it("costa — Y=15/H-15 Depth 30; altura costa = lat × factor único", () => {
    const sideH = 150;
    const costaH = sideH * (1 - 25 / 100);
    expect(costaH).toBe(COSTA.altura);
    const holes = computeDrawerCostaStructuralHoles({
      largura: COSTA.largura,
      altura: costaH,
      espessura: 16,
      lateralAlturaMm: sideH,
    });
    expect(holes).toHaveLength(6);
    const cavilhas = holes.filter((h) => h.tipo === "cavilha");
    expect(cavilhas).toHaveLength(4);
    expect(cavilhas.every((h) => h.profundidade === 30 && h.diametro === 10)).toBe(true);
    expect([...new Set(cavilhas.map((h) => h.y))].sort((a, b) => a - b)).toEqual([15, 97.5]); // 112.5−15
  });

  it("frente interna — 4 cavilhas face prof.13 (Y=15 / H-35)", () => {
    const holes = computeDrawerFrenteIntStructuralHoles(FRENTE);
    expect(holes).toHaveLength(4);
    expect(holes.every((h) => h.tipo === "cavilha" && h.profundidade === 13)).toBe(true);
    expect([...new Set(holes.map((h) => h.y))].sort((a, b) => a - b)).toEqual([15, 143]); // 178−35
  });

  it("pipeline — calcDrawerStructural via calculateTechnicalDrillingsForPiece", () => {
    const lat = calculateTechnicalDrillingsForPiece(
      {
        tipo: "gaveta_lat_esq",
        largura: LATERAL.largura,
        altura: LATERAL.altura,
        espessura: LATERAL.espessura,
      },
      defaultRulesConfig
    );
    const structuralLat = lat.filter((h) => h.tipo === "fixacao_estrutural" || h.tipo === "cavilha");
    expect(structuralLat.length).toBeGreaterThanOrEqual(6);
    expect(lat.filter((h) => h.holeSubtype === "groove")).toHaveLength(2);
    expect(lat.filter((h) => h.tipo === "corredica")).toHaveLength(0);
    expect(lat.every((h) => h.diametro !== 5)).toBe(true);

    const costa = calculateTechnicalDrillingsForPiece(
      {
        tipo: "gaveta_traseira",
        largura: COSTA.largura,
        altura: COSTA.altura,
        espessura: COSTA.espessura,
      },
      defaultRulesConfig
    );
    expect(
      costa.filter((h) => h.tipo === "cavilha" || h.tipo === "fixacao_estrutural").length
    ).toBeGreaterThanOrEqual(6);
    expect(costa.filter((h) => h.tipo === "corredica")).toHaveLength(0);
    expect(costa.every((h) => h.diametro !== 5)).toBe(true);

    const frente = calculateTechnicalDrillingsForPiece(
      {
        tipo: "gaveta_frente",
        largura: FRENTE.largura,
        altura: FRENTE.altura,
        espessura: FRENTE.espessura,
      },
      defaultRulesConfig
    );
    expect(frente.filter((h) => h.tipo === "cavilha")).toHaveLength(4);
    const frenteGroove = frente.find((h) => h.holeSubtype === "groove");
    expect(frenteGroove?.profundidade).toBe(11);
    expect(frenteGroove?.grooveWidth).toBe(11);
  });

  it("adapter — grooves propagados para PanelDrillHole", () => {
    const result = buildPanelDrillingResult(
      {
        tipo: "gaveta_lat_esq",
        larguraMm: LATERAL.largura,
        alturaMm: LATERAL.altura,
        espessuraMm: LATERAL.espessura,
      },
      defaultRulesConfig
    );
    expect(result.success).toBe(true);
    const grooves = result.data?.drillHoles.filter((h) => h.holeSubtype === "groove") ?? [];
    expect(grooves).toHaveLength(2);
    expect(grooves.map((g) => [g.grooveWidth, g.depth])).toEqual([
      [13, 3],
      [11, 10],
    ]);
  });

  it("XML — rasgos estruturais exportam TypeNo=3 (schema BeginX/EndX)", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig).filter((p) =>
      isDrawerPieceTipo(p.tipo)
    );
    const xmlFiles = buildDrillFilesForProject(cutlist, {
      projectName: "Teste",
      boxes: [box],
      rules: defaultRulesConfig,
    });

    const lateralXml = xmlFiles.find(
      (f) => f.partName.includes("gav_lat") && f.machineTarget === "drill"
    );
    const costaXml = xmlFiles.find(
      (f) => f.partName.includes("gav_cost") && f.machineTarget === "drill"
    );
    const frenteExtXml = xmlFiles.find(
      (f) => f.partName.includes("gav_frent_ext") && f.machineTarget === "drill"
    );
    expect(lateralXml?.xml).toContain("<TypeNo>3</TypeNo>");
    expect(lateralXml?.xml).toContain("<BeginX>");
    expect(lateralXml?.xml).not.toContain("<X2>");
    expect(costaXml?.xml).not.toContain("<TypeNo>3</TypeNo>");
    expect((costaXml?.xml.match(/<TypeNo>2<\/TypeNo>/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(frenteExtXml).toBeDefined();
    expect(frenteExtXml?.machineTarget).toBe("drill");
    expect(frenteExtXml?.xml).toContain("<TypeNo>3</TypeNo>");
    expect(frenteExtXml?.filenameBase).toMatch(/_DRILL$/);
  });
});
