import { describe, expect, it } from "vitest";
import {
  buildFullIndustrialName,
  buildIndustrialId,
  resolvePieceToken,
  sanitizeIndustrialToken,
} from "./industrialNaming";

describe("sanitizeIndustrialToken", () => {
  it("remove acentos, espaços→_, lowercase, colapsa _", () => {
    expect(sanitizeIndustrialToken("Khaled Cozinha Nova")).toBe("khaled_cozinha_nova");
    expect(sanitizeIndustrialToken("Armário  Teste")).toBe("armario_teste");
    expect(sanitizeIndustrialToken("__A__B__")).toBe("a_b");
  });
});

describe("resolvePieceToken — sem inversão L/R", () => {
  it("lateral_esquerda → lat_esq; lateral_direita → lat_dir", () => {
    expect(resolvePieceToken("lateral_esquerda")).toBe("lat_esq");
    expect(resolvePieceToken("lateral_direita")).toBe("lat_dir");
    expect(resolvePieceToken("Lateral Esquerda")).toBe("lat_esq");
    expect(resolvePieceToken("lateral direita")).toBe("lat_dir");
  });

  it("nunca troca lados", () => {
    expect(resolvePieceToken("lateral_esquerda")).not.toBe("lat_dir");
    expect(resolvePieceToken("lateral_direita")).not.toBe("lat_esq");
  });
});

describe("buildFullIndustrialName", () => {
  it("ex.: khaled_cozinha_nova_c_1_lat_dir", () => {
    expect(
      buildFullIndustrialName("Khaled Cozinha Nova", "C 1", "lateral_direita")
    ).toBe("khaled_cozinha_nova_c_1_lat_dir");
  });

  it("duplicatas sem zero à esquerda (_1 … _10)", () => {
    for (let i = 1; i <= 10; i++) {
      const name = buildFullIndustrialName("Proj", "Caixa 1", "prateleira", i);
      expect(name).toBe(`proj_caixa_1_pra_${i}`);
      expect(name).not.toMatch(/_0\d/);
    }
  });

  it("lateral_esquerda sem inversão no nome completo", () => {
    expect(buildFullIndustrialName("Proj", "Caixa 1", "lateral_esquerda")).toBe(
      "proj_caixa_1_lat_esq"
    );
    expect(buildFullIndustrialName("Proj", "Caixa 1", "lateral_direita")).toBe(
      "proj_caixa_1_lat_dir"
    );
  });
});

describe("buildIndustrialId", () => {
  it("khaled_cozinha_nova_c_1_lat_dir → kcnc1ld", () => {
    expect(buildIndustrialId("khaled_cozinha_nova_c_1_lat_dir")).toBe("kcnc1ld");
  });

  it("id a partir do nome completo gerado", () => {
    const full = buildFullIndustrialName("Khaled Cozinha Nova", "C 1", "lateral_direita");
    expect(buildIndustrialId(full)).toBe("kcnc1ld");
  });
});
