/**
 * Fase 5 — Suite de parity / sticky / lineOverrides / flag on-off
 * conforme matriz aprovada (deploy e default da flag NÃO entram aqui).
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import {
  FINANCEIRO_CUSTO_KEYS,
  type FinanceiroCustoKey,
} from "@/core/financeiro/financeiroUnificadoTypes";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import type { BoxModule } from "@/core/types";
import * as featuresMod from "../features";
import {
  applyDetalheProvenanceForKey,
  collectPaineisSugestoesProjeto,
  features,
  isReportFinanceiroProvenanceEnabled,
  officialLineTotal,
  setReportLineOverride,
  withLiveFinanceiro,
  type ProjectReport,
  type ReportFinanceiroDetalhe,
} from "./index";
import {
  buildLiveReportFinanceiro,
  snapshotToReportFinanceiro,
} from "./financeiroFromUnificado";
import { setReportMargemGanho } from "./financeiroMargemGanho";
import {
  emptyDesign,
  emptyGerais,
  emptyMetricas,
  emptyMontagem,
  emptyProducao,
  emptyQualidade,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function minimalBox(): BoxModule {
  return {
    id: "b1",
    nome: "Caixa",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    portaTipo: "sem_porta",
    gavetas: 0,
    prateleiras: 1,
    doorsLayer: [],
    drawersLayer: [],
    costaAtiva: true,
    material: "mdf_branco",
  } as unknown as BoxModule;
}

function minimalProject(name = "Fase5") {
  return {
    boxes: [minimalBox()],
    rules: defaultRulesConfig,
    materialId: "mdf_branco",
    projectName: name,
    remates: [],
    rodapes: [],
    financeiroOverrides: {
      ivaPct: 23,
      custos: { adm: 40 },
    },
  };
}

function lineTotal(
  fin: { linhas: Array<{ key: string; total: number }> },
  key: string
): number {
  return round2(Number(fin.linhas.find((l) => l.key === key)?.total) || 0);
}

function stickyRow(
  partial: Partial<ReportFinanceiroDetalhe> & Pick<ReportFinanceiroDetalhe, "id" | "tipo">
): ReportFinanceiroDetalhe {
  return {
    dimensoes: "",
    quantidade: 3,
    precoUnitario: 1,
    total: 3,
    ...partial,
  };
}

/** Keys sem builder SSOT de detalhe — padrão S1/S1m parametrizado (*). */
const KEYS_SEM_BUILDER_SSOT = [
  "portas",
  "remates",
  "gavetas",
  "operacoes",
  "desperdicio",
  "serragem",
  "maoDeObra",
  "logistica",
  "operacoesAvancadas",
  "adm",
  "montagem",
  "portes",
] as const satisfies readonly FinanceiroCustoKey[];

const OVERRIDEABLE_FOR_L = [
  "paineis",
  "ferragens",
  "orla",
  "gavetas",
  "adm",
  "montagem",
  "portes",
  "portas",
  "remates",
] as const satisfies readonly FinanceiroCustoKey[];

function stubReport(projectId: string, financeiro: ProjectReport["financeiro"]): ProjectReport {
  return {
    projectId,
    version: 2,
    reportStyle: "classico",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    gerais: emptyGerais(),
    metricas: emptyMetricas(),
    design: emptyDesign(),
    producao: emptyProducao(),
    montagem: emptyMontagem(),
    materiais: [],
    financeiro,
    manualPaths: [],
    history: [],
    notas: [],
    qualidade: emptyQualidade(),
  };
}

describe("Fase 5 — flag default false (transversal)", () => {
  it("features.reportFinanceiroProvenance === false", () => {
    expect(features.reportFinanceiroProvenance).toBe(false);
    expect(isReportFinanceiroProvenanceEnabled()).toBe(false);
  });
});

describe("Fase 5 — P: parity totais Relatório == ADMIN (todas as keys)", () => {
  it("cada FinanceiroCustoKey + iva/total alinhados ao Unificado", () => {
    const project = minimalProject("Fase5-P");
    const snap = computeFinanceiroUnificado(project);
    const report = buildLiveReportFinanceiro(project as never, []);

    for (const key of FINANCEIRO_CUSTO_KEYS) {
      expect(lineTotal(report, key), key).toBe(officialLineTotal(snap, key));
    }
    expect(report.subtotal).toBe(round2(snap.subtotal));
    expect(report.ivaValor).toBe(round2(snap.ivaValor));
    expect(report.totalProjeto).toBe(round2(snap.totalProjeto));
    expect(lineTotal(report, "chapasReais")).toBe(0);
    expect(lineTotal(report, "portas")).toBe(0);
    expect(lineTotal(report, "remates")).toBe(0);
  });
});

