import type { ProjectReportGerais, ReportStyle } from "@/core/projectReport";
import {
  reportGrid3,
  reportInput,
  reportLabel,
  reportSection,
  reportSectionTitle,
} from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  style: ReportStyle;
  value: ProjectReportGerais;
  operadoresCount: number;
  caixasCount: number;
  pecasCount: number;
  onChange: (next: ProjectReportGerais, path: string) => void;
};

function FixedStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border, rgba(127,127,127,0.25))",
        borderRadius: 8,
        padding: 12,
        textAlign: "center",
      }}
    >
      <span style={reportLabel}>{label}</span>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function InfoGeraisBlock({
  style,
  value,
  operadoresCount,
  caixasCount,
  pecasCount,
  onChange,
}: Props) {
  return (
    <section style={reportSection(style)}>
      <h2 style={reportSectionTitle}>{R.infoGerais}</h2>
      <div style={{ ...reportGrid3, alignItems: "end" }}>
        <label>
          <span style={reportLabel}>{R.designer}</span>
          <input
            style={reportInput}
            value={value.designer}
            onChange={(e) => onChange({ ...value, designer: e.target.value }, "gerais.designer")}
          />
        </label>
        <label style={{ textAlign: "center" }}>
          <span style={reportLabel}>{R.nomeProjeto}</span>
          <input
            style={{ ...reportInput, fontSize: 18, fontWeight: 700, textAlign: "center" }}
            value={value.nomeProjeto}
            onChange={(e) =>
              onChange({ ...value, nomeProjeto: e.target.value }, "gerais.nomeProjeto")
            }
          />
        </label>
        <label>
          <span style={reportLabel}>{R.empresa}</span>
          <input
            style={reportInput}
            value={value.empresa}
            onChange={(e) => onChange({ ...value, empresa: e.target.value }, "gerais.empresa")}
          />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          <span style={reportLabel}>{R.materiaisDescricao}</span>
          <input
            style={reportInput}
            value={value.materiaisDescricao ?? ""}
            onChange={(e) =>
              onChange(
                { ...value, materiaisDescricao: e.target.value },
                "gerais.materiaisDescricao"
              )
            }
          />
        </label>
        <label>
          <span style={reportLabel}>{R.dataInicioExec}</span>
          <input
            type="date"
            style={reportInput}
            value={value.dataInicioExecucao}
            onChange={(e) =>
              onChange(
                { ...value, dataInicioExecucao: e.target.value },
                "gerais.dataInicioExecucao"
              )
            }
          />
        </label>
        <div />
        <label>
          <span style={reportLabel}>{R.dataFimExec}</span>
          <input
            type="date"
            style={reportInput}
            value={value.dataConclusaoExecucao}
            onChange={(e) =>
              onChange(
                { ...value, dataConclusaoExecucao: e.target.value },
                "gerais.dataConclusaoExecucao"
              )
            }
          />
        </label>
      </div>
      <div style={{ ...reportGrid3, marginTop: 14 }}>
        <FixedStat label={R.operadoresFunc} value={operadoresCount} />
        <FixedStat label={R.totalCaixas} value={caixasCount} />
        <FixedStat label={R.totalPecas} value={pecasCount} />
      </div>
    </section>
  );
}
