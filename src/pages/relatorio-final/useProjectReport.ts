import { useCallback, useEffect, useState } from "react";
import { applyResultados } from "@/context/projectState";
import { reviveState } from "@/context/projectPersistence";
import type { ProjectState } from "@/context/projectTypes";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  buildLiveReportFinanceiro,
  loadMaterialsForFinanceiro,
  loadProjectReport,
  markManualPath,
  saveProjectReport,
  seedOrMergeProjectReport,
  setLinhaDetalheVisual,
  setReportStyle,
  setReportLineOverride,
  persistFerragensVisual,
  collectUnificadoFerragens,
  emitFerragensTotalVisual,
  withDerivedMetricas,
  withHistoryForPath,
  withLiveFinanceiro,
  type ProjectReport,
  type ReportFinanceiroDetalhe,
  type ReportStyle,
} from "@/core/projectReport";
import {
  findOfflineProjectByAnyKey,
  resolveProjectIdentity,
} from "@/core/projects/projectIdentity";
import { toSavedRecordFromOffline } from "@/core/projects/projectsMappers";

function loadReportFlexible(urlKey: string): Promise<ProjectReport | null> {
  const identity = resolveProjectIdentity(urlKey);
  const keys = [
    urlKey,
    identity?.slug,
    identity?.persistenceId,
    identity?.remoteId,
    identity?.localId,
  ].filter((k): k is string => Boolean(k && String(k).trim()));

  const seen = new Set<string>();
  return (async () => {
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      const stored = await loadProjectReport(key);
      if (stored) return stored;
    }
    return null;
  })();
}

function resolveSeedKey(urlKey: string): string {
  const identity = resolveProjectIdentity(urlKey);
  if (identity?.persistenceId) return identity.persistenceId;
  return urlKey.trim();
}

function loadProjectState(projectId: string): ProjectState | null {
  const offline = findOfflineProjectByAnyKey(projectId);
  if (!offline) return null;
  const record = toSavedRecordFromOffline(offline);
  const revived = reviveState(record.snapshot?.projectState);
  return revived ? applyResultados(revived) : null;
}

function preserveDetalheMap(report: ProjectReport) {
  const out: Partial<Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>> = {};
  for (const l of report.financeiro?.linhas ?? []) {
    if (l.key === "iva" || l.key === "total") continue;
    if ((l.detalhe?.length ?? 0) > 0) {
      out[l.key as FinanceiroCustoKey] = l.detalhe;
    }
  }
  return out;
}

export function useProjectReport(projectKey: string | undefined) {
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [projectState, setProjectState] = useState<ProjectState | null>(null);
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
        const state = loadProjectState(seedKey);
        const materials = loadMaterialsForFinanceiro();
        const stored = await loadReportFlexible(projectKey);
        const merged = await seedOrMergeProjectReport(seedKey, stored);
        const withLive = withLiveFinanceiro(merged, state, materials);
        if (!cancelled) {
          setProjectState(state);
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
        next = withLiveFinanceiro(next, projectState, loadMaterialsForFinanceiro());
        return withDerivedMetricas(next);
      });
      setDirty(true);
      setSaveMsg(null);
    },
    [projectState]
  );

  const setLineOverride = useCallback(
    (key: FinanceiroCustoKey, value: number | null) => {
      setReport((prev) => {
        if (!prev) return prev;
        const materials = loadMaterialsForFinanceiro();
        const live = buildLiveReportFinanceiro(projectState, materials, {
          lineOverrides: prev.financeiro.lineOverrides,
          attachChapasDetalhe: true,
          projectId: prev.projectId,
          preserveDetalheByKey: preserveDetalheMap(prev),
          ferragensOverrides: prev.financeiro.overrides?.ferragens,
        });
        const withOverride = setReportLineOverride(live, key, value);
        return withDerivedMetricas({
          ...prev,
          financeiro: withOverride,
        });
      });
      setDirty(true);
      setSaveMsg(null);
    },
    [projectState]
  );

  /** Actualiza detalhe visual de uma linha (não altera SSOT). */
  const setLinhaDetalhe = useCallback(
    (key: FinanceiroCustoKey, detalhe: ReportFinanceiroDetalhe[]) => {
      setReport((prev) => {
        if (!prev) return prev;
        const materials = loadMaterialsForFinanceiro();
        const live = buildLiveReportFinanceiro(projectState, materials, {
          lineOverrides: prev.financeiro.lineOverrides,
          attachChapasDetalhe: true,
          projectId: prev.projectId,
          preserveDetalheByKey: {
            ...preserveDetalheMap(prev),
            [key]: detalhe,
          },
          ferragensOverrides: prev.financeiro.overrides?.ferragens,
        });
        let withDetalhe =
          key === "ferragens"
            ? persistFerragensVisual(
                live,
                detalhe,
                collectUnificadoFerragens(projectState)
              )
            : setLinhaDetalheVisual(live, key, detalhe, key === "paineis");
        if (key === "ferragens") {
          const visual = emitFerragensTotalVisual(detalhe);
          const official = Number(withDetalhe.officialSnapshot?.ferragens) || 0;
          withDetalhe = setReportLineOverride(
            withDetalhe,
            key,
            Math.abs(visual - official) > 0.009 ? visual : null
          );
        }
        return withDerivedMetricas({
          ...prev,
          financeiro: withDetalhe,
        });
      });
      setDirty(true);
      setSaveMsg(null);
    },
    [projectState]
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
      const toSave = withLiveFinanceiro(
        report,
        projectState,
        loadMaterialsForFinanceiro()
      );
      const saved = await saveProjectReport(toSave);
      setReport(saved);
      setDirty(false);
      setSaveMsg("Alterações guardadas no servidor.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Falha ao guardar.");
    } finally {
      setSaving(false);
    }
  }, [report, projectState]);

  const liveFinanceiro = report
    ? buildLiveReportFinanceiro(projectState, loadMaterialsForFinanceiro(), {
        lineOverrides: report.financeiro.lineOverrides,
        attachChapasDetalhe: true,
        projectId: report.projectId,
        preserveDetalheByKey: preserveDetalheMap(report),
        ferragensOverrides: report.financeiro.overrides?.ferragens,
      })
    : null;

  return {
    report: report && liveFinanceiro ? { ...report, financeiro: liveFinanceiro } : report,
    projectState,
    loading,
    saving,
    error,
    dirty,
    saveMsg,
    updateReport,
    setLineOverride,
    setLinhaDetalhe,
    changeStyle,
    save,
    setReport,
  };
}
