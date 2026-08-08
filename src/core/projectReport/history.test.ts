import { describe, expect, it } from "vitest";
import {
  appendHistoryEntry,
  createHistoryEntry,
  getValueAtPath,
  serializeHistoryValue,
  withHistoryForPath,
} from "./history";
import { emptyQualidade, emptyGerais, emptyMetricas, emptyDesign, emptyProducao, emptyMontagem, emptyFinanceiro, type ProjectReport } from "./types";

function baseReport(): ProjectReport {
  return {
    projectId: "p1",
    version: 2,
    reportStyle: "classic",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    gerais: { ...emptyGerais(), nomeProjeto: "Demo" },
    metricas: emptyMetricas(),
    design: emptyDesign(),
    producao: emptyProducao(),
    montagem: emptyMontagem(),
    materiais: [],
    financeiro: emptyFinanceiro(),
    manualPaths: [],
    history: [],
    notas: [],
    qualidade: emptyQualidade(),
  };
}

describe("history", () => {
  it("serializa valores", () => {
    expect(serializeHistoryValue("abc")).toBe("abc");
    expect(serializeHistoryValue(12)).toBe("12");
    expect(serializeHistoryValue({ a: 1 })).toBe('{"a":1}');
  });

  it("le path aninhado", () => {
    const r = baseReport();
    expect(getValueAtPath(r, "gerais.nomeProjeto")).toBe("Demo");
  });

  it("nao acrescenta se valor igual", () => {
    const r = baseReport();
    const next = appendHistoryEntry(r, "gerais.nomeProjeto", "Demo", "Demo", "u");
    expect(next.history).toHaveLength(0);
  });

  it("acrescenta entrada e withHistoryForPath", () => {
    const prev = baseReport();
    const next = {
      ...prev,
      gerais: { ...prev.gerais, nomeProjeto: "Novo" },
    };
    const withHist = withHistoryForPath(prev, next, "gerais.nomeProjeto", "tester");
    expect(withHist.history).toHaveLength(1);
    expect(withHist.history[0].oldValue).toBe("Demo");
    expect(withHist.history[0].newValue).toBe("Novo");
    expect(withHist.history[0].user).toBe("tester");
  });

  it("createHistoryEntry tem campos obrigatorios", () => {
    const e = createHistoryEntry("metricas.erros", 0, 2, "u");
    expect(e.path).toBe("metricas.erros");
    expect(e.id.startsWith("hist-")).toBe(true);
  });
});
