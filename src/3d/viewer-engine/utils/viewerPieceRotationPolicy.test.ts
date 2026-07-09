import { describe, expect, it } from "vitest";
import {
  isViewerDoorRotationAllowed,
  isViewerRemateRotationAllowed,
  isViewerRodapeRotationAllowed,
} from "./viewerPieceRotationPolicy";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import type { ProjectRodape } from "../../../core/rodape/rodapeTypes";
import { resolveViewerRematePlacementMode } from "./viewerRematePose";

describe("viewerPieceRotationPolicy", () => {
  it("bloqueia rotação de remate com lockWoodGrain em MDF", () => {
    const piece = {
      materialPresetId: "mdf-branco-19",
      lockWoodGrain: true,
    } as RematePiece;
    expect(isViewerRemateRotationAllowed(piece)).toBe(false);
  });

  it("bloqueia rotação de rodapé com veio de madeira", () => {
    const rodape = {
      materialId: "carvalho-19",
    } as ProjectRodape;
    expect(isViewerRodapeRotationAllowed(rodape)).toBe(false);
  });

  it("bloqueia rotação de porta de madeira com lockWoodGrain", () => {
    expect(
      isViewerDoorRotationAllowed({
        materialId: "carvalho-19",
        lockWoodGrain: true,
      })
    ).toBe(false);
  });
});

describe("viewerRematePose", () => {
  it("preserva SNAPPED quando followBox e faceOffsets existem", () => {
    const piece = {
      followBox: true,
      placementMode: "FREE",
      faceOffsets: { offsetAlongNormalMm: 0, offsetTangentUMm: 0, offsetTangentVMm: 0 },
    } as RematePiece;
    expect(resolveViewerRematePlacementMode(piece)).toBe("SNAPPED");
  });
});
