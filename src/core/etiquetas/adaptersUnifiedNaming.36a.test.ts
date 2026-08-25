/**
 * Passo 3.6a — peças NOVAS das famílias especializadas usam naming unificado
 * (resolveNomeIndustrialForEtiqueta → buildFullIndustrialName), sem gravar
 * metadata.industrialLabel no formato antigo.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAllCutlistCache,
  cutlistComPrecoFromBox,
} from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { resolveNomeIndustrialForEtiqueta } from "./industrialDisplayName";
import { buildFullIndustrialName } from "../naming/industrialNaming";
import {
  defaultDivisorItem,
  defaultSeparadorItem,
  makeDivSepTestBox,
} from "../divSep/divSepTestHelpers";
import { extractDrawerCutlistFromLayerItems } from "../../services/drawerCutlistAdapter";
import { buildDrawerScenario } from "../../validation/drawerCertificationTestHelpers";
import { extractA1CutlistFromBox } from "../innerCabinet/a1CutlistAdapter";
import { INNER_CABINET_A1_PRODUCT_MODE } from "../innerCabinet/a1Geometry";
import { extractCxGavCutlistFromBox } from "../cxGav/cxGavCutlistAdapter";
import { CX_GAV_PRODUCT_MODE_ID } from "../cxGav/cxGavGeometry";
import { buildRemateCutlistItems } from "../remate/remateCutlist";
import { createRematePieces } from "../remate/rematePieceFactory";
import { buildRodapeCutlistItems } from "../rodape/rodapeCutlist";
import { createRodapesForBox } from "../rodape/rodapeFactory";
import type { BoxModule } from "../types";
import type { DoorLayerItem } from "../../models/BoxLayers";

const PROJECT = "Khaled Cozinha Nova";
const BOX = "C 1";

describe("Passo 3.6a — naming unificado para peças novas (adaptadores)", () => {
  beforeEach(() => {
    clearAllCutlistCache();
  });

  it("preserva metadata.industrialLabel legado sem recalcular", () => {
    const legacy = "Armario_Test_DIV_01";
    expect(
      resolveNomeIndustrialForEtiqueta(
        { tipo: "divisorio", metadata: { industrialLabel: legacy } },
        PROJECT,
        BOX
      )
    ).toBe(legacy);
  });

  it("gaveta → projeto_caixa_gav_*", () => {
    const { layers } = buildDrawerScenario({
      boxWidth: 600,
      boxHeight: 720,
      boxDepth: 560,
      boxThickness: 19,
      drawerCount: 1,
    });
    const pieces = extractDrawerCutlistFromLayerItems(layers, "mdf_branco", BOX);
    const lat = pieces.find((p) => p.tipo === "gaveta_lat_esq")!;
    expect(lat.metadata?.industrialLabel).toBeUndefined();
    const nome = resolveNomeIndustrialForEtiqueta(lat, PROJECT, BOX);
    expect(nome).toBe(buildFullIndustrialName(PROJECT, BOX, "gaveta_lat_esq", 1));
    expect(nome).toBe("khaled_cozinha_nova_c_1_gav_lat_esq_1");
  });

  it("A1 carcaça + gaveta → tokens cx_* / gav_* com projeto", () => {
    const box = {
      id: "box-a1",
      nome: BOX,
      dimensoes: { largura: 1200, altura: 2200, profundidade: 560 },
      espessura: 19,
      portaTipo: "porta_simples",
      gavetas: 1,
      alturaGaveta: 400,
      baseCabinetId: INNER_CABINET_A1_PRODUCT_MODE,
      doorsLayer: [
        {
          id: "d1",
          parentBoxId: "box-a1",
          width: 500,
          height: 2000,
          thickness: 19,
          hingeSide: "right",
          openDirection: "left",
          isOpen: false,
          pivot: "right-edge",
          posX: 0,
          posY: 0,
          posZ: 0,
          rotY: 0,
        },
      ],
      drawersLayer: [],
    } as unknown as BoxModule;

    const pieces = extractA1CutlistFromBox(box, "mdf_branco", BOX);
    const lat = pieces.find((p) => p.tipo === "a1_cx_lat_dir")!;
    const fren = pieces.find(
      (p) => p.tipo === "gaveta_frente_ext" && p.metadata?.drawerIndex === 1
    )!;
    expect(lat.metadata?.industrialLabel).toBeUndefined();
    expect(fren.metadata?.industrialLabel).toBeUndefined();

    expect(resolveNomeIndustrialForEtiqueta(lat, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_cx_lat_dir"
    );
    expect(resolveNomeIndustrialForEtiqueta(fren, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_gav_frent_ext_1"
    );
  });

  it("cx_gav → projeto_caixa_cx_gav_*", () => {
    const box = {
      id: "box-cx",
      nome: BOX,
      dimensoes: { largura: 600, altura: 720, profundidade: 560 },
      espessura: 19,
      baseCabinetId: CX_GAV_PRODUCT_MODE_ID,
      portaTipo: "sem_porta",
      gavetas: 0,
      drawersLayer: [],
      doorsLayer: [],
    } as unknown as BoxModule;

    const pieces = extractCxGavCutlistFromBox(box, "mdf_branco", BOX);
    const cima = pieces.find((p) => p.tipo === "cx_gav_cima")!;
    expect(cima.metadata?.industrialLabel).toBeUndefined();
    expect(resolveNomeIndustrialForEtiqueta(cima, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_cx_gav_cima"
    );
  });

  it("DIV/SEP → projeto_caixa_div|sep", () => {
    const box = makeDivSepTestBox({
      id: "box-divsep",
      nome: BOX,
      divisores: [defaultDivisorItem({ id: "div-1" })],
      separadores: [defaultSeparadorItem({ id: "sep-1" })],
    });
    const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const div = cutlist.find((i) => i.tipo === "divisorio")!;
    const sep = cutlist.find((i) => i.tipo === "separador")!;
    expect(div.metadata?.industrialLabel).toBeUndefined();
    expect(sep.metadata?.industrialLabel).toBeUndefined();
    expect(resolveNomeIndustrialForEtiqueta(div, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_div_1"
    );
    expect(resolveNomeIndustrialForEtiqueta(sep, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_sep_1"
    );
  });

  it("porta → projeto_caixa_port_*", () => {
    const door: DoorLayerItem = {
      id: "door-1",
      parentBoxId: "box-1",
      width: 594,
      height: 1994,
      thickness: 19,
      openDirection: "left",
      isOpen: false,
      hingeSide: "left",
      pivot: "left-edge",
      posX: -297,
      posY: 0,
      posZ: 300,
      rotY: 0,
    };
    const box = {
      id: "box-1",
      nome: BOX,
      dimensoes: { largura: 600, altura: 2000, profundidade: 300 },
      espessura: 19,
      portaTipo: "porta_simples",
      doorsLayer: [door],
      drawersLayer: [],
      cutList: [],
      cutListComPreco: [],
    } as unknown as BoxModule;

    const porta = cutlistComPrecoFromBox(box, defaultRulesConfig).find(
      (i) => i.tipo === "porta_simples"
    )!;
    expect(porta.metadata?.industrialLabel).toBeUndefined();
    expect(porta.metadata?.doorPositionKind).toBe("esq");
    expect(resolveNomeIndustrialForEtiqueta(porta, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_port_esq"
    );
  });

  it("remate → projeto_caixa_remate_*", () => {
    const wsBox = makeDivSepTestBox({ id: "box-remate", nome: BOX }) as import("../types").WorkspaceBox;
    const remates = createRematePieces(
      { productType: "COMPLETO", mountSlot: "DIR", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );
    const cutlist = buildRemateCutlistItems(remates, [
      makeDivSepTestBox({ id: wsBox.id, nome: BOX }),
    ]);
    const dir = cutlist.find((i) => i.metadata?.remateKind === "DIR")!;
    expect(dir.metadata?.industrialLabel).toBeUndefined();
    expect(resolveNomeIndustrialForEtiqueta(dir, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_remate_dir_1"
    );
  });

  it("rodapé → projeto_caixa_roda_pe", () => {
    const wsBox = makeDivSepTestBox({
      id: "box-rodape",
      nome: BOX,
    }) as import("../types").WorkspaceBox;
    const [rodape] = createRodapesForBox({
      box: wsBox,
      allBoxes: [wsBox],
      room: null,
      roomBoundsM: null,
      input: { kind: "SIMPLE", parentBoxId: wsBox.id },
      materialId: "mdf_branco",
      thicknessMm: 19,
      heightMm: 100,
      existingCount: 0,
    });
    const cutlist = buildRodapeCutlistItems(
      [rodape!],
      [makeDivSepTestBox({ id: wsBox.id, nome: BOX })]
    );
    expect(cutlist[0]?.metadata?.industrialLabel).toBeUndefined();
    expect(resolveNomeIndustrialForEtiqueta(cutlist[0]!, PROJECT, BOX)).toBe(
      "khaled_cozinha_nova_c_1_roda_pe_1"
    );
  });
});
