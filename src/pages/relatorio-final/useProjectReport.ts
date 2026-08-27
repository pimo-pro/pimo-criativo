import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectState } from "@/context/projectTypes";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import type { ProductionRelease } from "@/core/industrial/productionRelease";
import { loadProductionRelease } from "@/core/industrial/productionReleasePersist";
import {
  createReportSaveQueue,
  loadProjectReport,
  loadReportProjectContext,
  markManualPath,
  moneyEq,
  saveProjectReport,
  seedOrMergeProjectReport,
  setLinhaDetalheVisual,
  setReportStyle,
  setReportLineOverride,
  setReportMargemGanho,
  persistFerragensVisual,
  emitFerragensTotalVisual,
  releaseFerragensAsUnificadoLines,
  withDerivedMetricas,
  withHistoryForPath,
  withProductionReleaseFinanceiro,
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

export function useProjectReport(projectKey: string | undefined) {
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [projectState, setProjectState] = useState<ProjectState | null>(null);
  const [productionRelease, setProductionRelease] = useState<ProductionRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const reportRef = useRef<ProjectReport | null>(null);
  const projectStateRef = useRef<ProjectState | null>(null);
  const productionReleaseRef = useRef<ProductionRelease | null>(null);
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

  const refreshProductionRelease = useCallback(async () => {
    if (!projectKey?.trim() || !reportRef.current) return;
    if (loadingRef.current || saveQueueRef.current.isBusy()) return;
    try {
      const seedKey = resolveSeedKey(projectKey);
      const release = await loadProductionRelease(seedKey);
      productionReleaseRef.current = release;
      setProductionRelease(release);
      const prev = reportRef.current;
      if (!prev) return;
      const next = withProductionReleaseFinanceiro(prev, release);
      reportRef.current = next;
      setReport(next);
    } catch (err) {
      console.warn("[pimo] refresh productionRelease (Relatório) falhou:", err);
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
        const stored = await loadReportFlexible(projectKey);
        const release = await loadProductionRelease(seedKey);
        const merged = await seedOrMergeProjectReport(seedKey, stored, release);
        const next = withProductionReleaseFinanceiro(merged, release);
        if (!cancelled) {
          projectUpdatedAtRef.current = ctx.updatedAt || "";
          projectStateRef.current = state;
          productionReleaseRef.current = release;
          reportRef.current = next;
          setProjectState(state);
          setProductionRelease(release);
          setReport(next);
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
        void refreshProductionRelease();
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
  }, [projectKey, refreshProductionRelease]);

  const updateReport = useCallback(
    (updater: (prev: ProjectReport) => ProjectReport, manualPath?: string) => {
      const prev = reportRef.current;
      if (!prev) return;
      let next = updater(prev);
      if (manualPath) {
        next = markManualPath(next, manualPath);
        next = withHistoryForPath(prev, next, manualPath);
      }
      next = withProductionReleaseFinanceiro(next, productionReleaseRef.current);
      commitReport(withDerivedMetricas(next));
    },
    [commitReport]
  );

  const setLineOverride = useCallback(
    (key: FinanceiroCustoKey, value: number | null) => {
      const prev = reportRef.current;
      if (!prev) return;
      let nextValue = value;
      if (
        isReportFinanceiroProvenanceEnabled() &&
        nextValue != null &&
        Number.isFinite(nextValue)
      ) {
        const official = Number(prev.financeiro.officialSnapshot?.[key]) || 0;
        if (moneyEq(nextValue, official)) nextValue = null;
      }
      let withOverride = setReportLineOverride(prev.financeiro, key, nextValue);
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

  /** Actualiza detalhe visual de uma linha (não altera SSOT do release). */
  const setLinhaDetalhe = useCallback(
    (key: FinanceiroCustoKey, detalhe: ReportFinanceiroDetalhe[]) => {
      const prev = reportRef.current;
      if (!prev) return;
      let withDetalhe =
        key === "ferragens"
          ? persistFerragensVisual(
              prev.financeiro,
              detalhe,
              productionReleaseRef.current
                ? releaseFerragensAsUnificadoLines(productionReleaseRef.current)
                : []
            )
          : setLinhaDetalheVisual(prev.financeiro, key, detalhe, key === "paineis");
      if (key === "ferragens") {
        const visual = emitFerragensTotalVisual(detalhe);
        const official = Number(withDetalhe.officialSnapshot?.ferragens) || 0;
        withDetalhe =
          Math.abs(visual - official) > 0.009
            ? setReportLineOverride(withDetalhe, key, visual)
            : setReportLineOverride(withDetalhe, key, null);
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
      commitReport(
        withDerivedMetricas({
          ...prev,
          financeiro: setReportMargemGanho(prev.financeiro, config),
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
      const saved = await saveProjectReport(current);
      reportRef.current = saved;
      setReport(saved);
      setDirty(false);
      setSaveMsg("Altera\u00e7\u00f5es guardadas no servidor.");
    });
    setSaving(saveQueueRef.current.isBusy());
    if (result.ok === false) {
      setSaveMsg(result.error);
    } else {
      void refreshProductionRelease();
    }
    return result;
  }, [refreshProductionRelease]);

  const save = useCallback(async () => {
    return persistNow();
  }, [persistNow]);

  /** E2/A2: gravação imediata enfileirada (toast no Passo A). */
  const saveCritical = useCallback(async (): Promise<ReportSaveResult> => {
    return persistNow();
  }, [persistNow]);

  return {
    report,
    projectState,
    productionRelease,
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
