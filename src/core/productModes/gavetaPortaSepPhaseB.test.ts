import { describe, expect, it } from "vitest";
import { resolveDoorIndustrialLabel } from "../doors/doorLabels";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, WorkspaceBox } from "../types";
import { regenerateLayersForBox } from "../../services/boxLayersService";
import {
  assertDoorStartsAtSepMid,
  assertFrontCoversDrawerZone,
  assertFrontOverlaysFundo,
  boxUsesGavetaPortaSep,
  computeGavetaPortaSepLayout,
  GAVETA_PORTA_SEP_FRONT_GAP_MM,
  GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
  GAVETA_PORTA_SEP_SEP_ID,
  syncGavetaPortaSepBox,
} from "./gavetaPortaSepLayout";

function baseBox(partial: Partial<BoxModule> = {}): BoxModule {
  return {
    id: "box-gps",
    nome: "GPS1",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    tipoBorda: "reta",
    tipoFundo: "integrado",
    models: [],
    prateleiras: 2,
    portaTipo: "porta_simples",
    gavetas: 1,
    alturaGaveta: 180,
    doorsLayer: [],
    drawersLayer: [],
    divisores: [],
    separadores: [],
    cutList: [],
    cutListComPreco: [],
    ferragens: [],
    precoTotalPecas: 0,
    estrutura3D: null,
    baseCabinetId: GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
    ...partial,
  } as BoxModule;
}

function asWorkspace(box: BoxModule): WorkspaceBox {
  return {
    ...box,
    posicaoX_mm: 0,
    posicaoY_mm: 0,
    rotacaoY_90: false,
  } as WorkspaceBox;
}

