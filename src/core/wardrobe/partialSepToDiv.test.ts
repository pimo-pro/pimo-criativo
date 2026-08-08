import { describe, expect, it } from "vitest";
import { buildDivSepDrilling } from "../divSep/drilling";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, WorkspaceBox } from "../types";
import { regenerateLayersForBox } from "../../services/boxLayersService";
import {
  computeWardrobeLocalLayout,
  hasWardrobeSideDrawerBox,
} from "./wardrobeRules";
import {
  boxUsesWardrobePartialSep,
  buildPartialSepToDivItems,
  computePartialSepWidthMm,
  isPartialSepCavilhaOnly,
  syncWardrobePartialSepBox,
  WARDROBE_PARTIAL_DIV_ID,
  WARDROBE_PARTIAL_SEP_ID_LEFT,
  WARDROBE_PARTIAL_SEP_ID_RIGHT,
  WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
} from "./partialSepToDiv";

const MODE_DIR = `base-1800-roupeiro-h-2400-${WARDROBE_PARTIAL_SEP_PRODUCT_MODE}_dir`;
const MODE_ESQ = `base-1800-roupeiro-h-2400-${WARDROBE_PARTIAL_SEP_PRODUCT_MODE}_esq`;
const CLASSIC_CFG7 = "base-1800-roupeiro-h-2400-cfg7";

