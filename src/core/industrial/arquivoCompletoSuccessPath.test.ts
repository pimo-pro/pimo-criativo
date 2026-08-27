import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concludeArquivoCompletoSuccess } from "./arquivoCompletoSuccess";
import {
  PRODUCTION_RELEASE_OUTBOX_KEY,
  PRODUCTION_RELEASE_REDIRECT_BUDGET_MS,
} from "./productionReleasePersist";
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

  it("ZIP já entregue: save rápido → redirect só depois do save; outbox limpo", async () => {
    const events: string[] = [];
    events.push("zip-click");

    await concludeArquivoCompletoSuccess(
      {
        zipDelivered: true,
        redirectPath: "/PROJETOS/Antunes_Novo_Cozinha",
        projectId: "proj-1",
        release: sampleRelease(),
        aliasKeys: ["Antunes_Novo_Cozinha", "Antunes Novo Cozinha"],
      },
      {
        showToast: (_text, type) => events.push(`toast:${type ?? "info"}`),
        saveRelease: async () => {
          events.push("save-ok");
        },
        assignLocation: (path) => events.push(`redirect:${path}`),
      }
    );

    expect(events).toEqual([
      "zip-click",
      "toast:info",
      "save-ok",
      "redirect:/PROJETOS/Antunes_Novo_Cozinha",
    ]);
    expect(events.indexOf("zip-click")).toBeLessThan(events.indexOf("redirect:/PROJETOS/Antunes_Novo_Cozinha"));
    expect(store.get(PRODUCTION_RELEASE_OUTBOX_KEY)).toBeUndefined();
  });

  it("save falha dentro do budget: toast warning + redirect; outbox mantém-se", async () => {
    const events: string[] = [];
    events.push("zip-click");

    await concludeArquivoCompletoSuccess(
      {
        zipDelivered: true,
        redirectPath: "/PROJETOS/Antunes_Novo_Cozinha",
        projectId: "proj-1",
        release: sampleRelease(),
      },
      {
        showToast: (_text, type) => events.push(`toast:${type ?? "info"}`),
        saveRelease: async () => {
          events.push("save-fail");
          throw new Error("rede lenta");
        },
        assignLocation: (path) => events.push(`redirect:${path}`),
      }
    );

    expect(events).toEqual([
      "zip-click",
      "toast:info",
      "save-fail",
      "toast:warning",
      "redirect:/PROJETOS/Antunes_Novo_Cozinha",
    ]);
    expect(store.get(PRODUCTION_RELEASE_OUTBOX_KEY)).toBeTruthy();
  });

  it("save nunca resolve: redirect após budget; sem toast bloqueante; outbox mantém-se", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    events.push("zip-click");

    const done = concludeArquivoCompletoSuccess(
      {
        zipDelivered: true,
        redirectPath: "/PROJETOS/NP2625622",
        projectId: "proj-1",
        release: sampleRelease(),
      },
      {
        showToast: (_text, type) => events.push(`toast:${type ?? "info"}`),
        saveRelease: () => new Promise(() => {
          /* nunca resolve */
        }),
        assignLocation: (path) => events.push(`redirect:${path}`),
      }
    );

    await vi.advanceTimersByTimeAsync(PRODUCTION_RELEASE_REDIRECT_BUDGET_MS);
    await done;

    expect(events).toEqual([
      "zip-click",
      "toast:info",
      "redirect:/PROJETOS/NP2625622",
    ]);
    expect(events.some((e) => e === "toast:warning")).toBe(false);
    expect(events.some((e) => e === "toast:error")).toBe(false);
    expect(store.get(PRODUCTION_RELEASE_OUTBOX_KEY)).toBeTruthy();
  });

  it("sem release: toast warning + redirect imediato (sem espera de rede)", async () => {
    const events: string[] = [];
    events.push("zip-click");

    await concludeArquivoCompletoSuccess(
      {
        zipDelivered: true,
        redirectPath: "/PROJETOS/X",
        projectId: "proj-1",
        release: null,
      },
      {
        showToast: (_text, type) => events.push(`toast:${type ?? "info"}`),
        saveRelease: async () => {
          events.push("save-should-not-run");
        },
        assignLocation: (path) => events.push(`redirect:${path}`),
      }
    );

    expect(events).toEqual([
      "zip-click",
      "toast:info",
      "toast:warning",
      "redirect:/PROJETOS/X",
    ]);
    expect(events).not.toContain("save-should-not-run");
  });
});