describe("gaveta_porta_sep_prateleiras Fase B", () => {
  it("gate: só product mode; nunca industrial-*/custom-model-*", () => {
    expect(boxUsesGavetaPortaSep({ baseCabinetId: GAVETA_PORTA_SEP_PRODUCT_MODE_ID })).toBe(true);
    expect(boxUsesGavetaPortaSep({ baseCabinetId: "base-600-1porta" })).toBe(false);
    expect(
      boxUsesGavetaPortaSep({
        baseCabinetId: GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
        customIndustrialModelId: "industrial-base-600x720x500-v1",
      })
    ).toBe(false);
  });

  it("layout: frente = zona − 2×folga; porta no meio do SEP", () => {
    const box = baseBox();
    const layout = computeGavetaPortaSepLayout(box);
    // T=19, zona=180, gap=2 → frente 176; base = T+gap = 21; topo = T+zona−gap = 197
    expect(layout.drawerFrontWidthMm).toBe(600 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(layout.drawerFrontHeightMm).toBe(176);
    expect(layout.drawerFrontBottomAbsMm).toBe(19 + GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(layout.drawerFrontTopAbsMm).toBe(19 + 180 - GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(layout.drawerFrontBottomFromFloorTopMm).toBe(GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(layout.drawerBodyElevationFromFrontMm).toBe(16.5);
    expect(layout.drawerPosition).toBe("bottom");
    expect(layout.doorWidthMm).toBe(600 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(assertFrontCoversDrawerZone(layout)).toBe(true);
    expect(assertFrontOverlaysFundo(layout)).toBe(true);

    const door = {
      height: layout.doorHeightMm,
      posY: layout.doorPosYMm,
    };
    expect(assertDoorStartsAtSepMid(door, layout)).toBe(true);
  });

  it("sync injecta SEP intermédio na posição correcta", () => {
    const synced = syncGavetaPortaSepBox(baseBox({ separadores: [] }));
    const layout = computeGavetaPortaSepLayout(synced);
    expect(synced.separadores?.[0]?.id).toBe(GAVETA_PORTA_SEP_SEP_ID);
    expect(synced.separadores?.[0]?.positionMm).toBe(layout.sepPositionMm);
    expect(synced.separadores?.[0]?.referenceEdge).toBe("bottom");
  });

  it("layers: 1 gaveta + porta parcial + SEP; label porta port_cima", () => {
    const box = asWorkspace(baseBox());
    const layers = regenerateLayersForBox(box);
    expect(layers.drawersLayer).toHaveLength(1);
    expect(layers.doorsLayer).toHaveLength(1);
    expect(layers.separadores?.[0]?.id).toBe(GAVETA_PORTA_SEP_SEP_ID);

    const layout = computeGavetaPortaSepLayout(box);
    const door = layers.doorsLayer[0]!;
    expect(door.height).toBeCloseTo(layout.doorHeightMm, 5);
    expect(door.width).toBeCloseTo(layout.doorWidthMm, 5);
    expect(assertDoorStartsAtSepMid(door, layout)).toBe(true);
    expect(resolveDoorIndustrialLabel(door, 0, layers.doorsLayer)).toBe("port_cima");

    const drawer = layers.drawersLayer[0]!;
    expect(drawer.width).toBeCloseTo(layout.drawerFrontWidthMm, 5);
    expect(drawer.height).toBeCloseTo(layout.drawerFrontHeightMm, 5);
  });

  it("layers Fase 4: posY = centro frente embutida; elevação GPS; clássico intacto", () => {
    const box = asWorkspace(baseBox());
    const layout = computeGavetaPortaSepLayout(box);
    const layers = regenerateLayersForBox(box);
    const d = layers.drawersLayer[0]!;
    expect(d.posY).toBeCloseTo(layout.drawerFrontCenterYLocalMm, 5);
    expect(d.height).toBeCloseTo(layout.drawerFrontHeightMm, 5);
    expect(d.width).toBeCloseTo(layout.drawerFrontWidthMm, 5);
    expect(d.metadata?.sideBaseElevationMm).toBeCloseTo(layout.drawerBodyElevationFromFrontMm, 5);
    expect(d.metadata?.drawerFrontBottomFromFloorTopMm).toBeCloseTo(
      layout.drawerFrontBottomFromFloorTopMm,
      5
    );
    expect(d.metadata?.gavetaPortaSep).toBe(true);

    const classicLayers = regenerateLayersForBox(
      asWorkspace(
        baseBox({
          baseCabinetId: "base-600-1porta",
          gavetas: 0,
          portaTipo: "porta_simples",
          prateleiras: 1,
          drawersLayer: [],
          doorsLayer: [],
          separadores: [],
        })
      )
    );
    expect(classicLayers.drawersLayer).toHaveLength(0);
    expect(classicLayers.doorsLayer.length).toBeGreaterThanOrEqual(1);
    expect(classicLayers.separadores).toBeUndefined();
  });

  it("cutlist: gaveta + porta parcial + SEP + prateleiras; sem regressão clássica", () => {
    const gpsBox = asWorkspace(baseBox({ costaAtiva: true }));
    const layers = regenerateLayersForBox(gpsBox);
    const moduleBox = syncGavetaPortaSepBox({
      ...gpsBox,
      ...layers,
    }) as BoxModule;
    const layout = computeGavetaPortaSepLayout(moduleBox);

    const cutlist = cutlistComPrecoFromBox(moduleBox, defaultRulesConfig);
    const tipos = cutlist.map((i) => i.tipo);

    expect(tipos.some((t) => String(t).startsWith("gaveta_"))).toBe(true);
    expect(tipos).toContain("separador");
    expect(tipos.some((t) => String(t).startsWith("porta"))).toBe(true);
    expect(tipos.filter((t) => t === "prateleira").length).toBeGreaterThanOrEqual(2);

    const frente = cutlist.find((i) => i.tipo === "gaveta_frente_ext" || i.tipo === "gaveta_frente");
    expect(frente?.dimensoes.largura).toBe(600 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(frente?.dimensoes.altura).toBe(176);
    expect(frente?.metadata?.gavetaPortaSep).toBe(true);
    expect(frente?.metadata?.sideBaseElevationMm).toBeCloseTo(layout.drawerBodyElevationFromFrontMm, 5);
    expect(frente?.metadata?.drawerFrontBottomFromFloorTopMm).toBeCloseTo(
      layout.drawerFrontBottomFromFloorTopMm,
      5
    );

    // DRILL: laterais recebem furação (corrediças) com elevação GPS no layer.
    const latEsq = cutlist.find((i) => i.tipo === "lateral_esquerda");
    const latDir = cutlist.find((i) => i.tipo === "lateral_direita");
    expect((latEsq?.drillHoles ?? []).length).toBeGreaterThan(0);
    expect((latDir?.drillHoles ?? []).length).toBeGreaterThan(0);
    expect(layers.drawersLayer[0]?.metadata?.sideBaseElevationMm).toBeCloseTo(
      layout.drawerBodyElevationFromFrontMm,
      5
    );

    const classic = cutlistComPrecoFromBox(
      baseBox({
        baseCabinetId: "base-600-1porta",
        gavetas: 0,
        portaTipo: "porta_simples",
        prateleiras: 1,
        separadores: [],
        drawersLayer: [],
      }),
      defaultRulesConfig
    );
    expect(classic.some((i) => i.metadata?.gavetaPortaSep === true)).toBe(false);
    expect(classic.some((i) => i.metadata?.portaParcial === true)).toBe(false);
    expect(classic.some((i) => i.metadata?.sideBaseElevationMm === 16.5)).toBe(false);
  });
});
