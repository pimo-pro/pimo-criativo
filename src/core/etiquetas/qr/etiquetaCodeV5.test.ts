import { describe, it, expect } from "vitest";
import {
  buildEtiquetaCodeV5,
  buildEtiquetaQrPayloadV5,
  buildPiecesPerSheetMap,
  extractProjectSigla,
  formatNumCaixa,
  labelItemSheetKey,
} from "./etiquetaCodeV5";
import { buildFullIndustrialName, buildIndustrialId } from "../../naming/industrialNaming";

describe("etiquetaCodeV5 — ID industrial (buildIndustrialId)", () => {
  it("exemplo auditoria: khaled_cozinha_nova_c_1_lat_dir → kcnc1ld", () => {
    const full = buildFullIndustrialName("Khaled Cozinha Nova", "C 1", "lateral_direita");
    expect(full).toBe("khaled_cozinha_nova_c_1_lat_dir");
    expect(
      buildEtiquetaCodeV5({
        projectName: "Khaled Cozinha Nova",
        totalPiecesInSheet: 8,
        pieceSeq: 1,
        boxName: "C 1",
        nomeIndustrial: "lateral_direita",
      })
    ).toBe("kcnc1ld");
    expect(buildIndustrialId(full)).toBe("kcnc1ld");
  });

  it("sem NUM_CAIXA nem -SEQ no código", () => {
    const code = buildEtiquetaCodeV5({
      projectName: "NP262269",
      totalPiecesInSheet: 5,
      pieceSeq: 99,
      boxName: "Caixa 1",
      nomeIndustrial: "cima",
    });
    expect(code).toBe(buildIndustrialId("np262269_caixa_1_top"));
    expect(code).not.toMatch(/-/);
    expect(code).not.toMatch(/\d{3}-/);
  });

  it("metadata industrialLabel legado — não retokeniza; ID a partir do nome guardado", () => {
    const code = buildEtiquetaCodeV5({
      projectName: "ANTONIO_NOVO_5",
      totalPiecesInSheet: 4,
      pieceSeq: 6,
      boxName: "CC4",
      nomeIndustrial: "ANTONIO_NOVO_5_CC4_REMATE_L_B_01",
    });
    expect(code).toBe(buildIndustrialId("antonio_novo_5_cc4_remate_l_b_01"));
  });

  it("lateral_esquerda / lateral_direita nunca trocam", () => {
    const esq = buildEtiquetaCodeV5({
      projectName: "Proj",
      boxName: "Caixa 1",
      nomeIndustrial: "lateral_esquerda",
      pieceSeq: 1,
      totalPiecesInSheet: 1,
    });
    const dir = buildEtiquetaCodeV5({
      projectName: "Proj",
      boxName: "Caixa 1",
      nomeIndustrial: "lateral_direita",
      pieceSeq: 1,
      totalPiecesInSheet: 1,
    });
    expect(esq).toBe(buildIndustrialId("proj_caixa_1_lat_esq"));
    expect(dir).toBe(buildIndustrialId("proj_caixa_1_lat_dir"));
    expect(esq).not.toBe(dir);
  });

  it("helpers legados extractProjectSigla / formatNumCaixa ainda existem", () => {
    expect(extractProjectSigla("COZINHA AZUL PREMIUM")).toBe("CAP");
    expect(formatNumCaixa(12)).toBe("12");
  });

  it("payload QR v5 legado (listas) — inalterado neste passo", () => {
    expect(
      buildEtiquetaQrPayloadV5({
        industrialPieceRef: "ANTONIO_NOVO_5_CC4_REMATE_L_B_01",
        pieceSeq: 6,
      })
    ).toBe("ANTONIO_NOVO_5_CC4_REMATE_L_B_01-6");
  });
});

describe("buildPiecesPerSheetMap", () => {
  it("4.1 — com placements: totais por sheetIndex", () => {
    const items = [
      { boxId: "b1", nome: "p1" },
      { boxId: "b1", nome: "p2" },
      { boxId: "b2", nome: "p3" },
    ];
    const placements = [
      { boxId: "b1", partName: "p1", sheetIndex: 0 },
      { boxId: "b1", partName: "p2", sheetIndex: 0 },
      { boxId: "b2", partName: "p3", sheetIndex: 1 },
    ];
    const map = buildPiecesPerSheetMap(items, placements);
    expect(map.get(labelItemSheetKey("b1", "p1"))).toBe(2);
    expect(map.get(labelItemSheetKey("b1", "p2"))).toBe(2);
    expect(map.get(labelItemSheetKey("b2", "p3"))).toBe(1);
  });

  it("4.1b — sem match em placements: fallback por boxId", () => {
    const items = [
      { boxId: "b1", nome: "p1" },
      { boxId: "b1", nome: "p_extra" },
    ];
    const placements = [{ boxId: "b1", partName: "p1", sheetIndex: 0 }];
    const map = buildPiecesPerSheetMap(items, placements);
    expect(map.get(labelItemSheetKey("b1", "p1"))).toBe(1);
    expect(map.get(labelItemSheetKey("b1", "p_extra"))).toBe(2);
  });

  it("4.2 — sem placements: agrupa por boxId", () => {
    const items = [
      { boxId: "A", nome: "x" },
      { boxId: "A", nome: "y" },
      { boxId: "B", nome: "z" },
    ];
    const map = buildPiecesPerSheetMap(items);
    expect(map.get(labelItemSheetKey("A", "x"))).toBe(2);
    expect(map.get(labelItemSheetKey("B", "z"))).toBe(1);
  });

  it("4.3 — sem placements e sem boxId: agrupa por nome", () => {
    const items = [{ nome: "lat_esq" }, { nome: "lat_esq" }, { nome: "cima" }];
    const map = buildPiecesPerSheetMap(items);
    expect(map.get(labelItemSheetKey(undefined, "lat_esq"))).toBe(2);
    expect(map.get(labelItemSheetKey(undefined, "cima"))).toBe(1);
  });
});
