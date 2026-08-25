import { describe, expect, it, beforeEach } from "vitest";
import { clearAllCutlistCache } from "../core/manufacturing/cutlistFromBoxes";
import { buildCutlistItemsForIndustrialExport } from "../core/fabrication/buildCutlistItemsForIndustrialExport";
import { buildRodapeCutlistItems } from "../core/rodape/rodapeCutlist";
import { createRodapesForBox } from "../core/rodape/rodapeFactory";
import { makeDivSepTestBox } from "../core/divSep/divSepTestHelpers";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { cutlistToPieces } from "../core/cutlayout/cutLayoutEngine";
import { isRotatablePiece } from "../core/cutlayout/utils/cutLayoutUtils";
import { allowRotationForPiece } from "../nesting-v3/nestingV3Settings";
import { DEFAULT_NESTING_V3_SETTINGS } from "../nesting-v3/nestingV3Settings";
import type { ProjectRodape } from "../core/rodape/rodapeTypes";

function makeWorkspaceBox() {
  const box = makeDivSepTestBox({
    id: "box-rodape-ind",
    nome: "Armario_Test",
  });
  return box as import("../core/types").WorkspaceBox;
}

describe("Rodapé — integração industrial (cutlist + QR + nesting livre)", () => {
  beforeEach(() => {
    clearAllCutlistCache();
  });

  it("gera rodapé na cutlist sem industrialLabel antigo", () => {
    const wsBox = makeWorkspaceBox();
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
      [makeDivSepTestBox({ id: wsBox.id, nome: wsBox.nome })]
    );

    expect(cutlist).toHaveLength(1);
    expect(cutlist[0]?.nome).toBe("Rodapé");
    expect(cutlist[0]?.metadata?.industrialLabel).toBeUndefined();
    expect(cutlist[0]?.tipo).toBe("rodape");
    expect(cutlist[0]?.grainDirection).toBeUndefined();
  });

  it("buildCutlistItemsForIndustrialExport inclui rodapés com QR e sem grainDirection", () => {
    const box = makeDivSepTestBox({ id: "box-rodape-ind", nome: "Armario_Test" });
    const wsBox = makeWorkspaceBox();
    const rodapes = createRodapesForBox({
      box: wsBox,
      allBoxes: [wsBox],
      room: null,
      roomBoundsM: null,
      input: { kind: "SIMPLE" },
      materialId: "mdf_branco",
      thicknessMm: 19,
      heightMm: 100,
      existingCount: 0,
    });

    const all = buildCutlistItemsForIndustrialExport({
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "NP001",
      rodapes,
    });

    const rodapeItems = all.filter((i) => i.tipo === "rodape");
    expect(rodapeItems.length).toBe(1);
    expect(rodapeItems[0]?.nome).toBe("Rodapé");
    expect(rodapeItems[0]?.metadata?.industrialLabel).toBeUndefined();
    expect(rodapeItems[0]?.grainDirection).toBeUndefined();
    expect(rodapeItems[0]?.pieceNumber).toBeGreaterThan(0);
    expect(rodapeItems[0]?.qrSvg).toBeTruthy();
  });

  it("nesting — rotação sempre permitida para rodapé (veio livre)", () => {
    const rodape: ProjectRodape = {
      id: "rod-rot",
      parentBoxId: "box-rodape-ind",
      kind: "SIMPLE",
      materialId: "mdf_branco",
      thicknessMm: 19,
      heightMm: 100,
      dimensions: { widthMm: 2850, heightMm: 100, depthMm: 19 },
      name: "legacy",
      visible: true,
    };

    const cutlist = buildRodapeCutlistItems(
      [rodape],
      [makeDivSepTestBox({ id: "box-rodape-ind", nome: "MOD1" })]
    );
    const pieces = cutlistToPieces(cutlist, {
      projectName: "NP001",
      boxes: [{ id: "box-rodape-ind", nome: "MOD1" }],
    });

    expect(pieces).toHaveLength(1);
    const piece = pieces[0]!;
    expect(piece.industrialGrainCode).toBeUndefined();
    expect(piece.pieceTipo).toBe("rodape");
    expect(isRotatablePiece(piece)).toBe(true);
    expect(
      allowRotationForPiece(
        {
          id: "v3-1",
          name: piece.partName,
          widthMm: piece.largura_mm,
          heightMm: piece.altura_mm,
          thicknessMm: piece.espessura_mm,
          originalHoles: [],
          rotation: 0,
          color: "#ccc",
          pieceTipo: "rodape",
        },
        DEFAULT_NESTING_V3_SETTINGS
      )
    ).toBe(true);
  });

  it("Layout PRO usa nome PRO quando não há industrialLabel legado", () => {
    const rodape: ProjectRodape = {
      id: "rod-layout",
      parentBoxId: "box-rodape-ind",
      kind: "SIMPLE",
      materialId: "mdf_branco",
      thicknessMm: 19,
      heightMm: 100,
      dimensions: { widthMm: 600, heightMm: 100, depthMm: 19 },
      name: "legacy",
      visible: true,
    };

    const cutlist = buildRodapeCutlistItems(
      [rodape],
      [makeDivSepTestBox({ id: "box-rodape-ind", nome: "Armario_Test" })]
    );
    const pieces = cutlistToPieces(cutlist, {
      projectName: "NP001",
      boxes: [{ id: "box-rodape-ind", nome: "Armario_Test" }],
    });

    expect(pieces[0]?.partName).toMatch(/_roda_pe$/i);
    expect(pieces[0]?.materialId).toBeTruthy();
  });

  it("nomePersonalizado substitui nome na cutlist; sem industrialLabel antigo", () => {
    const wsBox = makeWorkspaceBox();
    const rodape = createRodapesForBox({
      box: wsBox,
      allBoxes: [wsBox],
      room: null,
      roomBoundsM: null,
      input: { kind: "SIMPLE", parentBoxId: wsBox.id },
      materialId: "mdf_branco",
      thicknessMm: 19,
      heightMm: 100,
      existingCount: 0,
    })[0];
    const customized = { ...rodape!, nomePersonalizado: "RODA_PE_ESQ" };
    const cutlist = buildRodapeCutlistItems(
      [customized],
      [makeDivSepTestBox({ id: wsBox.id, nome: wsBox.nome })]
    );
    expect(cutlist[0]?.nome).toBe("RODA_PE_ESQ");
    expect(cutlist[0]?.metadata?.industrialLabel).toBeUndefined();
  });
});
