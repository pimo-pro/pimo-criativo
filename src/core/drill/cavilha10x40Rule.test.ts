/**
 * Regra global CAVILHA_10x40 — canto Direita Inferior (CIMA ? FRENTE FIXA).
 */
import { describe, expect, it } from "vitest";
import {
  buildCornerFixedFrontDowelHoles,
  CORNER_FF_EDGE_DOWEL_DEPTH_MM,
  CORNER_FF_FACE_DOWEL_DEPTH_MM,
} from "../cornerCabinet/cornerFixedFrontDowels";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_10x40_FERRAGEM_NOME,
  CAVILHA_EDGE_DEPTH_MM,
  CAVILHA_FACE_DEPTH_MM,
  countCavilha10x40FromEdgeHoles,
  isIndustrialEdgeCavilhaHole,
  isIndustrialFaceCavilhaHole,
} from "./cavilha10x40Rule";
import { getHoleTypeById, getPairedHoleTypeId } from "./holeCatalog";
import { FERRAGENS_DEFAULT } from "../ferragens/ferragens";
import { insertDesignHoleWithCavilhaPairing } from "../industrialDesigner/cavilhaPairing";
import type { IndustrialDesignBox } from "../industrialDesigner/types";
import { nextDesignId } from "../industrialDesigner/designModel";

describe("CAVILHA_10x40 — regra global", () => {
  it("catálogo: 10–30 ? 10–13 + ferragem", () => {
    expect(getPairedHoleTypeId("cavilha_10x30")).toBe("cavilha_10x13");
    expect(getPairedHoleTypeId("cavilha_10x13")).toBe("cavilha_10x30");
    expect(getHoleTypeById("cavilha_10x30").ferragemId).toBe(CAVILHA_10x40_FERRAGEM_ID);
    expect(getHoleTypeById("cavilha_10x30").profundidadeMm).toBe(30);
    expect(getHoleTypeById("cavilha_10x13").profundidadeMm).toBe(13);
  });

  it("ferragem cavilha_10x40 no catálogo (nome comercial Cavilha 10mm, bege, Ø10×40)", () => {
    const f = FERRAGENS_DEFAULT.find((x) => x.id === CAVILHA_10x40_FERRAGEM_ID);
    expect(f).toBeDefined();
    expect(f!.nome).toBe("Cavilha 10mm");
    expect(f!.nome).toBe(CAVILHA_10x40_FERRAGEM_NOME);
    expect(f!.cor).toBe("bege");
    expect(f!.espessuraMm).toBe(10);
    expect(f!.comprimentoMm).toBe(40);
  });
});

describe("Canto Direita Inferior — CIMA ? FRENTE FIXA", () => {
  const layout = {
    fixedFrontWidthMm: 400,
    fixedFrontHeightMm: 720,
    panelWidthMm: 900,
    fixedFrontSide: "left" as const,
    thicknessMm: 19,
  };

  it("cada 10–30 tem par 10–13 com mesmo pairedHoleKey + ferragem", () => {
    const holes = buildCornerFixedFrontDowelHoles(layout, 682);
    expect(holes.cima).toHaveLength(2);
    expect(holes.cima.every((h) => h.depth === CORNER_FF_EDGE_DOWEL_DEPTH_MM)).toBe(true);
    expect(holes.cima.every((h) => h.topDrillable === false)).toBe(true);
    expect(holes.cima.every((h) => h.ferragemId === CAVILHA_10x40_FERRAGEM_ID)).toBe(true);

    expect(holes.frente_fixa.length).toBeGreaterThanOrEqual(4);
    expect(holes.frente_fixa.every((h) => h.depth === CORNER_FF_FACE_DOWEL_DEPTH_MM)).toBe(true);
    expect(holes.frente_fixa.every((h) => h.topDrillable === true)).toBe(true);

    for (const edge of holes.cima) {
      const face = holes.frente_fixa.find((h) => h.pairedHoleKey === edge.pairedHoleKey);
      expect(face).toBeDefined();
      expect(face!.x).toBeCloseTo(edge.x, 5);
      expect(isIndustrialEdgeCavilhaHole(edge)).toBe(true);
      expect(isIndustrialFaceCavilhaHole(face!)).toBe(true);
    }

    expect(countCavilha10x40FromEdgeHoles([...holes.cima, ...holes.fundo, ...(holes.lateral_esquerda ?? [])])).toBe(6);
    expect(CAVILHA_EDGE_DEPTH_MM).toBe(30);
    expect(CAVILHA_FACE_DEPTH_MM).toBe(13);
  });

  it("Design Industrial: clique em CIMA cria par na FRENTE FIXA", () => {
    const boxId = "box-corner";
    const cimaId = `${boxId}:cima`;
    const ffId = `${boxId}:frente-fixa`;
    const box: IndustrialDesignBox = {
      id: boxId,
      nome: "Canto Direita Inferior",
      outerWidthMm: 900,
      outerHeightMm: 720,
      outerDepthMm: 560,
      espessuraMm: 19,
      materialId: "mdf",
      panels: [
        {
          id: cimaId,
          tipo: "cima",
          widthMm: 900,
          heightMm: 541,
          thicknessMm: 19,
          materialId: "mdf",
          drillHoles: [],
        },
        {
          id: ffId,
          tipo: "frente_fixa",
          widthMm: 400,
          heightMm: 720,
          thicknessMm: 19,
          materialId: "mdf",
          drillHoles: [],
        },
      ],
      constraints: [
        {
          id: nextDesignId("constraint"),
          panelAId: cimaId,
          panelBId: ffId,
          tipo: "encaixe_cavilha",
        },
      ],
    };

    const result = insertDesignHoleWithCavilhaPairing(
      box,
      cimaId,
      "cavilha_10x30",
      60,
      60,
      "espessura"
    );

    expect(result.hole.holeTypeId).toBe("cavilha_10x30");
    expect(result.hole.ferragemId).toBe(CAVILHA_10x40_FERRAGEM_ID);
    expect(result.pairedHole).toBeDefined();
    expect(result.pairedHole!.holeTypeId).toBe("cavilha_10x13");
    expect(result.pairedPanelId).toBe(ffId);
    expect(result.hole.pairedHoleId).toBe(result.pairedHole!.id);
    expect(result.pairedHole!.pairedHoleId).toBe(result.hole.id);

    const cima = result.box.panels.find((p) => p.id === cimaId)!;
    const ff = result.box.panels.find((p) => p.id === ffId)!;
    expect(cima.drillHoles).toHaveLength(1);
    expect(ff.drillHoles).toHaveLength(1);
    expect(ff.drillHoles[0]!.face).toBe("face");
  });
});
