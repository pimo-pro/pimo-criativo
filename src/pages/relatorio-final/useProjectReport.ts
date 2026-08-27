import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectState } from "@/context/projectTypes";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  buildLiveReportFinanceiro,
  createReportSaveQueue,
  loadMaterialsForFinanceiro,
  loadProjectReport,
  loadReportProjectContext,
  markManualPath,
  moneyEq,
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
  type ReportSaveResult,
  type ReportStyle,
  type ReportMargemGanhoConfig,
} from "@/core/projectReport";
import { isReportFinanceiroProvenanceEnabled } from "@/core/features";
import { resolveProjectIdentity } from "@/core/projects/projectIdentity";

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

function preserveDetalheMap(report: ProjectReport) {
  const out: Partial<Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>> = {};
  for (const l of report.financeiro?.linhas ?? []) {
    if (l.key === "iva" || l.key === "total" || l.key === "margemGanho") continue;
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

  const reportRef = useRef<ProjectReport | null>(null);
  const projectStateRef = useRef<ProjectState | null>(null);
  const projectUpdatedAtRef = useRef<string>("");
  const loadingRef = useRef(false);
  const saveQueueRef = useRef(createReportSaveQueue());

  const commitReport = useCallback((next: ProjectReport, markDirty = true) => {
    reportRef.current = next;
    setReport(next);
    if (markDirty) {
      setDirty(true);
      setSaveMsg(null);
    }
  }, []);

  const refreshProjectState = useCallback(async () => {
    if (!projectKey?.trim() || !reportRef.current) return;
    if (loadingRef.current || saveQueueRef.current.isBusy()) return;
    try {
      const seedKey = resolveSeedKey(projectKey);
      const ctx = await loadReportProjectContext(seedKey);
      const nextUpdated = ctx.updatedAt || "";
      if (
        nextUpdated &&
        nextUpdated === projectUpdatedAtRef.current &&
        projectStateRef.current
      ) {
        return;
      }
      projectUpdatedAtRef.current = nextUpdated;
      projectStateRef.current = ctx.state;
      setProjectState(ctx.state);
    } catch (err) {
      console.warn("[pimo] refresh ProjectState (Relatório) falhou:", err);
    }
  }, [projectKey]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!projectKey?.trim()) {
        setError("Projeto n\u00e3o especificado.");
        setLoading(false);
        return;
      }
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const seedKey = resolveSeedKey(projectKey);
        const ctx = await loadReportProjectContext(seedKey);
        const state = ctx.state;
        const materials = loadMaterialsForFinanceiro();
        const stored = await loadReportFlexible(projectKey);
        const merged = await seedOrMergeProjectReport(seedKey, stored);
        const withLive = withLiveFinanceiro(merged, state, materials);
        if (!cancelled) {
          projectUpdatedAtRef.current = ctx.updatedAt || "";
          projectStateRef.current = state;
          reportRef.current = withLive;
          setProjectState(state);
          setReport(withLive);
          setDirty(!stored);
          setLoading(false);
          loadingRef.current = false;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar relat\u00f3rio.");
          setLoading(false);
          loadingRef.current = false;
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
      loadingRef.current = false;
    };
  }, [projectKey]);

  useEffect(() => {
    if (!projectKey?.trim()) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshProjectState();
      }, 300);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [projectKey, refreshProjectState]);

  const updateReport = useCallback(
    (updater: (prev: ProjectReport) => ProjectReport, manualPath?: string) => {
      const prev = reportRef.current;
      if (!prev) return;
      let next = updater(prev);
      if (manualPath) {
        next = markManualPath(next, manualPath);
        next = withHistoryForPath(prev, next, manualPath);
      }
      next = withLiveFinanceiro(next, projectStateRef.current, loadMaterialsForFinanceiro());
      commitReport(withDerivedMetricas(next));
    },
    [commitReport]
  );

  const setLineOverride = useCallback(
    (key: FinanceiroCustoKey, value: number | null) => {
      const prev = reportRef.current;
      if (!prev) return;
      const materials = loadMaterialsForFinanceiro();
      const state = projectStateRef.current;
      const live = buildLiveReportFinanceiro(state, materials, {
        lineOverrides: prev.financeiro.lineOverrides,
        attachChapasDetalhe: true,
        projectId: prev.projectId,
        preserveDetalheByKey: preserveDetalheMap(prev),
        ferragensOverrides: prev.financeiro.overrides?.ferragens,
        margemGanho: prev.financeiro.margemGanho,
        sourceFinanceiro: prev.financeiro,
      });
      let nextValue = value;
      if (
        isReportFinanceiroProvenanceEnabled() &&
        nextValue != null &&
        Number.isFinite(nextValue)
      ) {
        const official = Number(live.officialSnapshot?.[key]) || 0;
        if (moneyEq(nextValue, official)) nextValue = null;
      }
      let withOverride = setReportLineOverride(live, key, nextValue);
      let nextReport: ProjectReport = {
        ...prev,
        financeiro: withOverride,
      };
      if (nextValue != null && isReportFinanceiroProvenanceEnabled()) {
        nextReport = markManualPath(
          nextReport,
          `financeiro.lineOverrides.${key}`
        );
      }
      commitReport(withDerivedMetricas(nextReport));
    },
    [commitReport]
  );

  /** Actualiza detalhe visual de uma linha (não altera SSOT). */
  const setLinhaDetalhe = useCallback(
    (key: FinanceiroCustoKey, detalhe: ReportFinanceiroDetalhe[]) => {
      const prev = reportRef.current;
      if (!prev) return;
      const materials = loadMaterialsForFinanceiro();
      const state = projectStateRef.current;
      const live = buildLiveReportFinanceiro(state, materials, {
        lineOverrides: prev.financeiro.lineOverrides,
        attachChapasDetalhe: true,
        projectId: prev.projectId,
        preserveDetalheByKey: {
          ...preserveDetalheMap(prev),
          [key]: detalhe,
        },
        ferragensOverrides: prev.financeiro.overrides?.ferragens,
        margemGanho: prev.financeiro.margemGanho,
        sourceFinanceiro: prev.financeiro,
      });
      let withDetalhe =
        key === "ferragens"
          ? persistFerragensVisual(
              live,
              detalhe,
              collectUnificadoFerragens(state)
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
      commitReport(
        withDerivedMetricas({
          ...prev,
          financeiro: withDetalhe,
        })
      );
    },
    [commitReport]
  );

  const setMargemGanho = useCallback(
    (config: ReportMargemGanhoConfig | null) => {
      const prev = reportRef.current;
      if (!prev) return;
      const materials = loadMaterialsForFinanceiro();
      const state = projectStateRef.current;
      const live = buildLiveReportFinanceiro(state, materials, {
        lineOverrides: prev.financeiro.lineOverrides,
        attachChapasDetalhe: true,
        projectId: prev.projectId,
        preserveDetalheByKey: preserveDetalheMap(prev),
        ferragensOverrides: prev.financeiro.overrides?.ferragens,
        margemGanho: config,
        sourceFinanceiro: prev.financeiro,
      });
      commitReport(
        withDerivedMetricas({
          ...prev,
          financeiro: live,
        })
      );
    },
    [commitReport]
  );

  const changeStyle = useCallback(
    (style: ReportStyle) => {
      const prev = reportRef.current;
      if (!prev) return;
      const next = setReportStyle(prev, style);
      commitReport(withHistoryForPath(prev, next, "reportStyle"));
    },
    [commitReport]
  );

  /** Grava o reportRef actual via fila (Guardar geral + atos críticos). */
  const persistNow = useCallback(async (): Promise<ReportSaveResult> => {
    if (!reportRef.current) {
      return { ok: false, error: "Relat\u00f3rio indispon\u00edvel." };
    }
    setSaving(true);
    setSaveMsg(null);
    const result = await saveQueueRef.current.enqueue(async () => {
      const current = reportRef.current;
      if (!current) throw new Error("Relat\u00f3rio indispon\u00edvel.");
      const toSave = withLiveFinanceiro(
        current,
        projectStateRef.current,
        loadMaterialsForFinanceiro()
      );
      const saved = await saveProjectReport(toSave);
      reportRef.current = saved;
      setReport(saved);
      setDirty(false);
      setSaveMsg("Altera\u00e7\u00f5es guardadas no servidor.");
    });
    setSaving(saveQueueRef.current.isBusy());
    if (result.ok === false) {
      setSaveMsg(result.error);
    } else {
      void refreshProjectState();
    }
    return result;
  }, [refreshProjectState]);

  const save = useCallback(async () => {
    return persistNow();
  }, [persistNow]);

  /** E2/A2: gravação imediata enfileirada (toast no Passo A). */
  const saveCritical = useCallback(async (): Promise<ReportSaveResult> => {
    return persistNow();
  }, [persistNow]);

  const liveFinanceiro = report
    ? buildLiveReportFinanceiro(projectState, loadMaterialsForFinanceiro(), {
        lineOverrides: report.financeiro.lineOverrides,
        attachChapasDetalhe: true,
        projectId: report.projectId,
        preserveDetalheByKey: preserveDetalheMap(report),
        ferragensOverrides: report.financeiro.overrides?.ferragens,
        margemGanho: report.financeiro.margemGanho,
        sourceFinanceiro: report.financeiro,
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
    setMargemGanho,
    changeStyle,
    save,
    saveCritical,
    setReport,
  };
}
