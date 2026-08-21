import { describe, expect, it } from "vitest";
import { buildPanelDrillingResult } from "../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import {
  DRAWER_SLIDES_PER_DRAWER,
  extractDrawerCutlistFromLayerItems,
  extractDrawerIndustrialBomFromLayerItems,
  isDrawerPieceTipo,
} from "../services/drawerCutlistAdapter";
import { resolveDrawerVerticalPositions, DRAWER_VERTICAL_BASE_OFFSET_MM } from "../core/drawers/drawerVerticalPosition";
import { calculateDrawerHeights } from "../core/drawers/DrawerGroup";
import {
  resolveDrawerSlideLength,
  resolveDrawerUsableDepthMm,
} from "../core/drawers/drawerSlideDepth";
import {
  buildDrawerScenario,
  buildWardrobeHjDrawerScenario,
  countDrawerPiecesByTipo,
  minimalBoxWithDrawers,
  snapshotDrawerLayer,
} from "./drawerCertificationTestHelpers";

const SLIDE_TYPES = ["Blum Tandem", "Blum Movento", "Genérica"] as const;
const CLEARANCE_VALUES = [20, 25, 30] as const;
const BOX_T = 19;
const BOX_H = 720;

describe("Certificação — regressão industrial (snapshots)", () => {
  describe.each([1, 2, 3, 4])("gavetas normais — count=%i", (drawerCount) => {
    it("gera peças, dimensões e offsets consistentes", () => {
      const { layers, group } = buildDrawerScenario({
        boxWidth: 600,
        boxHeight: BOX_H,
        boxDepth: 560,
        boxThickness: BOX_T,
        drawerCount,
      });

      expect(layers).toHaveLength(drawerCount);

      const heights = calculateDrawerHeights(drawerCount, BOX_H, "equal", undefined, {
        topPanelThicknessMm: BOX_T,
      });
      const positions = resolveDrawerVerticalPositions(
        heights,
        BOX_H,
        DRAWER_VERTICAL_BASE_OFFSET_MM,
        { floorThicknessMm: BOX_T, topPanelThicknessMm: BOX_T }
      );
      layers.forEach((layer, i) => {
        expect(layer.posY).toBe(group.drawers[i].position.y);
        expect(layer.posY).toBeCloseTo(positions[i], 0);
        expect(layer.width).toBe(596);
        expect(layer.bodyDepth).toBe(500);
        expect(layer.pullDistanceMm).toBe(500);
        expect(snapshotDrawerLayer(layer, i)).toMatchSnapshot();
      });

      const cutlist = extractDrawerCutlistFromLayerItems(layers, "MDF");
      const drawerPieces = cutlist.filter((p) => isDrawerPieceTipo(p.tipo));
      expect(drawerPieces).toHaveLength(drawerCount * 5);

      const counts = countDrawerPiecesByTipo(drawerPieces.map((p) => p.tipo));
      expect(counts.gaveta_frente_ext).toBe(drawerCount);
      expect(counts.gaveta_frente_int ?? 0).toBe(0);
      expect(counts.gaveta_lat_esq).toBe(drawerCount);
      expect(counts.gaveta_lat_dir).toBe(drawerCount);
      expect(counts.gaveta_fundo).toBe(drawerCount);
      expect(counts.gaveta_traseira).toBe(drawerCount);
    });
  });

  describe.each([1, 2])("gavetas metálicas — count=%i", (drawerCount) => {
    it("gera 4 peças de madeira + ferragens de caixa metálica", () => {
      const { layers } = buildDrawerScenario({
        boxWidth: 600,
        boxHeight: 600,
        boxDepth: 560,
        drawerCount,
        metalBoxType: "Blum Metabox",
      });

      const cutlist = extractDrawerCutlistFromLayerItems(layers, "MDF");
      const tipos = cutlist.map((p) => p.tipo);
      expect(tipos).toHaveLength(drawerCount * 4);
      expect(tipos.every((t) => t !== "gaveta_lat_esq" && t !== "gaveta_lat_dir")).toBe(true);
      expect(tipos.filter((t) => t === "gaveta_frente_int")).toHaveLength(drawerCount);
      expect(tipos.filter((t) => t === "gaveta_frente_ext")).toHaveLength(drawerCount);
      expect(tipos.filter((t) => t === "gaveta_fundo")).toHaveLength(drawerCount);
      expect(tipos.filter((t) => t === "gaveta_traseira")).toHaveLength(drawerCount);

      const bom = extractDrawerIndustrialBomFromLayerItems(layers);
      expect(bom.hardware).toHaveLength(drawerCount);
      bom.hardware.forEach((h) => {
        expect(h.slideQuantity).toBe(DRAWER_SLIDES_PER_DRAWER);
        expect(h.metalBoxType).toBe("Blum Metabox");
      });
    });
  });

  describe.each(SLIDE_TYPES)("slideType=%s", (slideType) => {
    it("propaga tipo de corrediça até cutlist metadata", () => {
      const { layers } = buildDrawerScenario({
        boxWidth: 600,
        boxHeight: 400,
        boxDepth: 560,
        drawerCount: 1,
        slideType,
      });

      const cutlist = extractDrawerCutlistFromLayerItems(layers, "MDF");
      const frontExt = cutlist.find((p) => p.tipo === "gaveta_frente_ext");
      const rules = frontExt?.metadata?.drawerRules as { slideType?: string } | undefined;
      expect(rules?.slideType).toBe(slideType);
      expect(layers[0].slideType).toBe(slideType);
    });
  });

  describe.each([
    { softClose: true, label: "ON" },
    { softClose: false, label: "OFF" },
  ])("softClose $label", ({ softClose }) => {
    it("reflete softClose na layer e metadata", () => {
      const { layers } = buildDrawerScenario({
        boxWidth: 600,
        boxHeight: 400,
        boxDepth: 560,
        drawerCount: 1,
        softClose,
      });
      expect(layers[0].softClose).toBe(softClose);
      expect(layers[0].metadata?.softClose).toBe(softClose);
    });
  });

  it("profundidades nominais diferentes por gaveta", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 2,
      drawerOverrides: [{ nominalDepthMm: 450 }, { nominalDepthMm: 500 }],
    });

    expect(layers[0].bodyDepth).toBe(450);
    expect(layers[1].bodyDepth).toBe(500);
    expect(layers[0].metadata?.nominalDepth).toBe(450);
    expect(layers[1].metadata?.nominalDepth).toBe(500);
  });

  describe.each(CLEARANCE_VALUES)("recuo corrediça %i mm", (runnerClearanceMm) => {
    it("ajusta bodyDepth conforme settings e limite interno do módulo", () => {
      const { layers } = buildDrawerScenario({
        boxWidth: 600,
        boxHeight: 400,
        boxDepth: 560,
        drawerCount: 1,
        runnerClearanceMm,
      });
      const usable = resolveDrawerUsableDepthMm(560, 19, runnerClearanceMm);
      const expectedSlide = resolveDrawerSlideLength(usable);
      expect(layers[0].bodyDepth).toBe(expectedSlide);
    });
  });

  it("módulo estreito (≤ 300 mm)", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 280,
      boxHeight: 400,
      boxDepth: 300,
      drawerCount: 1,
    });
    expect(layers[0].width).toBeLessThanOrEqual(278);
    expect(layers[0].bodyDepth).toBeGreaterThan(0);
  });

  it("módulo profundo (≥ 600 mm) com profundidade nominal explícita", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 720,
      boxDepth: 650,
      drawerCount: 1,
      drawerOverrides: [{ nominalDepthMm: 600 }],
    });
    expect(layers[0].bodyDepth).toBe(600);
    expect(layers[0].metadata?.nominalDepth).toBe(600);
  });

  it("roupeiro H/J — compartimento inferior direito", () => {
    const { layers } = buildWardrobeHjDrawerScenario();
    expect(layers).toHaveLength(3);
    expect(layers[0].posX).toBeGreaterThan(0);
    expect(layers.every((l) => l.height > 0)).toBe(true);
  });

  it("cutlist completa com furação e sem duplicar gaveta_frente legado", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 2,
    });
    const box = minimalBoxWithDrawers(layers);
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const drawerPieces = cutlist.filter((p) => isDrawerPieceTipo(p.tipo));
    expect(drawerPieces).toHaveLength(10);

    const legacyFronts = cutlist.filter(
      (p) => p.tipo === "gaveta_frente" && !String(p.id).includes("drawer")
    );
    expect(legacyFronts).toHaveLength(0);

    const lat = drawerPieces.find((p) => p.tipo === "gaveta_lat_esq");
    expect(lat?.drillHoles?.length).toBeGreaterThan(0);
    const corredicaHoles = lat?.drillHoles?.filter((h) => h.holeType === "corredica") ?? [];
    expect(corredicaHoles).toHaveLength(0);
    expect(lat?.drillHoles?.every((h) => h.diameter !== 5)).toBe(true);
    expect(lat?.drillHoles?.some((h) => h.holeType === "cavilha")).toBe(true);
  });

  it("furação europeia na lateral — apenas cavilhas + rasgo (sem Ø5)", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 600,
      boxDepth: 560,
      drawerCount: 1,
    });
    const result = buildPanelDrillingResult(
      {
        tipo: "gaveta_lat_esq",
        larguraMm: layers[0].leftSideDepth ?? layers[0].bodyDepth ?? 500,
        alturaMm: layers[0].bodyHeight ?? 200,
        espessuraMm: layers[0].sideThickness ?? 16,
        slideType: layers[0].slideType,
      },
      defaultRulesConfig
    );
    expect(result.success).toBe(true);
    const holes = result.data?.drillHoles ?? [];
    expect(holes.filter((h) => h.holeType === "corredica")).toHaveLength(0);
    expect(holes.every((h) => h.diameter !== 5)).toBe(true);
    expect(holes.filter((h) => h.holeType === "cavilha").length).toBe(4);
    expect(holes.some((h) => h.holeSubtype === "groove")).toBe(true);
    expect(
      holes
        .filter((h) => h.holeType === "cavilha")
        .map((h) => ({ x: h.x, y: h.y, face: h.face }))
    ).toMatchSnapshot();
  });
});
