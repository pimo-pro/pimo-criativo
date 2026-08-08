import { describe, expect, it } from "vitest";
import { resolveXmlMachineTarget } from "../drill/xmlMachineRouting";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { resolveOrlaSidesForPieceTipo } from "../orla/orlaIndustrialRules";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule } from "../types";
import {
  WARDROBE_PARTIAL_SEP_ID_RIGHT,
  WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
  syncWardrobePartialSepBox,
} from "../wardrobe/partialSepToDiv";
import { extractA1CutlistFromBox } from "./a1CutlistAdapter";
import {
  boxUsesInnerCabinetA1,
  computeA1Layout,
  INNER_CABINET_A1_PRODUCT_MODE,
  resolveA1SpanSepDivMm,
} from "./a1Geometry";
import { buildA1CarcassIndustrialLabel, buildA1DrawerIndustrialLabel } from "./a1Naming";
import { A1_COMP_TIPO, HINGE_COMPENSATION_MM } from "./hingeCompensation40";

function baseBox(partial: Partial<BoxModule> = {}): BoxModule {
  return {
    id: "box-a1",
    nome: "A1BOX",
    dimensoes: { largura: 1200, altura: 2200, profundidade: 560 },
    espessura: 19,
    tipoBorda: "reta",
    tipoFundo: "integrado",
    models: [],
    prateleiras: 0,
    portaTipo: "porta_simples",
    gavetas: 2,
    alturaGaveta: 400,
    doorsLayer: [
      {
        id: "d1",
        parentBoxId: "box-a1",
        groupType: "simples",
        width: 500,
        height: 2000,
        thickness: 19,
        materialId: "mdf_branco",
        openDirection: "left",
        isOpen: false,
        hingeSide: "right",
        pivot: "right-edge",
        posX: 0,
        posY: 0,
        posZ: 0,
        rotY: 0,
      },
    ],
    drawersLayer: [],
    divisores: [],
    separadores: [],
    cutList: [],
    cutListComPreco: [],
    ferragens: [],
    precoTotalPecas: 0,
    estrutura3D: null,
    ...partial,
  } as BoxModule;
}

