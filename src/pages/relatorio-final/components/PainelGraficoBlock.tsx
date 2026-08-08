import {
  deriveTempoTrabalhoHoras,
  type ProjectReport,
  type ProjectReportMetricas,
  type ReportStyle,
} from "@/core/projectReport";
import {
  reportGrid3,
  reportLabel,
  reportSection,
  reportSectionTitle,
} from "../reportStyles";
import { R } from "../uiLabels";
import ProgressCircle from "./ProgressCircle";

type Props = {
  style: ReportStyle;
  metricas: ProjectReportMetricas;
  report: ProjectReport;
};

function StatCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--border, rgba(127,127,127,0.25))",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <span style={reportLabel}>{label}</span>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {value}
        {suffix ? (
          <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4, color: "var(--text-muted)" }}>
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function PainelGraficoBlock({ style, metricas, report }: Props) {
  const tempo = deriveTempoTrabalhoHoras(report);
  const operadores = report.producao.operadores.length;
  const caixas = report.producao.caixas.length;
  const pecas = report.producao.pecas.length;
  const totalProjeto = report.financeiro.totalProjeto;

  return (
    <section style={reportSection(style)}>
      <h2 style={reportSectionTitle}>{R.painelGrafico}</h2>
      <ProgressCircle metricas={metricas} />
      <div style={{ ...reportGrid3, marginTop: 14 }}>
        <StatCard label={R.colaboradores} value={metricas.colaboradores} />
        <StatCard label={R.tempoTrabalho} value={tempo} suffix="h" />
        <StatCard label={R.melhorias} value={metricas.melhorias} />
        <StatCard label={R.operadoresFunc} value={operadores} />
        <StatCard label={R.totalCaixas} value={caixas} />
        <StatCard label={R.totalPecas} value={pecas} />
        <StatCard
          label={R.totalProjeto}
          value={totalProjeto.toFixed(2)}
          suffix="EUR"
        />
      </div>
    </section>
  );
}
