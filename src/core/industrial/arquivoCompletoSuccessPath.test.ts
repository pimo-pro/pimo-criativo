import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concludeArquivoCompletoSuccess } from "./arquivoCompletoSuccess";
import { PRODUCTION_RELEASE_OUTBOX_KEY } from "./productionReleasePersist";
import type { ProductionRelease } from "./productionRelease";

function sampleRelease(): ProductionRelease {
  return {
    version: 1,
    generatedAt: "2026-08-27T10:00:00.000Z",
    projectId: "proj-1",
    chapas: {
      totalSheets: 1,
      totalWasteMm2: 0,
      totalWastePct: 0,
      sheets: [],
      mode: "oficial_pro",
      diagnostics: ["origem=oficial_pro"],
    },
    ferragens: { totalEur: 0, totalQty: 0, lines: [] },
  };
}

describe("onArquivoCompleto — cauda de sucesso (ZIP + productionRelease)", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("geração OK + persistência falha: ZIP e redirect não esperam; só toast de aviso depois", async () => {
    const events: string[] = [];
    let rejectSave!: (_err: Error) => void;
    const hanging = new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    });

    // 1. Espelha a.click() do ZIP — já aconteceu no handler real ANTES de conclude
    events.push("zip-click");

    concludeArquivoCompletoSuccess(
      {
        zipDelivered: true,
        redirectPath: "/PROJETOS/Antunes_Novo_Cozinha",
        projectId: "proj-1",
        release: sampleRelease(),
      },
      {
        showToast: (_text, type) => events.push(`toast:${type ?? "info"}`),
        saveRelease: () => {
          events.push("save-start");
          return hanging;
        },
        assignLocation: (path) => events.push(`redirect:${path}`),
      }
    );

    // 2. Depois de conclude() regressar, ZIP e redirect JÁ aconteceram — persistência ainda pendente
    expect(events).toEqual([
      "zip-click",
      "toast:info",
      "save-start",
      "redirect:/PROJETOS/Antunes_Novo_Cozinha",
    ]);
    expect(store.get(PRODUCTION_RELEASE_OUTBOX_KEY)).toBeTruthy();

    // 3. Persistência falha DEPOIS — aviso assíncrono; ZIP/redirect não se desfazem
    rejectSave(new Error("rede lenta"));
    await vi.waitFor(() => {
      expect(events).toContain("toast:warning");
    });

    expect(events).toEqual([
      "zip-click",
      "toast:info",
      "save-start",
      "redirect:/PROJETOS/Antunes_Novo_Cozinha",
      "toast:warning",
    ]);
    expect(events.filter((e) => e === "zip-click")).toHaveLength(1);
    expect(events.filter((e) => e.startsWith("redirect:"))).toHaveLength(1);
  });

  it("persistência que nunca resolve: redirect acontece na mesma (não bloqueia o fluxo CNC)", () => {
    vi.useFakeTimers();
    const events: string[] = [];
    events.push("zip-click");

    concludeArquivoCompletoSuccess(
      {
        zipDelivered: true,
        redirectPath: "/PROJETOS/NP2625622",
        projectId: "proj-1",
        release: sampleRelease(),
      },
      {
        showToast: (_text, type) => events.push(`toast:${type ?? "info"}`),
        saveRelease: () => new Promise(() => { /* nunca resolve */ }),
        assignLocation: (path) => events.push(`redirect:${path}`),
      }
    );

    expect(events).toContain("zip-click");
    expect(events).toContain("redirect:/PROJETOS/NP2625622");
    expect(events.indexOf("zip-click")).toBeLessThan(
      events.indexOf("redirect:/PROJETOS/NP2625622")
    );
    expect(events.some((e) => e === "toast:warning")).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(events.filter((e) => e.startsWith("redirect:"))).toHaveLength(1);
    expect(events.some((e) => e === "toast:warning")).toBe(false);
  });
});
