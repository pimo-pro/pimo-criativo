/**
 * Hook: ProjectState —nico para páginas `/analise` (mesmo SSOT que o ZIP/editor).
 * Prefere industrialLiveProjectStore; senão carrega o record e publica no store.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { reviveState, serializeState } from "@/context/projectPersistence";
import { applyResultados } from "@/context/projectState";
import type { ProjectState } from "@/context/projectTypes";
import type { PersistedProjectSnapshot, SavedProjectRecord } from "@/core/projects/types";
import { getCurrentProjectUser } from "@/core/projects/currentUser";
import { saveProject } from "@/core/projects/projectsClient";
import type { IndustrialDocumentOverridesStore } from "@/core/industrial/onlineAnalysis/industrialDocumentOverridesTypes";
import { persistIndustrialDocumentOverridesToRecord } from "@/core/industrial/onlineAnalysis/persistIndustrialDocumentOverrides";
import type { IndustrialDocumentOverride } from "@/core/industrial/onlineAnalysis/industrialDocumentOverridesTypes";
import type { IndustrialOnlineAnalysisDocId } from "@/core/industrial/onlineAnalysis/industrialOnlineAnalysisDocs";
import {
  getIndustrialLiveProject,
  getIndustrialLiveProjectMatchingSlug,
  liveProjectMatchesPageSlug,
  publishIndustrialLiveProject,
  subscribeIndustrialLiveProject,
} from "@/core/industrial/onlineAnalysis/industrialLiveProjectStore";
import {
  getProjetosSnapshot,
  setProjetosSnapshot,
  saveProjectRecord,
} from "@/app/PROJETOS/projetosSnapshotCache";
import { loadProjectRecordByPageSlug } from "@/app/PROJETOS/projetosProjectLoader";
import {
  decodeProjetosPageSlug,
  snapshotMatchesProjetosPageSlug,
} from "@/app/PROJETOS/projetosPageSlug";

function reviveFromRecord(record: SavedProjectRecord): ProjectState | null {
  const raw = record.snapshot?.projectState;
  if (!raw) return null;
  const revived = reviveState(raw);
  if (!revived) return null;
  return applyResultados(revived);
}

export function useIndustrialAnalysisProject(pageSlug: string | undefined): {
  projectState: ProjectState | null;
  projectName: string;
  loading: boolean;
  error: string | null;
  record: SavedProjectRecord | null;
  /** Persiste overrides e atualiza o store live + cache PROJETOS. */
  commitOverrides: (
    nextOverrides: IndustrialDocumentOverridesStore,
    options?: {
      historyDocId?: IndustrialOnlineAnalysisDocId;
      previousOverride?: IndustrialDocumentOverride;
    }
  ) => Promise<SavedProjectRecord>;
} {
  const liveRevision = useSyncExternalStore(
    subscribeIndustrialLiveProject,
    () => getIndustrialLiveProject()?.revision ?? 0,
    () => 0
  );

  const slugError = pageSlug ? null : "Projeto não especificado na URL.";

  const cachedRecord = useMemo(() => {
    if (!pageSlug) return null;
    const cached = getProjetosSnapshot();
    if (!snapshotMatchesProjetosPageSlug(cached, pageSlug)) return null;
    return reviveFromRecord(cached) ? cached : null;
  }, [pageSlug, liveRevision]);

  const syncedRecord = useMemo(() => {
    if (!pageSlug) return null;
    const live = getIndustrialLiveProject();
    if (!live || !liveProjectMatchesPageSlug(pageSlug, live.projectName)) return null;
    const cached = getProjetosSnapshot();
    return snapshotMatchesProjetosPageSlug(cached, pageSlug) ? cached : null;
  }, [pageSlug, liveRevision]);

  const [loadedRecord, setLoadedRecord] = useState<SavedProjectRecord | null>(null);
  const [loadedForSlug, setLoadedForSlug] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [overrideRecord, setOverrideRecord] = useState<SavedProjectRecord | null>(null);
  const [overrideForSlug, setOverrideForSlug] = useState<string | null>(null);

  const record =
    (overrideForSlug === pageSlug ? overrideRecord : null) ??
    syncedRecord ??
    cachedRecord ??
    (loadedForSlug === pageSlug ? loadedRecord : null);

  const hasLive = Boolean(getIndustrialLiveProjectMatchingSlug(pageSlug));
  const loading = Boolean(
    pageSlug && !slugError && !hasLive && !cachedRecord && loadedForSlug !== pageSlug,
  );
  const error = slugError ?? (loadedForSlug === pageSlug ? fetchError : null);

  useEffect(() => {
    if (!cachedRecord) return;
    const revived = reviveFromRecord(cachedRecord);
    if (revived) publishIndustrialLiveProject(revived);
  }, [cachedRecord]);

  useEffect(() => {
    if (!pageSlug || cachedRecord || getIndustrialLiveProjectMatchingSlug(pageSlug)) return;

    let cancelled = false;

    void loadProjectRecordByPageSlug(pageSlug).then((loaded) => {
      if (cancelled) return;

      setLoadedForSlug(pageSlug);

      if (!loaded) {
        setLoadedRecord(null);
        setFetchError("Projeto não encontrado.");
        return;
      }

      const revived = reviveFromRecord(loaded);
      if (!revived) {
        setLoadedRecord(null);
        setFetchError("Não foi possível ler o estado do projeto.");
        return;
      }

      publishIndustrialLiveProject(revived);
      setProjetosSnapshot(loaded);
      setLoadedRecord(loaded);
      setFetchError(null);
    });

    return () => {
      cancelled = true;
    };
  }, [pageSlug, cachedRecord, liveRevision]);

  const projectState =
    getIndustrialLiveProjectMatchingSlug(pageSlug) ??
    (record ? reviveFromRecord(record) : null);

  const projectName =
    projectState?.projectName?.trim() ||
    record?.name?.trim() ||
    decodeProjetosPageSlug(pageSlug ?? "Projeto");

  const commitOverrides = useCallback(
    async (
      nextOverrides: IndustrialDocumentOverridesStore,
      options?: {
        historyDocId?: IndustrialOnlineAnalysisDocId;
        previousOverride?: IndustrialDocumentOverride;
      }
    ) => {
      const live = getIndustrialLiveProjectMatchingSlug(pageSlug);
      const baseState = live ?? (record ? reviveFromRecord(record) : null);
      if (!baseState) {
        throw new Error("Projeto não disponível para guardar.");
      }

      const baseRecord =
        record && snapshotMatchesProjetosPageSlug(record, pageSlug)
          ? record
          : getProjetosSnapshot() &&
              snapshotMatchesProjetosPageSlug(getProjetosSnapshot(), pageSlug)
            ? getProjetosSnapshot()!
            : null;

      let workingRecord = baseRecord;
      if (!workingRecord) {
        const user = getCurrentProjectUser();
        const persistedSnapshot: PersistedProjectSnapshot = {
          projectState: serializeState(baseState),
          viewerSnapshot: null,
          roomSnapshot: null,
        };
        const saved = await saveProject({
          name: baseState.projectName?.trim() || projectName,
          ownerId: user.ownerId,
          ownerName: user.ownerName,
          snapshot: persistedSnapshot,
          localProjectId: baseState.currentProjectId ?? undefined,
        });
        if (!saved?.id) {
          throw new Error("Falha ao criar registo do projeto.");
        }
        await saveProjectRecord(saved.id, persistedSnapshot, {
          ...saved,
          name: saved.name ?? projectName,
        });
        workingRecord = getProjetosSnapshot();
        if (!workingRecord) {
          throw new Error("Falha ao preparar registo do projeto.");
        }
      }

      const updated = await persistIndustrialDocumentOverridesToRecord(
        workingRecord,
        baseState,
        nextOverrides,
        options
      );
      const nextState = reviveFromRecord(updated);
      if (nextState) {
        publishIndustrialLiveProject(nextState);
      }
      setProjetosSnapshot(updated);
      setOverrideRecord(updated);
      setOverrideForSlug(pageSlug ?? null);
      return updated;
    },
    [pageSlug, record, projectName]
  );

  return {
    projectState,
    projectName,
    loading,
    error,
    record,
    commitOverrides,
  };
}
