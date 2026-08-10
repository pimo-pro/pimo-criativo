import { NumericInput } from "../../ui/NumericInput";
import type { WorkspaceBox } from "../../../core/types";
import type {
  BoxShelfOptions,
  PrateleiraDirecao,
  PrateleiraGridMode,
  PrateleiraGridStepMm,
} from "../../../core/divSep/types";
import {
  resolveAvailableShelfDirecoes,
  resolveShelfDirecao,
  resolveShelfGridMode,
  resolveShelfGridStepMm,
  resolveShelfMargemMm,
} from "../../../core/divSep/shelfOptions";

type PrateleirasPopoverPanelProps = {
  box: WorkspaceBox;
  value: number;
  min?: number;
  max?: number;
  onCountChange: (n: number) => void;
  onShelfOptionsChange: (partial: Partial<BoxShelfOptions>) => void;
};

const DIRECAO_LABEL: Record<PrateleiraDirecao, string> = {
  direita: "Direita",
  esquerda: "Esquerda",
  superior: "Superior",
  inferior: "Inferior",
};

/**
 * Ficha de prateleiras: quantidade + opções avançadas DIV/SEP.
 * Mantém o layout do stepper e acrescenta controlos industriais.
 */
export default function PrateleirasPopoverPanel({
  box,
  value,
  min = 0,
  max = 99,
  onCountChange,
  onShelfOptionsChange,
}: PrateleirasPopoverPanelProps) {
  const v = Math.max(min, Math.min(max, Math.floor(value)));
  const availableDirecoes = resolveAvailableShelfDirecoes(box);
  const direcao = resolveShelfDirecao(box);
  const stepMm = resolveShelfGridStepMm(box);
  const gridMode = resolveShelfGridMode(box);
  const margemMm = resolveShelfMargemMm(box);
  const showAdvanced = availableDirecoes.length > 0 && v > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Número de prateleiras</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => onCountChange(Math.max(min, v - 1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-main)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            −
          </button>
          <span style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{v}</span>
          <button
            type="button"
            onClick={() => onCountChange(Math.min(max, v + 1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-main)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
      </div>

      {showAdvanced ? (
        <>
          <label style={{ display: "block", fontSize: 11 }}>
            Direção das prateleiras
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {availableDirecoes.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`button button-sm ${direcao === d ? "button-primary" : "button-ghost"}`}
                  onClick={() => onShelfOptionsChange({ direcao: d })}
                >
                  {DIRECAO_LABEL[d]}
                </button>
              ))}
            </div>
          </label>

          <label style={{ display: "block", fontSize: 11 }}>
            Distância entre furos
            <select
              className="input input-sm"
              value={stepMm}
              onChange={(e) =>
                onShelfOptionsChange({
                  distanciaEntreFurosMm: Number(e.target.value) as PrateleiraGridStepMm,
                })
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value={32}>32 mm (padrão)</option>
              <option value={64}>64 mm (dobro)</option>
            </select>
          </label>

          <label style={{ display: "block", fontSize: 11 }}>
            Grelha de furação
            <select
              className="input input-sm"
              value={gridMode}
              onChange={(e) =>
                onShelfOptionsChange({
                  gridMode: e.target.value as PrateleiraGridMode,
                })
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value="continua">Contínua</option>
              <option value="segmentada">Segmentada (blocos 4–8)</option>
            </select>
          </label>

          <label style={{ display: "block", fontSize: 11 }}>
            Margem superior/inferior (mm)
            <NumericInput
              value={margemMm}
              onChange={(n) =>
                onShelfOptionsChange({
                  margemSuperiorInferiorMm: Math.max(0, Math.floor(n)),
                })
              }
              min={0}
              max={500}
            />
            <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              0 = grelha padrão das regras; &gt;0 = grelha centrada no LAT.
            </span>
          </label>
        </>
      ) : null}
    </div>
  );
}
