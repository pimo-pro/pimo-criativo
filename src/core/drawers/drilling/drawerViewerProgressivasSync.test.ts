/**
 * Sync Viewer ↔ SSOT Progressivas:
 * cutlist/drillMarkers devem usar drawerHeightMode do workspace
 * (mesmo sem metadata.heightMode nas layers antigas).
 */
import { describe, expect, it } from "vitest";
import { convertWorkspaceToBox } from "../../../context/projectState";
import { cutlistComPrecoFromBox } from "../../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../../rules/rulesConfig";
import { buildViewerDrillMarkersByPanel } from "../../../modules/drilling/drillingAdapter";
import {
  DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
  generateDrawerGroup,
  drawerGroupToLayerItems,
  resolveDrawerBodyBottomFromModuleBaseMm,
  resolveDrawerFrontStackGeometry,
} from "../index";
import {
  resolveEuropeanModuleRunnerLinesYMm,
} from "./DrawerDrillingRules";
import { settingsDefaults } from "../../settings/settingsSchema";
import type { WorkspaceBox } from "../../types";

describe("Viewer sync — Progressivas via drawerHeightMode (não pitch)", () => {
  const H = 800;
  const T = 19;
  const panelH = H - 2 * T; // 762

  function buildWsProgressivas(opts?: { stripHeightModeMeta?: boolean }) {
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 560,
      boxThickness: T,
      boxId: "viewer-sync-prog",
      drawerCount: 3,
      drawerType: "normal",
      heightMode: "top_small_mid_medium_bottom_large",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
      interiorFrontStack: true,
    });
    let layers = drawerGroupToLayerItems(group);
    if (opts?.stripHeightModeMeta) {
      layers = layers.map((l) => ({
        ...l,
        metadata: {
          ...l.metadata,
          heightMode: undefined,
        },
      }));
    }
    const ws = {
      id: "viewer-sync-prog",
      nome: "Prog",
      dimensoes: { largura: 600, altura: H, profundidade: 560 },
      espessura: T,
      prateleiras: 0,
      portaTipo: "sem_porta" as const,
      gavetas: 3,
      drawerHeightMode: "top_small_mid_medium_bottom_large" as const,
      drawersLayer: layers,
      doorsLayer: [],
      models: [],
    } as WorkspaceBox;
    return { ws, layers };
  }

  it("convertWorkspaceToBox propaga drawerHeightMode", () => {
    const { ws } = buildWsProgressivas();
    const box = convertWorkspaceToBox(ws);
    expect(box.drawerHeightMode).toBe("top_small_mid_medium_bottom_large");
  });

  it("sem metadata.heightMode — cutlist/Viewer usam box.drawerHeightMode → bodyBottom+22,5", () => {
    const { ws, layers } = buildWsProgressivas({ stripHeightModeMeta: true });
    expect(layers.every((l) => !l.metadata?.heightMode)).toBe(true);

    const box = {
      ...convertWorkspaceToBox(ws),
      drawersLayer: ws.drawersLayer,
      drawerHeightMode: ws.drawerHeightMode,
      gavetas: ws.gavetas,
    };
    const cutList = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const markers = buildViewerDrillMarkersByPanel(cutList);
    const lat = markers.lateral_esquerda ?? [];
    const corredica = lat.filter((h) => h.tipo === "corredica");
    expect(corredica.length).toBeGreaterThan(0);

    // Y únicos fromTop → fromBottom
    const yFromTopUnique = [...new Set(corredica.map((h) => h.y))].sort(
      (a, b) => b - a
    );
    // painel lateral altura = H - 2T tipicamente
    const panelItem = cutList.find((i) => i.tipo === "lateral_esquerda");
    const pH = panelItem?.altura_mm ?? panelH;
    const yGuiaViewer = yFromTopUnique.map((y) => pH - y).sort((a, b) => a - b);

    const fromTopSsot = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: pH,
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
    const yGuiaSsot = fromTopSsot.map((y) => pH - y);

    expect(yGuiaViewer).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(yGuiaViewer[i]).toBeCloseTo(yGuiaSsot[i]!, 4);
    }

    // Nunca abaixo do corpo / frente; = bodyBottom + 22,5
    const heights = layers.map((l) => l.height!);
    const offset = DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM;
    for (let i = 0; i < 3; i++) {
      const geo = resolveDrawerFrontStackGeometry({
        drawerIndex0Based: i,
        drawerHeights: heights,
        boxInternalHeightMm: H,
        posYMm: layers[i]!.posY!,
        floorThicknessMm: T,
        topPanelThicknessMm: T,
      });
      const bodyBottom = resolveDrawerBodyBottomFromModuleBaseMm({
        frontBottomFromModuleBaseMm: geo.frontBottomFromModuleBaseMm,
        sideBaseElevationMm: Number(layers[i]!.metadata?.sideBaseElevationMm),
      });
      expect(yGuiaViewer[i]).toBeCloseTo(bodyBottom + offset, 4);
      expect(yGuiaViewer[i]!).toBeGreaterThanOrEqual(bodyBottom - 1e-6);
      expect(yGuiaViewer[i]!).toBeGreaterThanOrEqual(
        geo.frontBottomFromModuleBaseMm - 1e-6
      );
    }

    expect(yGuiaViewer[0]).toBeCloseTo(41, 4);
    expect(yGuiaViewer[1]).toBeCloseTo(377.3, 4);
    expect(yGuiaViewer[2]).toBeCloseTo(682.1, 4);

    // Confirmar que NÃO é pitch
    expect(yGuiaViewer[1]).not.toBeCloseTo(288.6666666667, 0);
  });
});
