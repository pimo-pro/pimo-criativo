import { describe, expect, it } from "vitest";
import { resolveXmlMachineTarget } from "../drill/xmlMachineRouting";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { getPieceLabel } from "../manufacturing/boxManufacturing";
import { resolveOrlaSidesForPieceTipo } from "../orla/orlaIndustrialRules";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, WorkspaceBox } from "../types";
import { CX_GAV_PRODUCT_MODE_ID } from "../cxGav/cxGavGeometry";
import {
  computeGavetaPortaSepLayout,
  GAVETA_PORTA_SEP_FRONT_GAP_MM,
  GAVETA_PORTA_SEP_NOME_INDUSTRIAL,
  GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
  syncGavetaPortaSepBox,
} from "../productModes/gavetaPortaSepLayout";
import { regenerateLayersForBox } from "../../services/boxLayersService";
import {
  WARDROBE_PARTIAL_SEP_ID_RIGHT,
  WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
} from "../wardrobe/partialSepToDiv";
import { INNER_CABINET_A1_PRODUCT_MODE } from "../innerCabinet/a1Geometry";
import { A1_COMP_TIPO } from "../innerCabinet/hingeCompensation40";
import {
  INDUSTRIAL_MODELS,
  INDUSTRIAL_ORLA_SIDES,
  resolveActiveIndustrialModels,
} from "./industrialModelsRegistry";

function baseBox(partial: Partial<BoxModule> = {}): BoxModule {
  return {
    id: "box-admin-e",
    nome: "ADM1",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    tipoBorda: "reta",
    tipoFundo: "integrado",
    models: [],
    prateleiras: 0,
    portaTipo: "sem_porta",
    gavetas: 0,
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
    ...partial,
  } as BoxModule;
}

