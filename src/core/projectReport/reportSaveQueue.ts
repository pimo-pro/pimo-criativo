/**
 * Fila serial + coalesce para gravações do Relatório Final.
 * Evita condição de corrida: no máximo 1 POST em voo + resaves com o runner mais recente.
 */

export type ReportSaveResult =
  | { ok: true }
  | { ok: false; error: string };

type SaveRunner = () => Promise<void>;

export type ReportSaveQueue = {
  /** Enfileira gravação; coalesce se já houver save em curso. */
  enqueue: (run: SaveRunner) => Promise<ReportSaveResult>;
  /** true se há POST em voo, resave pendente ou waiters. */
  isBusy: () => boolean;
};

export function createReportSaveQueue(): ReportSaveQueue {
  let inFlight = false;
  let needsResave = false;
  let latestRunner: SaveRunner | null = null;
  let waiters: Array<(result: ReportSaveResult) => void> = [];

  const flushWaiters = (result: ReportSaveResult) => {
    const batch = waiters;
    waiters = [];
    for (const w of batch) w(result);
  };

  const pump = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      do {
        needsResave = false;
        const run = latestRunner;
        latestRunner = null;
        if (!run) break;
        await run();
      } while (needsResave || latestRunner);
      flushWaiters({ ok: true });
    } catch (err) {
      needsResave = false;
      latestRunner = null;
      flushWaiters({
        ok: false,
        error: err instanceof Error ? err.message : "Falha ao guardar no servidor.",
      });
    } finally {
      inFlight = false;
    }
    if (latestRunner || waiters.length > 0) {
      void pump();
    }
  };

  return {
    isBusy: () =>
      inFlight || needsResave || latestRunner != null || waiters.length > 0,
    enqueue: (run: SaveRunner) =>
      new Promise<ReportSaveResult>((resolve) => {
        waiters.push(resolve);
        latestRunner = run;
        if (inFlight) {
          needsResave = true;
          return;
        }
        void pump();
      }),
  };
}
