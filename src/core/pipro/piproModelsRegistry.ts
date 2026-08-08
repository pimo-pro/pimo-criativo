/**
 * Biblioteca pipro — modelos criados no Workspace Design Mode.
 * Persistência localStorage (padrão semelhante aos custom industrial).
 */

import type { PiproModelRecord } from "./piproDesignTypes";
import { PIPRO_MODEL_PREFIX } from "./piproDesignTypes";

const STORAGE_KEY = "pimo-pipro-models-v1";
const runtime = new Map<string, PiproModelRecord>();
let loaded = false;

export function isPiproModelId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(PIPRO_MODEL_PREFIX);
}

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as PiproModelRecord[];
    if (!Array.isArray(list)) return;
    for (const m of list) {
      if (m?.id && isPiproModelId(m.id)) runtime.set(m.id, m);
    }
  } catch {
    /* ignore */
  }
}

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...runtime.values()]));
  } catch {
    /* ignore */
  }
}

export function listPiproModels(): PiproModelRecord[] {
  ensureLoaded();
  return [...runtime.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadPiproModel(id: string): PiproModelRecord | undefined {
  ensureLoaded();
  return runtime.get(id);
}

export function savePiproModel(model: PiproModelRecord): PiproModelRecord {
  ensureLoaded();
  const now = new Date().toISOString();
  const next: PiproModelRecord = {
    ...model,
    id: isPiproModelId(model.id) ? model.id : `${PIPRO_MODEL_PREFIX}${crypto.randomUUID()}`,
    updatedAt: now,
    createdAt: model.createdAt || now,
  };
  runtime.set(next.id, next);
  persist();
  return next;
}

export function deletePiproModel(id: string): boolean {
  ensureLoaded();
  const ok = runtime.delete(id);
  if (ok) persist();
  return ok;
}

export function __resetPiproModelsForTests(): void {
  runtime.clear();
  loaded = false;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
