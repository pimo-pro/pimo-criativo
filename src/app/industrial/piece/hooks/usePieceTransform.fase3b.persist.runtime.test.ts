/**
 * Fase 3B — contrato de persistTransform (blocked → sem onPersisted + notifyUser/showToast).
 * Espelha a lógica de usePieceTransform sem montar o viewer.
 */
import { describe, expect, it, vi } from "vitest";

import {
  isIndustrialPersistBlocked,
  type IndustrialPersistResult,
} from "@/industrial/persistence/shared/industrialPersistResult";

const BLOCKED: IndustrialPersistResult = { ok: false, reason: "blocked" };
const OK: IndustrialPersistResult = { ok: true, data: { id: "row" } };

/** Réplica mínima do fluxo persistTransform para evidência de contrato. */
async function runPersistFlow(deps: {
  transform: IndustrialPersistResult;
  remates?: IndustrialPersistResult | null;
  event: IndustrialPersistResult;
  onPersisted: () => void;
  notifyBlocked: () => void;
}): Promise<void> {
  if (!deps.transform.ok) {
    if (isIndustrialPersistBlocked(deps.transform)) deps.notifyBlocked();
    return;
  }
  if (deps.remates) {
    if (!deps.remates.ok) {
      if (isIndustrialPersistBlocked(deps.remates)) deps.notifyBlocked();
      return;
    }
  }
  if (!deps.event.ok) {
    if (isIndustrialPersistBlocked(deps.event)) deps.notifyBlocked();
    return;
  }
  deps.onPersisted();
}

describe("Fase 3B — persistTransform: blocked sem reload", () => {
  it("transform blocked → notify + sem onPersisted", async () => {
    const onPersisted = vi.fn();
    const notifyBlocked = vi.fn();
    await runPersistFlow({
      transform: BLOCKED,
      remates: null,
      event: OK,
      onPersisted,
      notifyBlocked,
    });
    expect(notifyBlocked).toHaveBeenCalledTimes(1);
    expect(onPersisted).not.toHaveBeenCalled();
  });

  it("remates blocked → notify + sem onPersisted", async () => {
    const onPersisted = vi.fn();
    const notifyBlocked = vi.fn();
    await runPersistFlow({
      transform: OK,
      remates: BLOCKED,
      event: OK,
      onPersisted,
      notifyBlocked,
    });
    expect(notifyBlocked).toHaveBeenCalledTimes(1);
    expect(onPersisted).not.toHaveBeenCalled();
  });

  it("event blocked → notify + sem onPersisted", async () => {
    const onPersisted = vi.fn();
    const notifyBlocked = vi.fn();
    await runPersistFlow({
      transform: OK,
      remates: null,
      event: BLOCKED,
      onPersisted,
      notifyBlocked,
    });
    expect(notifyBlocked).toHaveBeenCalledTimes(1);
    expect(onPersisted).not.toHaveBeenCalled();
  });

  it("tudo ok → onPersisted, sem notify", async () => {
    const onPersisted = vi.fn();
    const notifyBlocked = vi.fn();
    await runPersistFlow({
      transform: OK,
      remates: OK,
      event: OK,
      onPersisted,
      notifyBlocked,
    });
    expect(notifyBlocked).not.toHaveBeenCalled();
    expect(onPersisted).toHaveBeenCalledTimes(1);
  });

  it("rejected (não blocked) → sem onPersisted e sem notify de writes", async () => {
    const onPersisted = vi.fn();
    const notifyBlocked = vi.fn();
    await runPersistFlow({
      transform: { ok: false, reason: "rejected", message: "wo" },
      remates: null,
      event: OK,
      onPersisted,
      notifyBlocked,
    });
    expect(notifyBlocked).not.toHaveBeenCalled();
    expect(onPersisted).not.toHaveBeenCalled();
  });
});

describe("Fase 3B — notifyUser + showToast (bridge real)", () => {
  it("notifyUser com showToast invoca o toast", async () => {
    const { notifyUser } = await import("@/industrial/errors/industrialNotificationBridge");
    const showToast = vi.fn();
    notifyUser(
      {
        source: "trak",
        severity: "warning",
        step: "Persistência peça",
        message:
          "Gravação industrial bloqueada (writes Supabase desligados). A posição local não foi sincronizada.",
      },
      { showToast },
    );
    expect(showToast).toHaveBeenCalled();
    expect(String(showToast.mock.calls[0]?.[0])).toMatch(/Gravação industrial bloqueada/);
    expect(showToast.mock.calls[0]?.[1]).toBe("warning");
  });
});
