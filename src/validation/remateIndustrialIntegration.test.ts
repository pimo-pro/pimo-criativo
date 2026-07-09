import { describe, expect, it, beforeEach } from "vitest";
import { clearAllCutlistCache } from "../core/manufacturing/cutlistFromBoxes";
import { buildCutlistItemsForIndustrialExport } from "../core/fabrication/buildCutlistItemsForIndustrialExport";
import { buildRemateCutlistItems } from "../core/remate/remateCutlist";
import { createRematePieces } from "../core/remate/rematePieceFactory";
import { resolveObservacoesForCutListItem } from "../core/observacoes/ObservacoesService";
import { makeDivSepTestBox } from "../core/divSep/divSepTestHelpers";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import { cutlistToPieces } from "../core/cutlayout/cutLayoutEngine";
import { convertProjectToV3Pieces } from "../nesting-v3/utils/convertProjectToV3Pieces";
import { v3PiecesToCutPieces } from "../core/cutlayout/integration/v3ToCutPieces";
import { isRotatablePiece } from "../core/cutlayout/utils/cutLayoutUtils";
import { loadNestingV3SettingsFromGlobal } from "../nesting-v3/nestingV3Settings";
import type { ProjectState } from "../context/projectTypes";

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

  it("gera etiquetas BOXNAME_REMATE_* na cutlist", () => {
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
    expect(dir?.nome).toMatch(/^Armario_Test_REMATE_DIR_\d{2}$/);
    expect(dir?.metadata?.industrialLabel).toBe(dir?.nome);
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
    expect(ext?.nome).toBe("MOD1_REMATE_L_ext_01");
    expect(int?.nome).toBe("MOD1_REMATE_L_int_01");
    expect(ext?.grainDirection).toBe("XX");
    expect(int?.grainDirection).toBe("YY");
    expect(ext?.dimensoes).toEqual({ largura: 600, altura: 100, profundidade: 19 });
    expect(int?.dimensoes).toEqual({ largura: 600, altura: 100, profundidade: 19 });
    expect(ext?.metadata?.followBox).toBe(true);
    expect(int?.metadata?.followBox).toBe(true);
    expect(ext?.metadata?.placementMode).toBe("SNAPPED");
    expect(int?.metadata?.placementMode).toBe("SNAPPED");
    expect(ext?.metadata?.faceOffsets).toBeDefined();
    expect(int?.metadata?.faceOffsets).toBeDefined();
    expect(ext?.metadata?.rotationSnapIndex).toBe(0);
    expect(int?.metadata?.rotationSnapIndex).toBe(0);
    expect(resolveObservacoesForCutListItem(ext!, {})).toEqual(["ME manual"]);
    expect(resolveObservacoesForCutListItem(int!, {})).toEqual(["ME manual"]);
  });

  it("buildCutlistItemsForIndustrialExport inclui remates com shortCode e pieceNumber", () => {
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
      expect(item.nome).toMatch(/_REMATE_/);
      expect(item.shortCode).toBeTruthy();
      expect(item.shortCode).not.toBe("ERR");
      expect(item.pieceNumber).toBeGreaterThan(0);
      expect(item.grainDirection).toBe("XX");
    }
  });

  it("Layout PRO preserva metadata.industrialLabel no partName", () => {
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
    expect(pieces[0]?.partName).toMatch(/^Armario_Test_REMATE_ESQ_\d{2}$/);
    expect(pieces[0]?.industrialGrainCode).toBe("YY");
    expect(pieces[0]?.materialId).toBeTruthy();
  });

  it("nomePersonalizado substitui nome na cutlist mas preserva industrialLabel", () => {
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
    expect(dir?.metadata?.industrialLabel).toMatch(/^Armario_Test_REMATE_DIR_\d{2}$/);
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

  it("L ext/int passam pelo pipeline industrial completo com metadata de veio/rotação", () => {
    const wsBox = makeWorkspaceBox();
    const remates = createRematePieces(
      { productType: "L", mountSlot: "CIMA", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "carvalho-19",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    ).map((r) =>
      r.partIndex === 1
        ? { ...r, lockWoodGrain: true, rotation: { ...r.rotation, yRad: Math.PI / 2 } }
        : { ...r, lockWoodGrain: true }
    );

    const project = {
      boxes: [makeDivSepTestBox({ id: wsBox.id, nome: wsBox.nome })],
      workspaceBoxes: [wsBox],
      rules: defaultRulesConfig,
      materialId: "carvalho-19",
      projectName: "NP001",
      remates,
    } as unknown as ProjectState;

    const v3Pieces = convertProjectToV3Pieces(project);
    const extV3 = v3Pieces.find((p) => p.remateKind === "L_ext");
    const intV3 = v3Pieces.find((p) => p.remateKind === "L_int");

    expect(extV3?.lockWoodGrain).toBe(true);
    expect(intV3?.lockWoodGrain).toBe(true);
    expect(extV3?.followBox).toBe(true);
    expect(intV3?.followBox).toBe(true);
    expect(extV3?.placementMode).toBe("SNAPPED");
    expect(extV3?.rotation).toBe(90);
    expect(extV3?.rotationSnapIndex).toBe(1);

    const cutPieces = v3PiecesToCutPieces(v3Pieces, loadNestingV3SettingsFromGlobal());
    const extCut = cutPieces.find((p) => p.metadata?.remateKind === "L_ext");
    const intCut = cutPieces.find((p) => p.metadata?.remateKind === "L_int");

    expect(extCut?.metadata?.lockWoodGrain).toBe(true);
    expect(intCut?.metadata?.lockWoodGrain).toBe(true);
    expect(extCut?.metadata?.faceOffsets).toBeDefined();
    expect(extCut?.metadata?.rotationSnapIndex).toBe(1);
    expect(isRotatablePiece(extCut!)).toBe(false);
    expect(isRotatablePiece(intCut!)).toBe(false);
  });
});
