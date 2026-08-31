import { describe, expect, it, beforeEach } from "vitest";
import { buildCutListFromDesignBox, buildDrillFilesFromDesignBox } from "./designToCutlist";
import { buildViewerDrillMarkersFromDesign } from "./designToViewer";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { computeInnerCavityAabb, computePanelAabb } from "./geometryValidation";
import {
  __resetBuiltinIndustrialModelsForTests,
  isIndustrialCatalogModelId,
  listBuiltinIndustrialModelsAsBaseCabinet,
  registerBuiltinIndustrialModel,
} from "./staticIndustrialRegistry";
import {
  buildIndustrialDrawerSingle600x720x500DesignBox,
} from "./modules/industrialDrawerSingle600x720x500v1";
import {
  INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID,
  INDUSTRIAL_DRAWER_SINGLE_600_MODULE_NOME,
} from "./modules/industrialDrawerSingleConstants";
import { MODULE_SLIDE_EDGE_SETBACK_MM } from "../drawers/drilling/drawerSlideDrillingCatalog";

const project = { projectName: "TEST_DRAWER_SINGLE", boxes: [], rules: defaultRulesConfig };

const DRAWER_TIPOS = [
  "gaveta_lat_esq",
  "gaveta_lat_dir",
  "gaveta_fundo",
  "gaveta_frente_ext",
  "gaveta_frente_int",
  "gaveta_traseira",
] as const;

describe("industrial-drawer-single-600x720x500-v1", () => {
  beforeEach(() => {
    __resetBuiltinIndustrialModelsForTests();
  });

  it("constrói caixa base + gaveta com corrediças e furos estruturais", () => {
    const designBox = buildIndustrialDrawerSingle600x720x500DesignBox();
    const tipos = designBox.panels.map((p) => p.tipo);

    expect(tipos).toContain("cima");
    expect(tipos).toContain("fundo");
    expect(tipos).toContain("lateral");
    expect(tipos).toContain("costa");
    for (const t of DRAWER_TIPOS) {
      expect(tipos).toContain(t);
    }

    const lateralLe = designBox.panels.find((p) => p.id.endsWith(":lateral-le"))!;
    expect(lateralLe.drillHoles.some((h) => h.holeTypeId.startsWith("corredica"))).toBe(true);
    // Quadro V6: primeiro furo de corrediça a 38 mm da frente do painel.
    expect(
      lateralLe.drillHoles.some(
        (h) =>
          h.holeTypeId.startsWith("corredica") &&
          Math.abs(h.xMm - MODULE_SLIDE_EDGE_SETBACK_MM) < 1
      )
    ).toBe(true);
    expect(lateralLe.drillHoles.some((h) => h.holeTypeId === "cavilha_10x30")).toBe(true);

    const latGaveta = designBox.panels.find((p) => p.tipo === "gaveta_lat_esq")!;
    // Peças da gaveta não levam furação de corrediça: apenas cavilhas + rasgo inferior.
    expect(latGaveta.drillHoles.some((h) => h.holeTypeId.startsWith("corredica"))).toBe(false);
    expect(latGaveta.drillHoles.some((h) => h.holeTypeId === "cavilha_10x30")).toBe(true);

    expect(designBox.panels.reduce((s, p) => s + p.drillHoles.length, 0)).toBeGreaterThan(30);
  });

  it("model record → cutlist → TXML → viewer → catálogo gavetas (SSOT)", () => {
    const designBox = buildIndustrialDrawerSingle600x720x500DesignBox();
    const cutlist = buildCutListFromDesignBox(designBox);
    const cutlistComPreco = cutlist.map((item) => ({ ...item, precoUnitario: 0, precoTotal: 0 }));
    const liveTxml = buildDrillFilesFromDesignBox(designBox, project);
    const liveMarkers = buildViewerDrillMarkersFromDesign(designBox);

    registerBuiltinIndustrialModel({
      id: INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID,
      nome: INDUSTRIAL_DRAWER_SINGLE_600_MODULE_NOME,
      tipo: "industrial-designer",
      designWorkspace: false,
      widthMm: 600,
      heightMm: 720,
      depthMm: 500,
      designBox,
      cutlist,
      cutlistComPreco,
      drillExportFiles: liveTxml,
      viewerMarkers: liveMarkers,
      metadata: {
        designWorkspace: false,
        tipo: "industrial-designer",
        panelCount: designBox.panels.length,
        holeCount: designBox.panels.reduce((s, p) => s + p.drillHoles.length, 0),
        espessuraMm: designBox.espessuraMm,
        materialId: "mdf_branco",
        createdAt: new Date().toISOString(),
        cutlistItemCount: cutlist.length,
        txmlFileCount: liveTxml.length,
        moduleKind: "industrial-drawer-single-600x720x500",
        categoriaCatalogo: "gavetas",
        drawerCount: 1,
      },
    });

    expect(isIndustrialCatalogModelId(INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID)).toBe(true);
    expect(cutlist.length).toBeGreaterThanOrEqual(11);
    expect(liveTxml.length).toBeGreaterThan(0);
    expect(liveTxml.some((f) => f.xml.includes("Diameter>"))).toBe(true);

    const holeCount = (items: typeof cutlist) =>
      items.reduce((s, i) => s + (i.drillHoles?.length ?? 0), 0);
    expect(holeCount(cutlist)).toBeGreaterThan(20);

    const markerCount = Object.values(liveMarkers).reduce(
      (s, a) => s + (Array.isArray(a) ? a.length : 0),
      0
    );
    expect(markerCount).toBeGreaterThan(0);

    const catalog = listBuiltinIndustrialModelsAsBaseCabinet().find(
      (m) => m.id === INDUSTRIAL_DRAWER_SINGLE_600_MODULE_ID
    );
    expect(catalog?.categoria).toBe("gavetas");
    expect(catalog?.drawers).toBe(1);
    expect(catalog?.doors).toBe(0);
    expect(catalog?.subcategoriaCatalogo).toBe("gavetas-industriais");
  });

  it("validação geométrica — gaveta contida na cavidade da caixa", () => {
    const designBox = buildIndustrialDrawerSingle600x720x500DesignBox();
    const cavity = computeInnerCavityAabb(designBox);

    for (const tipo of DRAWER_TIPOS) {
      const panel = designBox.panels.find((p) => p.tipo === tipo)!;
      const aabb = computePanelAabb(designBox, panel);
      expect(aabb.min.x).toBeGreaterThanOrEqual(cavity.min.x - 1);
      expect(aabb.min.y).toBeGreaterThanOrEqual(cavity.min.y - 1);
      expect(aabb.max.x).toBeLessThanOrEqual(cavity.max.x + 1);
      expect(aabb.max.y).toBeLessThanOrEqual(cavity.max.y + 1);
    }
  });
});
