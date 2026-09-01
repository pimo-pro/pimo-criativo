import { useState } from "react";
import Panel from "../ui/Panel";
import { useSettings } from "../../context/SettingsContext";
import type { SettingsSchema } from "../../core/settings/settingsSchema";
import {
  AdminPageHeader,
  AdminStickyActionBar,
  adminPageShellStyle,
} from "./AdminUi";
import { useAdminFeedback } from "../../hooks/useAdminFeedback";
import {
  DRAWER_SLIDE_TYPES as SLIDE_TYPES,
  DRAWER_METAL_BOX_TYPES as METAL_BOX_TYPES,
  isDrawerSlideTypeActive,
  isDrawerMetalBoxTypeActive,
  drawerSlideTypeOptionLabel,
  drawerMetalBoxTypeOptionLabel,
} from "../../core/drawers/drawerUiConstants";

const HANDLE_TYPES = ["Nenhum", "Puxador", "Cava", "Perfil Alumínio"] as const;
const HANDLE_POSITIONS = ["Centro", "Topo", "Inferior"] as const;
const LOAD_CAPACITIES = [30, 40, 50, 70] as const;

type DrawerSettings = SettingsSchema["gavetas"];

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (_value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      <input className="input" type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  isOptionDisabled,
  labelForOption,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (_value: T) => void;
  /** Opcional: marca opções como desativadas (ex.: "EM BREVE"). Não afeta chamadas existentes. */
  isOptionDisabled?: (_option: T) => boolean;
  labelForOption?: (_option: T) => string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option} disabled={isOptionDisabled?.(option) ?? false}>
            {labelForOption?.(option) ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function BooleanField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (_checked: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function DepthListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (_value: number[]) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      <input
        className="input"
        value={value.join(", ")}
        onChange={(event) => {
          const next = event.target.value
            .split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isFinite(item) && item > 0);
          onChange(next);
        }}
        placeholder="300, 350, 400, 450, 500"
      />
    </label>
  );
}