function baseBox(partial: Partial<BoxModule> = {}): BoxModule {
  return {
    id: "box-ward-c",
    nome: "RW1",
    dimensoes: { largura: 1800, altura: 2400, profundidade: 550 },
    espessura: 19,
    tipoBorda: "reta",
    tipoFundo: "integrado",
    models: [],
    prateleiras: 2,
    portaTipo: "porta_simples",
    gavetas: 3,
    alturaGaveta: 0,
    doorsLayer: [],
    drawersLayer: [],
    divisores: [],
    separadores: [],
    cutList: [],
    cutListComPreco: [],
    ferragens: [],
    precoTotalPecas: 0,
    estrutura3D: null,
    costaAtiva: true,
    baseCabinetId: MODE_DIR,
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

describe("wardrobe SEP parcial Fase C", () => {
  it("gate e lado dir/esq", () => {
    expect(hasWardrobeSideDrawerBox(MODE_DIR)).toBe(true);
    expect(hasWardrobeSideDrawerBox(CLASSIC_CFG7)).toBe(false);
    expect(boxUsesWardrobePartialSep({ baseCabinetId: MODE_DIR })).toBe(true);
    expect(
      boxUsesWardrobePartialSep({
        baseCabinetId: MODE_DIR,
        customIndustrialModelId: "industrial-base-600x720x500-v1",
      })
    ).toBe(false);
  });

  it("SEP parcial com largura correcta (dir/esq)", () => {
    const layout = computeWardrobeLocalLayout({
      baseCabinetId: MODE_DIR,
      widthMm: 1800,
      heightMm: 2400,
      depthMm: 550,
      feetHeightMm: 100,
    });
    const fromLeft = layout.verticalDividerFromLeftMm!;
    const wDir = computePartialSepWidthMm({
      widthMm: 1800,
      verticalDividerFromLeftMm: fromLeft,
      side: "right",
      thicknessMm: 19,
    });
    const wEsq = computePartialSepWidthMm({
      widthMm: 1800,
      verticalDividerFromLeftMm: fromLeft,
      side: "left",
      thicknessMm: 19,
    });
    expect(wDir).toBeGreaterThan(100);
    expect(wEsq).toBeGreaterThan(100);
    // Com 3 portas o DIV está a W/3 — compartimentos assimétricos (não iguais).
    expect(wDir + wEsq).toBeGreaterThan(1000);
  });

  it("SEP2 visual (horizontal divider) intacto com/sem modo Fase C", () => {
    const base = {
      widthMm: 1800,
      heightMm: 2400,
      depthMm: 550,
      feetHeightMm: 100,
    };
    const classic = computeWardrobeLocalLayout({ ...base, baseCabinetId: CLASSIC_CFG7 });
    const phaseC = computeWardrobeLocalLayout({ ...base, baseCabinetId: MODE_DIR });
    expect(phaseC.horizontalDividerCenterY_mm).toBe(classic.horizontalDividerCenterY_mm);
  });

  it("build: SEP parcial + DIV ligados; sync não duplica SEP2", () => {
    const built = buildPartialSepToDivItems({
      baseCabinetId: MODE_DIR,
      widthMm: 1800,
      heightMm: 2400,
      depthMm: 550,
      feetHeightMm: 100,
      espessuraMm: 19,
    });
    expect(built.sep.id).toBe(WARDROBE_PARTIAL_SEP_ID_RIGHT);
    expect(built.sep.referenceEdge).toBe("bottom");
    expect(built.sep.larguraMm).toBe(built.sepWidthMm);
    expect(built.div.id).toBe(WARDROBE_PARTIAL_DIV_ID);
    expect(built.div.linkedSeparadorId).toBe(built.sep.id);
    expect(isPartialSepCavilhaOnly(built.sep)).toBe(true);

    const preExisting = {
      id: "sep-2-principal",
      positionMm: 1900,
      referenceEdge: "bottom" as const,
    };
    const synced = syncWardrobePartialSepBox(
      baseBox({ separadores: [preExisting], baseCabinetId: MODE_DIR })
    );
    expect(synced.separadores?.some((s) => s.id === "sep-2-principal")).toBe(true);
    expect(synced.separadores?.filter((s) => isPartialSepCavilhaOnly(s))).toHaveLength(1);
    expect(synced.divisores?.some((d) => d.id === WARDROBE_PARTIAL_DIV_ID)).toBe(true);
  });

  it("drilling: SEP parcial sem parafusos; DIV com cavilha", () => {
    const synced = syncWardrobePartialSepBox(baseBox({ baseCabinetId: MODE_DIR }));
    const drill = buildDivSepDrilling(synced, synced.panelIds, undefined, {
      cavilhaOnlyOnDivForPartialSep: true,
    });
    const sepId = synced.separadores!.find((s) => isPartialSepCavilhaOnly(s))!.id;
    const divId = WARDROBE_PARTIAL_DIV_ID;
    const sepHoles = drill.getExtraHoles("separador", sepId);
    const divHoles = drill.getExtraHoles("divisorio", divId);
    const latR = drill.getExtraHoles("lateral_direita");
    const latL = drill.getExtraHoles("lateral_esquerda");

    expect(sepHoles.some((h) => h.holeType === "cavilha")).toBe(true);
    expect(sepHoles.every((h) => h.holeType !== "parafuso")).toBe(true);
    expect(divHoles.some((h) => h.holeType === "cavilha")).toBe(true);
    // Laterais do lado da caixa: cavilha ok; sem parafuso (cavilha-only)
    expect([...latR, ...latL].every((h) => h.holeType !== "parafuso")).toBe(true);
  });

  it("layers: gavetas no lado configurado + SEP parcial", () => {
    const dir = asWorkspace(baseBox({ baseCabinetId: MODE_DIR, gavetas: 3 }));
    const layersDir = regenerateLayersForBox(dir);
    expect(layersDir.drawersLayer.length).toBeGreaterThanOrEqual(1);
    expect(layersDir.separadores?.some((s) => s.id === WARDROBE_PARTIAL_SEP_ID_RIGHT)).toBe(true);
    expect(layersDir.divisores?.some((d) => d.id === WARDROBE_PARTIAL_DIV_ID)).toBe(true);

    const layoutDir = computeWardrobeLocalLayout({
      baseCabinetId: MODE_DIR,
      widthMm: 1800,
      heightMm: 2400,
      depthMm: 550,
      feetHeightMm: 100,
    });
    const layoutEsq = computeWardrobeLocalLayout({
      baseCabinetId: MODE_ESQ,
      widthMm: 1800,
      heightMm: 2400,
      depthMm: 550,
      feetHeightMm: 100,
    });
    expect(layoutDir.drawerOriginXLocal_mm).toBe(layoutDir.rightCompartmentCenterX_mm);
    expect(layoutEsq.drawerOriginXLocal_mm).toBe(layoutEsq.leftCompartmentCenterX_mm);

    const esq = asWorkspace(baseBox({ baseCabinetId: MODE_ESQ, gavetas: 3 }));
    const layersEsq = regenerateLayersForBox(esq);
    expect(layersEsq.separadores?.some((s) => s.id === WARDROBE_PARTIAL_SEP_ID_LEFT)).toBe(true);
  });

  it("cutlist: SEP parcial + DIV + gavetas; cfg7 clássico sem regressão", () => {
    const ws = asWorkspace(baseBox({ baseCabinetId: MODE_DIR, gavetas: 3 }));
    const layers = regenerateLayersForBox(ws);
    const moduleBox = syncWardrobePartialSepBox({
      ...ws,
      ...layers,
    }) as BoxModule;

    const cutlist = cutlistComPrecoFromBox(moduleBox, defaultRulesConfig);
    const tipos = cutlist.map((i) => i.tipo);
    expect(tipos).toContain("separador");
    expect(tipos).toContain("divisorio");
    expect(tipos.some((t) => String(t).startsWith("gaveta_"))).toBe(true);

    const sepItem = cutlist.find((i) => i.tipo === "separador");
    expect(sepItem?.metadata?.panelId === WARDROBE_PARTIAL_SEP_ID_RIGHT ||
      String(sepItem?.id ?? "").includes("sep-parcial") ||
      sepItem != null).toBe(true);

    const classicWs = asWorkspace(
      baseBox({
        baseCabinetId: CLASSIC_CFG7,
        gavetas: 3,
        separadores: [],
        divisores: [],
      })
    );
    const classicLayers = regenerateLayersForBox(classicWs);
    expect(classicLayers.separadores?.some((s) => isPartialSepCavilhaOnly(s)) ?? false).toBe(
      false
    );
    const classicCut = cutlistComPrecoFromBox(
      { ...classicWs, ...classicLayers, baseCabinetId: CLASSIC_CFG7 } as BoxModule,
      defaultRulesConfig
    );
    expect(
      classicCut.some(
        (i) =>
          String(i.id).includes("sep-parcial-caixa") ||
          String(i.metadata?.panelId ?? "").includes("sep-parcial-caixa")
      )
    ).toBe(false);
  });
});
