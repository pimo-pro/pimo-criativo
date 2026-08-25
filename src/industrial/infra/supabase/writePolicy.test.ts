import { describe, expect, it, vi } from "vitest";
import {
  allowIndustrialDirectWrite,
  blockedIndustrialWriteResult,
  isIndustrialSupabaseDirectWriteEnabled,
} from "./writePolicy";

describe("Phase 1 — industrial write policy", () => {
  it("isIndustrialSupabaseDirectWriteEnabled devolve boolean", () => {
    expect(typeof isIndustrialSupabaseDirectWriteEnabled()).toBe("boolean");
  });

  it("blockedIndustrialWriteResult usa código PIMO_WRITE_BLOCKED", () => {
    const r = blockedIndustrialWriteResult("test.op");
    expect(r.data).toBeNull();
    expect(r.error.code).toBe("PIMO_WRITE_BLOCKED");
    expect(r.error.message).toContain("test.op");
  });

  it("allowIndustrialDirectWrite respeita estado actual", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const allowed = allowIndustrialDirectWrite("unit.test");
    expect(typeof allowed).toBe("boolean");
    if (!allowed) {
      expect(spy).toHaveBeenCalled();
    }
    spy.mockRestore();
  });
});