describe("Fase 5 — G: withLiveFinanceiro (simula reabrir) parity", () => {
  it("após withLiveFinanceiro, totais == ADMIN para todas as keys", () => {
    const project = minimalProject("Fase5-G");
    const snap = computeFinanceiroUnificado(project);
    const live = buildLiveReportFinanceiro(project as never, []);
    const report = stubReport("Fase5-G", live);
    const again = withLiveFinanceiro(report, project as never, []);

    for (const key of FINANCEIRO_CUSTO_KEYS) {
      expect(lineTotal(again.financeiro, key), key).toBe(
        officialLineTotal(snap, key)
      );
    }
    expect(again.financeiro.totalProjeto).toBe(round2(snap.totalProjeto));
  });
});

describe("Fase 5 — S0 flag OFF sticky preserve", () => {
  afterEach(() => vi.restoreAllMocks());

  it("Painéis: detalhe sticky preservado", () => {
    expect(isReportFinanceiroProvenanceEnabled()).toBe(false);
    const sticky = [stickyRow({ id: "s", tipo: "Sticky Painéis", quantidade: 9, total: 9 })];
    const report = buildLiveReportFinanceiro(minimalProject() as never, [], {
      preserveDetalheByKey: { paineis: sticky },
      projectId: "s0",
    });
    expect(report.linhas.find((l) => l.key === "paineis")?.detalhe?.[0]?.tipo).toBe(
      "Sticky Painéis"
    );
  });

  it("Ferragens: detalhe sticky preservado (com ou sem overrides)", () => {
    const sticky = [stickyRow({ id: "ferr-old", tipo: "Ferragem Sticky", total: 99 })];
    const report = buildLiveReportFinanceiro(minimalProject() as never, [], {
      preserveDetalheByKey: { ferragens: sticky },
      projectId: "s0f",
    });
    expect(
      report.linhas.find((l) => l.key === "ferragens")?.detalhe?.some(
        (d) => d.tipo === "Ferragem Sticky"
      )
    ).toBe(true);
  });
});

describe("Fase 5 — S1 / S1m keys sem builder SSOT (*)", () => {
  it.each(KEYS_SEM_BUILDER_SSOT)(
    "%s: 1ª migração descarta unmarked; mantém manual_added",
    (key) => {
      const unmarked = [stickyRow({ id: "u", tipo: "Lixo sticky" })];
      const manual = [
        stickyRow({
          id: "m",
          tipo: "Extra manual",
          provenance: "manual_added",
          total: 7,
        }),
      ];
      const dropped = applyDetalheProvenanceForKey({
        key,
        legacy: unmarked,
        ssot: [],
        firstMigration: true,
      });
      expect(dropped).toHaveLength(0);

      const kept = applyDetalheProvenanceForKey({
        key,
        legacy: [...unmarked, ...manual],
        ssot: [],
        firstMigration: true,
      });
      expect(kept).toHaveLength(1);
      expect(kept[0]?.tipo).toBe("Extra manual");
      expect(kept[0]?.provenance).toBe("manual_added");
    }
  );
});

describe("Fase 5 — S1 Painéis + F3 Ferragens (flag ON)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("Painéis: with_diff sem provenance → SSOT (S1)", () => {
    vi.spyOn(featuresMod, "isReportFinanceiroProvenanceEnabled").mockReturnValue(
      true
    );
    const legacy = [
      stickyRow({
        id: "old",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 9,
        precoUnitario: 1,
        total: 9,
      }),
    ];
    const ssot = [
      stickyRow({
        id: "new",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 2,
        precoUnitario: 50,
        total: 100,
      }),
    ];
    const merged = applyDetalheProvenanceForKey({
      key: "paineis",
      legacy,
      ssot,
      firstMigration: true,
    });
    expect(merged[0]?.quantidade).toBe(2);
    expect(merged[0]?.provenance).toBe("ssot");
  });

  it("Painéis: manual_edit mantém-se (S1m)", () => {
    vi.spyOn(featuresMod, "isReportFinanceiroProvenanceEnabled").mockReturnValue(
      true
    );
    const legacy = [
      stickyRow({
        id: "old",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 9,
        precoUnitario: 1,
        total: 9,
        provenance: "manual_edit",
      }),
    ];
    const ssot = [
      stickyRow({
        id: "new",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 2,
        precoUnitario: 50,
        total: 100,
      }),
    ];
    const merged = applyDetalheProvenanceForKey({
      key: "paineis",
      legacy,
      ssot,
      firstMigration: false,
    });
    expect(merged[0]?.quantidade).toBe(9);
    expect(merged[0]?.provenance).toBe("manual_edit");
  });

  it("Ferragens F3: sticky detalhe ignorado; rebuild a partir do SSOT", () => {
    vi.spyOn(featuresMod, "isReportFinanceiroProvenanceEnabled").mockReturnValue(
      true
    );
    const sticky = [stickyRow({ id: "ferr-old", tipo: "Ferragem Sticky", total: 99 })];
    const report = buildLiveReportFinanceiro(minimalProject("F3") as never, [], {
      preserveDetalheByKey: { ferragens: sticky },
      projectId: "F3",
      sourceFinanceiro: { provenanceVersion: undefined } as never,
    });
    const det = report.linhas.find((l) => l.key === "ferragens")?.detalhe ?? [];
    expect(det.every((d) => d.tipo !== "Ferragem Sticky")).toBe(true);
  });
});

