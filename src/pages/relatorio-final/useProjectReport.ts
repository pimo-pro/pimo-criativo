import { useCallback, useEffect, useState } from "react";
import {
  loadProjectReport,
  markManualPath,
  saveProjectReport,
  seedOrMergeProjectReport,
  setReportStyle,
  withDerivedMetricas,
  withHistoryForPath,
  type ProjectReport,
  type ReportStyle,
} from "@/core/projectReport";
import { applyResultados } from "@/context/projectState";
import { reviveState } from "@/context/projectPersistence";
import {
  buildLiveReportFinanceiro,
  loadMaterialsForFinanceiro,
} from "@/core/projectReport/financeiroFromUnificado";
import {
  buildPaineisChapasDetalhe,
  getPaineisDetalhe,
  withPaineisChapasDetalhe,
} from "@/core/projectReport/paineisChapasDetalhe";
import {
  findOfflineProjectByAnyKey,
  resolveProjectIdentity,
} from "@/core/projects/projectIdentity";
import { toSavedRecordFromOffline } from "@/core/projects/projectsMappers";

function loadReportFlexible(urlKey: string): ProjectReport | null {
  const identity = resolveProjectIdentity(urlKey);
  const keys = [
    urlKey,
    identity?.slug,
    identity?.persistenceId,
    identity?.remoteId,
    identity?.localId,
  ].filter((k): k is string => Boolean(k && String(k).trim()));

  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const stored = loadProjectReport(key);
    if (stored) return stored;
  }
  return null;
}

/** Chave de URL (slug ou id legado) → id de persistência para seed/TRAK. */
function resolveSeedKey(urlKey: string): string {
  const identity = resolveProjectIdentity(urlKey);
  if (identity?.persistenceId) return identity.persistenceId;
  return urlKey.trim();
}

/**
 * P3.17/P3.19: totais live do Unificado; preserva/seed detalhe Painéis sem reprecificar.
 */
function withLiveFinanceiro(report: ProjectReport, seedKey: string): ProjectReport {
  const offline = findOfflineProjectByAnyKey(seedKey);
  const preserved = getPaineisDetalhe(report.financeiro);
  if (!offline) {
    const live = buildLiveReportFinanceiro(null, loadMaterialsForFinanceiro());
    return {
      ...report,
      financeiro: withPaineisChapasDetalhe(live, preserved),
    };
  }
  const record = toSavedRecordFromOffline(offline);
  const revived = reviveState(record.snapshot?.projectState);
  const state = revived ? applyResultados(revived) : null;
  const live = buildLiveReportFinanceiro(state, loadMaterialsForFinanceiro());
  const detalhe =
    preserved.length > 0 ? preserved : buildPaineisChapasDetalhe(seedKey, state);
  return {
    ...report,
    financeiro: withPaineisChapasDetalhe(live, detalhe),
  };
}

export function useProjectReport(projectKey: string | undefined) {
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!projectKey?.trim()) {
        setError("Projeto n\u00e3o especificado.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const seedKey = resolveSeedKey(projectKey);
        const stored = loadReportFlexible(projectKey);
        const merged = await seedOrMergeProjectReport(seedKey, stored);
        const withLive = withLiveFinanceiro(merged, seedKey);
        if (!cancelled) {
          setReport(withLive);
          setDirty(!stored);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar relat\u00f3rio.");
          setLoading(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectKey]);

  const updateReport = useCallback(
    (updater: (prev: ProjectReport) => ProjectReport, manualPath?: string) => {
      setReport((prev) => {
        if (!prev) return prev;
        let next = updater(prev);
        if (manualPath) {
          next = markManualPath(next, manualPath);
          next = withHistoryForPath(prev, next, manualPath);
        }
        return withDerivedMetricas(next);
      });
      setDirty(true);
      setSaveMsg(null);
    },
    []
  );

  const changeStyle = useCallback((style: ReportStyle) => {
    setReport((prev) => {
      if (!prev) return prev;
      const next = setReportStyle(prev, style);
      return withHistoryForPath(prev, next, "reportStyle");
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!report) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const saved = saveProjectReport(report);
      setReport(saved);
      setDirty(false);
      setSaveMsg("Altera\u00e7\u00f5es guardadas no relat\u00f3rio.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Falha ao guardar.");
    } finally {
      setSaving(false);
    }
  }, [report]);

  return {
    report,
    loading,
    saving,
    error,
    dirty,
    saveMsg,
    updateReport,
    changeStyle,
    save,
    setReport,
  };
}
