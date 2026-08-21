/**
 * P3.13 — Validação industrial completa do gaveteiro.
 * Orientação XML · cavilhas laterais · stack · dimensões dinâmicas · trilho LAT.
 */
import { describe, expect, it } from "vitest";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { buildDrillStationXmlFilesForProject } from "../core/drill/drillExport";
import { DRAWER_FRONT_LATERAL_GAP_MM } from "../core/drawers/drawerGeometryConstants";
import {
  resolveDrawerBodyElevationForStackRoleMm,
  resolveDrawerFrontStackGeometry,
  resolveDrawerStackRole,
} from "../core/drawers/drawerStackPosition";
import { MODULE_SLIDE_EDGE_SETBACK_MM } from "../core/drawers/drilling/drawerSlideDrillingCatalog";
import {
  buildEuropeanModuleLateralCorredicaDrilling,
  resolveEuropeanModuleRunnerLinesYMm,
} from "../core/drawers/drilling/DrawerDrillingRules";
import { DRAWER_LOWEST_LAT_EDGE_DOWEL_Y_FROM_BOTTOM_MM } from "../core/drawers/drilling/drawerDowelInterlock";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "./drawerCertificationTestHelpers";

describe("P3.13 — gaveteiro industrial completo", () => {
  const boxW = 600;
  const boxH = 900;
  const boxD = 560;
  const T = 19;

  function buildEqualStack() {
    const { layers, group } = buildDrawerScenario({
      boxWidth: boxW,
      boxHeight: boxH,
      boxDepth: boxD,
      boxThickness: T,
      drawerCount: 3,
    });
    const box = minimalBoxWithDrawers(layers, {
      dimensoes: { largura: boxW, altura: boxH, profundidade: boxD },
      espessura: T,
    });
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    return { layers, group, box, cutlist };
  }

  it("1) GAV_FRENTE_EXT_01 — XML com datum BL; padrão relativo idêntico a 02/03", () => {
    const { cutlist, box } = buildEqualStack();
    const fronts = cutlist
      .filter((p) => p.tipo === "gaveta_frente_ext")
      .sort(
        (a, b) =>
          (Number(a.metadata?.drawerIndex) || 0) - (Number(b.metadata?.drawerIndex) || 0)
      );
    expect(fronts).toHaveLength(3);

    const relativePatterns = fronts.map((f) => {
      const rules = f.metadata?.drawerRules as { sideBaseElevationMm?: number } | undefined;
      const elev =
        rules?.sideBaseElevationMm ??
        resolveDrawerBodyElevationForStackRoleMm(
          (f.metadata?.drawerRules as { stackRole?: string })?.stackRole === "lowest"
            ? "lowest"
            : "middle",
          T
        );
      const cav = (f.drillHoles ?? [])
        .filter((h) => h.holeType === "cavilha")
        .map((h) => ({ x: h.x, yRel: +(h.y - elev).toFixed(3) }))
        .sort((a, b) => a.yRel - b.yRel || a.x - b.x);
      const groove = f.drillHoles?.find((h) => h.holeSubtype === "groove");
      return {
        cav,
        grooveRel: groove ? +(groove.y - elev).toFixed(3) : null,
        elev,
      };
    });

    // Corpo-relativo: 02 ≡ 03 (mesmo delta upper); 01 usa delta lowest (sideH menor).
    expect(relativePatterns[1]!.cav.map((c) => c.yRel)).toEqual(
      relativePatterns[2]!.cav.map((c) => c.yRel)
    );
    expect(relativePatterns[1]!.grooveRel).toBe(relativePatterns[2]!.grooveRel);
    expect(relativePatterns[0]!.elev).toBe(16.5);
    expect(relativePatterns[1]!.elev).toBe(48);
    // Upper yRel = sideH−35 → GAV1 < GAV2 (delta lowest maior).
    const yUpper0 = Math.max(...relativePatterns[0]!.cav.map((c) => c.yRel));
    const yUpper1 = Math.max(...relativePatterns[1]!.cav.map((c) => c.yRel));
    expect(yUpper0).toBeLessThan(yUpper1);
    expect(Math.min(...relativePatterns[0]!.cav.map((c) => c.yRel))).toBe(
      DRAWER_LOWEST_LAT_EDGE_DOWEL_Y_FROM_BOTTOM_MM
    );

    const drill = buildDrillStationXmlFilesForProject(cutlist, {
      projectName: "P313_ORIENT",
      boxes: [box],
      rules: defaultRulesConfig,
    });
    const xml01 = drill.find(
      (f) => f.partName.includes("gav_frent") && f.partName.includes("_01") && f.machineTarget === "drill"
    );
    expect(xml01?.xml).toBeDefined();
    expect(xml01!.xml).toMatch(/pimo:stackRole=lowest;orient=BL;face=tras/);
    // P3.15 — meta completo: elev= e sideH= sempre presentes.
    expect(xml01!.xml).toMatch(/elev=\d+\.\d/);
    expect(xml01!.xml).toMatch(/sideH=\d+\.\d/);
    // Sem rasgo legado 53 mm nem cavilha em elev+0.
    expect(xml01!.xml).not.toContain("<BeginY>53.00</BeginY>");
  });

  it("2) GAV_LAT_DIR/ESQ_01 — cavilha de aresta inferior Y=54 presente", () => {
    const { cutlist } = buildEqualStack();
    for (const tipo of ["gaveta_lat_esq", "gaveta_lat_dir"] as const) {
      const lat01 = cutlist
        .filter((p) => p.tipo === tipo)
        .sort(
          (a, b) =>
            (Number(a.metadata?.drawerIndex) || 0) - (Number(b.metadata?.drawerIndex) || 0)
        )[0];
      expect(lat01).toBeDefined();
      const edgeYs = (lat01!.drillHoles ?? [])
        .filter((h) => h.holeType === "cavilha" && h.topDrillable !== true)
        .map((h) => h.y)
        .sort((a, b) => a - b);
      expect(edgeYs[0]).toBeCloseTo(DRAWER_LOWEST_LAT_EDGE_DOWEL_Y_FROM_BOTTOM_MM, 5);
      expect(edgeYs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("3) Stack — lowest cobre base; highest cobre topo; middle neutro; folga frente ±2 mm", () => {
    const { layers, group } = buildEqualStack();
    const heights = group.drawers.map((d) => d.specs.frontExt.height);
    const boxInternalH = group.boxDimensions.height;
    for (let i = 0; i < layers.length; i++) {
      const geo = resolveDrawerFrontStackGeometry({
        drawerIndex0Based: i,
        drawerHeights: heights,
        boxInternalHeightMm: boxInternalH,
        posYMm: layers[i]!.posY ?? 0,
      });
      const role = resolveDrawerStackRole(i, layers.length);
      expect(geo.role).toBe(role);
      if (role === "lowest") expect(geo.flushToModuleBase).toBe(true);
      if (role === "highest") expect(geo.flushToModuleTop).toBe(true);
      if (role === "middle") {
        expect(geo.flushToModuleBase).toBe(false);
        expect(geo.flushToModuleTop).toBe(false);
      }
    }
    const fronts = cutlistComPrecoFromBox(
      minimalBoxWithDrawers(layers, {
        dimensoes: { largura: boxW, altura: boxH, profundidade: boxD },
        espessura: T,
      }),
      defaultRulesConfig
    ).filter((p) => p.tipo === "gaveta_frente_ext");
    for (const f of fronts) {
      expect(f.dimensoes.largura).toBeCloseTo(boxW - 2 * DRAWER_FRONT_LATERAL_GAP_MM, 5);
    }
  });

  it("4) Corpos — 2ª≡3ª (delta upper); 1ª mais baixa (delta lowest); elev 16,5/48/48", () => {
    const { cutlist } = buildEqualStack();
    const byTipo = (tipo: string) =>
      cutlist
        .filter((p) => p.tipo === tipo)
        .sort(
          (a, b) =>
            (Number(a.metadata?.drawerIndex) || 0) - (Number(b.metadata?.drawerIndex) || 0)
        );

    for (const tipo of ["gaveta_lat_esq", "gaveta_lat_dir", "gaveta_traseira"]) {
      const pieces = byTipo(tipo);
      expect(pieces.length).toBe(3);
      // 2ª ≡ 3ª
      expect(pieces[1]!.dimensoes.altura).toBeCloseTo(pieces[2]!.dimensoes.altura, 5);
      // 1ª mais baixa
      expect(pieces[0]!.dimensoes.altura).toBeLessThan(pieces[1]!.dimensoes.altura);
      expect(pieces[1]!.dimensoes.largura).toBeCloseTo(pieces[0]!.dimensoes.largura, 5);
    }
    // Fundo: mesmas L×P (não depende do delta de altura)
    const fundos = byTipo("gaveta_fundo");
    expect(fundos[0]!.dimensoes.largura).toBeCloseTo(fundos[1]!.dimensoes.largura, 5);
    expect(fundos[0]!.dimensoes.altura).toBeCloseTo(fundos[1]!.dimensoes.altura, 5);

    const elevs = byTipo("gaveta_frente_ext").map((f) => {
      const r = f.metadata?.drawerRules as { sideBaseElevationMm?: number; stackRole?: string };
      return (
        r?.sideBaseElevationMm ??
        resolveDrawerBodyElevationForStackRoleMm(
          (r?.stackRole as "lowest" | "middle" | "highest") || "middle",
          T
        )
      );
    });
    expect(elevs[0]).toBeCloseTo(16.5, 5);
    expect(elevs[1]).toBeCloseTo(48, 5);
    expect(elevs[2]).toBeCloseTo(48, 5);
  });

  it("5) Dimensões dinâmicas — largura corpo / frente / profundidade vs caixa + trilho", () => {
    const { group } = buildEqualStack();
    const specs0 = group.drawers[0]!.specs;
    const internalW = boxW - 2 * T;
    expect(specs0.frontExt.width).toBeCloseTo(boxW - 2 * DRAWER_FRONT_LATERAL_GAP_MM, 5);
    expect(specs0.body.width).toBeLessThan(internalW);
    expect(specs0.body.width).toBeGreaterThan(internalW - 40);
    expect(specs0.nominalDepthMm).toBeGreaterThan(0);
    expect(specs0.nominalDepthMm).toBeLessThanOrEqual(boxD);
    expect(specs0.leftSide.height).toBeCloseTo(specs0.rightSide.height, 5);
  });

  it("6) Furação trilho no LAT do módulo — Y por gaveta; setback 38; espelho L/R", () => {
    const { layers, box, cutlist } = buildEqualStack();
    const latEsq = cutlist.find((p) => p.tipo === "lateral_esquerda");
    const latDir = cutlist.find((p) => p.tipo === "lateral_direita");
    expect(latEsq).toBeDefined();
    expect(latDir).toBeDefined();

    const corEsq = (latEsq!.drillHoles ?? []).filter((h) => h.holeType === "corredica");
    const corDir = (latDir!.drillHoles ?? []).filter((h) => h.holeType === "corredica");
    expect(corEsq.length).toBeGreaterThanOrEqual(3);
    expect(corDir.length).toBe(corEsq.length);

    const panelH = latEsq!.dimensoes.altura;
    const panelD = latEsq!.dimensoes.largura;
    const lines = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: boxH,
      drawers: [...layers]
        .sort((a, b) => (a.posY ?? 0) - (b.posY ?? 0))
        .map((d) => ({
          posYMm: Number(d.posY) || 0,
          frontHeightMm: Number(d.height) || 0,
        })),
    });
    expect(lines.length).toBe(3);
    // Linhas sobem no painel (Y topo→baixo diminui ⇒ fromBottom aumenta).
    const fromBottom = lines.map((y) => panelH - y);
    expect(fromBottom[0]).toBeLessThan(fromBottom[1]!);
    expect(fromBottom[1]).toBeLessThan(fromBottom[2]!);
    expect(fromBottom[0]).toBeGreaterThanOrEqual(41 - 0.05);

    const built = buildEuropeanModuleLateralCorredicaDrilling({
      runnerLinesYMm: lines,
      panelDepthMm: panelD,
      panelHeightMm: panelH,
      side: "right",
      slideType: layers[0]?.slideType,
      slideLengthMm: 500,
    });
    expect(built.some((h) => Math.abs(h.x - MODULE_SLIDE_EDGE_SETBACK_MM) < 0.05)).toBe(true);

    // Espelho: X esquerdo + X direito ≈ profundidade do painel.
    const xEsq = [...new Set(corEsq.map((h) => +h.x.toFixed(2)))].sort((a, b) => a - b);
    const xDir = [...new Set(corDir.map((h) => +h.x.toFixed(2)))].sort((a, b) => a - b);
    expect(xEsq.length).toBe(xDir.length);
    for (let i = 0; i < xEsq.length; i++) {
      expect(xEsq[i]! + xDir[xDir.length - 1 - i]!).toBeCloseTo(panelD, 1);
    }

    void box;
  });
});
