import { describe, expect, it } from "vitest";
import {
  features,
  isReportFinanceiroProvenanceEnabled,
} from "../features";
import {
  FINANCEIRO_PROVENANCE_VERSION,
  applyDetalheProvenanceForKey,
  buildLineOverrideMeta,
  classifyLegacyDetalhe,
  classifyLegacyLineOverrides,
  filterFerragensOverridesToKeep,
  mergeSsotWithManual,
  needsFinanceiroProvenanceMigration,
  paineisStableMatchKey,
  previewFinanceiroProvenanceMigration,
  softMatchKey,
} from "./financeiroDetalheProvenance";
import type { ReportFinanceiroDetalhe } from "./types";

function row(
  partial: Partial<ReportFinanceiroDetalhe> &
    Pick<ReportFinanceiroDetalhe, "id" | "tipo">
): ReportFinanceiroDetalhe {
  return {
    dimensoes: "",
    quantidade: 1,
    precoUnitario: 10,
    total: 10,
    ...partial,
  };
}

describe("features.reportFinanceiroProvenance", () => {
  it("default false (Fase 0)", () => {
    expect(features.reportFinanceiroProvenance).toBe(false);
    expect(isReportFinanceiroProvenanceEnabled()).toBe(false);
  });
});

describe("classifyLegacyDetalhe + mergeSsotWithManual", () => {
  it("A: idêntico ao SSOT → discard no merge", () => {
    const ssot = [
      row({
        id: "a",
        tipo: "Chapa 18",
        quantidade: 2,
        precoUnitario: 5,
        total: 10,
      }),
    ];
    const legacy = [
      row({
        id: "a",
        tipo: "Chapa 18",
        quantidade: 2,
        precoUnitario: 5,
        total: 10,
      }),
    ];
    const c = classifyLegacyDetalhe(legacy, ssot);
    expect(c[0]?.kind).toBe("match_ssot_identical");
    const merged = mergeSsotWithManual(ssot, c);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.provenance).toBe("ssot");
    expect(merged[0]?.precoUnitario).toBe(5);
  });

  it("B: mesmo slot com diff → manual_edit", () => {
    const ssot = [
      row({
        id: "a",
        tipo: "Dobradiça",
        quantidade: 10,
        precoUnitario: 1,
        total: 10,
      }),
    ];
    const legacy = [
      row({
        id: "a",
        tipo: "Dobradiça",
        quantidade: 12,
        precoUnitario: 1,
        total: 12,
      }),
    ];
    const c = classifyLegacyDetalhe(legacy, ssot);
    expect(c[0]?.kind).toBe("match_ssot_with_diff");
    const merged = mergeSsotWithManual(ssot, c);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.provenance).toBe("manual_edit");
    expect(merged[0]?.quantidade).toBe(12);
  });

  it("C: órfão → manual_added", () => {
    const ssot = [row({ id: "a", tipo: "SSOT", total: 10 })];
    const legacy = [
      row({ id: "a", tipo: "SSOT", total: 10 }),
      row({
        id: "extra",
        tipo: "Extra manual",
        quantidade: 1,
        precoUnitario: 3,
        total: 3,
      }),
    ];
    const c = classifyLegacyDetalhe(legacy, ssot);
    expect(c.map((x) => x.kind)).toEqual([
      "match_ssot_identical",
      "orphan",
    ]);
    const merged = mergeSsotWithManual(ssot, c);
    expect(merged).toHaveLength(2);
    expect(merged[1]?.provenance).toBe("manual_added");
    expect(merged[1]?.tipo).toBe("Extra manual");
  });

  it("dois SSOT com a mesma soft key: edits FIFO no índice correcto", () => {
    // Sem id → soft key = tipo|espessura (cenário Painéis / colisão).
    const ssot = [
      row({
        id: "",
        tipo: "Chapa",
        espessuraMm: 18,
        quantidade: 1,
        precoUnitario: 10,
        total: 10,
      }),
      row({
        id: "",
        tipo: "Chapa",
        espessuraMm: 18,
        quantidade: 2,
        precoUnitario: 20,
        total: 40,
      }),
    ];
    expect(softMatchKey(ssot[0]!)).toBe(softMatchKey(ssot[1]!));

    const legacy = [
      row({
        id: "",
        tipo: "Chapa",
        espessuraMm: 18,
        quantidade: 1,
        precoUnitario: 11,
        total: 11,
      }),
      row({
        id: "",
        tipo: "Chapa",
        espessuraMm: 18,
        quantidade: 2,
        precoUnitario: 22,
        total: 44,
      }),
    ];
    const c = classifyLegacyDetalhe(legacy, ssot);
    expect(c.map((x) => x.kind)).toEqual([
      "match_ssot_with_diff",
      "match_ssot_with_diff",
    ]);
    const merged = mergeSsotWithManual(ssot, c);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.precoUnitario).toBe(11);
    expect(merged[0]?.provenance).toBe("manual_edit");
    expect(merged[1]?.precoUnitario).toBe(22);
    expect(merged[1]?.provenance).toBe("manual_edit");
  });
});

