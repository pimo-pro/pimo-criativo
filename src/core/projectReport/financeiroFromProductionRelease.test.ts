import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ProductionRelease } from "@/core/industrial/productionRelease";
import { collectPaineisSugestoesFromRelease } from "./paineisSugestoesProjeto";
import {
  emptyGerais,
  emptyQualidade,
  PROJECT_REPORT_VERSION,
  type ProjectReport,
} from "./types";
import {
  buildFinanceiroFromProductionRelease,
  withProductionReleaseFinanceiro,
} from "./financeiroFromProductionRelease";

vi.mock("@/core/pricing/pricing", () => ({
  getPrecoPorMaterial: () => 10,
}));

function sampleRelease(): ProductionRelease {
  return {
    version: 1,
    generatedAt: "2026-08-27T10:00:00.000Z",
    projectId: "proj-1",
    chapas: {
      totalSheets: 2,
      totalWasteMm2: 0,
      totalWastePct: 0,
      sheets: [
        {
          sheetIndex: 1,
          espessuraMm: 19,
          material: "MDF Branco",
          sheetLarguraMm: 2800,
          sheetAlturaMm: 2070,
          pieceCount: 1,
          usedAreaMm2: 0,
          sheetAreaMm2: 2800 * 2070,
          wasteMm2: 0,
          wastePct: 0,
          pieces: [
            {
              nome: "TAMPO",
              boxId: "box-1",
              nQr: "1",
              largura: 600,
              altura: 400,
            },
          ],
        },
        {
          sheetIndex: 2,
          espessuraMm: 19,
          material: "MDF Branco",
          sheetLarguraMm: 2800,
          sheetAlturaMm: 2070,
          pieceCount: 1,
          usedAreaMm2: 0,
          sheetAreaMm2: 2800 * 2070,
          wasteMm2: 0,
          wastePct: 0,
          pieces: [
            {
              nome: "LATERAL_ESQ",
              boxId: "box-1",
              nQr: "2",
              largura: 600,
              altura: 400,
            },
          ],
        },
      ],
      mode: "oficial_pro",
      diagnostics: ["origem=oficial_pro"],
    },
    ferragens: {
      totalEur: 12.5,
      totalQty: 4,
      lines: [
        {
          ferragemId: "dobradica_35mm",
          nome: "Dobradiça 35mm",
          quantidade: 4,
          precoUnitario: 3.125,
          precoTotal: 12.5,
          observacoes: "",
          origemPreco: "catalogo",
        },
      ],
    },
  };
}

function sampleReleaseWithCustos(): ProductionRelease {
  return {
    ...sampleRelease(),
    custos: {
      paineis: 0,
      portas: 0,
      gavetas: 45,
      ferragens: 12.5,
      orla: 20,
      remates: 0,
      operacoes: 30,
      desperdicio: 5,
      serragem: 2,
      chapasReais: 999,
      maoDeObra: 10,
      logistica: 8,
      operacoesAvancadas: 4,
      adm: 15,
      montagem: 50,
      portes: 12,
    },
    ivaPct: 23,
    custosOrigem: "oficial",
  };
}

function stubReport(financeiro = buildFinanceiroFromProductionRelease(null)): ProjectReport {
  return {
    projectId: "proj-1",
    version: PROJECT_REPORT_VERSION,
    reportStyle: "classic",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    gerais: emptyGerais(),
    metricas: {
      tarefasConcluidas: 0,
      erros: 0,
      errosCorrigidos: 0,
      melhorias: 0,
      ordensTrabalho: 0,
      colaboradores: 0,
    },
    design: {
      dataInicio: "",
      dataConclusao: "",
      revisoesAntesProducao: 0,
      revisoesAposProducao: 0,
      errosDesign: [],
      solucoesAplicadas: [],
      melhoriasPropostas: [],
      melhoriasImplementadas: [],
    },
    producao: {
      operadores: [],
      caixas: [],
      pecas: [],
      dataInicio: "",
      dataFim: "",
      horasEfetivas: 0,
      reProducoes: 0,
      erros: [],
      solucoesAplicadas: [],
      melhoriasPropostas: [],
      melhoriasImplementadas: [],
    },
    montagem: {
      dataEnvio: "",
      instaladores: [],
      dataInicio: "",
      dataFim: "",
      intervencoesPos: 0,
      erros: [],
      solucoesAplicadas: [],
      melhoriasPropostas: [],
      melhoriasImplementadas: [],
    },
    materiais: [],
    financeiro,
    manualPaths: ["gerais.nomeProjeto"],
    history: [],
    notas: [],
    qualidade: emptyQualidade(),
  };
}

