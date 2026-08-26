/**
 * Cache de sessão do nesting PRO oficial (chapas/painéis).
 * Fonte de verdade para Admin / Relatório / PDF armazém quando fingerprint bate.
 * Não corre nesting — apenas guarda o resultado já produzido pelo pipeline TCN/PRO.
 */

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

import { normalizeProjectName } from "../projects/projectIdentity";
import type { ChapasRealSummary } from "./computeChapasReal";

/** Só "oficial_pro" alimenta contagem/€ oficiais. Fast nunca entra aqui como oficial. */
export type ChapasOficiaisOrigin = "oficial_pro";

export type ChapasOficiaisProSnapshot = {
  projectId: string;
  /** Hash do cutlist + params de chapa — invalidação quando o projecto muda. */
  fingerprint: string;
  publishedAt: number;
  origin: ChapasOficiaisOrigin;
  summary: ChapasRealSummary;
};

type ChapasOficiaisProState = {
  /** Último snapshot oficial por projectId. */
  byProjectId: Record<string, ChapasOficiaisProSnapshot>;
  publish: (input: {
    projectId: string;
    fingerprint: string;
    summary: ChapasRealSummary;
    /** Se false/omitido com intenção non-pro, o publish é no-op (A1 / abort→fast). */
    isProMode: boolean;
  }) => boolean;
  getValid: (projectId: string, fingerprint: string) => ChapasOficiaisProSnapshot | null;
  getLatest: (projectId: string) => ChapasOficiaisProSnapshot | null;
  invalidate: (projectId: string) => void;
  clearAll: () => void;
};

/**
 * Chave estável: slug de projecto (nome ou page slug → mesmo token).
 * Financeiro / Relatório / publish TCN devem usar esta normalização.
 */
export function resolveChapasOficiaisProjectKey(projectIdOrName: string): string {
  const raw = String(projectIdOrName ?? "").trim();
  if (!raw) return "__default__";
  try {
    const slug = normalizeProjectName(raw);
    return slug || raw;
  } catch {
    return raw;
  }
}

function normalizeProjectId(projectId: string): string {
  return resolveChapasOficiaisProjectKey(projectId);
}

export const chapasOficiaisProStore = createStore<ChapasOficiaisProState>((set, get) => ({
  byProjectId: {},

  publish: ({ projectId, fingerprint, summary, isProMode }) => {
    // Regra: só publicar oficial quando o nesting efectivo foi PRO.
    if (!isProMode) return false;
    const fp = String(fingerprint ?? "").trim();
    if (!fp) return false;
    if (!summary || summary.sheets.length === 0) return false;

    const id = normalizeProjectId(projectId);
    const snapshot: ChapasOficiaisProSnapshot = {
      projectId: id,
      fingerprint: fp,
      publishedAt: Date.now(),
      origin: "oficial_pro",
      summary,
    };
    set({
      byProjectId: {
        ...get().byProjectId,
        [id]: snapshot,
      },
    });
    return true;
  },

  getValid: (projectId, fingerprint) => {
    const id = normalizeProjectId(projectId);
    const snap = get().byProjectId[id];
    if (!snap) return null;
    if (snap.origin !== "oficial_pro") return null;
    if (snap.fingerprint !== String(fingerprint ?? "").trim()) return null;
    return snap;
  },

  getLatest: (projectId) => {
    const id = normalizeProjectId(projectId);
    return get().byProjectId[id] ?? null;
  },

  invalidate: (projectId) => {
    const id = normalizeProjectId(projectId);
    const { [id]: _removed, ...rest } = get().byProjectId;
    set({ byProjectId: rest });
  },

  clearAll: () => set({ byProjectId: {} }),
}));

/** API funcional (sem React) — usada por computeChapasReal / publish nos handlers. */
export function publishChapasOficiaisPro(
  input: Parameters<ChapasOficiaisProState["publish"]>[0]
): boolean {
  return chapasOficiaisProStore.getState().publish(input);
}

export function getChapasOficiaisProValid(
  projectId: string,
  fingerprint: string
): ChapasOficiaisProSnapshot | null {
  return chapasOficiaisProStore.getState().getValid(projectId, fingerprint);
}

export function getChapasOficiaisProLatest(
  projectId: string
): ChapasOficiaisProSnapshot | null {
  return chapasOficiaisProStore.getState().getLatest(projectId);
}

export function invalidateChapasOficiaisPro(projectId: string): void {
  chapasOficiaisProStore.getState().invalidate(projectId);
}

export function clearChapasOficiaisPro(): void {
  chapasOficiaisProStore.getState().clearAll();
}

/** Hook React opcional (badges / refresh UI). */
export function useChapasOficiaisPro<T>(
  selector: (s: ChapasOficiaisProState) => T
): T {
  return useStore(chapasOficiaisProStore, selector);
}