describe("classifyLegacyLineOverrides (conservador)", () => {
  it("≈ SSOT → redundant keep=false", () => {
    const r = classifyLegacyLineOverrides(
      { paineis: 100 },
      { paineis: 100.004 }
    );
    expect(r[0]?.kind).toBe("redundant_eq_ssot");
    expect(r[0]?.keep).toBe(false);
  });

  it("eco sticky suspeito → keep=true + suspectedStickyEcho", () => {
    const legacy = [
      row({
        id: "a",
        tipo: "X",
        quantidade: 1,
        precoUnitario: 50,
        total: 50,
      }),
    ];
    const ssot = [
      row({
        id: "a",
        tipo: "X",
        quantidade: 1,
        precoUnitario: 50,
        total: 50,
      }),
    ];
    const classified = classifyLegacyDetalhe(legacy, ssot);
    const r = classifyLegacyLineOverrides(
      { paineis: 50 },
      { paineis: 80 },
      {
        legacyDetalheByKey: { paineis: legacy },
        classifiedDetalheByKey: { paineis: classified },
      }
    );
    expect(r[0]?.kind).toBe("suspected_sticky_echo");
    expect(r[0]?.keep).toBe(true);
    expect(r[0]?.suspectedStickyEcho).toBe(true);
  });

  it("override absoluto ≠ SSOT e ≠ soma detalhe → keep_explicit", () => {
    const r = classifyLegacyLineOverrides(
      { ferragens: 999 },
      { ferragens: 100 },
      {
        legacyDetalheByKey: {
          ferragens: [row({ id: "a", tipo: "F", total: 100 })],
        },
      }
    );
    expect(r[0]?.kind).toBe("keep_explicit");
    expect(r[0]?.keep).toBe(true);
    expect(r[0]?.suspectedStickyEcho).toBe(false);
  });
});

