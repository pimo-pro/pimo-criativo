/**
 * Progressivas — alinhamento industrial guias ↔ corpo.
 * Y_guia = bodyBottom + 22,5 (GAV_1 → 18,5+22,5=41).
 * Datum: face superior do fundo. Furos nunca abaixo do corpo nem da frente.
 */
import { describe, expect, it } from "vitest";
import {
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
  generateDrawerGroup,
  drawerGroupToLayerItems,
  resolveDrawerBodyBottomFromModuleBaseMm,
  resolveDrawerFrontStackGeometry,
} from "../index";
import {
  DEFAULT_CORREDICA_EIXO_GAVETA1_MM,
  resolveEuropeanModuleRunnerLinesYMm,
} from "./DrawerDrillingRules";
import { settingsDefaults } from "../../settings/settingsSchema";

describe("Progressivas — Y_guia = bodyBottom + 22,5 (drilling ≡ Viewer datum)", () => {
  const H = 800;
  const panelH = 762;
  const T = 19;
  const offset = DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM;

  function buildProgressivasStack() {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 560,
      boxThickness: T,
      boxId: "prog-align",
      drawerCount: 3,
      drawerType: "normal",
      heightMode: "top_small_mid_medium_bottom_large",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const heights = layers.map((l) => l.height!);
    const floorTop = -H / 2 + T;

    const rows = layers.map((layer, i) => {
      const geo = resolveDrawerFrontStackGeometry({
        drawerIndex0Based: i,
        drawerHeights: heights,
        boxInternalHeightMm: H,
        posYMm: layer.posY!,
        floorThicknessMm: T,
        topPanelThicknessMm: T,
      });
      const elev = Number(layer.metadata?.sideBaseElevationMm);
      const bodyBottom = resolveDrawerBodyBottomFromModuleBaseMm({
        frontBottomFromModuleBaseMm: geo.frontBottomFromModuleBaseMm,
        sideBaseElevationMm: elev,
      });
      const bodyH = layer.bodyHeight!;
      const offsetY = layer.bodyCenterOffsetY!;
      const bodyBottomFromLayer =
        layer.posY! + offsetY - bodyH / 2 - floorTop;
      return {
        i,
        frontBottom: geo.frontBottomFromModuleBaseMm,
        elev,
        bodyBottom,
        bodyBottomFromLayer,
        heightMode: layer.metadata?.heightMode,
      };
    });

    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: H,
      boxExternalHeightMm: H,
      floorThicknessMm: T,
      heightMode: "top_small_mid_medium_bottom_large",
      drawers: layers.map((d) => ({
        posYMm: Number(d.posY) || 0,
        frontHeightMm: Number(d.height) || 0,
        sideBaseElevationMm:
          typeof d.metadata?.sideBaseElevationMm === "number"
            ? d.metadata.sideBaseElevationMm
            : undefined,
      })),
    });
    const yGuia = fromTop.map((y) => panelH - y);

    return { rows, yGuia, layers };
  }

  it("H=800 n=3 — bodyBottom / Y_guia / metadata Progressivas", () => {
    const { rows, yGuia } = buildProgressivasStack();

    expect(rows.every((r) => r.heightMode === "top_small_mid_medium_bottom_large")).toBe(
      true
    );

    // GAV_1 SSOT — desde face superior do fundo
    expect(rows[0]!.elev).toBe(DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM);
    expect(rows[0]!.bodyBottom).toBeCloseTo(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM, 5);
    expect(rows[0]!.bodyBottomFromLayer).toBeCloseTo(18.5, 5);
    expect(yGuia[0]).toBeCloseTo(DEFAULT_CORREDICA_EIXO_GAVETA1_MM, 5);
    expect(yGuia[0]).toBeCloseTo(rows[0]!.bodyBottom + offset, 5);

    // Todas: Y_guia = bodyBottom + 22,5; nunca abaixo do corpo nem da frente
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      expect(yGuia[i]).toBeCloseTo(r.bodyBottom + offset, 5);
      expect(yGuia[i]!).toBeGreaterThanOrEqual(r.bodyBottom - 1e-6);
      expect(yGuia[i]!).toBeGreaterThanOrEqual(r.frontBottom - 1e-6);
    }

    // H=800 T=19 interior: usable=760 → Y_guia [41, 377.3, 682.1] (floorTop)
    expect(yGuia[0]).toBeCloseTo(41, 5);
    expect(yGuia[1]).toBeCloseTo(377.3, 5);
    expect(yGuia[2]).toBeCloseTo(682.1, 5);
  });

  it("sem heightMode Progressivas (equal) — pitch inalterado", () => {
    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: H,
      boxExternalHeightMm: H,
      floorThicknessMm: T,
      heightMode: "equal",
      drawers: [
        { posYMm: -200, frontHeightMm: 260, sideBaseElevationMm: 16.5 },
        { posYMm: 0, frontHeightMm: 260, sideBaseElevationMm: 48 },
        { posYMm: 200, frontHeightMm: 260, sideBaseElevationMm: 48 },
      ],
    });
    const y = fromTop.map((v) => panelH - v);
    expect(y[0]).toBeCloseTo(41, 5);
    expect(y[1]).toBeCloseTo(288.6666666667, 5);
    expect(y[2]).toBeCloseTo(555.3333333333, 5);
  });
});