describe("inner_cabinet_a1 Fase D", () => {
  it("gate: só inner_cabinet_a1; nunca industrial-*/custom-model-*", () => {
    expect(boxUsesInnerCabinetA1({ baseCabinetId: INNER_CABINET_A1_PRODUCT_MODE })).toBe(true);
    expect(
      boxUsesInnerCabinetA1({
        baseCabinetId: "wardrobe_sep_parcial_gavetas_dir_inner_cabinet_a1",
      })
    ).toBe(true);
    expect(boxUsesInnerCabinetA1({ baseCabinetId: "base-600-2portas" })).toBe(false);
    expect(
      boxUsesInnerCabinetA1({
        baseCabinetId: INNER_CABINET_A1_PRODUCT_MODE,
        customIndustrialModelId: "industrial-drawer-single-600x720x500-v1",
      })
    ).toBe(false);
  });

  it("largura: outerWidth = span SEP↔DIV − 40 mm", () => {
    const box = baseBox({
      baseCabinetId: INNER_CABINET_A1_PRODUCT_MODE,
      separadores: [
        {
          id: WARDROBE_PARTIAL_SEP_ID_RIGHT,
          positionMm: 400,
          referenceEdge: "bottom",
          larguraMm: 380,
        },
      ],
    });
    const layout = computeA1Layout(box);
    expect(layout.spanSepDivMm).toBe(380);
    expect(layout.compensationMm).toBe(HINGE_COMPENSATION_MM);
    expect(layout.outerWidthMm).toBe(380 - HINGE_COMPENSATION_MM);
    expect(layout.hingeSide).toBe("right");
  });

  it("naming industrial a_1_cx_* e a_1_cx_gav_*", () => {
    expect(buildA1CarcassIndustrialLabel("A1BOX", "cx_lat_dir")).toBe("A1BOX_a_1_cx_lat_dir");
    expect(buildA1DrawerIndustrialLabel("A1BOX", 1, "fren")).toBe("A1BOX_a_1_cx_gav_1_fren");
    expect(buildA1DrawerIndustrialLabel("A1BOX", 2, "lat_esq")).toBe(
      "A1BOX_a_1_cx_gav_2_lat_esq"
    );
  });

  it("cutlist: carcaça + compensador 40 + gavetas; routing DRILL; orla correcta", () => {
    const box = baseBox({
      baseCabinetId: INNER_CABINET_A1_PRODUCT_MODE,
      separadores: [
        {
          id: WARDROBE_PARTIAL_SEP_ID_RIGHT,
          positionMm: 400,
          referenceEdge: "bottom",
          larguraMm: 380,
        },
      ],
      gavetas: 2,
    });
    const pieces = extractA1CutlistFromBox(box, "mdf_branco", "A1BOX");
    const tipos = pieces.map((p) => p.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining([
        "a1_cx_lat_dir",
        "a1_cx_lat_esq",
        "a1_cx_cima",
        "a1_cx_fundo",
        A1_COMP_TIPO,
        "gaveta_frente_ext",
        "gaveta_lat_dir",
        "gaveta_lat_esq",
        "gaveta_fundo",
        "gaveta_traseira",
      ])
    );
    expect(pieces.filter((p) => String(p.tipo).startsWith("a1_cx"))).toHaveLength(5);
    // 2 gavetas × 5 peças
    expect(pieces.filter((p) => String(p.tipo).startsWith("gaveta_"))).toHaveLength(10);

    const comp = pieces.find((p) => p.tipo === A1_COMP_TIPO)!;
    expect(comp.dimensoes.largura).toBe(HINGE_COMPENSATION_MM);
    expect(comp.metadata?.industrialLabel).toBe("A1BOX_a_1_cx_comp_40");

    const lat = pieces.find((p) => p.tipo === "a1_cx_lat_dir")!;
    expect(lat.metadata?.industrialLabel).toBe("A1BOX_a_1_cx_lat_dir");
    expect(resolveXmlMachineTarget(lat.tipo)).toBe("drill");
    expect(resolveXmlMachineTarget(A1_COMP_TIPO)).toBe("drill");

    const fren = pieces.find(
      (p) => p.tipo === "gaveta_frente_ext" && p.metadata?.drawerIndex === 1
    )!;
    expect(fren.metadata?.industrialLabel).toBe("A1BOX_a_1_cx_gav_1_fren");
    expect(resolveXmlMachineTarget(fren.tipo)).toBe("drill");
    expect(resolveXmlMachineTarget(fren.tipo)).not.toBe("cnc");

    expect(resolveOrlaSidesForPieceTipo("a1_cx_fundo")).toEqual([]);
    expect(resolveOrlaSidesForPieceTipo("a1_cx_cima")).toHaveLength(4);
    expect(resolveOrlaSidesForPieceTipo("a1_cx_lat_dir")).toEqual(["front"]);
    expect(resolveOrlaSidesForPieceTipo("a1_cx_comp_40")).toEqual(["front", "back"]);
  });

  it("sincronização dinâmica com SEP parcial (Fase C)", () => {
    const wardrobeA1 = baseBox({
      baseCabinetId: `base-1800-roupeiro-h-2400-${WARDROBE_PARTIAL_SEP_PRODUCT_MODE}_dir_inner_cabinet_a1`,
      dimensoes: { largura: 1800, altura: 2400, profundidade: 550 },
      gavetas: 2,
      alturaGaveta: 400,
      costaAtiva: true,
    });
    const synced = syncWardrobePartialSepBox(wardrobeA1);
    const span = resolveA1SpanSepDivMm(synced);
    const sep = synced.separadores?.find((s) => s.id === WARDROBE_PARTIAL_SEP_ID_RIGHT);
    expect(sep?.larguraMm).toBeDefined();
    expect(span).toBe(Number(sep?.larguraMm));
    const layout = computeA1Layout(synced);
    expect(layout.outerWidthMm).toBe(span - HINGE_COMPENSATION_MM);
  });

  it("integração cutlistComPrecoFromBox sem regressão clássica / A / B / C", () => {
    const classic = cutlistComPrecoFromBox(
      baseBox({ baseCabinetId: "base-600-1porta", gavetas: 0, portaTipo: "porta_simples" }),
      defaultRulesConfig
    );
    expect(classic.some((i) => String(i.tipo).startsWith("a1_cx"))).toBe(false);
    expect(classic.some((i) => String(i.metadata?.innerCabinetId) === "a_1")).toBe(false);

    const cx = cutlistComPrecoFromBox(
      baseBox({
        baseCabinetId: "cx_gav_cavita",
        gavetas: 0,
        portaTipo: "sem_porta",
        dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        costaAtiva: true,
      }),
      defaultRulesConfig
    );
    expect(cx.filter((i) => String(i.tipo).startsWith("cx_gav"))).toHaveLength(4);
    expect(cx.some((i) => String(i.tipo).startsWith("a1_cx"))).toBe(false);

    const a1 = cutlistComPrecoFromBox(
      baseBox({
        baseCabinetId: INNER_CABINET_A1_PRODUCT_MODE,
        separadores: [
          {
            id: WARDROBE_PARTIAL_SEP_ID_RIGHT,
            positionMm: 400,
            referenceEdge: "bottom",
            larguraMm: 380,
          },
        ],
        costaAtiva: true,
      }),
      defaultRulesConfig
    );
    expect(a1.filter((i) => String(i.tipo).startsWith("a1_cx"))).toHaveLength(5);
    expect(a1.some((i) => i.tipo === A1_COMP_TIPO)).toBe(true);
    // Carcaça mãe clássica continua presente (aditivo)
    expect(a1.some((i) => i.tipo === "cima" || i.tipo === "fundo")).toBe(true);
  });
});
