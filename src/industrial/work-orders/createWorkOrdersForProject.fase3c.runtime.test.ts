/**
 * Fase 3C — evidência / contrato: skipExistingStationOrders=true (produção).
 * 2.ª geração reutiliza WO existente; não chama persistWorkOrderDraft de novo.
 * Caso skip=false documentado como anti-padrão (duplica).
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

vi.mock("./woIdempotencyConfig", () => ({
  woIdempotencyConfig: {
    skipExistingStationOrders: true,
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

describe("Fase 3C — WO idempotência (skipExistingStationOrders=true)", () => {
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

  it("2.ª geração: reutiliza existentes, zero persists novos, avisa", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(loadWorkOrders).mockResolvedValue([]);
    vi.mocked(persistWorkOrderDraft).mockImplementation(async (_projectId, draft) =>
      fakeOrder(draft.station, `wo-first-${draft.station}`),
    );
    const first = await createWorkOrdersForProject("proj-fase3c");
    expect(first.orders.length).toBeGreaterThan(0);
    expect(persistWorkOrderDraft).toHaveBeenCalled();

    vi.mocked(persistWorkOrderDraft).mockClear();
    vi.mocked(loadWorkOrders).mockImplementation(async (filter) => {
      const station = filter?.station ?? "unknown";
      return [fakeOrder(String(station), `wo-existing-${station}`)];
    });

    const second = await createWorkOrdersForProject("proj-fase3c");
    expect(persistWorkOrderDraft).not.toHaveBeenCalled();
    expect(second.orders.length).toBeGreaterThan(0);
    expect(second.orders.every((o) => o.id.startsWith("wo-existing-"))).toBe(true);
    expect(
      warnSpy.mock.calls.some(
        (c) => typeof c[0] === "string" && c[0].includes("[WO] Ordem existente"),
      ),
    ).toBe(true);

    warnSpy.mockRestore();
  });
});

describe("Fase 3C — anti-padrão documentado (skip=false duplica)", () => {
  it("com skipExistingStationOrders=false: 2.ª geração volta a persistir", async () => {
    vi.resetModules();
    vi.doMock("./woIdempotencyConfig", () => ({
      woIdempotencyConfig: {
        skipExistingStationOrders: false,
        warnOnDuplicate: true,
      },
    }));
    vi.doMock("./resolveProjectCutlist", () => ({
      resolveProjectCutlist: vi.fn().mockReturnValue({
        projectId: "proj-fase3c-noskip",
        projectName: "NoSkip",
        pieces: [samplePiece("piece-1")],
        cutlist: [],
        cutListItems: [],
        boxNameById: {},
      }),
    }));
    const persist = vi.fn(async (_projectId: string, draft: { station: string }) =>
      fakeOrder(draft.station, `wo-dup-${draft.station}`),
    );
    vi.doMock("../persistence/work-orders/persistWorkOrder", () => ({
      persistWorkOrderDraft: persist,
    }));
    vi.doMock("../persistence/work-orders/loadWorkOrders", () => ({
      loadWorkOrders: vi.fn().mockResolvedValue([fakeOrder("nesting", "wo-existing-nesting")]),
    }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createWorkOrdersForProject: createNoSkip } = await import(
      "./createWorkOrdersForProject"
    );
    const result = await createNoSkip("proj-fase3c-noskip");
    expect(persist).toHaveBeenCalled();
    expect(result.orders.every((o) => o.id.startsWith("wo-dup-"))).toBe(true);
    warnSpy.mockRestore();
    vi.resetModules();
  });
});
