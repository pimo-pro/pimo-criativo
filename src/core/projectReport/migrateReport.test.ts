import { describe, expect, it } from "vitest";
import {
  migrateProjectReport,
  reportNeedsFinanceiroProvenanceMigration,
  stringToTextoItems,
} from "./migrateReport";
import { emptyFinanceiro } from "./types";

describe("migrateReport", () => {
  it("converte string multi-linha em itens", () => {
    const items = stringToTextoItems("a\nb\n\nc");
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.texto)).toEqual(["a", "b", "c"]);
  });

  it("converte bloco unico em um item", () => {
    const items = stringToTextoItems("texto continuo sem newlines");
    expect(items).toHaveLength(1);
    expect(items[0]?.texto).toBe("texto continuo sem newlines");
  });

  it("migra design/producao/montagem v1 -> v2", () => {
    const migrated = migrateProjectReport({
      projectId: "x",
      version: 1,
      design: {
        dataInicio: "",
        dataConclusao: "",
        revisoesAntesProducao: 0,
        revisoesAposProducao: 0,
        errosDesign: "erro1\nerro2",
        solucoesAplicadas: "",
        melhoriasPropostas: "m1",
        melhoriasImplementadas: "",
      },
      producao: {
        operadores: [],
        caixas: [],
        pecas: [],
        dataInicio: "",
        dataFim: "",
        horasEfetivas: 0,
        reProducoes: 0,
        erros: "prod",
        solucoesAplicadas: "",
        melhoriasImplementadas: "",
      },
      montagem: {
        dataEnvio: "",
        instaladores: [],
        dataInicio: "",
        dataFim: "",
        intervencoesPos: 0,
      },
    } as never);

    expect(migrated.version).toBe(2);
    expect(migrated.design.errosDesign).toHaveLength(2);
    expect(migrated.producao.erros[0]?.texto).toBe("prod");
    expect(migrated.montagem.erros).toEqual([]);
    expect(migrated.design.melhoriasPropostas[0]?.texto).toBe("m1");
  });

  it("gate provenance: financeiro sem version → pending; com version actual → ok", () => {
    const base = migrateProjectReport({
      projectId: "x",
      version: 2,
      financeiro: emptyFinanceiro(),
    } as never);
    expect(reportNeedsFinanceiroProvenanceMigration(base)).toBe(true);

    const withV = migrateProjectReport({
      projectId: "x",
      version: 2,
      financeiro: { ...emptyFinanceiro(), provenanceVersion: 1 },
    } as never);
    expect(reportNeedsFinanceiroProvenanceMigration(withV)).toBe(false);
  });
});
