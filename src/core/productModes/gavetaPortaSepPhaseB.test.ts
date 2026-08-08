import { describe, expect, it } from "vitest";
import { resolveDoorIndustrialLabel } from "../doors/doorLabels";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, WorkspaceBox } from "../types";
import { regenerateLayersForBox } from "../../services/boxLayersService";
import {
  assertDoorStartsAtSepMid,
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

  it("layout: porta começa no meio do SEP; folga 2 mm na frente", () => {
    const box = baseBox();
    const layout = computeGavetaPortaSepLayout(box);
    expect(layout.drawerFrontWidthMm).toBe(600 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(layout.drawerFrontHeightMm).toBe(180 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(layout.doorWidthMm).toBe(600 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);

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

  it("cutlist: gaveta + porta parcial + SEP + prateleiras; sem regressão clássica", () => {
    const gpsBox = asWorkspace(baseBox({ costaAtiva: true }));
    const layers = regenerateLayersForBox(gpsBox);
    const moduleBox = syncGavetaPortaSepBox({
      ...gpsBox,
      ...layers,
    }) as BoxModule;

    const cutlist = cutlistComPrecoFromBox(moduleBox, defaultRulesConfig);
    const tipos = cutlist.map((i) => i.tipo);

    expect(tipos.some((t) => String(t).startsWith("gaveta_"))).toBe(true);
    expect(tipos).toContain("separador");
    expect(tipos.some((t) => String(t).startsWith("porta"))).toBe(true);
    expect(tipos.filter((t) => t === "prateleira").length).toBeGreaterThanOrEqual(2);

    const frente = cutlist.find((i) => i.tipo === "gaveta_frente_ext" || i.tipo === "gaveta_frente");
    expect(frente?.dimensoes.largura).toBe(600 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);

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
  });
});
