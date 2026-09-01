/**
 * Fase 3C — evidência runtime: work orders duplicáveis.
 * Com skipExistingStationOrders=false (produção), segunda geração na mesma
 * estação chama persistWorkOrderDraft outra vez apesar de já existir WO.
 * warnOnDuplicate só escreve console.warn.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IndustrialPiece } from "../core/pieces/types";

vi.mock("./resolveProjectCutlist", () => ({
  resolveProjectCutlist: vi.fn(),
}));

vi.mock("../persistence/work-orders/persistWorkOrder", () => ({
  persistWorkOrderDraft: vi.fn(),
}));

vi.mock("../persistence/work-orders/loadWorkOrders", () => ({
  loadWorkOrders: vi.fn(),
}));

// Config REAL de produção (não o mock do teste unitário que desliga warn).
vi.mock("./woIdempotencyConfig", () => ({
  woIdempotencyConfig: {
    skipExistingStationOrders: false,
    warnOnDuplicate: true,
  },
}));

import { createWorkOrdersForProject } from "./createWorkOrdersForProject";
import { resolveProjectCutlist } from "./resolveProjectCutlist";
import { persistWorkOrderDraft } from "../persistence/work-orders/persistWorkOrder";
import { loadWorkOrders } from "../persistence/work-orders/loadWorkOrders";

function samplePiece(id: string): IndustrialPiece {
  return {
    id,
    name: `Peça ${id}`,
    dimensions: { widthMm: 600, heightMm: 720, thicknessMm: 19 },
    quantity: 1,
    operations: ["cnc", "drill", "orlar", "montagem", "embalagem"],
    status: "pending",
    metadata: {},
    createdAt: "2026-06-23T09:00:00Z",
    updatedAt: "2026-06-23T09:00:00Z",
  };
}

function fakeOrder(station: string, id: string) {
  return {
    id,
    projectId: "proj-fase3c",
    station,
    status: "pending" as const,
    pieceIds: ["piece-1"],
    operationTypes: ["cut"],
    metadata: {},
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
  };
}

describe("Fase 3C — WO duplicáveis (skipExistingStationOrders=false)", () => {
  beforeEach(() => {
    vi.mocked(resolveProjectCutlist).mockReset();
    vi.mocked(persistWorkOrderDraft).mockReset();
    vi.mocked(loadWorkOrders).mockReset();
    vi.mocked(resolveProjectCutlist).mockReturnValue({
      projectId: "proj-fase3c",
      projectName: "Fase3C Dup",
      pieces: [samplePiece("piece-1")],
      cutlist: [],
      cutListItems: [],
      boxNameById: {},
    });
  });

  it("2.ª geração: load encontra WO existente, avisa, mas volta a persistir (duplica)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 1.ª geração — nenhuma ordem existente
    vi.mocked(loadWorkOrders).mockResolvedValue([]);
    vi.mocked(persistWorkOrderDraft).mockImplementation(async (projectId, draft) =>
      fakeOrder(draft.station, `wo-first-${draft.station}`),
    );

    const first = await createWorkOrdersForProject("proj-fase3c");
    const firstPersistCalls = vi.mocked(persistWorkOrderDraft).mock.calls.length;
    expect(first.orders.length).toBeGreaterThan(0);
    expect(firstPersistCalls).toBe(first.orders.length);

    // 2.ª geração — cada estação já tem ordem
    vi.mocked(persistWorkOrderDraft).mockClear();
    vi.mocked(loadWorkOrders).mockImplementation(async (filter) => {
      const station = filter?.station ?? "unknown";
      return [fakeOrder(String(station), `wo-existing-${station}`)];
    });
    vi.mocked(persistWorkOrderDraft).mockImplementation(async (projectId, draft) =>
      fakeOrder(draft.station, `wo-dup-${draft.station}`),
    );

    const second = await createWorkOrdersForProject("proj-fase3c");
    const secondPersistCalls = vi.mocked(persistWorkOrderDraft).mock.calls.length;

    // Continua a criar — não reutiliza as existentes
    expect(secondPersistCalls).toBe(second.orders.length);
    expect(secondPersistCalls).toBeGreaterThan(0);
    expect(second.orders.every((o) => o.id.startsWith("wo-dup-"))).toBe(true);

    const dupWarns = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("[WO] Ordem existente"),
    );
    expect(dupWarns.length).toBeGreaterThan(0);

    warnSpy.mockRestore();
  });

  it("com skipExistingStationOrders=true (hipotético): não persistiria de novo", async () => {
    // Documenta o comportamento desejado quando a flag for activada — via mock pontual.
    vi.resetModules();
    vi.doMock("./woIdempotencyConfig", () => ({
      woIdempotencyConfig: {
        skipExistingStationOrders: true,
        warnOnDuplicate: true,
      },
    }));
    vi.doMock("./resolveProjectCutlist", () => ({
      resolveProjectCutlist: vi.fn().mockReturnValue({
        projectId: "proj-fase3c-skip",
        projectName: "Skip",
        pieces: [samplePiece("piece-1")],
        cutlist: [],
        cutListItems: [],
        boxNameById: {},
      }),
    }));
    const persist = vi.fn();
    vi.doMock("../persistence/work-orders/persistWorkOrder", () => ({
      persistWorkOrderDraft: persist,
    }));
    vi.doMock("../persistence/work-orders/loadWorkOrders", () => ({
      loadWorkOrders: vi.fn().mockResolvedValue([fakeOrder("nesting", "wo-keep-nesting")]),
    }));

    const { createWorkOrdersForProject: createWithSkip } = await import(
      "./createWorkOrdersForProject"
    );
    // load devolve existing para todas as estações — com skip, zero persists
    // Nota: load é chamado por estação; mock devolve sempre 1 existing.
    const result = await createWithSkip("proj-fase3c-skip");
    expect(persist).not.toHaveBeenCalled();
    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders.every((o) => o.id.startsWith("wo-keep-"))).toBe(true);

    vi.resetModules();
  });
});