function DrawerPreview({ rules }: { rules: DrawerSettings }) {
  const metal = rules.gavetaTipoCaixaMetalica !== "Nenhuma";
  const handleY = rules.gavetaPosicaoHandle === "Topo" ? 42 : rules.gavetaPosicaoHandle === "Inferior" ? 138 : 90;
  return (
    <svg viewBox="0 0 260 180" role="img" aria-label="Pré-visualização da gaveta" style={{ width: "100%", maxWidth: 360, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
      <rect x="40" y="20" width="180" height="140" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" />
      <rect x="62" y="42" width="136" height="96" rx="4" fill={metal ? "#94a3b8" : "#d6b48c"} opacity="0.6" />
      {rules.gavetaTipoHandle === "Puxador" ? <rect x="95" y={handleY - 5} width="70" height="10" rx="5" fill="#334155" /> : null}
      {rules.gavetaTipoHandle === "Cava" ? <rect x="76" y={handleY - 3} width="108" height="6" rx="3" fill="#0f172a" /> : null}
      {rules.gavetaTipoHandle === "Perfil Alumínio" ? <rect x="60" y={handleY - 4} width="140" height="8" rx="2" fill="#cbd5e1" /> : null}
      <text x="130" y="172" textAnchor="middle" fill="#cbd5e1" fontSize="10">
        {rules.gavetaTipoCorredica} · {rules.gavetaSoftClose ? "soft-close" : "sem soft-close"}
      </text>
    </svg>
  );
}

export default function DrawerRulesAdminPage() {
  const feedback = useAdminFeedback();
  const { settings, updateSettings, validate } = useSettings();
  const [draft, setDraft] = useState<DrawerSettings>(settings.gavetas);
  const [syncedGavetas, setSyncedGavetas] = useState(settings.gavetas);
  if (settings.gavetas !== syncedGavetas) {
    setSyncedGavetas(settings.gavetas);
    setDraft(settings.gavetas);
  }

  const updateDrawerRules = (patch: Partial<DrawerSettings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const save = () => {
    const nextSettings: SettingsSchema = { ...settings, gavetas: draft };
    const validation = validate(nextSettings);
    const result = updateSettings(validation.normalized);
    if (result.success) feedback.success("Regras das gavetas guardadas com sucesso.");
    else feedback.warning(result.errors[0] ?? "Regras guardadas com ajustes.");
  };

  return (
    <div style={{ ...adminPageShellStyle, maxWidth: 1120 }}>
      <AdminPageHeader
        title="Regras das Gavetas"
        subtitle="Configuração profissional de dimensões, corrediças, caixas metálicas, handles e validações do domínio de gavetas."
      />

      <AdminStickyActionBar>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Estas regras alimentam a geração, Viewer, cutlist e furação das gavetas.</span>
        <button type="button" className="button button-primary" onClick={save}>
          Salvar Regras
        </button>
      </AdminStickyActionBar>

      <Panel title="Dimensões e Parametrização" description="Espessuras, folgas, limites e profundidades oficiais.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <NumberField label="espessuraFrenteMm" value={draft.gavetaEspessuraFrenteMm} onChange={(v) => updateDrawerRules({ gavetaEspessuraFrenteMm: v })} />
          <NumberField label="espessuraLateralMm" value={draft.gavetaEspessuraLateralMm} onChange={(v) => updateDrawerRules({ gavetaEspessuraLateralMm: v })} />
          <NumberField label="espessuraTraseiraMm" value={draft.gavetaEspessuraTraseiraMm} onChange={(v) => updateDrawerRules({ gavetaEspessuraTraseiraMm: v })} />
          <NumberField label="espessuraFundoMm" value={draft.gavetaEspessuraFundoMm} onChange={(v) => updateDrawerRules({ gavetaEspessuraFundoMm: v })} />
          <NumberField label="recuoCorpoMm" value={draft.gavetaRecuoCorpoMm} onChange={(v) => updateDrawerRules({ gavetaRecuoCorpoMm: v })} />
          <NumberField
            label="Redução das laterais (%)"
            value={draft.gavetaReducaoPercentual}
            min={5}
            max={60}
            step={1}
            onChange={(v) => updateDrawerRules({ gavetaReducaoPercentual: Math.round(v) })}
          />
          <NumberField label="folgaLateralMm" value={draft.gavetaFolgaLateralMm} onChange={(v) => updateDrawerRules({ gavetaFolgaLateralMm: v })} />
          <NumberField label="alturaMinimaMm" value={draft.gavetaAlturaMinimaMm} onChange={(v) => updateDrawerRules({ gavetaAlturaMinimaMm: v })} />
          <NumberField label="alturaMaximaMm" value={draft.gavetaAlturaMaximaMm} onChange={(v) => updateDrawerRules({ gavetaAlturaMaximaMm: v })} />
          <DepthListField label="profundidadesDisponiveisMm" value={draft.gavetaProfundidadesDisponiveisMm} onChange={(v) => updateDrawerRules({ gavetaProfundidadesDisponiveisMm: v })} />
        </div>
      </Panel>

      <Panel title="Ferragens / Corrediças" description="Tipo de corrediça, soft-close, curso e carga.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <SelectField
            label="tipoCorredica"
            value={draft.gavetaTipoCorredica}
            options={SLIDE_TYPES}
            onChange={(v) => updateDrawerRules({ gavetaTipoCorredica: v })}
            isOptionDisabled={(o) => !isDrawerSlideTypeActive(o)}
            labelForOption={drawerSlideTypeOptionLabel}
          />
          <BooleanField label="softClose" checked={draft.gavetaSoftClose} onChange={(v) => updateDrawerRules({ gavetaSoftClose: v })} />
          <NumberField label="cursoTotalMm (0 = automático)" value={draft.gavetaCursoTotalMm} onChange={(v) => updateDrawerRules({ gavetaCursoTotalMm: v })} />
          <SelectField label="capacidadeCargaKg" value={String(draft.gavetaCapacidadeCargaKg)} options={LOAD_CAPACITIES.map(String)} onChange={(v) => updateDrawerRules({ gavetaCapacidadeCargaKg: Number(v) as 30 | 40 | 50 | 70 })} />
        </div>
      </Panel>

      <Panel title="Caixas metálicas / pré-fabricadas" description="Regras para Legrabox, Antaro, AvanTech, Alto ou genéricas.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <SelectField
            label="tipoCaixaMetalica"
            value={draft.gavetaTipoCaixaMetalica}
            options={METAL_BOX_TYPES}
            onChange={(v) => updateDrawerRules({ gavetaTipoCaixaMetalica: v })}
            isOptionDisabled={(o) => o !== "Nenhuma" && !isDrawerMetalBoxTypeActive(o)}
            labelForOption={(o) => (o === "Nenhuma" ? o : drawerMetalBoxTypeOptionLabel(o))}
          />
          <NumberField label="alturaCaixaMetalica" value={draft.gavetaAlturaCaixaMetalicaMm} onChange={(v) => updateDrawerRules({ gavetaAlturaCaixaMetalicaMm: v })} />
          <DepthListField label="profundidadeCompatível" value={draft.gavetaProfundidadesCompativeisMm} onChange={(v) => updateDrawerRules({ gavetaProfundidadesCompativeisMm: v })} />
        </div>
      </Panel>

      <Panel title="Handles (Puxadores)" description="Tipo, posição e offset do handle da frente.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <SelectField label="tipoHandle" value={draft.gavetaTipoHandle} options={HANDLE_TYPES} onChange={(v) => updateDrawerRules({ gavetaTipoHandle: v })} />
          <SelectField label="posiçãoHandle" value={draft.gavetaPosicaoHandle} options={HANDLE_POSITIONS} onChange={(v) => updateDrawerRules({ gavetaPosicaoHandle: v })} />
          <NumberField label="offsetHandleMm" value={draft.gavetaOffsetHandleMm} onChange={(v) => updateDrawerRules({ gavetaOffsetHandleMm: v })} />
        </div>
      </Panel>

      <Panel title="Regras de Validação" description="Ativar/desativar validações profissionais.">
        <div style={{ display: "grid", gap: 10 }}>
          <BooleanField label="validarAlturasCustom" checked={draft.gavetaValidarAlturasCustom} onChange={(v) => updateDrawerRules({ gavetaValidarAlturasCustom: v })} />
          <BooleanField label="validarProfundidadeCompatível" checked={draft.gavetaValidarProfundidadeCompativel} onChange={(v) => updateDrawerRules({ gavetaValidarProfundidadeCompativel: v })} />
          <BooleanField label="validarCargaMáxima" checked={draft.gavetaValidarCargaMaxima} onChange={(v) => updateDrawerRules({ gavetaValidarCargaMaxima: v })} />
          <BooleanField label="validarSoftCloseCompatível" checked={draft.gavetaValidarSoftCloseCompativel} onChange={(v) => updateDrawerRules({ gavetaValidarSoftCloseCompativel: v })} />
        </div>
      </Panel>

      <Panel title="Pré-visualização" description="Resumo visual simples das regras ativas.">
        <DrawerPreview rules={draft} />
      </Panel>
    </div>
  );
}
