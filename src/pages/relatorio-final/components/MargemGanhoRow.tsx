import {
  effectiveMargemPercentagem,
  sumBasePreIva,
  type ProjectReportFinanceiro,
  type ReportMargemGanhoConfig,
  type ReportMargemGanhoMode,
} from "@/core/projectReport";
import { reportInput, reportTd } from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  financeiro: ProjectReportFinanceiro;
  margemTotal: number;
  onChange: (config: ReportMargemGanhoConfig | null) => void;
};

function formatEur(n: number): string {
  return `${(Number(n) || 0).toFixed(2)} EUR`;
}

function basePreIva(fin: ProjectReportFinanceiro): number {
  const map = new Map<string, number>();
  for (const l of fin.linhas) {
    if (l.key === "iva" || l.key === "total" || l.key === "margemGanho") continue;
    map.set(l.key, Number(l.total) || 0);
  }
  return sumBasePreIva(map);
}

export default function MargemGanhoRow({ financeiro, margemTotal, onChange }: Props) {
  const config = financeiro.margemGanho;
  const mode: ReportMargemGanhoMode = config?.mode ?? "percentagem";
  const base = basePreIva(financeiro);
  const effectivePct = effectiveMargemPercentagem(config, base);

  const emit = (nextMode: ReportMargemGanhoMode, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      onChange(null);
      return;
    }
    if (nextMode === "percentagem") {
      onChange({ mode: "percentagem", percentagem: n });
      return;
    }
    onChange({
      mode: "valorFixo",
      percentagem: base > 0 ? Math.round((n / base) * 10000) / 100 : 0,
      valorFixo: n,
    });
  };

  const inputValue =
    mode === "valorFixo" && config?.valorFixo != null
      ? String(config.valorFixo)
      : config?.percentagem != null && config.percentagem > 0
        ? String(config.percentagem)
        : "";

  return (
    <tr data-testid="margem-ganho-row">
      <td style={reportTd}>{R.margemGanho}</td>
      <td style={reportTd}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{R.margemGanhoHint}</span>
      </td>
      <td style={reportTd}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <select
            style={{ ...reportInput, minHeight: 32, width: 56 }}
            value={mode}
            aria-label={R.margemGanhoModo}
            onChange={(e) => {
              const nextMode = e.target.value as ReportMargemGanhoMode;
              if (inputValue.trim() === "") {
                onChange(null);
                return;
              }
              emit(nextMode, inputValue);
            }}
          >
            <option value="percentagem">%</option>
            <option value="valorFixo">€</option>
          </select>
          <input
            type="number"
            min={0}
            step={mode === "percentagem" ? 0.1 : 0.01}
            style={{ ...reportInput, minHeight: 32, width: 100 }}
            value={inputValue}
            placeholder={mode === "percentagem" ? "0" : "0.00"}
            aria-label={R.margemGanhoValor}
            onChange={(e) => emit(mode, e.target.value)}
          />
          {mode === "valorFixo" && effectivePct > 0 ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              = {effectivePct.toFixed(2)}%
            </span>
          ) : null}
        </div>
      </td>
      <td style={reportTd}>{formatEur(margemTotal)}</td>
    </tr>
  );
}
