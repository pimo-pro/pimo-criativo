import { describe, expect, it } from "vitest";
import { deriveMetricas, deriveTempoTrabalhoHoras } from "./deriveMetricas";
import {
  emptyDesign,
  emptyFinanceiro,
  emptyGerais,
  emptyMetricas,
  emptyMontagem,
  emptyProducao,
  emptyQualidade,
  type ProjectReport,
} from "./types";

function base(): ProjectReport {
  return {
    projectId: "p1",
    version: 2,
    reportStyle: "classic",
    createdAt: "",
    updatedAt: "",
    gerais: emptyGerais(),
    metricas: { ...emptyMetricas(), ordensTrabalho: 5, tarefasConcluidas: 2 },
    design: {
      ...emptyDesign(),
      errosDesign: [{ id: "1", texto: "erro d" }],
      solucoesAplicadas: [{ id: "2", texto: "sol d" }],
      melhoriasPropostas: [{ id: "3", texto: "prop" }],
      melhoriasImplementadas: [{ id: "4", texto: "impl" }],
    },
    producao: {
      ...emptyProducao(),
      erros: [{ id: "5", texto: "erro p" }],
      solucoesAplicadas: [{ id: "6", texto: "sol p" }],
      melhoriasImplementadas: [{ id: "7", texto: "impl p" }],
      operadores: [{ id: "o1", nome: "A", horas: 3, tarefas: "" }],
      horasEfetivas: 4,
    },
    montagem: {
      ...emptyMontagem(),
      erros: [{ id: "8", texto: "erro m" }],
      solucoesAplicadas: [],
      melhoriasImplementadas: [{ id: "9", texto: "impl m" }],
      instaladores: [
        { id: "i1", nome: "B", horas: 2, tarefas: "montagem" },
        { id: "i2", nome: "C", horas: 1, tarefas: "montagem" },
      ],
    },
    materiais: [],
    financeiro: emptyFinanceiro(),
    manualPaths: [],
    history: [],
    notas: [],
    qualidade: emptyQualidade(),
  };
}

describe("deriveMetricas", () => {
  it("soma erros/solucoes/melhorias de Design+Producao+Montagem (1A)", () => {
    const m = deriveMetricas(base());
    expect(m.ordensTrabalho).toBe(5);
    expect(m.tarefasConcluidas).toBe(2);
    expect(m.erros).toBe(3);
    expect(m.errosCorrigidos).toBe(2);
    expect(m.melhorias).toBe(4);
    expect(m.colaboradores).toBe(2);
  });

  it("usa operadores se nao houver instaladores", () => {
    const r = base();
    r.montagem.instaladores = [];
    expect(deriveMetricas(r).colaboradores).toBe(1);
  });

  it("soma tempo de trabalho", () => {
    expect(deriveTempoTrabalhoHoras(base())).toBe(7);
  });
});