describe("filterFerragensOverridesToKeep", () => {
  it("mantém added/removed/patch", () => {
    const kept = filterFerragensOverridesToKeep({
      a: { added: true, tipo: "Nova" },
      b: { removed: true },
      c: { quantidade: 2 },
      d: {},
    });
    expect(Object.keys(kept).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("buildLineOverrideMeta (Fase 3)", () => {
  it("inclui suspected e explicit sem filtrar", () => {
    const classifications = classifyLegacyLineOverrides(
      { paineis: 50, ferragens: 999 },
      { paineis: 80, ferragens: 100 },
      {
        legacyDetalheByKey: {
          paineis: [
            row({
              id: "a",
              tipo: "X",
              quantidade: 1,
              precoUnitario: 50,
              total: 50,
            }),
          ],
        },
        classifiedDetalheByKey: {
          paineis: classifyLegacyDetalhe(
            [
              row({
                id: "a",
                tipo: "X",
                quantidade: 1,
                precoUnitario: 50,
                total: 50,
              }),
            ],
            [
              row({
                id: "a",
                tipo: "X",
                quantidade: 1,
                precoUnitario: 50,
                total: 50,
              }),
            ]
          ),
        },
      }
    );
    const meta = buildLineOverrideMeta(classifications);
    expect(meta.paineis?.suspectedStickyEcho).toBe(true);
    expect(meta.paineis?.kind).toBe("suspected_sticky_echo");
    expect(meta.ferragens?.kind).toBe("keep_explicit");
    expect(meta.ferragens?.suspectedStickyEcho).toBe(false);
  });
});

describe("needsFinanceiroProvenanceMigration + preview", () => {
  it("sem provenanceVersion → precisa", () => {
    expect(needsFinanceiroProvenanceMigration({} as never)).toBe(true);
    expect(
      needsFinanceiroProvenanceMigration({
        provenanceVersion: FINANCEIRO_PROVENANCE_VERSION,
      } as never)
    ).toBe(false);
  });

  it("preview: sem SSOT builder, órfão sem provenance é descartado (1ª migração)", () => {
    const legacy = [row({ id: "x", tipo: "Órfão", total: 7 })];
    const preview = previewFinanceiroProvenanceMigration({
      legacyDetalheByKey: { orla: legacy },
      ssotDetalheByKey: { orla: [] },
      lineOverrides: { orla: 7 },
      officialByKey: { orla: 0 },
      financeiro: { provenanceVersion: undefined } as never,
    });
    expect(preview.needsMigration).toBe(true);
    expect(preview.mergedDetalheByKey.orla ?? []).toHaveLength(0);
  });

  it("preview: sem SSOT builder, manual_added mantém-se", () => {
    const legacy = [
      row({
        id: "x",
        tipo: "Extra",
        total: 7,
        provenance: "manual_added",
      }),
    ];
    const preview = previewFinanceiroProvenanceMigration({
      legacyDetalheByKey: { orla: legacy },
      ssotDetalheByKey: { orla: [] },
      financeiro: { provenanceVersion: undefined } as never,
    });
    expect(preview.mergedDetalheByKey.orla?.[0]?.tipo).toBe("Extra");
    expect(preview.mergedDetalheByKey.orla?.[0]?.provenance).toBe(
      "manual_added"
    );
  });
});

describe("Painéis matching estável (Fase 2)", () => {
  it("dois materiais @18mm com ids regenerados: 1ª migração descarta sticky-diff a favor do SSOT", () => {
    const legacy = [
      row({
        id: "ch-OLD-1",
        tipo: "Carvalho",
        espessuraMm: 18,
        quantidade: 3,
        precoUnitario: 10,
        total: 30,
      }),
      row({
        id: "ch-OLD-2",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 1,
        precoUnitario: 8,
        total: 8,
      }),
    ];
    const ssot = [
      row({
        id: "ch-NEW-9",
        tipo: "Carvalho",
        espessuraMm: 18,
        quantidade: 2,
        precoUnitario: 10,
        total: 20,
      }),
      row({
        id: "ch-NEW-8",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 1,
        precoUnitario: 8,
        total: 8,
      }),
    ];

    expect(paineisStableMatchKey(legacy[0]!)).toBe(
      paineisStableMatchKey(ssot[0]!)
    );
    expect(paineisStableMatchKey(legacy[0]!)).not.toBe(
      paineisStableMatchKey(legacy[1]!)
    );

    const merged = applyDetalheProvenanceForKey({
      key: "paineis",
      legacy,
      ssot,
      firstMigration: true,
    });
    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.tipo === "Carvalho")?.quantidade).toBe(2);
    expect(merged.find((m) => m.tipo === "MDF Branco")?.quantidade).toBe(1);
    expect(merged.find((m) => m.tipo === "Carvalho")?.id).toBe("ch-NEW-9");
    expect(merged.find((m) => m.tipo === "MDF Branco")?.id).toBe("ch-NEW-8");
    expect(merged.find((m) => m.tipo === "Carvalho")?.provenance).toBe("ssot");
  });

  it("após provenance manual_edit, diff no Carvalho mantém-se e não contamina MDF", () => {
    const legacy = [
      row({
        id: "x",
        tipo: "Carvalho",
        espessuraMm: 18,
        quantidade: 3,
        precoUnitario: 10,
        total: 30,
        provenance: "manual_edit",
      }),
      row({
        id: "y",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 1,
        precoUnitario: 8,
        total: 8,
      }),
    ];
    const ssot = [
      row({
        id: "a",
        tipo: "Carvalho",
        espessuraMm: 18,
        quantidade: 2,
        precoUnitario: 10,
        total: 20,
      }),
      row({
        id: "b",
        tipo: "MDF Branco",
        espessuraMm: 18,
        quantidade: 1,
        precoUnitario: 8,
        total: 8,
      }),
    ];
    const merged = applyDetalheProvenanceForKey({
      key: "paineis",
      legacy,
      ssot,
      firstMigration: false,
    });
    expect(merged.find((m) => m.tipo === "Carvalho")?.quantidade).toBe(3);
    expect(merged.find((m) => m.tipo === "Carvalho")?.provenance).toBe(
      "manual_edit"
    );
    expect(merged.find((m) => m.tipo === "MDF Branco")?.quantidade).toBe(1);
    expect(merged.find((m) => m.tipo === "MDF Branco")?.provenance).toBe(
      "ssot"
    );
  });
});
