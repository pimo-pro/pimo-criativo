/**
 * Prova isolada da fila serial + coalesce (anti-corrida do Relatório Final).
 */
import { describe, expect, it, vi } from "vitest";
import { createReportSaveQueue } from "./reportSaveQueue";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createReportSaveQueue", () => {
  it("3+ enqueues em paralelo: coalesce — runner final corre, não 1 POST por clique", async () => {
    const queue = createReportSaveQueue();
    const gate = deferred();
    const payloads: number[] = [];
    let runCount = 0;

    const mkRunner = (n: number) => async () => {
      runCount += 1;
      payloads.push(n);
      if (runCount === 1) {
        await gate.promise;
      }
    };

    const p1 = queue.enqueue(mkRunner(1));
    const p2 = queue.enqueue(mkRunner(2));
    const p3 = queue.enqueue(mkRunner(3));
    const p4 = queue.enqueue(mkRunner(4));

    expect(queue.isBusy()).toBe(true);

    gate.resolve();
    const results = await Promise.all([p1, p2, p3, p4]);

    expect(results.every((r) => r.ok)).toBe(true);
    // 1.º corre com payload 1; durante o await, 2/3/4 coalescem → 2.º corre com 4
    expect(runCount).toBe(2);
    expect(payloads).toEqual([1, 4]);
    expect(queue.isBusy()).toBe(false);
  });

  it("sucesso simples: um enqueue resolve ok:true", async () => {
    const queue = createReportSaveQueue();
    const spy = vi.fn(async () => undefined);
    const result = await queue.enqueue(spy);
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falha: erro no runner → todos os waiters recebem ok:false com mensagem", async () => {
    const queue = createReportSaveQueue();
    const gate = deferred();

    const failing = async () => {
      await gate.promise;
      throw new Error("HTTP 500 simulado");
    };

    const p1 = queue.enqueue(failing);
    const p2 = queue.enqueue(async () => undefined);
    const p3 = queue.enqueue(async () => undefined);

    gate.resolve();
    const results = await Promise.all([p1, p2, p3]);

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toBe("HTTP 500 simulado");
      }
    }
    expect(queue.isBusy()).toBe(false);
  });

  it("após falha, um novo enqueue consegue gravar com sucesso", async () => {
    const queue = createReportSaveQueue();

    const failResult = await queue.enqueue(async () => {
      throw new Error("falha anterior");
    });
    expect(failResult.ok).toBe(false);

    const okResult = await queue.enqueue(async () => undefined);
    expect(okResult).toEqual({ ok: true });
    expect(queue.isBusy()).toBe(false);
  });
});
