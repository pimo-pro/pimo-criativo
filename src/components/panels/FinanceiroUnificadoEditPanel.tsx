import { useMemo, useState } from "react";
import { useProject } from "../../context/useProject";
import Panel from "../ui/Panel";
import Button from "../ui/Button";
import {
  FINANCEIRO_CUSTO_KEYS,
  FINANCEIRO_IVA_DEFAULT_PCT,
  computeFinanceiroAdminCustos,
  type FinanceiroCustoKey,
  type FinanceiroOverrides,
  type FinanceiroUnificadoSnapshot,
} from "../../core/financeiro";
import { formatCurrency } from "../../utils/formatting";

type Props = {
  snap: FinanceiroUnificadoSnapshot;
  onCancel: () => void;
  onSaved: () => void;
};

const CUSTO_FIELD_KEYS: FinanceiroCustoKey[] = [
  "paineis",
  "portas",
  "gavetas",
  "ferragens",
  "orla",
  "remates",
  "operacoes",
  "desperdicio",
  "serragem",
  // chapasReais omitido da UI — madeira/chapas em Painéis
  "maoDeObra",
  "logistica",
  "operacoesAvancadas",
  "adm",
  "montagem",
  "portes",
];

function custoFieldLabel(key: FinanceiroCustoKey, _snap: FinanceiroUnificadoSnapshot): string {
  if (key === "paineis") return "Painéis";
  if (key === "remates") return "Remates / Rodapés";
  if (key === "operacoes") return "Operações (CNC/Drill)";
  if (key === "desperdicio") return "Desperdício";
  if (key === "maoDeObra") return "Mão de obra";
  if (key === "logistica") return "Logística";
  if (key === "operacoesAvancadas") return "Ops avançadas";
  const staticLabels: Partial<Record<FinanceiroCustoKey, string>> = {
    portas: "Portas",
    gavetas: "Gavetas",
    ferragens: "Ferragens",
    orla: "Orla",
    serragem: "Serragem",
    adm: "ADM",
    montagem: "Montagem",
    portes: "Portes",
  };
  return staticLabels[key] ?? key;
}

function parseOptionalNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export default function FinanceiroUnificadoEditPanel({ snap, onCancel, onSaved }: Props) {
  const { actions } = useProject();

  const [ivaPct, setIvaPct] = useState(String(snap.ivaPct ?? FINANCEIRO_IVA_DEFAULT_PCT));
  const [distanciaKm, setDistanciaKm] = useState(String(snap.distanciaKm ?? 0));
  const [incluirPortes, setIncluirPortes] = useState(snap.overrides.incluirPortes === true);
  const [custos, setCustos] = useState<Record<FinanceiroCustoKey, string>>(() => {
    const init = {} as Record<FinanceiroCustoKey, string>;
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      const ov = snap.overrides.custos?.[key];
      init[key] = typeof ov === "number" ? String(ov) : "";
    }
    return init;
  });
  const [notas, setNotas] = useState(snap.overrides.notas ?? "");

  const preview = useMemo(() => {
    const materialKeys: FinanceiroCustoKey[] = [
      "paineis",
      "portas",
      "gavetas",
      "ferragens",
      "orla",
      "remates",
      "operacoes",
      "desperdicio",
      "serragem",
      "chapasReais",
      "maoDeObra",
      "logistica",
      "operacoesAvancadas",
    ];
    const effective = {} as Record<FinanceiroCustoKey, number>;
    for (const key of materialKeys) {
      const parsed = parseOptionalNumber(custos[key]);
      effective[key] = typeof parsed === "number" ? parsed : snap.custosComputed[key];
    }
    for (const key of ["adm", "montagem"] as const) {
      const parsed = parseOptionalNumber(custos[key]);
      effective[key] = typeof parsed === "number" ? parsed : snap.custosComputed[key];
    }

    const portesParsed = parseOptionalNumber(custos.portes);
    if (typeof portesParsed === "number") {
      effective.portes = portesParsed;
    } else if (!incluirPortes) {
      effective.portes = 0;
    } else {
      const dist =
        parseOptionalNumber(distanciaKm) ??
        (Number.isFinite(snap.distanciaKm) ? snap.distanciaKm : 0);
      const subtotalPreview = materialKeys.reduce((s, k) => s + effective[k], 0);
      const calc = computeFinanceiroAdminCustos({
        subtotalMateriais: subtotalPreview,
        caixas: snap.caixas,
        pesoTotalKg: snap.pesoTotalKg,
        volumeMontadoM3: snap.areaTotalMontadoM3,
        distanciaKm: dist,
        settings: {
          ...snap.adminSettings,
          portes: { ...snap.adminSettings.portes, enabled: true },
        },
      });
      effective.portes = calc.portes;
    }

    const subtotal = materialKeys.reduce((s, k) => s + effective[k], 0);
    const ivaN = Number(String(ivaPct).replace(",", "."));
    const ivaPctN = Number.isFinite(ivaN) && ivaN >= 0 ? ivaN : FINANCEIRO_IVA_DEFAULT_PCT;
    const iva = subtotal * (ivaPctN / 100);
    const total =
      subtotal + effective.adm + effective.montagem + effective.portes + iva;
    return { subtotal, ivaPctN, iva, total, effective };
  }, [custos, ivaPct, incluirPortes, distanciaKm, snap]);

  const handleSave = () => {
    const next: FinanceiroOverrides = {
      ivaPct: preview.ivaPctN,
      incluirPortes,
    };
    const dist = parseOptionalNumber(distanciaKm);
    if (typeof dist === "number") next.distanciaKm = dist;

    const custosOut: NonNullable<FinanceiroOverrides["custos"]> = {};
    let hasCusto = false;
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      const parsed = parseOptionalNumber(custos[key]);
      if (typeof parsed === "number") {
        custosOut[key] = parsed;
        hasCusto = true;
      }
    }
    if (hasCusto) next.custos = custosOut;
    if (notas.trim()) next.notas = notas.trim();
    actions.setFinanceiroOverrides(next);
    onSaved();
  };

  const handleClearOverrides = () => {
    setIvaPct(String(FINANCEIRO_IVA_DEFAULT_PCT));
    setDistanciaKm("0");
    setIncluirPortes(false);
    setCustos(() => {
      const init = {} as Record<FinanceiroCustoKey, string>;
      for (const key of FINANCEIRO_CUSTO_KEYS) init[key] = "";
      return init;
    });
    setNotas("");
    actions.setFinanceiroOverrides({});
    onSaved();
  };

  const fieldStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 120px 100px",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
    fontSize: 12,
  };

  return (
    <Panel title="Editar Financeiro Unificado">
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
        Deixe o campo de custo vazio para usar o valor calculado. IVA aplica-se sobre o subtotal de
        materiais. ADM / montagem / portes entram no total (regras em Admin ? Financeiro). Portes
        só são cobrados com escolha explícita abaixo.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12, display: "block" }}>
          IVA (%)
          <input
            type="number"
            min={0}
            step={0.1}
            value={ivaPct}
            onChange={(e) => setIvaPct(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, display: "block" }}>
          Distância portes (km)
          <input
            type="number"
            min={0}
            step={0.1}
            value={distanciaKm}
            onChange={(e) => setDistanciaKm(e.target.value)}
            disabled={!incluirPortes}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          marginBottom: 16,
        }}
      >
        <input
          type="checkbox"
          checked={incluirPortes}
          onChange={(e) => setIncluirPortes(e.target.checked)}
        />
        Incluir portes (transporte) — sem isto, Portes = 0€
      </label>

      {snap.materialCostMode === "por_chapas_reais" ? (
        <p
          style={{
            fontSize: 12,
            marginBottom: 12,
            color: "#0369a1",
            fontWeight: 600,
          }}
        >
          Modo material: por chapas reais (Painéis a 0 € — anti double-count)
        </p>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <div style={{ ...fieldStyle, fontWeight: 700, color: "var(--text-muted)" }}>
          <span>Custo</span>
          <span>Calculado</span>
          <span>Override €</span>
        </div>
        {CUSTO_FIELD_KEYS.map((key) => (
          <div key={key} style={fieldStyle}>
            <span>{custoFieldLabel(key, snap)}</span>
            <span>
              {formatCurrency(
                key === "portes" ? preview.effective.portes : snap.custosComputed[key]
              )}
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="auto"
              value={custos[key]}
              onChange={(e) => setCustos((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <label style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
        Notas
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          style={{ display: "block", width: "100%", marginTop: 4, resize: "vertical" }}
        />
      </label>

      <div
        style={{
          fontSize: 12,
          marginBottom: 16,
          padding: 10,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div>Subtotal materiais: {formatCurrency(preview.subtotal)}</div>
        <div>
          ADM + Montagem + Portes:{" "}
          {formatCurrency(
            preview.effective.adm + preview.effective.montagem + preview.effective.portes
          )}
        </div>
        <div>
          IVA ({preview.ivaPctN}%): {formatCurrency(preview.iva)}
        </div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>
          Total projeto: {formatCurrency(preview.total)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button type="button" onClick={handleSave}>
          Guardar
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="secondary" onClick={handleClearOverrides}>
          Limpar overrides
        </Button>
      </div>
    </Panel>
  );
}
