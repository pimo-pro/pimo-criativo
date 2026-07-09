import { describe, expect, it } from "vitest";
import {
  buildViewerRemateTransformPatch,
  effectiveRemateForViewerPose,
} from "./viewerRematePose";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";

describe("viewerRematePose", () => {
  it("movimento manual define placementMode FREE sem faceOffsets", () => {
    const patch = buildViewerRemateTransformPatch("translate", {
      position: { xMm: 10, yMm: 20, zMm: 30 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
    });
    expect(patch.placementMode).toBe("FREE");
    expect(patch.faceOffsets).toBeUndefined();
    expect(patch.followBox).toBeUndefined();
  });

  it("FREE preserva posição mesmo com followBox e faceOffsets", () => {
    const piece = {
      followBox: true,
      placementMode: "FREE",
      faceOffsets: { offsetAlongNormalMm: 0, offsetTangentUMm: 0, offsetTangentVMm: 0 },
      position: { xMm: 50, yMm: 60, zMm: 70 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
    } as RematePiece;
    const effective = effectiveRemateForViewerPose(piece);
    expect(effective.placementMode).toBe("FREE");
    expect(effective.position.xMm).toBe(50);
  });
});
