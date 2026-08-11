import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import PageContainer from "@/components/ui/PageContainer";
import {
  deriveMetricas,
  emptyQualidade,
  exportProjectReportPdf,
  type ReportStyle,
} from "@/core/projectReport";
import { resolveProjectIdentity } from "@/core/projects/projectIdentity";
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

export default function RelatorioFinalProjeto() {
  const { projectId, project } = useParams<{ projectId?: string; project?: string }>();
  const urlKey = (project ?? projectId ?? "").trim();
  const identity = useMemo(() => resolveProjectIdentity(urlKey), [urlKey]);
  const {
    report,
    loading,
    saving,
    error,
    dirty,
    saveMsg,
    updateReport,
    changeStyle,
    save,
  } = useProjectReport(urlKey);
  const backHref = identity?.persistenceId
    ? `/projects/${encodeURIComponent(identity.slug || identity.persistenceId)}`
    : "/projects";
  const [histOpen, setHistOpen] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);

  const metricas = useMemo(() => (report ? deriveMetricas(report) : null), [report]);
  const ferragensCount = report ? report.materiais.length : 0;

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

  const handleExportPdf = () => {
    try {
      exportProjectReportPdf(report);
      setPdfMsg(R.pdfOk);
    } catch (err) {
      setPdfMsg(err instanceof Error ? err.message : R.pdfFail);
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

      <div style={reportPageShell(style)} data-testid="relatorio-final-page">
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
            <Button type="button" variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? R.aGuardar : R.guardar}
            </Button>
            <Button type="button" variant="ghost" disabled title="Em breve">
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

        {/* Ordem P3.18: resumo primeiro, preço (Financeiro) no final */}
        <InfoGeraisBlock
          style={style}
          value={report.gerais}
          onChange={(gerais, path) => updateReport((r) => ({ ...r, gerais }), path)}
        />

        <PainelGraficoBlock style={style} metricas={metricas} report={report} />

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

        <section style={reportSection(style)} data-testid="resumo-sem-precos">
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
              <div style={{ fontSize: 22, fontWeight: 700 }}>{ferragensCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{R.qualidadeLabel}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {(report.qualidade ?? emptyQualidade()).rating} / 5
              </div>
            </div>
          </div>
        </section>

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

        <FinanceiroBlock style={style} value={report.financeiro} />
      </div>

      <HistoricoModal
        open={histOpen}
        history={report.history ?? []}
        onClose={() => setHistOpen(false)}
      />
    </PageContainer>
  );
}