describe("industrialAdminIntegration Fase E", () => {
  it("cx_gav: cutlist + DRILL + orla + naming via registo", () => {
    const box = baseBox({ baseCabinetId: CX_GAV_PRODUCT_MODE_ID });
    expect(resolveActiveIndustrialModels(box).map((m) => m.id)).toEqual([CX_GAV_PRODUCT_MODE_ID]);
    const items = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const cx = items.filter((i) => String(i.tipo).startsWith("cx_gav"));
    expect(cx).toHaveLength(4);
    for (const p of cx) {
      expect(resolveXmlMachineTarget(p.tipo)).toBe("drill");
      expect(resolveOrlaSidesForPieceTipo(p.tipo)).toEqual([
        ...(INDUSTRIAL_ORLA_SIDES[p.tipo] ?? []),
      ]);
    }
    expect(getPieceLabel("cx_gav_cima")).toBe("CX GAV cima");
    expect(cx.every((i) => i.metadata?.industrialLabel == null)).toBe(true);
  });

  it("gaveta_porta_sep: cutlist embutida + nome industrial; clássico intacto", () => {
    const raw = baseBox({
      baseCabinetId: GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
      dimensoes: { largura: 600, altura: 720, profundidade: 560 },
      portaTipo: "porta_simples",
      gavetas: 1,
      prateleiras: 2,
      alturaGaveta: 180,
    });
    const ws = {
      ...raw,
      posicaoX_mm: 0,
      posicaoY_mm: 0,
      rotacaoY_90: false,
    } as WorkspaceBox;
    const layers = regenerateLayersForBox(ws);
    const moduleBox = syncGavetaPortaSepBox({ ...ws, ...layers }) as BoxModule;
    const layout = computeGavetaPortaSepLayout(moduleBox);

    const gps = cutlistComPrecoFromBox(moduleBox, defaultRulesConfig);
    const frente = gps.find((i) => i.tipo === "gaveta_frente_ext" || i.tipo === "gaveta_frente");
    expect(frente?.dimensoes.altura).toBe(176);
    expect(frente?.dimensoes.largura).toBe(600 - 2 * GAVETA_PORTA_SEP_FRONT_GAP_MM);
    expect(frente?.metadata?.gavetaPortaSep).toBe(true);
    expect(frente?.metadata?.sideBaseElevationMm).toBeCloseTo(layout.drawerBodyElevationFromFrontMm, 5);
    expect(gps.some((i) => i.tipo === "separador")).toBe(true);
    expect((gps.find((i) => i.tipo === "lateral_esquerda")?.drillHoles ?? []).length).toBeGreaterThan(0);

    const mode = resolveActiveIndustrialModels({ baseCabinetId: GAVETA_PORTA_SEP_PRODUCT_MODE_ID });
    expect(mode).toHaveLength(1);
    expect(mode[0]?.nomeIndustrial).toBe(GAVETA_PORTA_SEP_NOME_INDUSTRIAL);
    expect(
      INDUSTRIAL_MODELS.find((m) => m.id === GAVETA_PORTA_SEP_PRODUCT_MODE_ID)?.nomeIndustrial
    ).toBe(GAVETA_PORTA_SEP_NOME_INDUSTRIAL);

    const classic = cutlistComPrecoFromBox(
      baseBox({ baseCabinetId: "base-600-1porta", portaTipo: "porta_simples" }),
      defaultRulesConfig
    );
    expect(classic.some((i) => String(i.tipo).startsWith("cx_gav"))).toBe(false);
    expect(classic.some((i) => String(i.tipo).startsWith("a1_cx"))).toBe(false);
    expect(classic.some((i) => i.tipo === "cima" || i.tipo === "fundo")).toBe(true);
    expect(classic.some((i) => i.metadata?.gavetaPortaSep === true)).toBe(false);
  });

  it("wardrobe SEP parcial: activa modo C sem peças a1", () => {
    const mode = `base-1800-roupeiro-h-2400-${WARDROBE_PARTIAL_SEP_PRODUCT_MODE}_dir`;
    const items = cutlistComPrecoFromBox(
      baseBox({
        baseCabinetId: mode,
        dimensoes: { largura: 1800, altura: 2400, profundidade: 550 },
        portaTipo: "porta_simples",
        gavetas: 3,
        prateleiras: 2,
      }),
      defaultRulesConfig
    );
    expect(resolveActiveIndustrialModels({ baseCabinetId: mode }).map((m) => m.id)).toEqual([
      WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
    ]);
    expect(items.some((i) => i.tipo === "separador" || i.tipo === "divisorio")).toBe(true);
    expect(items.some((i) => String(i.tipo).startsWith("a1_cx"))).toBe(false);
  });

  it("inner_cabinet_a1: carcaça + compensador; DRILL/orla/naming", () => {
    const items = cutlistComPrecoFromBox(
      baseBox({
        baseCabinetId: INNER_CABINET_A1_PRODUCT_MODE,
        dimensoes: { largura: 1200, altura: 2200, profundidade: 560 },
        portaTipo: "porta_simples",
        gavetas: 2,
        alturaGaveta: 400,
        separadores: [
          {
            id: WARDROBE_PARTIAL_SEP_ID_RIGHT,
            positionMm: 400,
            referenceEdge: "bottom",
            larguraMm: 380,
          },
        ],
      }),
      defaultRulesConfig
    );
    const a1 = items.filter((i) => String(i.tipo).startsWith("a1_cx"));
    expect(a1).toHaveLength(5);
    expect(items.some((i) => i.tipo === A1_COMP_TIPO)).toBe(true);
    for (const p of a1) {
      expect(resolveXmlMachineTarget(p.tipo)).toBe("drill");
    }
    expect(resolveOrlaSidesForPieceTipo("a1_cx_comp_40")).toEqual(["front", "back"]);
    expect(getPieceLabel("a1_cx_comp_40")).toBe("A1 compensador 40 mm");
    expect(items.some((i) => i.tipo === "cima" || i.tipo === "fundo")).toBe(true);
  });

  it("coexistência C+D e pipeline clássico intacto", () => {
    const comboId = `base-1800-roupeiro-h-2400-${WARDROBE_PARTIAL_SEP_PRODUCT_MODE}_dir_${INNER_CABINET_A1_PRODUCT_MODE}`;
    expect(resolveActiveIndustrialModels({ baseCabinetId: comboId }).map((m) => m.id)).toEqual([
      WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
      INNER_CABINET_A1_PRODUCT_MODE,
    ]);

    const classic = cutlistComPrecoFromBox(
      baseBox({ baseCabinetId: "base-600-2portas", portaTipo: "porta_dupla" }),
      defaultRulesConfig
    );
    expect(classic.some((i) => String(i.metadata?.innerCabinetId) === "a_1")).toBe(false);
    expect(classic.filter((i) => i.tipo === "lateral_esquerda" || i.tipo === "lateral_direita").length).toBeGreaterThan(
      0
    );
    expect(resolveXmlMachineTarget("cima")).toBe("cnc");
    expect(resolveXmlMachineTarget("lateral_esquerda")).toBe("drill");
  });
});