describe("buildFinanceiroFromProductionRelease", () => {
  it("sem release → Financeiro vazio", () => {
    const fin = buildFinanceiroFromProductionRelease(null);
    expect(fin.linhas).toEqual([]);
    expect(fin.subtotal).toBe(0);
    expect(fin.totalProjeto).toBe(0);
  });

  it("com release → Painéis + Ferragens oficiais; resto 0; origem oficial_pro", () => {
    const fin = buildFinanceiroFromProductionRelease(sampleRelease());
    const paineis = fin.linhas.find((l) => l.key === "paineis");
    const ferragens = fin.linhas.find((l) => l.key === "ferragens");
    const orla = fin.linhas.find((l) => l.key === "orla");
    const mao = fin.linhas.find((l) => l.key === "maoDeObra");
    const chapasReais = fin.linhas.find((l) => l.key === "chapasReais");

    const sheetM2 = 2.8 * 2.07;
    expect(paineis?.quantidade).toBe(2);
    expect(paineis?.total).toBeCloseTo(10 * sheetM2 * 2, 2);
    expect(ferragens?.total).toBe(12.5);
    expect(ferragens?.quantidade).toBe(4);
    expect(orla?.total).toBe(0);
    expect(mao?.total).toBe(0);
    expect(chapasReais?.total).toBe(0);
    expect(fin.paineisOrigem).toBe("oficial_pro");
  });

  it("F2: accordion Painéis/Ferragens preenchido a partir do release", () => {
    const fin = buildFinanceiroFromProductionRelease(sampleRelease());
    const paineis = fin.linhas.find((l) => l.key === "paineis");
    const ferragens = fin.linhas.find((l) => l.key === "ferragens");
    expect((paineis?.detalhe?.length ?? 0) >= 1).toBe(true);
    expect(paineis?.detalhe?.[0]?.tipo).toBe("MDF Branco");
    expect(ferragens?.detalhe).toHaveLength(1);
    expect(ferragens?.detalhe?.[0]?.ferragemId).toBe("dobradica_35mm");
    expect(ferragens?.detalhe?.[0]?.quantidade).toBe(4);
    expect(collectPaineisSugestoesFromRelease(sampleRelease())).toContain("TAMPO");
    expect(collectPaineisSugestoesFromRelease(sampleRelease())).toContain("MDF Branco");
  });

  it("withProductionReleaseFinanceiro preserva gerais e manualPaths", () => {
    const report = stubReport();
    const next = withProductionReleaseFinanceiro(report, sampleRelease());
    expect(next.gerais).toEqual(report.gerais);
    expect(next.manualPaths).toEqual(["gerais.nomeProjeto"]);
    expect(next.financeiro.paineisOrigem).toBe("oficial_pro");
  });

  it("módulo não chama Unificado nem computeChapasReal", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "financeiroFromProductionRelease.ts"), "utf8");
    expect(src).not.toMatch(/from ["'][^"']*computeChapasReal/);
    expect(src).not.toMatch(/computeFinanceiroUnificado\s*\(/);
    expect(src).not.toMatch(/buildPaineisChapasDetalhe\s*\(/);
  });

  it("F4: com custos → linhas restantes do freeze; chapasReais=0; Painéis/Ferragens F2", () => {
    const fin = buildFinanceiroFromProductionRelease(sampleReleaseWithCustos());
    expect(fin.linhas.find((l) => l.key === "orla")?.total).toBe(20);
    expect(fin.linhas.find((l) => l.key === "gavetas")?.total).toBe(45);
    expect(fin.linhas.find((l) => l.key === "operacoes")?.total).toBe(30);
    expect(fin.linhas.find((l) => l.key === "desperdicio")?.total).toBe(5);
    expect(fin.linhas.find((l) => l.key === "serragem")?.total).toBe(2);
    expect(fin.linhas.find((l) => l.key === "maoDeObra")?.total).toBe(10);
    expect(fin.linhas.find((l) => l.key === "logistica")?.total).toBe(8);
    expect(fin.linhas.find((l) => l.key === "operacoesAvancadas")?.total).toBe(4);
    expect(fin.linhas.find((l) => l.key === "adm")?.total).toBe(15);
    expect(fin.linhas.find((l) => l.key === "montagem")?.total).toBe(50);
    expect(fin.linhas.find((l) => l.key === "portes")?.total).toBe(12);
    expect(fin.linhas.find((l) => l.key === "chapasReais")?.total).toBe(0);
    const sheetM2 = 2.8 * 2.07;
    expect(fin.linhas.find((l) => l.key === "paineis")?.total).toBeCloseTo(10 * sheetM2 * 2, 2);
    expect(fin.linhas.find((l) => l.key === "ferragens")?.total).toBe(12.5);
    expect(fin.ivaPct).toBe(23);
  });

  it("F4: sem custos → resto 0 (compat F2)", () => {
    const fin = buildFinanceiroFromProductionRelease(sampleRelease());
    expect(fin.linhas.find((l) => l.key === "orla")?.total).toBe(0);
    expect(fin.linhas.find((l) => l.key === "maoDeObra")?.total).toBe(0);
  });
});
