/**
 * Carrega ProjectState para o Relatório Final: offline primeiro, remoto se faltar.
 * Não toca no pipeline industrial; só lê snapshot já persistido.
 */

import { applyResultados } from "@/context/projectState";
import { reviveState } from "@/context/projectPersistence";
import type { ProjectState } from "@/context/projectTypes";
import {
  findOfflineProjectByAnyKey,
  resolveProjectIdentity,
} from "@/core/projects/projectIdentity";
import { loadProjectRecord } from "@/core/projects/projectsClient";
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

/**
 * 1) Offline com state válido → usa já.
 * 2) Senão → loadProjectRecord (remoto + merge offline se necessário).
 */
export async function loadReportProjectContext(
  projectId: string
): Promise<ReportProjectContext> {
  const id = projectId.trim();
  if (!id) return emptyContext();

  for (const key of resolveLoadKeys(id)) {
    const offlineCtx = contextFromOffline(key);
    if (offlineCtx?.state) return offlineCtx;
  }

  for (const key of resolveLoadKeys(id)) {
    try {
      const record = await loadProjectRecord(key);
      if (!record) continue;
      const ctx = contextFromRecord(record);
      if (ctx.state || ctx.name) return ctx;
    } catch (err) {
      console.warn("[pimo] Falha ao carregar ProjectState remoto para relatório:", key, err);
    }
  }

  for (const key of resolveLoadKeys(id)) {
    const offlineCtx = contextFromOffline(key);
    if (offlineCtx) return offlineCtx;
  }

  return emptyContext();
}
