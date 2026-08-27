import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import PageContainer from "@/components/ui/PageContainer";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  deriveMetricas,
  emptyQualidade,
  exportProjectReportPdf,
  exportProjectReportPdfBytes,
  resolveReportCoverImage,
  sendFinalReportEmail,
  collectUnificadoFerragens,
  collectPaineisSugestoesProjeto,
  type ReportStyle,
} from "@/core/projectReport";
import { useToast } from "@/context/ToastContext";
import { findOfflineProjectByAnyKey, resolveProjectIdentity } from "@/core/projects/projectIdentity";
import { printHideClass, reportPageShell, reportSection, reportSectionTitle } from "./reportStyles";
import { useProjectReport } from "./useProjectReport";
import { R } from "./uiLabels";
import InfoGeraisBlock from "./components/InfoGeraisBlock";
import PainelGraficoBlock from "./components/PainelGraficoBlock";
import EstadoProjetoBlock from "./components/EstadoProjetoBlock";
import FinanceiroBlock from "./components/FinanceiroBlock";
import NotasBlock from "./components/NotasBlock";
import QualidadeBlock from "./components/QualidadeBlock";
import HistoricoModal from "./components/HistoricoModal";
import EnviarRelatorioEmailModal from "./components/EnviarRelatorioEmailModal";

