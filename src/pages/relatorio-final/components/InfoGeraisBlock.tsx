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
  onChange: (next: ProjectReportGerais, path: string) => void;
};

export default function InfoGeraisBlock({ style, value, onChange }: Props) {
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
    </section>
  );
}
