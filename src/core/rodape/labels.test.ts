import { describe, expect, it } from "vitest";
import { resolveRodapePieceDisplayName, resolveRodapePieceNomeForRodape } from "./labels";
import type { ProjectRodape } from "./rodapeTypes";

function rodape(partial: Partial<ProjectRodape> & Pick<ProjectRodape, "id">): ProjectRodape {
  return {
    parentBoxId: "b1",
    kind: "SIMPLE",
    materialId: "mdf_branco",
    thicknessMm: 19,
    heightMm: 100,
    dimensions: { widthMm: 600, heightMm: 100, depthMm: 19 },
    name: "legacy",
    visible: true,
    ...partial,
  };
}

describe("rodape display labels", () => {
  it("resolveRodapePieceDisplayName — personalizado ou Rodapé", () => {
    const piece = rodape({ id: "r1", nomePersonalizado: "RODA_PE_ESQ" });
    expect(resolveRodapePieceDisplayName(piece, "Rodapé")).toBe("RODA_PE_ESQ");
    expect(resolveRodapePieceNomeForRodape(piece, { b1: "MOD1" })).toBe("RODA_PE_ESQ");

    const auto = rodape({ id: "r2" });
    expect(resolveRodapePieceNomeForRodape(auto, { b1: "MOD1" })).toBe("Rodapé");
  });
});
