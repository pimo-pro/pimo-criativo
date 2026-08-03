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

/** Dimensões de referência — cutlist largura=profundidade, altura=altura. */
const LATERAL = { largura: 521, altura: 150, espessura: 16 } as const;
const COSTA = { largura: 489, altura: 127, espessura: 16 } as const; // lat − 23
const FRENTE = { largura: 598, altura: 178, espessura: 19 } as const;

describe("Furacao estrutural de gaveta (TechnicalDrillHole) — SSOT cx gav lat", () => {
  it("lateral — 4 cavilhas TypeNo2 + grelha Ø5; sem rasgos", () => {
    const holes = computeDrawerLateralStructuralHoles({
      ...LATERAL,
      side: "esq",
    });

    expect(holes).toHaveLength(19);

    const cavilhas = holes.filter((h) => h.tipo === "cavilha");
    expect(cavilhas).toHaveLength(4);
    expect(cavilhas.every((h) => h.diametro === 10 && h.profundidade === 30)).toBe(true);
    expect(cavilhas.map((h) => h.y).sort((a, b) => a - b)).toEqual([
      60,
      60,
      LATERAL.largura - 60,
      LATERAL.largura - 60,
    ]);
    expect([...new Set(cavilhas.map((h) => h.x))].sort((a, b) => a - b)).toEqual([
      0,
      LATERAL.altura,
    ]);

    expect(holes.filter((h) => h.tipo === "corredica")).toHaveLength(15);
    expect(holes.filter((h) => h.holeSubtype === "groove")).toHaveLength(0);
  });

  it("lateral esq — cavilhas em X=0 e X=L", () => {
    const holes = computeDrawerLateralStructuralHoles({
      ...LATERAL,
      side: "esq",
    });
    const edge = holes.filter((h) => h.tipo === "cavilha");
    expect([...new Set(edge.map((h) => h.x))].sort((a, b) => a - b)).toEqual([0, LATERAL.altura]);
  });

  it("lateral dir — mesmas cavilhas; grelha X sem espelho", () => {
    const holes = computeDrawerLateralStructuralHoles({
      ...LATERAL,
      side: "dir",
    });

    expect(holes).toHaveLength(19);
    const edge = holes.filter((h) => h.tipo === "cavilha");
    expect(edge).toHaveLength(4);
    expect(edge.every((h) => h.profundidade === 30)).toBe(true);
    expect(holes.filter((h) => h.tipo === "corredica").some((h) => h.x === 41)).toBe(true);
  });

  it("lateral esq/dir — cavilhas Y iguais; grelha X espelhada", () => {
    const esq = computeDrawerLateralStructuralHoles({ ...LATERAL, side: "esq" });
    const dir = computeDrawerLateralStructuralHoles({ ...LATERAL, side: "dir" });
    expect(
      esq
        .filter((h) => h.tipo === "cavilha")
        .map((h) => h.y)
        .sort((a, b) => a - b)
    ).toEqual(
      dir
        .filter((h) => h.tipo === "cavilha")
        .map((h) => h.y)
        .sort((a, b) => a - b)
    );
    const esqX = [
      ...new Set(esq.filter((h) => h.tipo === "corredica").map((h) => h.x)),
    ].sort((a, b) => a - b);
    const dirX = [
      ...new Set(dir.filter((h) => h.tipo === "corredica").map((h) => h.x)),
    ].sort((a, b) => a - b);
    const L = LATERAL.altura;
    expect(esqX).toEqual(dirX.map((x) => Number((L - x).toFixed(2))).sort((a, b) => a - b));
  });

  it("costa — Y=15/H-15 Depth 30; altura costa = lat − 23", () => {
    const sideH = 150;
    const costaH = sideH - 23;
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
    expect([...new Set(cavilhas.map((h) => h.y))].sort((a, b) => a - b)).toEqual([15, 112]);
  });

  it("frente interna — 4 cavilhas face prof.13 (Y=15 / H-35)", () => {
    const holes = computeDrawerFrenteIntStructuralHoles(FRENTE);
    expect(holes).toHaveLength(4);
    expect(holes.every((h) => h.tipo === "cavilha" && h.profundidade === 13)).toBe(true);
    expect([...new Set(holes.map((h) => h.y))].sort((a, b) => a - b)).toEqual([15, 143]);
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
    expect(lat.filter((h) => h.tipo === "cavilha")).toHaveLength(4);
    expect(lat.filter((h) => h.holeSubtype === "groove")).toHaveLength(0);
    expect(lat.filter((h) => h.tipo === "corredica")).toHaveLength(15);
    expect(lat.filter((h) => h.diametro === 5)).toHaveLength(15);

    const costa = calculateTechnicalDrillingsForPiece(
      {
        tipo: "gaveta_traseira",
        largura: COSTA.largura,
        altura: COSTA.altura,
        espessura: COSTA.espessura,
      },
      defaultRulesConfig
    );
    expect(costa.length).toBeGreaterThanOrEqual(6);
    expect(costa.filter((h) => h.tipo === "cavilha")).toHaveLength(4);
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
    expect(frente.some((h) => h.holeSubtype === "groove")).toBe(false);
  });

  it("adapter — grelha Ø5 propagada; sem rasgos", () => {
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
    expect(result.data?.drillHoles.filter((h) => h.holeSubtype === "groove") ?? []).toHaveLength(0);
    expect(result.data?.drillHoles.filter((h) => h.diameter === 5) ?? []).toHaveLength(15);
  });

  it("XML — laterais sem TypeNo3; frente_ext mantém rasgo", () => {
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
    expect(lateralXml?.xml).not.toContain("<TypeNo>3</TypeNo>");
    expect(lateralXml?.xml).toContain("<Diameter>5.00</Diameter>");
    expect(lateralXml?.xml).toContain("<Y1>60.00</Y1>");
    expect(costaXml?.xml).not.toContain("<TypeNo>3</TypeNo>");
    expect((costaXml?.xml.match(/<TypeNo>2<\/TypeNo>/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(frenteExtXml).toBeDefined();
    expect(frenteExtXml?.machineTarget).toBe("drill");
    expect(frenteExtXml?.xml).toContain("<TypeNo>3</TypeNo>");
    expect(frenteExtXml?.filenameBase).toMatch(/_DRILL$/);
  });
});
