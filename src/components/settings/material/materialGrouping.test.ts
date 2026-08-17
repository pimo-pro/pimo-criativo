import { describe, expect, it } from "vitest";
import { listOfficialMaterials } from "../../../core/materials/materials.api";
import {
  extractMaterialBaseName,
  groupMaterialsByPadronizado,
  toMaterialPadronizado,
} from "./materialGrouping";

describe("materialGrouping SSOT", () => {
  it("extractMaterialBaseName remove espessura sem exigir sufixo mm", () => {
    expect(extractMaterialBaseName("MDF Branco 19")).toBe("MDF Branco");
    expect(extractMaterialBaseName("Carvalho 10")).toBe("Carvalho");
    expect(extractMaterialBaseName("Lacado 17 mm")).toBe("Lacado");
    expect(extractMaterialBaseName("HDF CRU 19mm")).toBe("HDF CRU");
  });

  it("agrupa oficiais por família SSOT sem números no nome", () => {
    const list = listOfficialMaterials().filter((m) => m.industrial && m.visual);
    const grupos = groupMaterialsByPadronizado(list);
    const names = grupos.map((g) => g.materialPadronizado);

    expect(names.some((n) => /\d/.test(n))).toBe(false);
    expect(names).toContain("MDF Branco");
    expect(names).toContain("MDF Preto");
    expect(names).toContain("AGL LAM BRANCO");

    const mdf = grupos.find((g) => g.materialPadronizado === "MDF Branco");
    expect(mdf).toBeTruthy();
    expect(mdf!.listaDeEspessuras.length).toBeGreaterThanOrEqual(2);

    expect(
      toMaterialPadronizado("MDF Branco 19", { canonicalId: "mdf_branco-19" })
    ).toBe("MDF Branco");
  });
});
