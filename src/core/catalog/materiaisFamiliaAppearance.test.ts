import { describe, expect, it } from "vitest";
import {
  defaultTextureForFamilia,
  resolveFamiliaAppearance,
} from "./materiaisFamiliaAppearance";

describe("materiaisFamiliaAppearance", () => {
  it("mapeia famílias SSOT para texturas em public/textures", () => {
    expect(defaultTextureForFamilia("MDF Branco")).toBe("/textures/mdf/mdf-branco.jpg");
    expect(defaultTextureForFamilia("MDF Preto")).toBe("/textures/mdf/mdf-preto.jpg");
    expect(defaultTextureForFamilia("AGL CARVALHO")).toBe("/textures/wood/carvalho.jpg");
    expect(defaultTextureForFamilia("AGL LAM BRANCO")).toBe("/textures/mdf/mdf-branco.jpg");
  });

  it("resolve aparência por textura padrão ou cor do CRUD", () => {
    const withTex = resolveFamiliaAppearance("MDF Branco", []);
    expect(withTex.textureUrl).toBe("/textures/mdf/mdf-branco.jpg");
    expect(withTex.source).toBe("default_map");

    const colorOnly = resolveFamiliaAppearance("Material XYZ Custom", [
      {
        id: "x1",
        label: "Material XYZ Custom 19",
        categoryId: "outros",
        color: "#aabbcc",
        espessura: 19,
      },
    ]);
    expect(colorOnly.textureUrl).toBeNull();
    expect(colorOnly.color).toBe("#aabbcc");
    expect(colorOnly.source).toBe("color_only");
  });
});
