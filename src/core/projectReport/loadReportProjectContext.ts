/**
 * Carrega ProjectState para o Relatório Final.
 * R1: escolhe o snapshot mais fresco entre offline e remoto (updatedAt),
 * em vez de "offline primeiro cego".
 * Não toca no pipeline industrial; só lê (o merge remoto pode actualizar
 * o cache offline via loadProjectFromServerAndMerge).
 */

import { applyResultados } from "@/context/projectState";
import { reviveState } from "@/context/projectPersistence";
import type { ProjectState } from "@/context/projectTypes";
import {
  findOfflineProjectByAnyKey,
  resolveProjectIdentity,
} from "@/core/projects/projectIdentity";
import { loadProjectRecordFresh } from "@/core/projects/projectsClient";
import { toSavedRecordFromOffline } from "@/core/projects/projectsMappers";
import type { SavedProjectRecord } from "@/core/projects/types";

export type ReportProjectContext = {
  state: ProjectState | null;
  name: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
};

function emptyContext(): ReportProjectContext {
  return { state: null, name: "", ownerName: "", createdAt: "", updatedAt: "" };
}

function resolveLoadKeys(projectId: string): string[] {
  const identity = resolveProjectIdentity(projectId);
  const keys = [
    projectId,
    identity?.persistenceId,
    identity?.remoteId,
    identity?.slug,
    identity?.localId,
  ].filter((k): k is string => Boolean(k && String(k).trim()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function contextFromRecord(record: SavedProjectRecord): ReportProjectContext {
  const revived = reviveState(record.snapshot?.projectState);
  const state = revived ? applyResultados(revived) : null;
  return {
    state,
    name: record.name || state?.projectName || "",
    ownerName: record.ownerName || "",
    createdAt: record.createdAt || "",
    updatedAt: record.updatedAt || "",
  };
}

function contextFromOffline(projectId: string): ReportProjectContext | null {
  const offline = findOfflineProjectByAnyKey(projectId);
  if (!offline) return null;
  return contextFromRecord(toSavedRecordFromOffline(offline));
}

function parseUpdatedAtMs(iso: string): number {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? t : 0;
}

/**
 * Prefere contexto com state; entre dois com state, o updatedAt mais recente.
 * Empate → mantém `a` (quem chama passa remoto/fresco primeiro → ganha empates).
 */
export function pickFresherReportContext(
  a: ReportProjectContext | null,
  b: ReportProjectContext | null
): ReportProjectContext | null {
  if (!a) return b;
  if (!b) return a;
  const aOk = Boolean(a.state);
  const bOk = Boolean(b.state);
  if (aOk && !bOk) return a;
  if (bOk && !aOk) return b;
  if (parseUpdatedAtMs(b.updatedAt) > parseUpdatedAtMs(a.updatedAt)) return b;
  return a;
}

/**
 * 1) Tenta load fresco (remoto+merge, com timeout) por cada key de identidade.
 * 2) Compara com offline puro.
 * 3) Devolve o mais recente com state válido.
 */
export async function loadReportProjectContext(
  projectId: string
): Promise<ReportProjectContext> {
  const id = projectId.trim();
  if (!id) return emptyContext();

  const keys = resolveLoadKeys(id);
  let best: ReportProjectContext | null = null;

  for (const key of keys) {
    try {
      const record = await loadProjectRecordFresh(key);
      if (!record) continue;
      best = pickFresherReportContext(best, contextFromRecord(record));
    } catch (err) {
      console.warn(
        "[pimo] Falha ao carregar ProjectState fresco para relatório:",
        key,
        err
      );
    }
  }

  for (const key of keys) {
    best = pickFresherReportContext(best, contextFromOffline(key));
  }

  return best ?? emptyContext();
}