describe("Fase 5 — L0 / L1 / Lrep lineOverrides", () => {
  afterEach(() => vi.restoreAllMocks());

  it("L0 flag OFF: lineOverrides aplicam-se sem lineOverrideMeta", () => {
    expect(isReportFinanceiroProvenanceEnabled()).toBe(false);
    const project = minimalProject("L0");
    const report = buildLiveReportFinanceiro(project as never, [], {
      lineOverrides: { adm: 999 },
      projectId: "L0",
    });
    expect(lineTotal(report, "adm")).toBe(999);
    expect(report.lineOverrideMeta).toBeUndefined();
  });

  it("L1 flag ON: lineOverrides preservados + meta possível", () => {
    vi.spyOn(featuresMod, "isReportFinanceiroProvenanceEnabled").mockReturnValue(
      true
    );
    const stickyDetalhe = [
      stickyRow({ id: "a", tipo: "X", quantidade: 1, precoUnitario: 50, total: 50 }),
    ];
    const report = buildLiveReportFinanceiro(minimalProject("L1") as never, [], {
      lineOverrides: { paineis: 50 },
      preserveDetalheByKey: { paineis: stickyDetalhe },
      attachChapasDetalhe: false,
      projectId: "L1",
      sourceFinanceiro: { provenanceVersion: 1 } as never,
    });
    expect(report.lineOverrides?.paineis).toBe(50);
    expect(lineTotal(report, "paineis")).toBe(50);
    expect(report.lineOverrideMeta?.paineis?.suspectedStickyEcho).toBe(true);
  });

  it.each(OVERRIDEABLE_FOR_L)(
    "Lrep %s: setReportLineOverride(null) repõe SSOT",
    (key) => {
      const project = minimalProject(`Lrep-${key}`);
      const snap = computeFinanceiroUnificado(project);
      const official = officialLineTotal(snap, key);
      let fin = buildLiveReportFinanceiro(project as never, []);
      fin = setReportLineOverride(fin, key, official + 123.45);
      expect(lineTotal(fin, key)).toBe(round2(official + 123.45));
      fin = setReportLineOverride(fin, key, null);
      expect(lineTotal(fin, key)).toBe(official);
      expect(fin.lineOverrides?.[key]).toBeUndefined();
    }
  );
});

describe("Fase 5 — M margemGanho", () => {
  it("margem 0/ausente: finalize sem linha de ganho activa muda totais legacy", () => {
    const project = minimalProject("M0");
    const snap = computeFinanceiroUnificado(project);
    const report = buildLiveReportFinanceiro(project as never, []);
    expect(report.totalProjeto).toBe(round2(snap.totalProjeto));
  });

  it("margem > 0: IVA sobre base+margem", () => {
    const base = snapshotToReportFinanceiro(
      computeFinanceiroUnificado(minimalProject("M1"))
    );
    const withMargem = setReportMargemGanho(base, {
      mode: "percentagem",
      percentagem: 10,
    });
    expect(withMargem.linhas.some((l) => l.key === "margemGanho")).toBe(true);
    expect(withMargem.totalProjeto).toBeGreaterThan(base.totalProjeto);
  });
});

describe("Fase 5 — Sugestões Painéis (Sug)", () => {
  it("TAMPO via remates + material via nesting mock-safe", () => {
    const state = {
      ...minimalProject("Sug"),
      remates: [
        {
          id: "r1",
          tipo: "TAMPO",
          productType: "TAMPO_COZINHA",
          width: 100,
          height: 10,
          depth: 600,
        },
      ],
      cutList: [],
    };
    const s = collectPaineisSugestoesProjeto("Sug", state as never);
    expect(s).toContain("TAMPO");
  });
});

describe("Fase 5 — secções 1–5 smoke (manualPaths / gerais)", () => {
  it("withLiveFinanceiro não apaga gerais nem manualPaths", () => {
    const project = minimalProject("sec");
    const live = buildLiveReportFinanceiro(project as never, []);
    const report = stubReport("sec", live);
    report.gerais.nomeProjeto = "Antunes teste";
    report.manualPaths = ["gerais.nomeProjeto"];
    const next = withLiveFinanceiro(report, project as never, []);
    expect(next.gerais.nomeProjeto).toBe("Antunes teste");
    expect(next.manualPaths).toContain("gerais.nomeProjeto");
  });
});
