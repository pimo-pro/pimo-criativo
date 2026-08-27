import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { IndustrialHistoryEntry } from "@/core/industrial/onlineAnalysis/industrialDocumentHistoryTypes";
import type { IndustrialOnlineAnalysisDocId } from "@/core/industrial/onlineAnalysis/industrialOnlineAnalysisDocs";
import {
  INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS,
  INDUSTRIAL_ONLINE_ANALYSIS_DOCS,
  anyDocumentHasOverrides,
  buildIndustrialOnlineAnalysisDocPath,
  documentHasOverrides,
  downloadIndustrialOnlineAnalysisPdfs,
  listModifiedIndustrialDocIds,
} from "@/core/industrial/onlineAnalysis";
import { industrialFeatureFlags } from "@/industrial/config/featureFlags";

import Button from "@/components/ui/Button";

import ProjetosLoginGate from "../../ProjetosLoginGate";
import IndustrialOnlineAnalysisLayout from "../../analise/IndustrialOnlineAnalysisLayout";
import IndustrialOnlineAnalysisHistoryPanel from "../../analise/IndustrialOnlineAnalysisHistoryPanel";
import IndustrialOnlineAnalysisDownloadBar from "../../analise/IndustrialOnlineAnalysisDownloadBar";
import { useIndustrialAnalysisProject } from "../../analise/useIndustrialAnalysisProject";

