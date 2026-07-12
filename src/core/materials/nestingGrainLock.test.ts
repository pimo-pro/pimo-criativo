import { describe, expect, it } from "vitest";
import {
  inferMaterialMadeiraFromRecord,
  isMaterialMadeira,
  isNestingRotationLocked,
  isViewerGrainFlipped,
  resolveNestingLayoutGrainDirection,
  resolveViewerGrainDirectionForPiece,
  resolveViewerGrainUvScale,
  shouldPreserveDesignDimensions,
} from "./nestingGrainLock";

describe("inferMaterialMadeiraFromRecord", () => {
  it("respeita valor explícito", () => {
    expect(inferMaterialMadeiraFromRecord({ materialMadeira: true })).toBe(true);
    expect(inferMaterialMadeiraFromRecord({ materialMadeira: false })).toBe(false);
  });

  it("infere carvalho como madeira e MDF como não-madeira", () => {
    expect(inferMaterialMadeiraFromRecord({ categoryId: "carvalho", label: "X" })).toBe(true);
    expect(inferMaterialMadeiraFromRecord({ categoryId: "mdf", label: "Branco" })).toBe(false);
  });
});

describe("shouldPreserveDesignDimensions", () => {
  it("preserva madeira e YY mesmo com allowPieceRotation true", () => {
    expect(
      shouldPreserveDesignDimensions({
        materialId: "carvalho",
        industrialGrainCode: "YY",
        allowPieceRotation: true,
      })
    ).toBe(true);
  });

  it("preserva remates", () => {
    expect(shouldPreserveDesignDimensions({ isRemate: true, materialId: "mdf_branco" })).toBe(true);
  });
});

describe("isNestingRotationLocked", () => {
  it("YY industrial bloqueia rotação por defeito", () => {
    expect(isNestingRotationLocked({ industrialGrainCode: "YY", materialId: "mdf_branco" })).toBe(true);
  });

  it("materialMadeira bloqueia por defeito", () => {
    expect(
      isNestingRotationLocked({
        industrialGrainCode: "XX",
        materialId: "carvalho",
        allowPieceRotation: undefined,
      })
    ).toBe(true);
  });

  it("allowPieceRotation true libera rotação em material de madeira", () => {
    expect(
      isNestingRotationLocked({
        industrialGrainCode: "XX",
        materialId: "carvalho",
        allowPieceRotation: true,
      })
    ).toBe(false);
  });

  it("lockWoodGrain true bloqueia rotação mesmo sem materialMadeira", () => {
    expect(
      isNestingRotationLocked({
        industrialGrainCode: "XX",
        materialId: "mdf_branco",
        lockWoodGrain: true,
      })
    ).toBe(true);
  });

  it("allowPieceRotation false bloqueia mesmo sem materialMadeira", () => {
    expect(
      isNestingRotationLocked({
        industrialGrainCode: "XX",
        materialId: "mdf_branco",
        allowPieceRotation: false,
      })
    ).toBe(true);
  });
});

describe("resolveNestingLayoutGrainDirection", () => {
  it("devolve eixo quando bloqueado", () => {
    expect(
      resolveNestingLayoutGrainDirection({
        industrialGrainCode: "YY",
        pieceTipo: "porta_simples",
        materialId: "carvalho",
      })
    ).toBe("width");
    expect(
      resolveNestingLayoutGrainDirection({
        industrialGrainCode: "XX",
        materialId: "carvalho",
      })
    ).toBe("length");
  });

  it("livre quando material não é madeira e XX", () => {
    expect(
      resolveNestingLayoutGrainDirection({
        industrialGrainCode: "XX",
        materialId: "mdf_branco",
      })
    ).toBeUndefined();
  });
});

describe("resolveViewerGrainDirectionForPiece", () => {
  it("porta madeira YY = vertical por defeito", () => {
    expect(
      resolveViewerGrainDirectionForPiece({
        materialId: "carvalho",
        industrialGrainCode: "YY",
        pieceTipo: "porta_simples",
      })
    ).toBe("vertical");
  });

  it("allowPieceRotation true inverte veio no viewer", () => {
    expect(
      resolveViewerGrainDirectionForPiece({
        materialId: "carvalho",
        industrialGrainCode: "YY",
        pieceTipo: "porta_simples",
        allowPieceRotation: true,
      })
    ).toBe("horizontal");
  });

  it("gaveta frente = horizontal por defeito", () => {
    expect(
      resolveViewerGrainDirectionForPiece({
        materialId: "carvalho",
        industrialGrainCode: "YY",
        pieceTipo: "gaveta_frente",
      })
    ).toBe("horizontal");
  });
});

describe("viewer grain UV", () => {
  it("inverte escala quando peça virada", () => {
    expect(isViewerGrainFlipped(1)).toBe(true);
    expect(isViewerGrainFlipped(0)).toBe(false);
    const base = { x: 2, y: 1 };
    expect(
      resolveViewerGrainUvScale(base, {
        materialMadeira: true,
        grainFlipped: true,
        grainDirection: "horizontal",
      })
    ).toEqual({ x: 1, y: 2 });
  });

  it("isMaterialMadeira false sem id", () => {
    expect(isMaterialMadeira(undefined)).toBe(false);
  });
});
