/**
 * drill/{qr}.xml (principal, todas) + drill/XML/{qr}_DRILL.xml (so estacao DRILL).
 */
import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, CutListItemComPreco, PanelDrillHole } from "../types";
import {
  buildCncXmlFilesForProject,
  buildDrillCompletoXmlFilesForProject,
  buildDrillFilesForProject,
  buildDrillStationXmlFilesForProject,
  resolveXmlMachineTarget,
} from "./drillExport";
import { pieceShouldHaveDrillLabel } from "./xmlMachineRouting";

const project = {
  projectName: "TEST_PROJ",
  boxes: [
    {
      id: "box-1",
      nome: "C1",
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
      cutList: [],
      cutListComPreco: [],
      ferragens: [],
      precoTotalPecas: 0,
      estrutura3D: null,
    },
  ] as BoxModule[],
  rules: defaultRulesConfig,
};

function item(
  tipo: string,
  dims: { largura: number; altura: number },
  holes: PanelDrillHole[],
  overrides: Partial<CutListItemComPreco> = {}
): CutListItemComPreco {
  return {
    id: tipo,
    nome: tipo,
    tipo,
    quantidade: 1,
    dimensoes: { ...dims, profundidade: 19 },
    espessura: 19,
    material: "mdf",
    boxId: "box-1",
    drillHoles: holes,
    precoUnitario: 0,
    precoTotal: 0,
    metadata: { qrCode: `C1_${tipo.toUpperCase()}-1` },
    ...overrides,
  };
}

const holes: PanelDrillHole[] = [
  { x: 60, y: 200, diameter: 5, depth: 13, holeType: "prateleira", topDrillable: true },
];

const cav: PanelDrillHole[] = [
  { x: 0, y: 39, diameter: 10, depth: 14, holeType: "cavilha" },
];

describe("drill principal + DRILL split", () => {
  it("cx_gav_* e div/sep -> DRILL", () => {
    expect(resolveXmlMachineTarget("cx_gav_lat_dir")).toBe("drill");
    expect(resolveXmlMachineTarget("cx_gav_lat_esq")).toBe("drill");
    expect(resolveXmlMachineTarget("cx_gav_cima")).toBe("drill");
    expect(resolveXmlMachineTarget("cx_gav_fun")).toBe("drill");
    expect(resolveXmlMachineTarget("cx_gav_fun")).not.toBe("cnc");
    expect(
      resolveXmlMachineTarget(
        item("cx_gav_lat_dir", { largura: 400, altura: 150 }, cav, {
          nome: "CX_GAV_LAT_DIR",
        })
      )
    ).toBe("drill");
  });

  it("_DRILL so tem pecas da estacao DRILL; principal tem todas", () => {
    const items = [
      item("cima", { largura: 600, altura: 560 }, holes, { metadata: { qrCode: "C1_TOP-1" } }),
      item("fundo", { largura: 600, altura: 560 }, holes, { metadata: { qrCode: "C1_FUN-1" } }),
      item("lateral_esquerda", { largura: 351, altura: 720 }, holes, {
        metadata: { qrCode: "C1_LAT_ESQ-1" },
      }),
      item("gaveta_frente_ext", { largura: 598, altura: 180 }, cav, {
        metadata: { qrCode: "C1_GAV_FRENT-1" },
      }),
      item("gaveta_traseira", { largura: 500, altura: 127 }, cav, {
        metadata: { qrCode: "C1_GAV_COST-1" },
      }),
      item("separador", { largura: 560, altura: 700 }, holes, {
        metadata: { qrCode: "C1_SEP-1" },
      }),
    ];

    const drill = buildDrillStationXmlFilesForProject(items, project);
    const principal = buildDrillCompletoXmlFilesForProject(items, project);
    const cnc = buildCncXmlFilesForProject(items, project);

    expect(drill.map((f) => f.filenameBase).sort()).toEqual([
      "C1_GAV_COST-1_DRILL",
      "C1_GAV_FRENT-1_DRILL",
      "C1_LAT_ESQ-1_DRILL",
      "C1_SEP-1_DRILL",
    ]);
    expect(drill.every((f) => f.zipPath.startsWith("drill/XML/"))).toBe(true);
    expect(drill.some((f) => f.filenameBase.includes("TOP"))).toBe(false);
    expect(drill.some((f) => f.filenameBase.includes("FUN"))).toBe(false);

    expect(principal).toHaveLength(6);
    expect(principal.every((f) => !f.filenameBase.endsWith("_COMPLETO"))).toBe(true);
    expect(
      principal.every((f) => f.zipPath.startsWith("drill/") && !f.zipPath.includes("/XML/"))
    ).toBe(true);
    expect(principal.map((f) => f.filenameBase).sort()).toEqual([
      "C1_FUN-1",
      "C1_GAV_COST-1",
      "C1_GAV_FRENT-1",
      "C1_LAT_ESQ-1",
      "C1_SEP-1",
      "C1_TOP-1",
    ]);

    expect(cnc.map((f) => f.zipPath).sort()).toEqual([
      "cnc/XML/C1_FUN-1.xml",
      "cnc/XML/C1_TOP-1.xml",
    ]);
  });

  it("etiqueta DRILL so para pecas da estacao DRILL (principal nao conta)", () => {
    expect(pieceShouldHaveDrillLabel(item("cima", { largura: 600, altura: 560 }, holes))).toBe(
      false
    );
    expect(
      pieceShouldHaveDrillLabel(item("lateral_direita", { largura: 351, altura: 720 }, holes))
    ).toBe(true);
    const all = buildDrillFilesForProject(
      [item("cima", { largura: 600, altura: 560 }, holes, { metadata: { qrCode: "C1_TOP-1" } })],
      project
    );
    expect(all.some((f) => f.machineTarget === "completo")).toBe(true);
    expect(all.some((f) => f.machineTarget === "drill")).toBe(false);
  });
});
