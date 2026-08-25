import { describe, it, expect, vi } from "vitest";
import { buildIndustrialArmazemPdf, industrialArmazemPdfFileName } from "./pdfIndustrialArmazem";
import type { ChapasRealSummary } from "../industrial/computeChapasReal";
import type { ConsumoMateriaisSummary } from "../industrial/computeConsumoMateriais";

vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({ ok: false }) as Response)
);

describe("buildIndustrialArmazemPdf", () => {
  it("gera PDF unificado com resumo + consumo por chapa (sem peças)", async () => {
    const chapas: ChapasRealSummary = {
      totalSheets: 2,
      totalWasteMm2: 100000,
      totalWastePct: 10,
      mode: "real",
      diagnostics: [],
      sheets: [
        {
          sheetIndex: 1,
          material: "MDF Branco",
          espessuraMm: 19,
          sheetLarguraMm: 2750,
          sheetAlturaMm: 1830,
          pieceCount: 3,
          usedAreaMm2: 1_000_000,
          sheetAreaMm2: 2_000_000,
          wasteMm2: 1_000_000,
          wastePct: 50,
          pieces: [{ nome: "LAT", boxId: "C1", nQr: "x", largura: 600, altura: 700 }],
        },
        {
          sheetIndex: 2,
          material: "MDF Branco",
          espessuraMm: 10,
          sheetLarguraMm: 2750,
          sheetAlturaMm: 1830,
          pieceCount: 2,
          usedAreaMm2: 800_000,
          sheetAreaMm2: 2_000_000,
          wasteMm2: 1_200_000,
          wastePct: 60,
          pieces: [],
        },
      ],
      layout: null,
    };
    const consumo: ConsumoMateriaisSummary = {
      porPeca: [
        {
          pecaId: "1",
          peca: "LAT",
          caixa: "C1",
          nQr: "x",
          material: "MDF Branco",
          areaMm2: 100000,
          pesoKg: 1,
          quantidade: 3,
        },
      ],
      porChapa: chapas.sheets.map((s) => ({
        chapaIndex: s.sheetIndex,
        material: s.material,
        espessuraMm: s.espessuraMm,
        areaUsadaMm2: s.usedAreaMm2,
        areaChapaMm2: s.sheetAreaMm2,
        desperdicioMm2: s.wasteMm2,
        desperdicioPct: s.wastePct,
      })),
      desperdicioTotalMm2: chapas.totalWasteMm2,
      desperdicioTotalPct: chapas.totalWastePct,
    };

    const doc = await buildIndustrialArmazemPdf("Projeto Teste", chapas, consumo);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(industrialArmazemPdfFileName("Projeto Teste")).toBe("Projeto_Teste_industrial_armazem.pdf");
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