function ProjetosAnaliseIndexPageContent() {
  const { project: pageSlug } = useParams();
  const enabled = industrialFeatureFlags.industrialOnlineAnalysis;

  const { projectState, projectName, loading, error } =
    useIndustrialAnalysisProject(pageSlug);

  const [selected, setSelected] = useState<Set<IndustrialOnlineAnalysisDocId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [dlMsg, setDlMsg] = useState<string | null>(null);

  const revivedOk = projectState != null;
  const historyEntries: IndustrialHistoryEntry[] =
    projectState?.industrialDocumentHistory ?? [];
  const hasAnyOverrides = anyDocumentHasOverrides(projectState?.industrialDocumentOverrides);
  const modifiedIds = useMemo(
    () => (projectState ? listModifiedIndustrialDocIds(projectState) : []),
    [projectState]
  );

  const toggleDoc = useCallback((docId: IndustrialOnlineAnalysisDocId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const runDownload = useCallback(
    async (
      docIds: IndustrialOnlineAnalysisDocId[],
      rowsMode: "effective" | "canonical",
      emptyMessage: string
    ) => {
      if (!projectState) return;
      if (docIds.length === 0) {
        setDlMsg(emptyMessage);
        return;
      }
      setBusy(true);
      setDlMsg(null);
      try {
        const result = await downloadIndustrialOnlineAnalysisPdfs(projectState, docIds, {
          rowsMode,
        });
        if (!result.ok && result.docCount === 0) {
          setDlMsg(result.errors[0]?.message ?? "Falha ao gerar PDFs.");
        } else if (result.errors.length) {
          setDlMsg(
            `Descarregado ${result.fileName} (${result.docCount} PDF(s)); falhas: ${result.errors
              .map((e) => e.docId)
              .join(", ")}`
          );
        } else {
          setDlMsg(`Descarregado: ${result.fileName}`);
        }
      } catch (err) {
        setDlMsg(err instanceof Error ? err.message : "Falha no download.");
      } finally {
        setBusy(false);
      }
    },
    [projectState]
  );

  if (!enabled) {
    return (
      <IndustrialOnlineAnalysisLayout
        projectName={projectName}
        pageSlug={pageSlug ?? projectName}
      >
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          A funcionalidade — Análise arquivo completo… está desativada (
          <code>industrialOnlineAnalysis = false</code>).
        </p>
      </IndustrialOnlineAnalysisLayout>
    );
  }

  return (
    <IndustrialOnlineAnalysisLayout projectName={projectName} pageSlug={pageSlug ?? projectName}>
      {loading ? <p style={{ color: "var(--text-muted)" }}>A carregar projeto…</p> : null}
      {!loading && error ? (
        <p style={{ color: "var(--pi-btn-danger-bg, #dc2626)" }}>{error}</p>
      ) : null}
      {!loading && !error && !revivedOk ? (
        <p style={{ color: "var(--pi-btn-danger-bg, #dc2626)" }}>
          Não foi possível ler o estado do projeto.
        </p>
      ) : null}
      {!loading && !error && revivedOk && projectState ? (
        <>
          <IndustrialOnlineAnalysisDownloadBar
            selectedCount={selected.size}
            modifiedCount={modifiedIds.length}
            hasAnyOverrides={hasAnyOverrides}
            busy={busy}
            message={dlMsg}
            onSelectAll={() => setSelected(new Set(INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS))}
            onClearSelection={() => setSelected(new Set())}
            onGenerateSelected={() =>
              void runDownload([...selected], "effective", "Seleccione pelo menos um documento.")
            }
            onGenerateModified={() =>
              void runDownload(modifiedIds, "effective", "Nenhum PDF modificado.")
            }
            onGenerateAll={() =>
              void runDownload([...INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS], "effective", "")
            }
            onGenerateOriginals={() => {
              const ids =
                selected.size > 0
                  ? [...selected]
                  : [...INDUSTRIAL_ONLINE_ANALYSIS_DOC_IDS];
              void runDownload(ids, "canonical", "");
            }}
          />
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>
              Documentos industriais (leitura + edição documental + download seletivo). A cutlist
              editada alimenta as etiquetas UEE (material/obs/qtd/peça/caixa) sem alterar CNC.
            </p>
            {documentHasOverrides(projectState.industrialDocumentOverrides, "cutlist") ? (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  color: "#92400e",
                  background: "#fffbeb",
                  padding: "8px 10px",
                  borderRadius: 6,
                }}
              >
                A cutlist tem edições documentais: as etiquetas UEE reflectem material, qtd,
                observações, peça e caixa. CNC/TCN/drill/nesting não são alterados.
              </p>
            ) : null}
            {INDUSTRIAL_ONLINE_ANALYSIS_DOCS.map((doc) => {
              const modified = documentHasOverrides(
                projectState.industrialDocumentOverrides,
                doc.id
              );
              const isSelected = selected.has(doc.id);
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "stretch",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${
                      isSelected ? "var(--blue-light, #2563eb)" : "var(--card-border)"
                    }`,
                    background: isSelected ? "rgba(37,99,235,0.08)" : "var(--card-bg)",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDoc(doc.id)}
                      disabled={busy}
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sel.</span>
                  </label>
                  <Link
                    to={buildIndustrialOnlineAnalysisDocPath(projectName, doc.id)}
                    style={{
                      flex: 1,
                      textDecoration: "none",
                      color: "var(--text-main)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}>
                      <span>{doc.label}</span>
                      {modified ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "#fef3c7",
                            color: "#92400e",
                          }}
                        >
                          Modificado
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {doc.description} — <code style={{ fontSize: 11 }}>{doc.id}</code>
                    </div>
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void runDownload([doc.id], "effective", "")}
                    style={{ alignSelf: "center", flexShrink: 0 }}
                  >
                    PDF
                  </Button>
                </div>
              );
            })}
          </div>
          <IndustrialOnlineAnalysisHistoryPanel
            entries={historyEntries}
            projectName={projectName}
            title="Histórico global"
          />
        </>
      ) : null}
    </IndustrialOnlineAnalysisLayout>
  );
}

export default function ProjetosAnaliseIndexPage() {
  return (
    <ProjetosLoginGate title="Inicia sessão para veres este projeto">
      <ProjetosAnaliseIndexPageContent />
    </ProjetosLoginGate>
  );
}
