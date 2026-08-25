import { describe, expect, it } from "vitest";
import {
  isIndustrialEdgeCavilhaHole,
  isIndustrialFaceCavilhaHole,
} from "../drill/cavilha10x40Rule";
import { resolveXmlMachineTarget } from "../drill/xmlMachineRouting";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { resolveOrlaSidesForPieceTipo } from "../orla/orlaIndustrialRules";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule } from "../types";
import { extractCxGavCutlistFromBox } from "./cxGavCutlistAdapter";
import { buildCxGavDrillHoles } from "./cxGavDrilling";
import {
  boxUsesCxGav,
  computeCxGavLayout,
  CX_GAV_CIMA_DEPTH_MM,
  CX_GAV_PRODUCT_MODE_ID,
} from "./cxGavGeometry";

function baseBox(partial: Partial<BoxModule> = {}): BoxModule {
  return {
    id: "box-cx",
    nome: "CX1",
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
    ...partial,
  } as BoxModule;
}

describe("cx_gav Fase A", () => {
  it("gate: só cx_gav_cavita; nunca industrial-*/custom-model-*", () => {
    expect(boxUsesCxGav({ baseCabinetId: CX_GAV_PRODUCT_MODE_ID })).toBe(true);
    expect(boxUsesCxGav({ baseCabinetId: "base-600-2portas" })).toBe(false);
    expect(
      boxUsesCxGav({
        baseCabinetId: CX_GAV_PRODUCT_MODE_ID,
        customIndustrialModelId: "industrial-drawer-single-600x720x500-v1",
      })
    ).toBe(false);
  });

  it("cima tem profundidade fixa 100 mm", () => {
    const layout = computeCxGavLayout(baseBox({ baseCabinetId: CX_GAV_PRODUCT_MODE_ID }));
    expect(layout.cimaProfundidadeMm).toBe(CX_GAV_CIMA_DEPTH_MM);
  });

  it("furos: 10×30 aresta + 10×13 a 30/70 da traseira", () => {
    const layout = computeCxGavLayout(baseBox({ baseCabinetId: CX_GAV_PRODUCT_MODE_ID }));
    const lat = buildCxGavDrillHoles("cx_gav_lat_dir", layout);
    expect(lat.some(isIndustrialEdgeCavilhaHole)).toBe(true);
    expect(lat.some(isIndustrialFaceCavilhaHole)).toBe(true);
    const faceXs = lat.filter(isIndustrialFaceCavilhaHole).map((h) => h.x);
    expect(faceXs).toEqual(
      expect.arrayContaining([
        layout.lateralProfundidadeMm - 30,
        layout.lateralProfundidadeMm - 70,
      ])
    );
  });

  it("cutlist emite 4 tipos sem industrialLabel antigo; routing DRILL; orla correcta", () => {
    const box = baseBox({ baseCabinetId: CX_GAV_PRODUCT_MODE_ID });
    const pieces = extractCxGavCutlistFromBox(box, "mdf_branco", "CX1");
    expect(pieces.map((p) => p.tipo).sort()).toEqual([
      "cx_gav_cima",
      "cx_gav_fun",
      "cx_gav_lat_dir",
      "cx_gav_lat_esq",
    ]);
    const cima = pieces.find((p) => p.tipo === "cx_gav_cima")!;
    expect(cima.dimensoes.altura).toBe(100);
    expect(cima.metadata?.industrialLabel).toBeUndefined();
    expect(cima.nome).toBe("cx_gav_cima");
    for (const p of pieces) {
      expect(resolveXmlMachineTarget(p.tipo)).toBe("drill");
      expect(resolveXmlMachineTarget(p.tipo)).not.toBe("cnc");
    }
    expect(resolveOrlaSidesForPieceTipo("cx_gav_fun")).toEqual([]);
    expect(resolveOrlaSidesForPieceTipo("cx_gav_cima")).toHaveLength(4);
  });

  it("integração cutlistComPrecoFromBox sem regressão em caixa clássica", () => {
    const classic = cutlistComPrecoFromBox(
      baseBox({ baseCabinetId: "base-600-1porta" }),
      defaultRulesConfig
    );
    expect(classic.some((i) => String(i.tipo).startsWith("cx_gav"))).toBe(false);

    const cx = cutlistComPrecoFromBox(
      baseBox({ baseCabinetId: CX_GAV_PRODUCT_MODE_ID, costaAtiva: true }),
      defaultRulesConfig
    );
    expect(cx.filter((i) => String(i.tipo).startsWith("cx_gav"))).toHaveLength(4);
  });
});
