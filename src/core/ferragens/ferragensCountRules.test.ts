import { describe, expect, it } from "vitest";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_10x40_FERRAGEM_NOME,
} from "../drill/cavilha10x40Rule";
import { CORNER_DIREITA_INFERIOR_V2_ID } from "../cornerCabinet/cornerCabinetRules";
import type { BoxModule, CutListItemComPreco } from "../types";
import {
  boxHasCornerFixedFront,
  countParafuso3x30PorGavetas,
  pieceTemParafusoPuxador,
  resolveCanonicalFerragemId,
  resolveFerragemCommercialName,
} from "./ferragensCountRules";
import { FERRAGENS_DEFAULT } from "./ferragens";

describe("ferragensCountRules", () => {
  it("resolveCanonicalFerragemId unifica variantes legadas", () => {
    expect(resolveCanonicalFerragemId("cavilha_10mm")).toBe(CAVILHA_10x40_FERRAGEM_ID);
    expect(resolveCanonicalFerragemId("CAVILHA_10x40")).toBe(CAVILHA_10x40_FERRAGEM_ID);
    expect(resolveCanonicalFerragemId("cavilha_10x40")).toBe(CAVILHA_10x40_FERRAGEM_ID);
  });

  it("resolveFerragemCommercialName devolve Cavilha 10mm para qualquer alias", () => {
    const catalog = new Map(FERRAGENS_DEFAULT.map((f) => [f.id, f]));
    expect(resolveFerragemCommercialName("cavilha_10mm", catalog)).toBe(CAVILHA_10x40_FERRAGEM_NOME);
    expect(resolveFerragemCommercialName(CAVILHA_10x40_FERRAGEM_ID, catalog)).toBe(
      CAVILHA_10x40_FERRAGEM_NOME
    );
  });

  it("countParafuso3x30PorGavetas = 3 × nº gavetas", () => {
    const box = {
      id: "b1",
      drawersLayer: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
    } as BoxModule;
    expect(countParafuso3x30PorGavetas([box])).toBe(9);
  });

  it("boxHasCornerFixedFront para Canto — Direita (Inferior)", () => {
    const box = {
      baseCabinetId: CORNER_DIREITA_INFERIOR_V2_ID,
      portaTipo: "porta_simples",
    } as BoxModule;
    expect(boxHasCornerFixedFront(box)).toBe(true);
  });

  it("pieceTemParafusoPuxador false sem handle nem furos", () => {
    const item = {
      id: "p1",
      tipo: "gaveta_frente",
      metadata: { drawerIndex: 0 },
    } as CutListItemComPreco;
    const box = {
      id: "b1",
      drawersLayer: [{ id: "d1", handleType: "Nenhum" }],
    } as BoxModule;
    expect(pieceTemParafusoPuxador(item, box)).toBe(false);
  });
});
