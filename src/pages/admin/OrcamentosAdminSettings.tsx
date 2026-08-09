/**
 * P3.9 — ADMIN ? Sistema ? Orçamentos.
 * F1: tarifas. F2: flag unificação ferragens. Sem ligar custos avançados.
 */

import { useEffect, useState } from "react";
import {
  AdminPageHeader,
  adminLabelStyle,
  adminPageShellStyle,
  AdminStickyActionBar,
} from "../../components/admin/AdminUi";
import Button from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { useSettings } from "../../context/SettingsContext";
import { getSettings } from "../../core/settings/settingsService";
import {
  CHAPAS_REAIS_ACTIVATION_STEPS,
  CHAPAS_REAIS_ACTIVATION_WARNING,
  normalizeOrcamentosSettings,
  type OrcamentosMargemModo,
  type OrcamentosMaterialCostMode,
  type OrcamentosMontagemAvancadaModo,
  type OrcamentosSettings,
} from "../../core/orcamentos";

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const bannerStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  border: "1px solid rgba(245, 158, 11, 0.35)",
  background: "rgba(245, 158, 11, 0.08)",
  borderRadius: 8,
  padding: "10px 12px",
  lineHeight: 1.45,
};

function NumberInput({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <span style={adminLabelStyle}>{label}</span>
      <input
        className="input"
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
      />
    </div>
  );
}

