import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveProjectReport } from "./projectReportStore";
import type { ProjectReport } from "./types";
import { emptyFinanceiro, emptyGerais, emptyQualidade } from "./types";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.payload.sig";

function minimalReport(projectId = "Antunes_Novo_Cozinha"): ProjectReport {
  return {
    projectId,
    version: 2,
    reportStyle: "classic",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    manualPaths: [],
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
    financeiro: emptyFinanceiro(),
    history: [],
    notas: [],
    qualidade: emptyQualidade(),
  };
}

function remoteProjectPayload() {
  return {
    id: "pimo-antunes",
    name: "Antunes Novo Cozinha",
    ownerId: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    room: null,
    boxes: [],
    shelves: [],
    dividers: [],
    centerDisplay: null,
    holes: [],
    drillMarkers: [],
    materials: [],
    viewerSnapshot: null,
    settings: {},
  };
}

describe("saveProjectReport — Authorization (Fix 1)", () => {
  const store = new Map<string, string>();
  const fetchMock = vi.fn();

  beforeEach(() => {
    store.clear();
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
      },
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  it("sem token: não faz POST e lança erro de sessão", async () => {
    await expect(saveProjectReport(minimalReport())).rejects.toThrow(/Sessão remota/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("local-dev-token: tratado como sem sessão (não POST)", async () => {
    localStorage.setItem("pimo_auth_token", "local-dev-token");
    await expect(saveProjectReport(minimalReport())).rejects.toThrow(/Sessão remota/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com JWT: POST inclui Authorization Bearer", async () => {
    localStorage.setItem("pimo_auth_token", TOKEN);
    const remote = remoteProjectPayload();
    const report = minimalReport();

    fetchMock.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      const method = String(init?.method || "GET").toUpperCase();
      if (method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            project: {
              ...remote,
              settings: { projectReport: report },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", project: remote }),
      };
    });

    await saveProjectReport(report);

    const postCalls = fetchMock.mock.calls.filter(
      (c) => String(c[1]?.method || "GET").toUpperCase() === "POST"
    );
    expect(postCalls.length).toBe(1);
    const postHeaders = postCalls[0][1]?.headers as Record<string, string>;
    expect(postHeaders["Content-Type"]).toBe("application/json");
    expect(postHeaders.Authorization).toBe(`Bearer ${TOKEN}`);
  });
});
