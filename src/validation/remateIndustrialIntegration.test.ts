import { describe, expect, it, beforeEach } from "vitest";
import { clearAllCutlistCache } from "../core/manufacturing/cutlistFromBoxes";
import { buildCutlistItemsForIndustrialExport } from "../core/fabrication/buildCutlistItemsForIndustrialExport";
import { buildRemateCutlistItems } from "../core/remate/remateCutlist";
import { createRematePieces } from "../core/remate/rematePieceFactory";
import { resolveObservacoesForCutListItem } from "../core/observacoes/ObservacoesService";
import { makeDivSepTestBox } from "../core/divSep/divSepTestHelpers";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { cutlistToPieces } from "../core/cutlayout/cutLayoutEngine";

function makeWorkspaceBox() {
  const box = makeDivSepTestBox({
    id: "box-remate-ind",
    nome: "Armario_Test",
  });
  return box as import("../core/types").WorkspaceBox;
}

describe("Remate — integração industrial (cutlist + QR + layout PRO)", () => {
  beforeEach(() => {
    clearAllCutlistCache();
  });

  it("gera remates na cutlist sem industrialLabel antigo (naming na etiqueta)", () => {
    const wsBox = makeWorkspaceBox();
    const remates = createRematePieces(
      { productType: "COMPLETO", mountSlot: "DIR", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );

    const cutlist = buildRemateCutlistItems(remates, [makeDivSepTestBox({ id: wsBox.id, nome: wsBox.nome })]);
    expect(cutlist.length).toBeGreaterThan(0);

    const dir = cutlist.find((i) => i.metadata?.remateKind === "DIR");
    expect(dir?.metadata?.industrialLabel).toBeUndefined();
    expect(dir?.metadata?.remateKind).toBe("DIR");
    expect(dir?.tipo).toBe("remate");
    expect(dir?.metadata?.followBox).toBe(true);
    expect(dir?.metadata?.placementMode).toBe("SNAPPED");
    expect(dir?.metadata?.faceOffsets).toBeDefined();
  });

  it("remate L CIMA → MOD1_REMATE_L_ext / L_int com dimensões e grain", () => {
    const wsBox = { ...makeWorkspaceBox(), nome: "MOD1" };
    const remates = createRematePieces(
      { productType: "L", mountSlot: "CIMA", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );

    const cutlist = buildRemateCutlistItems(remates, [makeDivSepTestBox({ id: wsBox.id, nome: "MOD1" })]);
    expect(cutlist).toHaveLength(2);

    const ext = cutlist.find((i) => i.metadata?.remateKind === "L_ext");
    const int = cutlist.find((i) => i.metadata?.remateKind === "L_int");
    expect(ext?.nome).toBe("Remate L_ext");
    expect(int?.nome).toBe("Remate L_int");
    expect(ext?.metadata?.industrialLabel).toBeUndefined();
    expect(int?.metadata?.industrialLabel).toBeUndefined();
    expect(ext?.grainDirection).toBe("XX");
    expect(int?.grainDirection).toBe("YY");
    expect(ext?.dimensoes).toEqual({ largura: 600, altura: 100, profundidade: 19 });
    expect(int?.dimensoes).toEqual({ largura: 600, altura: 100, profundidade: 19 });
    expect(resolveObservacoesForCutListItem(ext!, {})).toEqual(["ME manual"]);
    expect(resolveObservacoesForCutListItem(int!, {})).toEqual(["ME manual"]);
  });

  it("buildCutlistItemsForIndustrialExport inclui remates com pieceNumber e qrSvg", () => {
    const box = makeDivSepTestBox({ id: "box-remate-ind", nome: "Armario_Test" });
    const wsBox = makeWorkspaceBox();
    const remates = createRematePieces(
      { productType: "AVISTA", mountSlot: "FRENTE", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );

    const all = buildCutlistItemsForIndustrialExport({
      boxes: [box],
      rules: defaultRulesConfig,
      materialId: "mdf_branco",
      projectName: "NP001",
      remates,
    });

    const remateItems = all.filter((i) => i.tipo === "remate");
    expect(remateItems.length).toBeGreaterThan(0);
    for (const item of remateItems) {
      expect(item.metadata?.industrialLabel).toBeUndefined();
      expect(item.metadata?.remateKind).toBeTruthy();
      expect(item.pieceNumber).toBeGreaterThan(0);
      expect(item.qrSvg).toBeTruthy();
      expect(item.grainDirection).toBe("XX");
    }
  });

  it("Layout PRO usa nome PRO quando não há industrialLabel legado", () => {
    const wsBox = makeWorkspaceBox();
    const remates = createRematePieces(
      { productType: "COMPLETO", mountSlot: "ESQ", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );
    const cutlist = buildRemateCutlistItems(remates, [makeDivSepTestBox({ id: wsBox.id, nome: wsBox.nome })]);
    const pieces = cutlistToPieces(cutlist, {
      projectName: "NP001",
      boxes: [{ id: wsBox.id, nome: wsBox.nome }],
    });
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces[0]?.partName).toMatch(/_rem$/i);
    expect(pieces[0]?.industrialGrainCode).toBe("YY");
    expect(pieces[0]?.materialId).toBeTruthy();
  });

  it("nomePersonalizado substitui nome na cutlist; sem industrialLabel antigo", () => {
    const wsBox = makeWorkspaceBox();
    const remates = createRematePieces(
      { productType: "COMPLETO", mountSlot: "DIR", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );
    const customized = remates.map((r) =>
      r.tipo === "DIR" ? { ...r, nomePersonalizado: "REMATE_DIR_CUSTOM" } : r
    );
    const cutlist = buildRemateCutlistItems(customized, [
      makeDivSepTestBox({ id: wsBox.id, nome: wsBox.nome }),
    ]);
    const dir = cutlist.find((i) => i.metadata?.remateKind === "DIR");
    expect(dir?.nome).toBe("REMATE_DIR_CUSTOM");
    expect(dir?.metadata?.industrialLabel).toBeUndefined();
    expect(dir?.metadata?.remateKind).toBe("DIR");
  });

  it("cutlistToPieces preserva ordem comprimento×largura dos remates (sem swap)", () => {
    const wsBox = makeWorkspaceBox();
    const remates = createRematePieces(
      { productType: "COMPLETO", mountSlot: "DIR", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );
    const customized = remates.map((r) =>
      r.tipo === "DIR" ? { ...r, width: 100, height: 720 } : r
    );
    const cutlist = buildRemateCutlistItems(customized, [
      makeDivSepTestBox({ id: wsBox.id, nome: wsBox.nome }),
    ]);
    const pieces = cutlistToPieces(cutlist);
    const dir = pieces.find((p) => p.pieceTipo === "remate");
    expect(dir?.largura_mm).toBe(100);
    expect(dir?.altura_mm).toBe(720);
  });
});
