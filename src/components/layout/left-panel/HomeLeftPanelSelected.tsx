import { useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import UnifiedPopover, { StepperPopover } from "../../ui/UnifiedPopover";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import Panel from "../../ui/Panel";
import { NumericInput } from "../../ui/NumericInput";
import BoxLayersPanel from "./BoxLayersPanel";
import BoxPecasObservacoesSection from "../../settings/observacoes/BoxPecasObservacoesSection";
import DivSepPanel from "./DivSepPanel";
import { useToast } from "../../../context/ToastContext";
import { getMaterialByIdOrLabel } from "../../../core/materials";
import type { UseMaterialsForPickerResult } from "./hooks/useMaterialsForPicker";
import { isPiBaseCabinetId } from "../../../data/moveisUnificados/pi/models";
import { computeBoxProfundidadeLeituraMm } from "../../../utils/boxProfundidadeLeituraUi";
import { Icon } from "@/components/icons";
import SelecionarMaterialSection from "../../settings/material/SelecionarMaterialSection";
import { resolveNoBackPanel } from "../../../core/box/backPanelFlags";
import CostaMaterialControl from "./CostaMaterialControl";
import { useUiStore } from "../../../stores/uiStore";
import RematePropertiesPanel from "../../settings/remate/RematePropertiesPanel";
import BoxRemateDrawer from "../../settings/remate/BoxRemateDrawer";
import CornerOrientationPanel from "../../settings/corner/CornerOrientationPanel";
import { SectionTitleWithHelp } from "../../ui/MiniHelpTooltip";

const HOME_SELECTED_SECTION_HELP_TEXT =
  "Controles principais da caixa selecionada e definição inicial do projeto.";

export type HomeLeftPanelSelectedProps = {
  materialsPicker: UseMaterialsForPickerResult;
};

export function HomeLeftPanelSelected({ materialsPicker }: HomeLeftPanelSelectedProps) {
  const { project, actions } = useProject();
  const { showToast } = useToast();
  const selectedBox = project.workspaceBoxes.find(
    (box) => box.id === project.selectedWorkspaceBoxId
  );
  const selectedPrateleiras = selectedBox?.prateleiras ?? 0;
  const selectedGavetas = selectedBox?.gavetas ?? 0;
  void materialsPicker;
  const { viewerApi } = usePimoViewerContext();
  const [remateDrawerOpen, setRemateDrawerOpen] = useState(false);
  const selectedObject = useUiStore((s) => s.selectedObject);
  const selectedRemateId = selectedObject.type === "remate" ? selectedObject.id : null;

  const profundidadeLeitura = useMemo(
    () => (selectedBox ? computeBoxProfundidadeLeituraMm(selectedBox, project.rules) : null),
    [selectedBox, project.rules]
  );

  const portaTipoLabel =
    selectedBox?.portaTipo === "sem_porta"
      ? "Sem"
      : selectedBox?.portaTipo === "porta_simples"
        ? "Simples"
        : selectedBox?.portaTipo === "porta_correr"
          ? "Correr"
          : "Dupla";

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="design-panel-header">
            <SectionTitleWithHelp title="Início" helpText={HOME_SELECTED_SECTION_HELP_TEXT} />
          </div>

          {selectedBox && (
            <Panel title="NOME DA CAIXA">
              <input
                type="text"
                value={selectedBox.nome}
                onChange={(e) => actions.setWorkspaceBoxNome(selectedBox.id, e.target.value)}
                placeholder="Nome da caixa"
                className="input input-sm"
              />
            </Panel>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => actions.addWorkspaceBox()}
              className="button button-primary"
              style={{ flex: 1, minWidth: 140 }}
            >
              Adicionar Caixote
            </button>
            {selectedBox && (
              <button
                type="button"
                onClick={() => actions.duplicateWorkspaceBox()}
                className="button button-ghost"
                style={{ flex: 1, minWidth: 140 }}
              >
                Duplicar Caixa
              </button>
            )}
          </div>

          {selectedBox && (
            <>
              <UnifiedPopover
                id="dimensoes-popover"
                fullWidth
                triggerVariant="ghost"
                triggerTitle="Definir largura, altura e profundidade do módulo."
                trigger={<span>Dimensões</span>}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="panel-field-row">
                    <span className="panel-label">Largura:</span>
                    <NumericInput
                      value={selectedBox.dimensoes.largura}
                      onChange={(value) => {
                        actions.setDimensoes({ largura: value });
                      }}
                      className="input input-xs"
                      unit="mm"
                    />
                  </div>
                  <div className="panel-field-row">
                    <span className="panel-label">Altura:</span>
                    <NumericInput
                      value={selectedBox.dimensoes.altura}
                      onChange={(value) => {
                        actions.setDimensoes({ altura: value });
                      }}
                      className="input input-xs"
                      unit="mm"
                    />
                  </div>
                  <div className="panel-field-row">
                    <span className="panel-label">Profundidade:</span>
                    <NumericInput
                      value={selectedBox.dimensoes.profundidade}
                      onChange={(value) => {
                        actions.setDimensoes({ profundidade: value });
                      }}
                      className="input input-xs"
                      unit="mm"
                    />
                  </div>
                </div>
              </UnifiedPopover>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <StepperPopover
                id="prateleiras-popover"
                label="Prateleiras"
                value={selectedPrateleiras}
                onChange={(v) => actions.setPrateleiras(v)}
                fullWidth
                triggerVariant="ghost"
                triggerTitle="Número de prateleiras internas do módulo."
              />
              <StepperPopover
                id="gavetas-popover"
                label="Gavetas"
                value={selectedGavetas}
                onChange={(v) => actions.setGavetas(v)}
                fullWidth
                triggerVariant="ghost"
                triggerTitle="Quantidade de gavetas aplicadas ao módulo."
              />
              {selectedBox.drawerConfigError && (
                <div
                  style={{
                    fontSize: 11,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.12)",
                    color: "#fca5a5",
                    border: "1px solid rgba(239,68,68,0.35)",
                  }}
                >
                  {selectedBox.drawerConfigError}
                </div>
              )}
              <UnifiedPopover
                fullWidth
                triggerVariant="ghost"
                triggerTitle="Selecione o tipo de porta para este módulo."
                trigger={
                  <span>
                    Tipo de porta — <strong>{portaTipoLabel}</strong>
                  </span>
                }
              >
                <select
                  value={selectedBox.portaTipo ?? "sem_porta"}
                  onChange={(e) =>
                    actions.setPortaTipo(
                      e.target.value as "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr"
                    )
                  }
                  className="select"
                  style={{ width: "100%" }}
                >
                  <option value="sem_porta">Sem porta</option>
                  <option value="porta_simples">Porta simples</option>
                  <option value="porta_dupla">Porta dupla</option>
                  <option value="porta_correr">Porta de correr</option>
                </select>
              </UnifiedPopover>
              <button
                type="button"
                className="button button-ghost"
                style={{ width: "100%" }}
                title="Adicionar e configurar remates e roda pé do módulo."
                aria-label="Adicionar e configurar remates e roda pé do módulo."
                onClick={() => setRemateDrawerOpen(true)}
              >
                Remate
              </button>
              <UnifiedPopover
                fullWidth
                triggerVariant="ghost"
                triggerTitle="Ativar e configurar pés do módulo."
                trigger={<span>Pés</span>}
              >
                {(() => {
                  const feetHeightMm = Math.max(40, selectedBox.feetHeight ?? ((selectedBox.pe_cm ?? 10) * 10));
                  const feetOffsetFrontMm = Math.max(0, selectedBox.feetOffsetFront ?? 100);
                  const shouldLockY = selectedBox.cabinetType === "lower";
                  const feetEnabled = selectedBox.feetEnabled !== false;
                  return (
                    <>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--text-main)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={feetEnabled}
                          onChange={(e) => {
                            const nextEnabled = e.target.checked;
                            const partial: {
                              feetEnabled: boolean;
                              y_mm?: number;
                              manualPosition?: boolean;
                            } = { feetEnabled: nextEnabled };
                            if (nextEnabled && shouldLockY) {
                              partial.y_mm = feetHeightMm + selectedBox.dimensoes.altura / 2;
                              partial.manualPosition = true;
                            } else if (!nextEnabled && shouldLockY) {
                              partial.manualPosition = true;
                            }
                            actions.updateWorkspaceBoxTransform(selectedBox.id, partial);
                          }}
                        />
                        Ativar pés
                      </label>

                      {feetEnabled && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                          <div className="panel-field-row">
                            <label className="panel-label" style={{ minWidth: 110 }}>
                              Altura (mm)
                            </label>
                            <NumericInput
                              value={feetHeightMm}
                              min={40}
                              onChange={(clamped) => {
                                const partial: {
                                  feetHeight: number;
                                  y_mm?: number;
                                  manualPosition?: boolean;
                                } = { feetHeight: clamped };
                                if (selectedBox.feetEnabled !== false && shouldLockY) {
                                  partial.y_mm = clamped + selectedBox.dimensoes.altura / 2;
                                  partial.manualPosition = true;
                                }
                                actions.updateWorkspaceBoxTransform(selectedBox.id, partial);
                              }}
                              className="input input-sm"
                              style={{ width: 110 }}
                            />
                          </div>

                          <div className="panel-field-row">
                            <label className="panel-label" style={{ minWidth: 110 }}>
                              Recuo frontal (mm)
                            </label>
                            <NumericInput
                              value={feetOffsetFrontMm}
                              min={0}
                              onChange={(value) => {
                                actions.updateWorkspaceBoxTransform(selectedBox.id, {
                                  feetOffsetFront: Math.max(0, Math.round(value)),
                                });
                              }}
                              className="input input-sm"
                              style={{ width: 110 }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </UnifiedPopover>
              <UnifiedPopover
                id="selecionar-material-popover"
                fullWidth
                triggerVariant="ghost"
                triggerTitle="Selecionar materiais do módulo, porta e gavetas."
                trigger={<span>Selecionar Material</span>}
              >
                <SelecionarMaterialSection
                  embedded
                  boxId={selectedBox.id}
                  onViewerMaterialChange={(boxId, materialName) => {
                    viewerApi?.updateBox(boxId, { materialName });
                    showToast("Material aplicado à caixa.", "info");
                  }}
                  onDoorMaterialChange={(boxId, doorLayerId, materialName) => {
                    viewerApi?.updateDoorMaterial?.(boxId, doorLayerId, materialName);
                    showToast("Material aplicado à porta.", "info");
                  }}
                  onDrawerMaterialChange={(boxId, drawerLayerId, materialName) => {
                    viewerApi?.updateDrawerMaterial?.(boxId, drawerLayerId, materialName);
                    showToast("Material aplicado à gaveta.", "info");
                  }}
                  onFixedFrontMaterialChange={(boxId, materialName) => {
                    viewerApi?.updateFixedFrontMaterial?.(boxId, materialName);
                    showToast("Material aplicado à frente fixa.", "info");
                  }}
                />
              </UnifiedPopover>

              {profundidadeLeitura && (
                <details
                  style={{
                    marginTop: 8,
                    padding: "12px 12px",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    fontSize: 12,
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Icon name="ruler" size={16} aria-hidden />
                    Profundidade da caixa (referência)
                  </summary>
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        paddingLeft: 10,
                        borderLeft: "3px solid #38bdf8",
                        color: "var(--text-main)",
                        lineHeight: 1.45,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Externa
                      </div>
                      <div style={{ fontWeight: 600 }}>{profundidadeLeitura.profundidadeExternaMm} mm</div>
                    </div>
                    <div
                      style={{
                        paddingLeft: 10,
                        borderLeft: "3px solid #c4b5fd",
                        color: "var(--text-main)",
                        lineHeight: 1.45,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Útil interna
                      </div>
                      <div style={{ fontWeight: 600 }}>{profundidadeLeitura.profundidadeInternaUtilMm} mm</div>
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        color: "var(--text-main)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={resolveNoBackPanel(selectedBox)}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          actions.setWorkspaceBoxNoBackPanel(selectedBox.id, enabled);
                          viewerApi?.setBoxNoBackPanel?.(selectedBox.id, enabled);
                          showToast(
                            enabled ? "Costa removida (visual + industrial)." : "Costa restaurada.",
                            "info"
                          );
                        }}
                      />
                      Sem costa
                    </label>
                    <CostaMaterialControl
                      box={selectedBox}
                      projectMaterialId={project.materialId}
                      disabled={resolveNoBackPanel(selectedBox)}
                      onApply={(costaMaterialId, costaThicknessMm) => {
                        actions.setWorkspaceBoxCostaMaterial(
                          selectedBox.id,
                          costaMaterialId,
                          costaThicknessMm
                        );
                        showToast("Material da costa actualizado.", "info");
                      }}
                      onReset={() => {
                        actions.setWorkspaceBoxCostaMaterial(selectedBox.id);
                        showToast("Costa reposta para o padrão (família + 10 mm).", "info");
                      }}
                    />
                  </div>
                </details>
              )}
              </div>
            </>
          )}

          {selectedRemateId ? (
            <RematePropertiesPanel remateId={selectedRemateId} />
          ) : null}

          {selectedBox && (
            <BoxRemateDrawer
              boxId={selectedBox.id}
              open={remateDrawerOpen}
              onClose={() => setRemateDrawerOpen(false)}
              defaultMaterialId={
                selectedBox.material || project.materialId || project.material.tipo
              }
            />
          )}

          {!selectedBox && (
            <div className="section-title" style={{ marginTop: 20 }}>Definições</div>
          )}

          {!selectedBox && (
            <Panel title="NOME DE PROJETO">
              <input
                type="text"
                value={project.projectName}
                onChange={(e) => actions.setProjectName(e.target.value)}
                placeholder="Nome do projeto"
                className="input input-sm"
              />
            </Panel>
          )}

          {!selectedBox && (
            <Panel title="Material do projeto" description="Material padrão (somente leitura)">
              <div style={{ fontSize: 12, color: "var(--text-main)" }}>
                {project.materialId
                  ? (getMaterialByIdOrLabel(project.materialId)?.label ?? project.material.tipo)
                  : project.material.tipo}
              </div>
            </Panel>
          )}

          {selectedBox && (
            <CornerOrientationPanel
              box={selectedBox}
              onOrientationChange={(orientation) =>
                actions.setCornerOrientation(selectedBox.id, orientation)
              }
            />
          )}

          {selectedBox && (
            <Panel title="Opções do box">
              <BoxLayersPanel embedded />
              <div style={{ marginTop: 12 }}>
                <DivSepPanel box={selectedBox} actions={actions} />
              </div>
              <div style={{ marginTop: 12 }}>
                <BoxPecasObservacoesSection boxId={selectedBox.id} boxNome={selectedBox.nome} />
              </div>
            </Panel>
          )}

          {selectedBox && isPiBaseCabinetId(selectedBox.baseCabinetId) && (
            <Panel
              title="Furação PI (laterais)"
              description="A grelha 32 mm e os furos de dobradiça são fixos do módulo. Opcional: ocultar só corrediça na visualização e na lista."
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text-main)",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedBox.piHideDrawerHoles === true}
                  onChange={(e) =>
                    actions.setWorkspaceBoxPiHideDrawerHoles(selectedBox.id, e.target.checked)
                  }
                />
                Ocultar furos de corrediça (laterais)
              </label>
            </Panel>
          )}

        </aside>
      </div>
    </div>
  );
}
