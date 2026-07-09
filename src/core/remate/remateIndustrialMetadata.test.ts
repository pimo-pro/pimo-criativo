import { describe, expect, it } from "vitest";
import { createRematePieces } from "./rematePieceFactory";
import {
  buildRemateIndustrialViewerMetadata,
  readRotationSnapIndexFromMetadata,
  resolveV3RotationFromIndustrialMetadata,
  rotationSnapIndexToV3Rotation,
} from "./remateIndustrialMetadata";
import { makeDivSepTestBox } from "../divSep/divSepTestHelpers";

describe("remateIndustrialMetadata", () => {
  it("deriva faceOffsets e rotationSnapIndex para L ext/int sem faceOffsets persistidos", () => {
    const wsBox = makeDivSepTestBox({ id: "box-l-meta", nome: "MOD1" });
    const remates = createRematePieces(
      { productType: "L", mountSlot: "CIMA", parentBoxId: wsBox.id, followBox: true },
      {
        box: wsBox,
        materialPresetId: "mdf_branco",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.56 },
      }
    );
    const ext = remates.find((r) => r.partIndex === 1)!;
    const int = remates.find((r) => r.partIndex === 2)!;

    expect(ext.faceOffsets).toBeUndefined();
    expect(int.faceOffsets).toBeUndefined();

    const extMeta = buildRemateIndustrialViewerMetadata(ext);
    const intMeta = buildRemateIndustrialViewerMetadata(int);

    expect(extMeta.followBox).toBe(true);
    expect(intMeta.followBox).toBe(true);
    expect(extMeta.placementMode).toBe("SNAPPED");
    expect(intMeta.placementMode).toBe("SNAPPED");
    expect(extMeta.faceOffsets).toBeDefined();
    expect(intMeta.faceOffsets).toBeDefined();
    expect(extMeta.rotationSnapIndex).toBe(0);
    expect(intMeta.rotationSnapIndex).toBe(0);
  });

  it("rotationSnapIndexToV3Rotation alinha orientação viewer com rotação V3", () => {
    expect(rotationSnapIndexToV3Rotation(0)).toBe(0);
    expect(rotationSnapIndexToV3Rotation(1)).toBe(90);
    expect(rotationSnapIndexToV3Rotation(2)).toBe(180);
    expect(rotationSnapIndexToV3Rotation(3)).toBe(270);
  });

  it("readRotationSnapIndexFromMetadata lê índice directo ou via faceOffsets", () => {
    expect(readRotationSnapIndexFromMetadata({ rotationSnapIndex: 2 })).toBe(2);
    expect(
      readRotationSnapIndexFromMetadata({
        faceOffsets: { offsetAlongNormalMm: 0, offsetTangentUMm: 0, offsetTangentVMm: 0, rotationSnapIndex: 3 },
      })
    ).toBe(3);
  });

  it("resolveV3RotationFromIndustrialMetadata preserva snap com veio activo", () => {
    const out = resolveV3RotationFromIndustrialMetadata({
      rotationSnapIndex: 1,
      materialId: "carvalho-19",
      lockWoodGrain: true,
      pieceTipo: "porta_simples",
      industrialGrainCode: "YY",
    });
    expect(out.rotation).toBe(90);
    expect(out.rotationSnapIndex).toBe(1);
  });
});
