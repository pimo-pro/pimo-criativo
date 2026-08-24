import { useEffect, useState } from "react";
import Panel from "../ui/Panel";
import { useSettings } from "../../context/SettingsContext";
import { getSettings, saveSettings, type SettingsSchema } from "../../core/settings/settingsService";
import { useTheme } from "../../context/ThemeContext";
import { PANEL_PRESETS } from "../../core/panel/panelConstants";
import {
  AdminPageHeader,
  AdminStickyActionBar,
  adminFieldErrorStyle,
  adminPageShellStyle,
} from "./AdminUi";
import { useAdminFeedback } from "../../hooks/useAdminFeedback";
import { useProject } from "../../context/useProject";
import {
  DRAWER_SLIDE_TYPES,
  DRAWER_METAL_BOX_TYPES,
  isDrawerSlideTypeActive,
  isDrawerMetalBoxTypeActive,
  drawerSlideTypeOptionLabel,
  drawerMetalBoxTypeOptionLabel,
} from "../../core/drawers/drawerUiConstants";
import JSZip from "jszip";
import { buildCncFromCutlistItems, buildTcnExportBaseName } from "../../core/cnc/cncPipeline";
import type { CutlistItemForPieces } from "../../core/cutlayout/cutLayoutEngine";
import { buildItemsForCncExport } from "../../hooks/useGerarArquivoHandlers";

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
      <input
        className="input"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function SystemSettingsBase() {
  const feedback = useAdminFeedback();
  const { settings, refreshSettings, updateSettings, validate } = useSettings();
  const { setThemePreference } = useTheme();
  const { project } = useProject();
  const [draft, setDraft] = useState<SettingsSchema>(settings);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const applyAndSave = () => {
    const validation = validate(draft);
    const nextErrors: Record<string, string> = {};
    if (!validation.normalized.geral.locale.trim()) {
      nextErrors["geral.locale"] = "Locale é obrigatório.";
    }
    if (validation.normalized.materiais.sheetThicknessMm <= 0) {
      nextErrors["materiais.sheetThicknessMm"] = "Espessura da chapa deve ser maior que zero.";
    }
    setFieldErrors(nextErrors);
    const result = updateSettings(validation.normalized);
    if (result.success) {
      // Bridge: geral.theme (dark|light|system) → ThemeContext / DOM / pimo-theme*
      setThemePreference(validation.normalized.geral.theme);
      feedback.success("Configurações globais guardadas com sucesso.");
    } else {
      feedback.warning(result.errors[0] ?? "Configurações guardadas com ajustes.");
    }
  };

  const exportTcnProfile = () => {
    const payload = {
      version: "1.0",
      date: new Date().toISOString(),
      description: "Perfil de definições TCN exportado do pimo-v3",
      settings: {
        cnc: {
          tcnMetodo: draft.cnc.tcnMetodo,
          zSafetyMm: draft.cnc.zSafetyMm,
          minSpacingMm: draft.cnc.minSpacingMm,
          diametroFresaContornoMm: draft.cnc.diametroFresaContornoMm,
          compensacaoFerramenta: draft.cnc.compensacaoFerramenta,
          contourEntryMode: draft.cnc.contourEntryMode,
          contourCloseExplicit: draft.cnc.contourCloseExplicit,
          toolFeedRate: draft.cnc.toolFeedRate,
          toolRpm: draft.cnc.toolRpm,
          drillFeedRate: draft.cnc.drillFeedRate,
          drillRpm: draft.cnc.drillRpm,
          sheetMarginMm: draft.cnc.sheetMarginMm ?? 10,
          rampDistanceMm: draft.cnc.rampDistanceMm ?? 20,
        },
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcn-profile-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadAllVariants = async () => {
    if (isGeneratingVariants) return;
    if (!project.boxes?.length) {
      feedback.warning("Nenhuma caixa no projeto atual para gerar TCN.");
      return;
    }

    setIsGeneratingVariants(true);
    feedback.success("Gerando variantes…");
    const previousSettings = getSettings();
    const variants = [
      { metodo: "nesting_mo" as const, file: "peça_nesting_mo.tcn" },
      { metodo: "v2_new" as const, file: "peça_v2_new.tcn" },
    ];

    try {
      console.log("Projeto atual:", project);
      console.log("Parts extraídas:", project.extractedPartsByBoxId);
      const allItems = buildItemsForCncExport(project, project.boxes) as CutlistItemForPieces[];
      console.log("Cutlist:", allItems);
      if (!allItems.length) {
        feedback.warning("A cutlist está vazia. Nada para exportar.");
        return;
      }

      const zip = new JSZip();
      const arquivos: string[] = [];
      for (const v of variants) {
        console.log("Método atual:", v.metodo);
        saveSettings({
          ...previousSettings,
          cnc: {
            ...previousSettings.cnc,
            ...draft.cnc,
            tcnMetodo: v.metodo,
          },
        });

        let filesAddedForVariant = 0;
        const cncBundle = buildCncFromCutlistItems(project, allItems);
        if (cncBundle?.cnc?.files?.length) {
          for (const file of cncBundle.cnc.files) {
            const matSlug = buildTcnExportBaseName(
              cncBundle.layoutResult,
              file.panelIndex,
              cncBundle.cnc.files.length
            )
              .replace(/[^\p{L}\p{N}_-]+/gu, "_")
              .replace(/_+/g, "_")
              .replace(/^_+|_+$/g, "")
              .slice(0, 40) || "Material";
            const espessura = Math.round(file.thicknessMm ?? 0);
            const filename = `${matSlug}_${espessura}mm_panel_${file.panelIndex}_${v.metodo}.tcn`;
            console.log("TCN gerado:", filename);
            zip.file(filename, file.tcn);
            arquivos.push(filename);
            filesAddedForVariant++;
          }
        }

        if (filesAddedForVariant === 0) {
          throw new Error(`Sem conteúdo TCN para variante ${v.metodo}.`);
        }
      }
      console.log("Total de painéis nas variantes:", arquivos.length);

      const slug = (project.projectName ?? "Projeto")
        .replace(/[^\p{L}\p{N}_-]+/gu, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "Projeto";
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}_variants_v1-v6.zip`;
      a.click();
      URL.revokeObjectURL(url);
      feedback.success("Download concluído.");
    } catch (err) {
      console.error("Erro ao gerar variantes:", err);
      feedback.error("Erro ao gerar variantes. Ver console.");
    } finally {
      saveSettings(previousSettings);
      setIsGeneratingVariants(false);
    }
  };

  return (
    <div style={{ ...adminPageShellStyle, maxWidth: 980 }}>
      <AdminPageHeader
        title="System Settings"
        subtitle="Configurações globais do sistema. Alterações aplicam defaults e parâmetros transversais sem alterar a lógica de negócio."
      />

      <AdminStickyActionBar>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Configure e salve quando terminar a edição.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="button button-ghost" onClick={refreshSettings}>
            Recarregar
          </button>
          <button type="button" className="button button-primary" onClick={applyAndSave}>
            Salvar Configurações
          </button>
        </div>
      </AdminStickyActionBar>

      <Panel title="Geral" description="Preferências de interface e comportamento geral da aplicação.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Locale</span>
            <input
              className="input"
              placeholder="ex: pt-PT"
              value={draft.geral.locale}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, geral: { ...prev.geral, locale: e.target.value } }))
              }
            />
            {fieldErrors["geral.locale"] ? (
              <span style={adminFieldErrorStyle}>{fieldErrors["geral.locale"]}</span>
            ) : null}
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Tema (claro / escuro) — não confundir com Templates Alpha/Pi em Temas (Aparência)
            </span>
            <select
              className="input"
              value={draft.geral.theme}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  geral: { ...prev.geral, theme: e.target.value as SettingsSchema["geral"]["theme"] },
                }))
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System (OS)</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.geral.autosaveEnabled}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, geral: { ...prev.geral, autosaveEnabled: e.target.checked } }))
              }
            />
            Autosave ativo
          </label>
        </div>
      </Panel>

      <Panel title="Fábrica (tolerâncias)" description="Parâmetros de tolerância produtiva. O tamanho da chapa está em Materiais.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <NumberField
            label="Tolerância de corte (mm)"
            value={draft.fabrica.toleranciaCorteMm}
            step={0.1}
            onChange={(value) => setDraft((prev) => ({ ...prev, fabrica: { ...prev.fabrica, toleranciaCorteMm: value } }))}
          />
        </div>
      </Panel>

      <Panel title="Preços" description="Defaults de cálculo para margem, multiplicadores e custo de operação.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <NumberField
            label="Margem (%)"
            value={draft.precos.margemPercentual}
            step={0.1}
            onChange={(value) => setDraft((prev) => ({ ...prev, precos: { ...prev.precos, margemPercentual: value } }))}
          />
          <NumberField
            label="Multiplicador base"
            value={draft.precos.multiplicadorBase}
            step={0.01}
            onChange={(value) => setDraft((prev) => ({ ...prev, precos: { ...prev.precos, multiplicadorBase: value } }))}
          />
          <NumberField
            label="Valor hora máquina"
            value={draft.precos.valorHoraMaquina}
            step={0.5}
            onChange={(value) => setDraft((prev) => ({ ...prev, precos: { ...prev.precos, valorHoraMaquina: value } }))}
          />
        </div>
      </Panel>

      <Panel title="Materiais (defaults)" description="Valores padrão para categoria e presets quando nenhum valor específico estiver definido.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Categoria padrão</span>
            <input
              className="input"
              value={draft.materiais.categoriaPadraoId}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, materiais: { ...prev.materiais, categoriaPadraoId: e.target.value } }))
              }
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Preset visual padrão</span>
            <input
              className="input"
              value={draft.materiais.presetVisualPadraoId}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, materiais: { ...prev.materiais, presetVisualPadraoId: e.target.value } }))
              }
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Material industrial padrão</span>
            <input
              className="input"
              value={draft.materiais.materialIndustrialPadraoId}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, materiais: { ...prev.materiais, materialIndustrialPadraoId: e.target.value } }))
              }
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tamanho do painel (LF×HF×SF)</span>
            <select
              className="input"
              value={
                PANEL_PRESETS.find(
                  (p) =>
                    p.lf === draft.materiais.sheetWidthMm &&
                    p.hf === draft.materiais.sheetHeightMm &&
                    p.sf === draft.materiais.sheetThicknessMm
                )?.id ?? "custom"
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") return;
                const preset = PANEL_PRESETS.find((p) => p.id === val);
                if (preset) {
                  setDraft((prev) => ({
                    ...prev,
                    materiais: {
                      ...prev.materiais,
                      sheetWidthMm: preset.lf,
                      sheetHeightMm: preset.hf,
                      sheetThicknessMm: preset.sf,
                      sheetName: `MDF ${preset.sf}mm (${preset.lf}×${preset.hf})`,
                    },
                  }));
                }
              }}
            >
              {PANEL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <NumberField
            label="Largura do painel (mm)"
            value={draft.materiais.sheetWidthMm}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, materiais: { ...prev.materiais, sheetWidthMm: value } }))
            }
          />
          <NumberField
            label="Altura do painel (mm)"
            value={draft.materiais.sheetHeightMm}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, materiais: { ...prev.materiais, sheetHeightMm: value } }))
            }
          />
          <NumberField
            label="Espessura padrão (mm)"
            value={draft.materiais.sheetThicknessMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, materiais: { ...prev.materiais, sheetThicknessMm: value } }))
            }
          />
          {fieldErrors["materiais.sheetThicknessMm"] ? (
            <span style={{ ...adminFieldErrorStyle, gridColumn: "1 / -1" }}>
              {fieldErrors["materiais.sheetThicknessMm"]}
            </span>
          ) : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Nome do material/chapa</span>
            <input
              className="input"
              value={draft.materiais.sheetName}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, materiais: { ...prev.materiais, sheetName: e.target.value } }))
              }
            />
          </label>
        </div>
      </Panel>

      <Panel title="Configurações de Furação" description="Distâncias e posicionamento de furos (parafuso, cavilha, prateleira, dobradiça). Alinhado ao 3D, Layout de Corte PRO e TCN.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <span style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Parafuso + Cavilha (união topo/base)</span>
          <NumberField
            label="Distância frente parafuso (mm)"
            value={draft.furação?.parafuso?.frontDistance ?? 40}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  parafuso: { ...p.furação?.parafuso, frontDistance: v },
                },
              }))
            }
          />
          <NumberField
            label="Distância frente cavilha (mm)"
            value={draft.furação?.cavilha?.frontDistance ?? 60}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  cavilha: { ...p.furação?.cavilha, frontDistance: v },
                },
              }))
            }
          />
          <NumberField
            label="Distância fundo cavilha (mm)"
            value={draft.furação?.cavilha?.backDistance ?? 60}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  cavilha: { ...p.furação?.cavilha, backDistance: v },
                },
              }))
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Cavilha cima/fundo — centro ao bordo lateral (mm), vazio = automático (metade da espessura)
            </span>
            <input
              className="input"
              type="number"
              min={3}
              max={50}
              step={0.5}
              placeholder="Automático"
              value={draft.furação?.cavilha?.sideOffset ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((p) => ({
                  ...p,
                  furação: {
                    ...p.furação,
                    cavilha: {
                      ...p.furação?.cavilha,
                      sideOffset: v === "" ? undefined : Number(v),
                    },
                  },
                }));
              }}
            />
          </label>
          <NumberField
            label="Offset da borda (mm)"
            value={draft.furação?.parafuso?.offsetDaBorda ?? 9}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  parafuso: { ...p.furação?.parafuso, offsetDaBorda: v },
                },
              }))
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Parafuso cima/fundo — centro ao bordo lateral (mm), vazio = automático (metade da espessura)
            </span>
            <input
              className="input"
              type="number"
              min={3}
              max={50}
              step={0.5}
              placeholder="Automático"
              value={draft.furação?.parafuso?.sideOffset ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((p) => ({
                  ...p,
                  furação: {
                    ...p.furação,
                    parafuso: {
                      ...p.furação?.parafuso,
                      sideOffset: v === "" ? undefined : Number(v),
                    },
                  },
                }));
              }}
            />
          </label>
          <span style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Furos de prateleira (sistema 32mm)</span>
          <NumberField
            label="Margem topo (mm)"
            value={draft.furação?.prateleira?.margemTop ?? 200}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  prateleira: { ...p.furação?.prateleira, margemTop: v },
                },
              }))
            }
          />
          <NumberField
            label="Margem fundo (mm)"
            value={draft.furação?.prateleira?.margemBottom ?? 200}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  prateleira: { ...p.furação?.prateleira, margemBottom: v },
                },
              }))
            }
          />
          <NumberField
            label="Min furos/coluna"
            value={draft.furação?.prateleira?.minFuros ?? 6}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  prateleira: { ...p.furação?.prateleira, minFuros: v },
                },
              }))
            }
          />
          <NumberField
            label="Max furos/coluna"
            value={draft.furação?.prateleira?.maxFuros ?? 40}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  prateleira: { ...p.furação?.prateleira, maxFuros: v },
                },
              }))
            }
          />
          <NumberField
            label="Espaçamento vertical (mm)"
            value={draft.furação?.prateleira?.espacamentoVertical ?? 32}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  prateleira: { ...p.furação?.prateleira, espacamentoVertical: v },
                },
              }))
            }
          />
          <NumberField
            label="Distância frente/fundo – prateleira (mm)"
            value={draft.furação?.prateleira?.distanciaDaBorda ?? 60}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  prateleira: { ...p.furação?.prateleira, distanciaDaBorda: v },
                },
              }))
            }
          />
          <span style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Regras de Dobradiça (Porta)</span>
          <NumberField
            label="Dist. topo (mm)"
            value={draft.furação?.dobradica?.distanciaDobradiçaTopo ?? 100}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradica: { ...p.furação?.dobradica, distanciaDobradiçaTopo: v },
                },
              }))
            }
          />
          <NumberField
            label="Dist. fundo (mm)"
            value={draft.furação?.dobradica?.distanciaDobradiçaFundo ?? 100}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradica: { ...p.furação?.dobradica, distanciaDobradiçaFundo: v },
                },
              }))
            }
          />
          <NumberField
            label="Número por porta"
            value={draft.furação?.dobradica?.numeroPorPorta ?? 2}
            min={2}
            max={6}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradica: { ...p.furação?.dobradica, numeroPorPorta: v },
                },
              }))
            }
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.furação?.dobradica?.distribuicaoAutomatica ?? true}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  furação: {
                    ...p.furação,
                    dobradica: { ...p.furação?.dobradica, distribuicaoAutomatica: e.target.checked },
                  },
                }))
              }
            />
            Distribuição automática (distTopo/distFundo/proporcional)
          </label>
          <NumberField
            label="Distância centro–borda (mm)"
            value={draft.furação?.dobradica?.distanciaCentroDaBorda ?? 21.5}
            step={0.5}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradica: { ...p.furação?.dobradica, distanciaCentroDaBorda: v },
                },
              }))
            }
          />
          <span style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Dobradiça — fixação na lateral (2 calço + 1 parafuso união)</span>
          <NumberField
            label="Distância da borda frontal — dobradiça (mm)"
            value={draft.furação?.dobradicaFixacao?.distanciaDaBordaCalco ?? 16}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradicaFixacao: { ...p.furação?.dobradicaFixacao, distanciaDaBordaCalco: v },
                },
              }))
            }
          />
          <NumberField
            label="Distância da borda — parafuso união (mm)"
            value={draft.furação?.dobradicaFixacao?.distanciaDaBordaParafusoUniao ?? 53}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradicaFixacao: { ...p.furação?.dobradicaFixacao, distanciaDaBordaParafusoUniao: v },
                },
              }))
            }
          />
          <NumberField
            label="Distância entre furos — calço (mm)"
            value={draft.furação?.dobradicaFixacao?.distanciaEntreFurosCalco ?? 32}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradicaFixacao: { ...p.furação?.dobradicaFixacao, distanciaEntreFurosCalco: v },
                },
              }))
            }
          />
          <NumberField
            label="Diâmetro calço (mm)"
            value={draft.furação?.dobradicaFixacao?.diametro ?? 5}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradicaFixacao: { ...p.furação?.dobradicaFixacao, diametro: v },
                },
              }))
            }
          />
          <NumberField
            label="Profundidade calço (mm)"
            value={draft.furação?.dobradicaFixacao?.profundidadeFuro ?? 12}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradicaFixacao: { ...p.furação?.dobradicaFixacao, profundidadeFuro: v },
                },
              }))
            }
          />
          <NumberField
            label="Diâmetro parafuso união (mm)"
            value={draft.furação?.dobradicaFixacao?.diametroParafusoUniao ?? 5}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradicaFixacao: { ...p.furação?.dobradicaFixacao, diametroParafusoUniao: v },
                },
              }))
            }
          />
          <NumberField
            label="Profundidade parafuso união (mm)"
            value={draft.furação?.dobradicaFixacao?.profundidadeParafusoUniao ?? 12}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                furação: {
                  ...p.furação,
                  dobradicaFixacao: { ...p.furação?.dobradicaFixacao, profundidadeParafusoUniao: v },
                },
              }))
            }
          />
        </div>
      </Panel>

      <Panel title="Nesting (parâmetros globais)" description="Preferências globais de corte e aproveitamento para planeamento.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <NumberField
            label="Kerf padrão (mm)"
            value={draft.nesting.kerfPadraoMm}
            step={0.1}
            onChange={(value) => setDraft((prev) => ({ ...prev, nesting: { ...prev.nesting, kerfPadraoMm: value } }))}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Prioridade</span>
            <select
              className="input"
              value={draft.nesting.prioridadeAproveitamento}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  nesting: {
                    ...prev.nesting,
                    prioridadeAproveitamento: e.target.value as SettingsSchema["nesting"]["prioridadeAproveitamento"],
                  },
                }))
              }
            >
              <option value="balanceado">Balanceado</option>
              <option value="area">Área</option>
              <option value="chapas">Chapas</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.nesting.permitirRotacaoGlobal}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, nesting: { ...prev.nesting, permitirRotacaoGlobal: e.target.checked } }))
              }
            />
            Permitir rotação global
          </label>
        </div>
      </Panel>

      <Panel title="Portas (gaps e offsets)" description="Parâmetros de folgas e posicionamento das portas.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <NumberField
            label="Gap vertical (mm)"
            value={draft.portas.portaGapVerticalMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, portas: { ...prev.portas, portaGapVerticalMm: value } }))
            }
          />
          <NumberField
            label="Gap horizontal (mm)"
            value={draft.portas.portaGapHorizontalMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, portas: { ...prev.portas, portaGapHorizontalMm: value } }))
            }
          />
          <NumberField
            label="Gap porta dupla (mm)"
            value={draft.portas.portaGapDuplaMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, portas: { ...prev.portas, portaGapDuplaMm: value } }))
            }
          />
          <NumberField
            label="Offset posZ (mm)"
            value={draft.portas.portaPosZOffsetMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, portas: { ...prev.portas, portaPosZOffsetMm: value } }))
            }
          />
        </div>
      </Panel>

      <Panel title="Regras das Gavetas (Drawer Rules)" description="Parâmetros profissionais de construção, ferragens, handles e validações.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <NumberField
            label="Folga da frente (mm)"
            value={draft.gavetas.gavetaFolgaFrenteMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaFolgaFrenteMm: value } }))
            }
          />
          <NumberField
            label="Folga lateral corredica (mm)"
            value={draft.gavetas.gavetaFolgaLateralMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaFolgaLateralMm: value } }))
            }
          />
          <NumberField
            label="Espessura frente (mm)"
            value={draft.gavetas.gavetaEspessuraFrenteMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaEspessuraFrenteMm: value } }))
            }
          />
          <NumberField
            label="Espessura laterais (mm)"
            value={draft.gavetas.gavetaEspessuraLateralMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaEspessuraLateralMm: value } }))
            }
          />
          <NumberField
            label="Espessura traseira (mm)"
            value={draft.gavetas.gavetaEspessuraTraseiraMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaEspessuraTraseiraMm: value } }))
            }
          />
          <NumberField
            label="Espessura fundo (mm)"
            value={draft.gavetas.gavetaEspessuraFundoMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaEspessuraFundoMm: value } }))
            }
          />
          <NumberField
            label="Recuo altura corpo (mm)"
            value={draft.gavetas.gavetaRecuoCorpoMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaRecuoCorpoMm: value } }))
            }
          />
          <NumberField
            label="Redução das laterais (%)"
            value={draft.gavetas.gavetaReducaoPercentual}
            step={1}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                gavetas: { ...prev.gavetas, gavetaReducaoPercentual: Math.round(value) },
              }))
            }
          />
          <NumberField
            label="Altura mínima (mm)"
            value={draft.gavetas.gavetaAlturaMinimaMm}
            step={1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaAlturaMinimaMm: value } }))
            }
          />
          <NumberField
            label="Altura máxima (mm)"
            value={draft.gavetas.gavetaAlturaMaximaMm}
            step={1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaAlturaMaximaMm: value } }))
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tipo de corrediça</span>
            <select
              className="input"
              value={draft.gavetas.gavetaTipoCorredica}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  gavetas: { ...prev.gavetas, gavetaTipoCorredica: e.target.value as SettingsSchema["gavetas"]["gavetaTipoCorredica"] },
                }))
              }
            >
              {DRAWER_SLIDE_TYPES.map((option) => (
                <option key={option} value={option} disabled={!isDrawerSlideTypeActive(option)}>
                  {drawerSlideTypeOptionLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.gavetas.gavetaSoftClose}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaSoftClose: e.target.checked } }))
              }
            />
            Soft-close
          </label>
          <NumberField
            label="Curso total override (mm)"
            value={draft.gavetas.gavetaCursoTotalMm}
            step={1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaCursoTotalMm: value } }))
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Capacidade carga (kg)</span>
            <select
              className="input"
              value={draft.gavetas.gavetaCapacidadeCargaKg}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  gavetas: { ...prev.gavetas, gavetaCapacidadeCargaKg: Number(e.target.value) as 30 | 40 | 50 | 70 },
                }))
              }
            >
              {[30, 40, 50, 70].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tipo caixa metálica</span>
            <select
              className="input"
              value={draft.gavetas.gavetaTipoCaixaMetalica}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  gavetas: { ...prev.gavetas, gavetaTipoCaixaMetalica: e.target.value as SettingsSchema["gavetas"]["gavetaTipoCaixaMetalica"] },
                }))
              }
            >
              {DRAWER_METAL_BOX_TYPES.map((option) => (
                <option
                  key={option}
                  value={option}
                  disabled={option !== "Nenhuma" && !isDrawerMetalBoxTypeActive(option)}
                >
                  {option === "Nenhuma" ? option : drawerMetalBoxTypeOptionLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Altura caixa metálica (mm)"
            value={draft.gavetas.gavetaAlturaCaixaMetalicaMm}
            step={1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaAlturaCaixaMetalicaMm: value } }))
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tipo handle</span>
            <select
              className="input"
              value={draft.gavetas.gavetaTipoHandle}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  gavetas: { ...prev.gavetas, gavetaTipoHandle: e.target.value as SettingsSchema["gavetas"]["gavetaTipoHandle"] },
                }))
              }
            >
              {["Nenhum", "Puxador", "Cava", "Perfil Alumínio"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Posição handle</span>
            <select
              className="input"
              value={draft.gavetas.gavetaPosicaoHandle}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  gavetas: { ...prev.gavetas, gavetaPosicaoHandle: e.target.value as SettingsSchema["gavetas"]["gavetaPosicaoHandle"] },
                }))
              }
            >
              {["Centro", "Topo", "Inferior"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <NumberField
            label="Offset handle (mm)"
            value={draft.gavetas.gavetaOffsetHandleMm}
            step={1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, gavetas: { ...prev.gavetas, gavetaOffsetHandleMm: value } }))
            }
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Profundidades disponiveis (mm)</span>
            <input
              className="input"
              value={draft.gavetas.gavetaProfundidadesDisponiveisMm.join(", ")}
              onChange={(e) => {
                const values = e.target.value
                  .split(",")
                  .map((item) => Number(item.trim()))
                  .filter((item) => Number.isFinite(item) && item > 0);
                setDraft((prev) => ({
                  ...prev,
                  gavetas: { ...prev.gavetas, gavetaProfundidadesDisponiveisMm: values },
                }));
              }}
              placeholder="250, 300, 350, 400"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Profundidades compatíveis (mm)</span>
            <input
              className="input"
              value={draft.gavetas.gavetaProfundidadesCompativeisMm.join(", ")}
              onChange={(e) => {
                const values = e.target.value
                  .split(",")
                  .map((item) => Number(item.trim()))
                  .filter((item) => Number.isFinite(item) && item > 0);
                setDraft((prev) => ({
                  ...prev,
                  gavetas: { ...prev.gavetas, gavetaProfundidadesCompativeisMm: values },
                }));
              }}
              placeholder="300, 350, 400, 450"
            />
          </label>
          {[
            ["Validar alturas custom", "gavetaValidarAlturasCustom"],
            ["Validar profundidade compatível", "gavetaValidarProfundidadeCompativel"],
            ["Validar carga máxima", "gavetaValidarCargaMaxima"],
            ["Validar soft-close compatível", "gavetaValidarSoftCloseCompativel"],
          ].map(([label, key]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={Boolean(draft.gavetas[key as keyof SettingsSchema["gavetas"]])}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    gavetas: { ...prev.gavetas, [key]: e.target.checked },
                  }))
                }
              />
              {label}
            </label>
          ))}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Modo de altura</span>
            <select
              className="input"
              value={draft.gavetas.gavetaAlturaModoPadrao}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  gavetas: {
                    ...prev.gavetas,
                    gavetaAlturaModoPadrao: e.target.value as SettingsSchema["gavetas"]["gavetaAlturaModoPadrao"],
                  },
                }))
              }
            >
              <option value="equal">Todas iguais</option>
              <option value="top_small_mid_medium_bottom_large">Topo pequeno, meio medio, baixo grande</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel title="Modelo PI" description="Configurações do módulo paramétrico PI (base de cozinha).">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <NumberField
            label="Espessura da madeira (mm)"
            value={draft.modeloPI.espessuraMadeiraMm}
            step={0.1}
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, modeloPI: { ...prev.modeloPI, espessuraMadeiraMm: value } }))
            }
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.modeloPI.ativarFuracaoPrateleiras}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, modeloPI: { ...prev.modeloPI, ativarFuracaoPrateleiras: e.target.checked } }))
              }
            />
            Ativar furação de prateleiras
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.modeloPI.ativarFuracaoDobradicas}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, modeloPI: { ...prev.modeloPI, ativarFuracaoDobradicas: e.target.checked } }))
              }
            />
            Ativar furação de dobradiças
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.modeloPI.ativarFuracaoGavetas}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, modeloPI: { ...prev.modeloPI, ativarFuracaoGavetas: e.target.checked } }))
              }
            />
            Ativar furação de gavetas
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sistema de gavetas</span>
            <select
              className="input"
              value={draft.modeloPI.sistemaGavetas}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  modeloPI: { ...prev.modeloPI, sistemaGavetas: e.target.value as SettingsSchema["modeloPI"]["sistemaGavetas"] },
                }))
              }
            >
              <option value="AvanTech YOU L">AvanTech YOU L</option>
              <option value="AvanTech YOU XL">AvanTech YOU XL</option>
              <option value="AvanTech YOU M">AvanTech YOU M</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Comprimento nominal corrediça (mm)</span>
            <select
              className="input"
              value={draft.modeloPI.comprimentoCorredicaMm}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  modeloPI: { ...prev.modeloPI, comprimentoCorredicaMm: Number(e.target.value) },
                }))
              }
            >
              {[250, 300, 350, 400, 450, 500, 550, 600, 650].map((size) => (
                <option key={size} value={size}>{size}mm</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Número de gavetas</span>
            <select
              className="input"
              value={draft.modeloPI.numeroGavetas}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  modeloPI: { ...prev.modeloPI, numeroGavetas: Number(e.target.value) },
                }))
              }
            >
              {[1, 2, 3, 4].map((qty) => (
                <option key={qty} value={qty}>{qty}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tipo de frente</span>
            <select
              className="input"
              value={draft.modeloPI.tipoFrente}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  modeloPI: { ...prev.modeloPI, tipoFrente: e.target.value as SettingsSchema["modeloPI"]["tipoFrente"] },
                }))
              }
            >
              <option value="full_overlay">Full Overlay</option>
              <option value="inset">Inset</option>
              <option value="overlay">Overlay</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel title="Viewer" description="Qualidade visual e opções de visualização do ambiente 3D.">
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Qualidade</span>
            <select
              className="input"
              value={draft.viewer.qualidade}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  viewer: { ...prev.viewer, qualidade: e.target.value as SettingsSchema["viewer"]["qualidade"] },
                }))
              }
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <NumberField
            label="Intensidade de luz"
            value={draft.viewer.luzIntensidade}
            step={0.1}
            onChange={(value) => setDraft((prev) => ({ ...prev, viewer: { ...prev.viewer, luzIntensidade: value } }))}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.viewer.mostrarGrid}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, viewer: { ...prev.viewer, mostrarGrid: e.target.checked } }))
              }
            />
            Mostrar grid
          </label>
        </div>
      </Panel>

      <Panel title="Etiquetas QR com Logo" description="Configuração de logo integrado nos QR codes das etiquetas de peças.">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={draft.etiquetasQr.logoAtivado}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  etiquetasQr: { ...prev.etiquetasQr, logoAtivado: e.target.checked },
                }))
              }
            />
            Ativar QR com logo integrado
          </label>

          {draft.etiquetasQr.logoAtivado && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Upload de Logo (PNG com fundo transparente)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const dataUrl = event.target?.result as string;
                        setDraft((prev) => ({
                          ...prev,
                          etiquetasQr: { ...prev.etiquetasQr, logoDataUrl: dataUrl },
                        }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {draft.etiquetasQr.logoDataUrl && (
                  <img
                    src={draft.etiquetasQr.logoDataUrl}
                    alt="Logo preview"
                    style={{
                      maxWidth: "100px",
                      maxHeight: "100px",
                      marginTop: 8,
                      borderRadius: 4,
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  />
                )}
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Tamanho do logo: {draft.etiquetasQr.logoTamanhoPorcento}% (10-30%)
                </span>
                <input
                  type="range"
                  min="10"
                  max="30"
                  value={draft.etiquetasQr.logoTamanhoPorcento}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      etiquetasQr: { ...prev.etiquetasQr, logoTamanhoPorcento: Number(e.target.value) },
                    }))
                  }
                  style={{ width: "100%" }}
                />
              </label>
            </>
          )}
        </div>
      </Panel>
      <Panel
        title="Fabricação / TCN"
        description="Parâmetros de geração do ficheiro TCN para a máquina CNC. Alterações aplicam-se na próxima exportação."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
              Método de geração do contorno
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="tcnMetodo"
                  value="nesting_mo"
                  checked={(draft.cnc.tcnMetodo ?? "nesting_mo") === "nesting_mo"}
                  onChange={() =>
                    setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, tcnMetodo: "nesting_mo" } }))
                  }
                />
                <span><strong>NESTING MO</strong> — Modo principal (dinâmico)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="tcnMetodo"
                  value="v2_new"
                  checked={(draft.cnc.tcnMetodo ?? "nesting_mo") === "v2_new"}
                  onChange={() =>
                    setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, tcnMetodo: "v2_new" } }))
                  }
                />
                <span><strong>v2_new</strong> — Furos sem compensação de raio (+ contorno estilo v1)</span>
              </label>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={onDownloadAllVariants}
                disabled={isGeneratingVariants || !project.boxes?.length}
              >
                {isGeneratingVariants ? "Gerando variantes..." : "Download All Variants (v1…v6)"}
              </button>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <NumberField
              label="Z de segurança (mm)"
              value={draft.cnc.zSafetyMm ?? 10}
              min={5} max={50} step={1}
              onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, zSafetyMm: value } }))}
            />
            <NumberField
              label="Espaçamento mínimo entre peças (mm)"
              value={draft.cnc.minSpacingMm ?? 3}
              min={0} max={100} step={1}
              onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, minSpacingMm: value } }))}
            />
            <NumberField
              label="Diâmetro fresa contorno (mm)"
              value={draft.cnc.diametroFresaContornoMm ?? 12}
              min={1} max={50} step={0.5}
              onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, diametroFresaContornoMm: value } }))}
            />
            <NumberField
              label="Margem de segurança da chapa (mm)"
              value={draft.cnc.sheetMarginMm ?? 10}
              min={0} max={100} step={1}
              onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, sheetMarginMm: value } }))}
            />
            <NumberField
              label="Distância de rampa entrada/saída (mm)"
              value={draft.cnc.rampDistanceMm ?? 20}
              min={5} max={100} step={1}
              onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, rampDistanceMm: value } }))}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Compensação de ferramenta</span>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    cnc: {
                      ...prev.cnc,
                      compensacaoFerramenta: (prev.cnc.compensacaoFerramenta ?? "dentro") === "fora" ? "dentro" : "fora",
                    },
                  }))
                }
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  background: (draft.cnc.compensacaoFerramenta ?? "dentro") === "fora" ? "#16a34a" : "#4b5563",
                  color: "#fff",
                  transition: "background 0.2s",
                }}
              >
                {(draft.cnc.compensacaoFerramenta ?? "dentro") === "fora"
                  ? "Compensação: FORA da peça ✓"
                  : "Compensação: DENTRO da peça"}
              </button>
            </div>
          </div>

          <details>
            <summary style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
              Parâmetros avançados (feed rate, RPM, fecho de contorno)
            </summary>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
              <NumberField
                label="Feed rate corte — #2008"
                value={draft.cnc.toolFeedRate ?? 8}
                min={1} max={100} step={1}
                onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, toolFeedRate: value } }))}
              />
              <NumberField
                label="RPM corte — #2002"
                value={draft.cnc.toolRpm ?? 21000}
                min={1000} max={30000} step={500}
                onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, toolRpm: value } }))}
              />
              <NumberField
                label="Feed rate furação (mm/min)"
                value={draft.cnc.drillFeedRate ?? 1000}
                min={100} max={5000} step={100}
                onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, drillFeedRate: value } }))}
              />
              <NumberField
                label="RPM furação"
                value={draft.cnc.drillRpm ?? 18000}
                min={1000} max={30000} step={500}
                onChange={(value) => setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, drillRpm: value } }))}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={draft.cnc.contourCloseExplicit ?? false}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, cnc: { ...prev.cnc, contourCloseExplicit: e.target.checked } }))
                  }
                />
                Fechar contorno explicitamente
              </label>
            </div>
          </details>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="button button-primary" onClick={applyAndSave}>
              Guardar definições
            </button>
            <button type="button" className="button button-ghost" onClick={exportTcnProfile}>
              Exportar perfil JSON
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
