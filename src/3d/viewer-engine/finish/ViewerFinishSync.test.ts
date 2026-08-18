import { describe, expect, it, vi } from "vitest";
import {
  createFinishSyncFlags,
  flushPendingFinishSync,
  requestFinishSync,
} from "./ViewerFinishSync";

describe("ViewerFinishSync (Z-01.2.7)", () => {
  it("adia o sync durante drag e executa depois", () => {
    const flags = createFinishSyncFlags();
    const run = vi.fn();
    requestFinishSync(flags, "remate", true, run);
    expect(run).not.toHaveBeenCalled();
    expect(flags.remate).toBe(true);

    flushPendingFinishSync(flags, false, {
      orla: vi.fn(),
      remate: run,
      hemati: vi.fn(),
      rodape: vi.fn(),
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(flags.remate).toBe(false);
  });
});
