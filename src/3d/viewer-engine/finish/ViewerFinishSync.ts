/**
 * ViewerFinishSync (Z-01.2.7 C) — sync visual de orla/remate/hemati/rodapé.
 * Não gera cutlist nem altera regras de peça.
 */
export type FinishSyncKind = "orla" | "remate" | "hemati" | "rodape";

export type FinishSyncFlags = Record<FinishSyncKind, boolean>;

export function createFinishSyncFlags(): FinishSyncFlags {
  return { orla: false, remate: false, hemati: false, rodape: false };
}

export function requestFinishSync(
  flags: FinishSyncFlags,
  kind: FinishSyncKind,
  dragging: boolean,
  run: () => void
): void {
  if (dragging) {
    flags[kind] = true;
    return;
  }
  flags[kind] = false;
  run();
}

export function flushPendingFinishSync(
  flags: FinishSyncFlags,
  dragging: boolean,
  runners: Record<FinishSyncKind, () => void>
): void {
  if (dragging) return;
  (Object.keys(flags) as FinishSyncKind[]).forEach((kind) => {
    if (!flags[kind]) return;
    flags[kind] = false;
    runners[kind]();
  });
}