export default function RelatorioFinalProjeto() {
  const { projectId, project } = useParams<{ projectId?: string; project?: string }>();
  const urlKey = (project ?? projectId ?? "").trim();
  const identity = useMemo(() => resolveProjectIdentity(urlKey), [urlKey]);
  const { showToast, startLoading, stopLoading } = useToast();
  const {
    report,
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
  } = useProjectReport(urlKey);
  const backHref = identity?.persistenceId
    ? `/projects/${encodeURIComponent(identity.slug || identity.persistenceId)}`
    : "/projects";
  const [histOpen, setHistOpen] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const metricas = useMemo(() => (report ? deriveMetricas(report) : null), [report]);

  const ferragensSsotOrigem = useMemo(() => {
    const lines = collectUnificadoFerragens(projectState);
    return Object.fromEntries(lines.map((l) => [l.ferragemId, l.origemPreco]));
  }, [projectState]);

  const ferragensSugestoesProjeto = useMemo(() => {
    const lines = collectUnificadoFerragens(projectState);
    return [...new Set(lines.map((l) => l.nome).filter(Boolean))];
  }, [projectState]);

  const paineisSugestoesProjeto = useMemo(() => {
    const projectId = report?.projectId?.trim() || urlKey;
    if (!projectId) return [];
    return collectPaineisSugestoesProjeto(projectId, projectState);
  }, [report?.projectId, projectState, urlKey]);

  const handleGuardar = async () => {
    const result = await save();
    if (result.ok) {
      showToast(R.guardadoServidor, "success");
    } else if (result.ok === false) {
      showToast(result.error || R.guardarFail, "error");
    }
  };

  const handleApplyVisualPersist = async (
    key: FinanceiroCustoKey,
    value: number | null
  ) => {
    setLineOverride(key, value);
    const result = await saveCritical();
    if (result.ok) {
      showToast(R.overrideGuardadoOk, "success");
    } else if (result.ok === false) {
      showToast(result.error || R.guardarFail, "error");
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <Loader label={R.carregar} />
      </PageContainer>
    );
  }

  if (error || !report || !metricas) {
    return (
      <PageContainer>
        <p style={{ color: "var(--pi-btn-danger-bg, #dc2626)" }}>
          {error ?? R.indisponivel}
        </p>
        <Link to={backHref}>{R.voltar}</Link>
      </PageContainer>
    );
  }

  const style: ReportStyle = report.reportStyle;

  const resolveCoverImageDataUrl = (): string | null => {
    const offline = findOfflineProjectByAnyKey(urlKey);
    return (
      resolveReportCoverImage([
        report.projectId,
        identity?.persistenceId,
        identity?.slug,
        identity?.remoteId,
        identity?.localId,
        urlKey,
      ]) ??
      offline?.thumbnailDataUrl ??
      null
    );
  };

  const handleExportPdf = () => {
    try {
      exportProjectReportPdf(report, { coverImageDataUrl: resolveCoverImageDataUrl() });
      setPdfMsg(R.pdfOk);
    } catch (err) {
      setPdfMsg(err instanceof Error ? err.message : R.pdfFail);
    }
  };

  const handleSendEmail = async (recipientEmail: string) => {
    setEmailSending(true);
    const loadingId = startLoading(R.emailAEnviar);
    try {
      const attachment = exportProjectReportPdfBytes(report, {
        coverImageDataUrl: resolveCoverImageDataUrl(),
      });
      const result = await sendFinalReportEmail({
        recipientEmail,
        projectName: report.gerais.nomeProjeto,
        designer: report.gerais.designer,
        boxCount: report.producao.caixas.length,
        pecasCount: report.producao.pecas.length,
        qualityRating: (report.qualidade ?? emptyQualidade()).rating,
        subtotal: report.financeiro.subtotal,
        ivaPct: report.financeiro.ivaPct,
        ivaValor: report.financeiro.ivaValor,
        totalProjeto: report.financeiro.totalProjeto,
        attachment,
        attachmentFileName: `Relatorio_Final_${(report.gerais.nomeProjeto || "projeto")
          .replace(/[^\w\- ]+/g, "")
          .trim()
          .replace(/\s+/g, "_")
          .slice(0, 60) || "projeto"}.pdf`,
      });
      if (result.success) {
        showToast(R.emailOk, "success");
        setEmailOpen(false);
      } else {
        showToast(result.error ?? R.emailFail, "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : R.emailFail, "error");
    } finally {
      stopLoading(loadingId);
      setEmailSending(false);
    }
  };

  return (
    <PageContainer>
      <style>{`
        @media print {
          .${printHideClass} { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div style={reportPageShell(style)}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{R.titulo}</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {R.isolado}
              {dirty ? R.dirty : ""}
            </p>
          </div>
          <div className={printHideClass} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button
              type="button"
              variant={style === "classic" ? "primary" : "secondary"}
              onClick={() => changeStyle("classic")}
            >
              {R.classico}
            </Button>
            <Button
              type="button"
              variant={style === "cards" ? "primary" : "secondary"}
              onClick={() => changeStyle("cards")}
            >
              {R.cards}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setHistOpen(true)}>
              {R.historico}
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              {R.imprimir}
            </Button>
            <Button type="button" variant="secondary" onClick={handleExportPdf}>
              {R.exportarPdf}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => void handleGuardar()}
            >
              {saving ? R.aGuardar : R.guardar}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={emailSending}
              onClick={() => setEmailOpen(true)}
            >
              {R.email}
            </Button>
            <Link to={backHref} style={{ alignSelf: "center", fontSize: 13 }}>
              {R.voltar}
            </Link>
          </div>
        </header>

        {saveMsg || pdfMsg ? (
          <p className={printHideClass} style={{ margin: 0, color: "var(--pi-btn-confirm-bg, #16a34a)" }}>
            {saveMsg ?? pdfMsg}
          </p>
        ) : null}

        <InfoGeraisBlock
          style={style}
          value={report.gerais}
          onChange={(gerais, path) => updateReport((r) => ({ ...r, gerais }), path)}
        />

        <PainelGraficoBlock
          style={style}
          metricas={metricas}
          report={report}
          projectState={projectState}
        />

        <EstadoProjetoBlock
          style={style}
          design={report.design}
          producao={report.producao}
          montagem={report.montagem}
          onDesign={(design) => updateReport((r) => ({ ...r, design }), "design")}
          onProducao={(producao, path) =>
            updateReport((r) => ({ ...r, producao }), path ?? "producao")
          }
          onMontagem={(montagem, path) =>
            updateReport((r) => ({ ...r, montagem }), path ?? "montagem")
          }
        />

        <FinanceiroBlock
          style={style}
          value={report.financeiro}
          onLineOverride={setLineOverride}
          onLinhaDetalhe={setLinhaDetalhe}
          onApplyVisualPersist={handleApplyVisualPersist}
          saving={saving}
          ferragensSsotOrigem={ferragensSsotOrigem}
          ferragensSugestoesProjeto={ferragensSugestoesProjeto}
          paineisSugestoesProjeto={paineisSugestoesProjeto}
          onMargemGanhoChange={setMargemGanho}
        />

        <NotasBlock
          style={style}
          value={report.notas ?? []}
          onChange={(notas) => updateReport((r) => ({ ...r, notas }), "notas")}
        />

        <QualidadeBlock
          style={style}
          value={report.qualidade ?? emptyQualidade()}
          onChange={(qualidade) => updateReport((r) => ({ ...r, qualidade }), "qualidade")}
        />

        <section style={reportSection(style)}>
          <h2 style={reportSectionTitle}>{R.resumo}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.caixas}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{report.producao.caixas.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.pecas}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{report.producao.pecas.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.materiaisFerragens}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{report.materiais.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.qualidadeLabel}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {(report.qualidade ?? emptyQualidade()).rating} / 5
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.subtotal}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {report.financeiro.subtotal.toFixed(2)} EUR
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                IVA ({report.financeiro.ivaPct}%)
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {report.financeiro.ivaValor.toFixed(2)} EUR
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.totalProjeto}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--blue-light, #2563eb)" }}>
                {report.financeiro.totalProjeto.toFixed(2)} EUR
              </div>
            </div>
          </div>
        </section>
      </div>

      <HistoricoModal
        open={histOpen}
        history={report.history ?? []}
        onClose={() => setHistOpen(false)}
      />
      <EnviarRelatorioEmailModal
        open={emailOpen}
        isSubmitting={emailSending}
        onConfirm={(email) => void handleSendEmail(email)}
        onCancel={() => setEmailOpen(false)}
      />
    </PageContainer>
  );
}
