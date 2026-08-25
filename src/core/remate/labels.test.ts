import { describe, expect, it } from "vitest";
import {
  resolveRemateIndustrialSuffix,
  resolveRematePieceDisplayName,
  resolveRematePieceNomeForRemate,
} from "./labels";
import type { RematePiece } from "./rematePieceTypes";

function remate(partial: Partial<RematePiece> & Pick<RematePiece, "id" | "tipo">): RematePiece {
  return {
    name: "legacy",
    width: 600,
    height: 720,
    depth: 19,
    visible: true,
    materialPresetId: "mdf_branco",
    ...partial,
  } as RematePiece;
}

describe("remate industrial labels", () => {
  it("resolveRemateIndustrialSuffix — L, laterais e AVISTA", () => {
    expect(resolveRemateIndustrialSuffix(remate({ id: "1", tipo: "L", productType: "L", partIndex: 1 }))).toBe(
      "L_ext"
    );
    expect(resolveRemateIndustrialSuffix(remate({ id: "2", tipo: "L", productType: "L", partIndex: 2 }))).toBe(
      "L_int"
    );
    expect(resolveRemateIndustrialSuffix(remate({ id: "3", tipo: "DIR", productType: "COMPLETO" }))).toBe("DIR");
    expect(resolveRemateIndustrialSuffix(remate({ id: "4", tipo: "FRENTE", productType: "AVISTA" }))).toBe("FRENTE");
  });

  it("resolveRematePieceDisplayName — personalizado ou automático curto", () => {
    const piece = remate({
      id: "r1",
      tipo: "DIR",
      productType: "COMPLETO",
      parentBoxId: "b1",
      nomePersonalizado: "REMATE_CUSTOM",
    });
    expect(resolveRematePieceDisplayName(piece, "Remate DIR")).toBe("REMATE_CUSTOM");
    expect(resolveRematePieceNomeForRemate(piece, { b1: "MOD1" })).toBe("REMATE_CUSTOM");

    const auto = remate({ id: "r2", tipo: "DIR", productType: "COMPLETO", parentBoxId: "b1" });
    expect(resolveRematePieceNomeForRemate(auto, { b1: "MOD1" })).toBe("Remate DIR");
  });
});
