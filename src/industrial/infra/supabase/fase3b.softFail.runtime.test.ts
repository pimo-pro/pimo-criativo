/**
 * Fase 3B — evidência runtime (diagnóstico + contrato pós-fix).
 * Writes desligados: savePieceTransform / savePieceRemates → { ok:false, reason:"blocked" };
 * persistWorkOrderDraft → throw (não soft).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PIECE_ID = "00000000-0000-4000-8000-0000000000b1";
const ENTITY_ID = "00000000-0000-4000-8000-0000000000b2";

describe("Fase 3B — Supabase write blocked soft-fail tipado", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_INDUSTRIAL_SUPABASE_DIRECT_WRITES", "false");
    vi.stubEnv("VITE_SUPABASE_URL", "https://fase3b.example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fase3b-anon-key");
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              single: async () => ({ data: null, error: { message: "should-not-hit" } }),
            }),
          }),
          insert: () => {
            throw new Error("insert real não deveria correr com writes bloqueados");
          },
          upsert: () => {
            throw new Error("upsert real não deveria correr com writes bloqueados");
          },
          update: () => {
            throw new Error("update real não deveria correr com writes bloqueados");
          },
          delete: () => {
            throw new Error("delete real não deveria correr com writes bloqueados");
          },
        }),
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@supabase/supabase-js");
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("política: DIRECT_WRITES=false → allowIndustrialDirectWrite=false + warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { allowIndustrialDirectWrite, isIndustrialSupabaseDirectWriteEnabled } = await import(
      "./writePolicy"
    );
    expect(isIndustrialSupabaseDirectWriteEnabled()).toBe(false);
    expect(allowIndustrialDirectWrite("fase3b.probe")).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("proxy: upsert bloqueado devolve PIMO_WRITE_BLOCKED sem chamar upsert real", async () => {
    const { supabase } = await import("./client");
    const { data, error } = (await supabase
      .from("piece_transforms")
      .upsert({ piece_id: PIECE_ID })
      .select()
      .single()) as { data: unknown; error: { code?: string; message?: string } | null };

    expect(data).toBeNull();
    expect(error?.code).toBe("PIMO_WRITE_BLOCKED");
  });

  it("savePieceTransform: blocked tipado (sem throw)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { savePieceTransform } = await import("../../persistence/piece/savePieceTransform");

    const result = await savePieceTransform(PIECE_ID, {
      entityId: ENTITY_ID,
      entityType: "piece",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    });

    expect(result).toEqual({ ok: false, reason: "blocked" });
  });

  it("savePieceRemates: blocked tipado (sem throw)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { savePieceRemates } = await import("../../persistence/piece/savePieceRemates");

    const result = await savePieceRemates(PIECE_ID, {
      entityId: ENTITY_ID,
      entityType: "remate",
      payload: { position: [0, 0, 0] },
    });

    expect(result).toEqual({ ok: false, reason: "blocked" });
  });

  it("persistWorkOrderDraft: mesmo bloqueio → throw (não soft-fail)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { persistWorkOrderDraft } = await import(
      "../../persistence/work-orders/persistWorkOrder"
    );

    await expect(
      persistWorkOrderDraft("proj-fase3b", {
        station: "corte",
        pieceIds: [PIECE_ID],
        operationTypes: ["cut"],
        tasks: [{ pieceId: PIECE_ID, operationType: "cut" }],
      })
    ).rejects.toThrow(/Write directo Supabase bloqueado/);
  });
});
