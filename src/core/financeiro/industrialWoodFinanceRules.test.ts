import { describe, expect, it } from "vitest";
import {
  isBundledSheetWoodTipo,
  isFallbackCarcassWoodTipo,
  isRemateOrRodapeTipo,
} from "./industrialWoodFinanceRules";

describe("industrialWoodFinanceRules", () => {
  it("identifica madeira agrupada nas chapas (porta/gaveta/remate)", () => {
    expect(isBundledSheetWoodTipo("porta_simples")).toBe(true);
    expect(isBundledSheetWoodTipo("porta_dupla")).toBe(true);
    expect(isBundledSheetWoodTipo("gaveta_frente_ext")).toBe(true);
    expect(isBundledSheetWoodTipo("gaveta_fundo")).toBe(true);
    expect(isBundledSheetWoodTipo("remate")).toBe(true);
    expect(isBundledSheetWoodTipo("rodape")).toBe(true);
    expect(isRemateOrRodapeTipo("rodapé")).toBe(true);
  });

  it("fallback Painéis = só carcaça", () => {
    expect(isFallbackCarcassWoodTipo("lateral_esquerda")).toBe(true);
    expect(isFallbackCarcassWoodTipo("cima")).toBe(true);
    expect(isFallbackCarcassWoodTipo("prateleira")).toBe(true);
    expect(isFallbackCarcassWoodTipo("porta_simples")).toBe(false);
    expect(isFallbackCarcassWoodTipo("gaveta_lat_esq")).toBe(false);
    expect(isFallbackCarcassWoodTipo("remate")).toBe(false);
  });
});