export default function OrcamentosAdminSettings() {
  const { showToast } = useToast();
  const { refreshSettings, updateSettings } = useSettings();
  const [draft, setDraft] = useState<OrcamentosSettings>(() =>
    normalizeOrcamentosSettings(getSettings().orcamentos)
  );

  useEffect(() => {
    setDraft(normalizeOrcamentosSettings(getSettings().orcamentos));
  }, []);

  const handleSave = () => {
    const next = normalizeOrcamentosSettings(draft);
    const result = updateSettings({ orcamentos: next });
    setDraft(result.settings.orcamentos);
    refreshSettings();
    showToast(
      result.success
        ? "Orcamentos guardados (sync remoto se autenticado). Unificacao ferragens so afecta totais se a flag estiver activa."
        : result.message,
      result.success ? "info" : "error"
    );
  };

  const handleReset = () => {
    // Preferir SSOT /config/pricing.json
    void import("../../core/pricing/centralPricingConfig").then(({ orcamentosDefaultsFromCentral }) => {
      setDraft(orcamentosDefaultsFromCentral());
    });
  };

  return (
    <div style={adminPageShellStyle}>
      <AdminPageHeader
        title="Orcamentos"
        subtitle="Centro de tarifas P3.9. F1 schema + F2 unificacao ferragens (flag). CNC/PDFs industriais intactos."
      />

      <div style={bannerStyle}>
        Defaults: madeira = chapas reais; ferragens unificadas (catálogo = Secção 4); tarifas
        industriais 0 / flags off. ADM / Montagem / Portes / IVA em{" "}
        <strong>Financeiro (ADM / Montagem / Portes)</strong>.
      </div>

      <AdminStickyActionBar>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Persistencia: System Settings (`pimo_system_settings_v1`)
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="button" variant="secondary" onClick={handleReset}>
            Restaurar defaults
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </AdminStickyActionBar>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Ferragens (P3.9 F2)</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Default on = Unificado e Peças usam catálogo B (fonte alinhada à Secção 4) + fallback A.
          STRICT = avisos no relatório, sem bloquear CNC/PDF/financeiro. Desligar volta à Via A.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={draft.ferragens.enableUnificacao}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                ferragens: { ...p.ferragens, enableUnificacao: e.target.checked },
              }))
            }
          />
          Unificar ferragens (catalogo B + fallback A + STRICT)
        </label>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Perfuracoes / CNC</h3>
        <div style={grid2}>
          <NumberInput
            label="Drill (EUR / furo)"
            value={draft.perfuracoes.drillEurPorFuro}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                perfuracoes: { ...p.perfuracoes, drillEurPorFuro: v },
              }))
            }
          />
          <NumberInput
            label="Nesting / CNC (EUR / operacao)"
            value={draft.perfuracoes.nestingEurPorOperacao}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                perfuracoes: { ...p.perfuracoes, nestingEurPorOperacao: v },
              }))
            }
          />
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Operacoes Industriais Avancadas</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Tarifas tipadas (P3.9 F4). Defaults 0 = sem impacto. Nao altera CNC/TCN/cutlist/drill.
        </p>
        <div style={grid2}>
          <NumberInput
            label="Foro 5mm (EUR)"
            value={draft.operacoesAvancadas.precoForo5mm}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoForo5mm: v },
              }))
            }
          />
          <NumberInput
            label="Foro cavilha 10x13 (EUR)"
            value={draft.operacoesAvancadas.precoForoCavilha10x13}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoForoCavilha10x13: v },
              }))
            }
          />
          <NumberInput
            label="Foro cavilha 10x30 (EUR)"
            value={draft.operacoesAvancadas.precoForoCavilha10x30}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoForoCavilha10x30: v },
              }))
            }
          />
          <NumberInput
            label="Foro da calco (grupo) (EUR)"
            value={draft.operacoesAvancadas.precoForoCalcoGrupo}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoForoCalcoGrupo: v },
              }))
            }
          />
          <NumberInput
            label="Foro dobradica da porta (grupo) (EUR)"
            value={draft.operacoesAvancadas.precoForoDobradicaGrupo}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoForoDobradicaGrupo: v },
              }))
            }
          />
          <NumberInput
            label="Rasgo da gaveta (EUR)"
            value={draft.operacoesAvancadas.precoRasgoGaveta}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoRasgoGaveta: v },
              }))
            }
          />
          <NumberInput
            label="Corte manual por metro (EUR)"
            value={draft.operacoesAvancadas.precoCorteManualPorMetro}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoCorteManualPorMetro: v },
              }))
            }
          />
          <NumberInput
            label="Me quadrilha (EUR)"
            value={draft.operacoesAvancadas.precoMeQuadrilha}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                operacoesAvancadas: { ...p.operacoesAvancadas, precoMeQuadrilha: v },
              }))
            }
          />
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Custos industriais</h3>
        <div style={grid2}>
          <NumberInput
            label="Desperdicio (EUR / m2)"
            value={draft.custosIndustriais.desperdicioEurPorM2}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                custosIndustriais: { ...p.custosIndustriais, desperdicioEurPorM2: v },
              }))
            }
          />
          <NumberInput
            label="Serragem (EUR / m2)"
            value={draft.custosIndustriais.serragemEurPorM2}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                custosIndustriais: { ...p.custosIndustriais, serragemEurPorM2: v },
              }))
            }
          />
          <div>
            <span style={adminLabelStyle}>Custo chapa real</span>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
              Derivado automaticamente: preço €/m² do material (mesmo SSOT de Painéis) × área da
              chapa padrão do sistema. Sem campo de preço extra — não editar aqui para evitar
              duplicação de tarifas.
            </p>
          </div>
          <NumberInput
            label="Ops especiais (EUR / un)"
            value={draft.custosIndustriais.custoOperacoesEspeciais}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                custosIndustriais: { ...p.custosIndustriais, custoOperacoesEspeciais: v },
              }))
            }
          />
          <NumberInput
            label="Mão de obra (EUR manual)"
            value={draft.custosIndustriais.valorHoraMaquina}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                custosIndustriais: {
                  ...p.custosIndustriais,
                  valorHoraMaquina: v,
                  // Valor > 0 activa; 0 desliga (sem cálculo automático).
                  enableMaoDeObra: v > 0,
                },
              }))
            }
          />
          <p style={{ margin: "-4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            0 = sem mão de obra. Valor &gt; 0 = total fixo no Unificado (não é €/h × minutos).
            Montagem/gavetas é linha à parte.
          </p>
          <NumberInput
            label="Logística (EUR manual)"
            value={draft.custosIndustriais.custoLogisticaPorKg}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                custosIndustriais: {
                  ...p.custosIndustriais,
                  custoLogisticaPorKg: v,
                  // Valor > 0 activa; 0 desliga (sem cálculo automático).
                  enableLogistica: v > 0,
                },
              }))
            }
          />
          <p style={{ margin: "-4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            0 = sem logística. Valor &gt; 0 = total fixo no Unificado (não é €/kg × peso).
          </p>
          <NumberInput
            label="Custo de montagem por gaveta (EUR)"
            value={draft.custosIndustriais.custoMontagemPorPeca}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                custosIndustriais: { ...p.custosIndustriais, custoMontagemPorPeca: v },
              }))
            }
          />
          <div>
            <span style={adminLabelStyle}>Modo custo material</span>
            <select
              className="input"
              value={draft.custosIndustriais.materialCostMode}
              onChange={(e) => {
                const next = e.target.value as OrcamentosMaterialCostMode;
                if (
                  next === "por_chapas_reais" &&
                  draft.custosIndustriais.materialCostMode !== "por_chapas_reais"
                ) {
                  const ok = window.confirm(
                    `${CHAPAS_REAIS_ACTIVATION_WARNING}\n\n` +
                      CHAPAS_REAIS_ACTIVATION_STEPS.map((s, i) => `${i + 1}. ${s}`).join("\n")
                  );
                  if (!ok) return;
                }
                setDraft((p) => ({
                  ...p,
                  custosIndustriais: {
                    ...p.custosIndustriais,
                    materialCostMode: next,
                  },
                }));
              }}
            >
              <option value="por_peca">Por peça (fallback / legado)</option>
              <option value="por_chapas_reais">Por chapas reais (default — fonte única madeira)</option>
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              Default = «Por chapas reais» (fonte única de madeira). Com nesting Real: Painéis /
              portas / remates a 0 €; Chapas = N × €/chapa. Sem sheets reais: fallback Painéis por
              peça (remates sem linha de madeira). €/chapa = derivado (€/m² × área chapa). Gavetas =
              N × 15 € (montagem). MO e logística = EUR manual Admin. Portes P3.6 intactos.
            </p>
            {draft.custosIndustriais.materialCostMode === "por_chapas_reais" ? (
              <div style={{ ...bannerStyle, marginTop: 8 }}>
                <strong style={{ display: "block", marginBottom: 6 }}>
                  Procedimento Chapas Reais (activo no rascunho)
                </strong>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {CHAPAS_REAIS_ACTIVATION_STEPS.map((step) => (
                    <li key={step} style={{ marginBottom: 4 }}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
          {(
            [
              ["enableDesperdicio", "Activar desperdicio EUR"],
              ["enableSerragem", "Activar serragem EUR"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
            >
              <input
                type="checkbox"
                checked={draft.custosIndustriais[key]}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    custosIndustriais: { ...p.custosIndustriais, [key]: e.target.checked },
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Montagem avancada (em breve)</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Schema reservado. Nao substitui Financeiro (ADM / Montagem / Portes). Nao ligado ao
          calculo nesta fase.
        </p>
        <div style={grid2}>
          <div>
            <span style={adminLabelStyle}>Modo</span>
            <select
              className="input"
              value={draft.montagemAvancada.modo}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  montagemAvancada: {
                    ...p.montagemAvancada,
                    modo: e.target.value as OrcamentosMontagemAvancadaModo,
                  },
                }))
              }
            >
              <option value="off">Off</option>
              <option value="m2">EUR / m2</option>
              <option value="caixa">EUR / caixa</option>
              <option value="peca">EUR / peca</option>
            </select>
          </div>
          <NumberInput
            label="Preco / m2"
            value={draft.montagemAvancada.precoPorM2}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                montagemAvancada: { ...p.montagemAvancada, precoPorM2: v },
              }))
            }
          />
          <NumberInput
            label="Preco / caixa"
            value={draft.montagemAvancada.precoPorCaixa}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                montagemAvancada: { ...p.montagemAvancada, precoPorCaixa: v },
              }))
            }
          />
          <NumberInput
            label="Preco gavetas"
            value={draft.montagemAvancada.precoGavetas}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                montagemAvancada: { ...p.montagemAvancada, precoGavetas: v },
              }))
            }
          />
          <NumberInput
            label="Preco remate"
            value={draft.montagemAvancada.precoRemate}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                montagemAvancada: { ...p.montagemAvancada, precoRemate: v },
              }))
            }
          />
          <NumberInput
            label="Preco ferragens montagem"
            value={draft.montagemAvancada.precoFerragensMontagem}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                montagemAvancada: { ...p.montagemAvancada, precoFerragensMontagem: v },
              }))
            }
          />
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Margem de ganho</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Persistida aqui; activacao no calculo so na Fase 5. Default: desligada.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={draft.margemGanho.enabled}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                margemGanho: { ...p.margemGanho, enabled: e.target.checked },
              }))
            }
          />
          Activar margem (tarifas — sem efeito no total ate Fase 5)
        </label>
        <div style={grid2}>
          <div>
            <span style={adminLabelStyle}>Modo</span>
            <select
              className="input"
              value={draft.margemGanho.modo}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  margemGanho: {
                    ...p.margemGanho,
                    modo: e.target.value as OrcamentosMargemModo,
                  },
                }))
              }
            >
              <option value="percentual">Percentual</option>
              <option value="fixo">Valor fixo (EUR)</option>
            </select>
          </div>
          <NumberInput
            label={draft.margemGanho.modo === "percentual" ? "Valor (%)" : "Valor (EUR)"}
            value={draft.margemGanho.valor}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                margemGanho: { ...p.margemGanho, valor: v },
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}
