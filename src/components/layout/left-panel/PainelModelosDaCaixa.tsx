/**
 * Painel Modelos = Instâncias dentro da caixa atual.
 * Mostra apenas: lista de instâncias (modelInstanceId), nome/material/categoria editáveis,
 * remover, RuleViolationsAlert, LayoutWarningsAlert, secção Layout (Auto‑Organizar, Snap, Reset).
 * Sem catálogo CAD nem "adicionar modelo" (isso fica no tab Móveis).
 */

import { useState } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import Panel from "../../ui/Panel";
import { useCadModels } from "../../../hooks/useCadModels";
import { mmToM } from "../../../utils/units";
import { CATEGORIAS_CAD } from "../../../core/cad/categories";
import RuleViolationsAlert from "../../ui/RuleViolationsAlert";
import LayoutWarningsAlert from "../../ui/LayoutWarningsAlert";
import { autoArrangeModels } from "../../../core/layout/smartArrange";
import { snapPosition } from "../../../core/rules/positioning";
import { positionMmToLocalM } from "../../../core/layout/viewerLayoutAdapter";
export default function PainelModelosDaCaixa() {
  const { project, actions } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const { models: cadModels } = useCadModels();
  const selectedBox = project.workspaceBoxes.find(
    (box) => box.id === project.selectedWorkspaceBoxId
  );
  const boxModels = selectedBox?.models ?? [];
  const [accordionOpen, setAccordionOpen] = useState(false);

  if (!selectedBox) {
    return (
      <aside className="panel-content panel-content--side">
        <div className="section-title">Modelos</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Selecione uma caixa no tab <strong>Calculadora</strong> para gerir os modelos dentro dela.
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel-content panel-content--side">
      <div className="section-title">Modelos na caixa</div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Instâncias em <strong>{selectedBox.nome}</strong>. Edite nome, material e categoria; use Layout para posição.
      </p>

      <Panel title="Instâncias" description="Modelos adicionados a esta caixa.">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {boxModels.map((instance) => {
            const cad = cadModels.find((c) => c.id === instance.modelId);
            const nome = instance.nome ?? cad?.nome ?? instance.modelId;
            const categoria = instance.categoria ?? cad?.categoria ?? "";
            const material = instance.material ?? project.material.tipo;
            return (
              <li
                key={instance.id}
                role="button"
                tabIndex={0}
                onClick={() => actions.selectModelInstance(project.selectedCaixaId, instance.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    actions.selectModelInstance(project.selectedCaixaId, instance.id);
                  }
                }}
                style={{
                  padding: 8,
                  background: "var(--surface)",
                  borderRadius: 6,
                  border:
                    project.selectedModelInstanceId === instance.id
                      ? "1px solid var(--primary)"
                      : "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{nome}</span>
                  <button
                    type="button"
                    onClick={() => actions.removeModelFromBox(project.selectedCaixaId, instance.id)}
                    className="panel-button"
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >
                    Remover
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  <div className="panel-field-row">
                    <span className="panel-label">Nome:</span>
                    <input
                      type="text"
                      value={instance.nome ?? ""}
                      placeholder={cad?.nome}
                      onChange={(e) =>
                        actions.updateModelInBox(project.selectedCaixaId, instance.id, {
                          nome: e.target.value || undefined,
                        })
                      }
                      className="input input-xs"
                    />
                  </div>
                  <div className="panel-field-row">
                    <span className="panel-label">Material:</span>
                    <select
                      value={material}
                      onChange={(e) =>
                        actions.updateModelInBox(project.selectedCaixaId, instance.id, {
                          material: e.target.value,
                        })
                      }
                      className="select"
                      style={{ flex: 1 }}
                    >
                      <option value="MDF">MDF</option>
                      <option value="Contraplacado">Contraplacado</option>
                      <option value="Carvalho">Carvalho</option>
                      <option value="Faia">Faia</option>
                      <option value="Pinho">Pinho</option>
                    </select>
                  </div>
                  <div className="panel-field-row">
                    <span className="panel-label">Categoria:</span>
                    <select
                      value={categoria}
                      onChange={(e) =>
                        actions.updateModelInBox(project.selectedCaixaId, instance.id, {
                          categoria: e.target.value || undefined,
                        })
                      }
                      className="select"
                      style={{ flex: 1 }}
                    >
                      <option value="">—</option>
                      {CATEGORIAS_CAD.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {boxModels.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Nenhum modelo nesta caixa. Adicione modelos no tab <strong>Móveis</strong>.
          </p>
        )}
      </Panel>

      <Panel
        title="Opções da caixa"
        description="Tipo de projeto, material, borda e fundo."
      >
        <button
          type="button"
          onClick={() => setAccordionOpen((o) => !o)}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text-main)",
            fontSize: 12,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {accordionOpen ? "▼" : "▶"} {accordionOpen ? "Ocultar" : "Mostrar"} tipo, material, borda e fundo
        </button>
        {accordionOpen && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Tipo de Projeto</div>
              <select
                value={project.tipoProjeto}
                onChange={(e) => {
                  const value = e.target.value;
                  actions.setTipoProjeto(value);
                  if (value === "Caixa com porta") actions.setPortaTipo("porta_simples");
                  else if (value === "Guarda-roupa com porta de correr") actions.setPortaTipo("porta_correr");
                  else if (value === "Caixa sem porta") actions.setPortaTipo("sem_porta");
                }}
                className="select"
                style={{ width: "100%" }}
              >
                <option value="Caixa sem porta">Caixa sem porta</option>
                <option value="Caixa com porta">Caixa com porta</option>
                <option value="Guarda-roupa com porta de correr">Guarda-roupa com porta de correr</option>
                <option value="Caixa de canto esquerda">Caixa de canto esquerda</option>
                <option value="Caixa de canto direita">Caixa de canto direita</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Material</div>
              <select
                value={project.material.tipo}
                onChange={(e) => {
                  const value = e.target.value;
                  actions.setMaterial({ ...project.material, tipo: value });
                  if (project.selectedWorkspaceBoxId) viewerApi?.updateBox(project.selectedWorkspaceBoxId, { materialName: value });
                }}
                className="select"
                style={{ width: "100%" }}
              >
                <option value="Carvalho Natural">Carvalho Natural</option>
                <option value="Carvalho Escuro">Carvalho Escuro</option>
                <option value="Nogueira">Nogueira</option>
                <option value="MDF Branco">MDF Branco</option>
                <option value="MDF Cinza">MDF Cinza</option>
                <option value="MDF Preto">MDF Preto</option>
              </select>
              <select
                value={selectedBox?.espessura ?? project.material.espessura}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  actions.setEspessura(value);
                  if (project.selectedWorkspaceBoxId) viewerApi?.updateBox(project.selectedWorkspaceBoxId, { thickness: mmToM(value) });
                }}
                className="select"
                style={{ width: "100%", marginTop: 4 }}
              >
                <option value={15}>15mm</option>
                <option value={18}>18mm</option>
                <option value={19}>19mm</option>
                <option value={25}>25mm</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Tipo de borda</div>
              <select
                value={selectedBox?.tipoBorda ?? "reta"}
                onChange={(e) => actions.setTipoBorda(e.target.value as "reta" | "biselada" | "arredondada")}
                className="select"
                style={{ width: "100%" }}
              >
                <option value="reta">Reta</option>
                <option value="biselada">Biselada</option>
                <option value="arredondada">Arredondada</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Tipo de fundo</div>
              <select
                value={selectedBox?.tipoFundo ?? "recuado"}
                onChange={(e) => actions.setTipoFundo(e.target.value as "integrado" | "recuado" | "sem_fundo")}
                className="select"
                style={{ width: "100%" }}
              >
                <option value="integrado">Integrado</option>
                <option value="recuado">Recuado</option>
                <option value="sem_fundo">Sem fundo</option>
              </select>
            </div>
          </div>
        )}
      </Panel>

      <RuleViolationsAlert
        violations={project.ruleViolations ?? []}
        boxId={project.selectedWorkspaceBoxId}
      />

      <LayoutWarningsAlert
        warnings={project.layoutWarnings ?? { collisions: [], outOfBounds: [] }}
        boxId={project.selectedWorkspaceBoxId}
      />

      {boxModels.length > 0 && (
        <Panel title="Layout" description="Posição e organização dos modelos na caixa.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {project.selectedModelInstanceId && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Posição (m):{" "}
                {(() => {
                  const pos =
                    project.modelPositionsByBoxId?.[project.selectedCaixaId]?.[
                      project.selectedModelInstanceId
                    ] ??
                    viewerApi?.getModelPosition?.(
                      project.selectedCaixaId,
                      project.selectedModelInstanceId
                    );
                  if (!pos) return "—";
                  return `x: ${pos.x.toFixed(3)}, y: ${pos.y.toFixed(3)}, z: ${pos.z.toFixed(3)}`;
                })()}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                className="panel-button"
                onClick={() => {
                  const boxId = project.selectedCaixaId;
                  const boxDimsM = {
                    width: mmToM(selectedBox.dimensoes.largura),
                    height: mmToM(selectedBox.dimensoes.altura),
                    depth: mmToM(selectedBox.dimensoes.profundidade),
                  };
                  const models = boxModels.map((m) => {
                    const parts = project.extractedPartsByBoxId?.[boxId]?.[m.id] ?? [];
                    const sizeM =
                      parts.length > 0
                        ? {
                            width: Math.max(
                              0.01,
                              Math.max(...parts.map((p) => p.dimensoes.largura)) / 1000
                            ),
                            height: Math.max(
                              0.01,
                              Math.max(...parts.map((p) => p.dimensoes.altura)) / 1000
                            ),
                            depth: Math.max(
                              0.01,
                              Math.max(...parts.map((p) => p.dimensoes.profundidade)) / 1000
                            ),
                          }
                        : { width: 0.1, height: 0.1, depth: 0.1 };
                    const pos =
                      project.modelPositionsByBoxId?.[boxId]?.[m.id] ??
                      viewerApi?.getModelPosition?.(boxId, m.id) ?? {
                        x: 0,
                        y: boxDimsM.height / 2,
                        z: 0,
                      };
                    return {
                      instanceId: m.id,
                      modelId: m.modelId,
                      categoria: m.categoria,
                      currentPosition: pos,
                      sizeM,
                    };
                  });
                  const results = autoArrangeModels(boxDimsM, models);
                  results.forEach((r) => {
                    viewerApi?.setModelPosition?.(boxId, r.instanceId, r.position);
                    actions.setModelPositionInBox(boxId, r.instanceId, r.position);
                  });
                }}
              >
                Auto-Organizar
              </button>
              <button
                type="button"
                className="panel-button"
                disabled={!project.selectedModelInstanceId}
                onClick={() => {
                  const boxId = project.selectedCaixaId;
                  const mid = project.selectedModelInstanceId;
                  if (!mid || !viewerApi) return;
                  const pos =
                    project.modelPositionsByBoxId?.[boxId]?.[mid] ??
                    viewerApi.getModelPosition(boxId, mid);
                  if (!pos) return;
                  const boxDimsM = {
                    width: mmToM(selectedBox.dimensoes.largura),
                    height: mmToM(selectedBox.dimensoes.altura),
                    depth: mmToM(selectedBox.dimensoes.profundidade),
                  };
                  const modelId =
                    selectedBox.models?.find((m) => m.id === mid)?.modelId ?? mid;
                  const posMm = {
                    x: (pos.x + boxDimsM.width / 2) * 1000,
                    y: (pos.y + boxDimsM.height / 2) * 1000,
                    z: (pos.z + boxDimsM.depth / 2) * 1000,
                  };
                  const snapped = snapPosition(posMm, modelId);
                  const local = positionMmToLocalM(snapped, boxDimsM);
                  viewerApi.setModelPosition(boxId, mid, local);
                  actions.setModelPositionInBox(boxId, mid, local);
                }}
              >
                Snap to Grid
              </button>
              <button
                type="button"
                className="panel-button"
                disabled={!project.selectedModelInstanceId}
                onClick={() => {
                  const boxId = project.selectedCaixaId;
                  const mid = project.selectedModelInstanceId;
                  if (!mid || !viewerApi) return;
                  const boxDimsM = {
                    width: mmToM(selectedBox.dimensoes.largura),
                    height: mmToM(selectedBox.dimensoes.altura),
                    depth: mmToM(selectedBox.dimensoes.profundidade),
                  };
                  const resetPos = { x: 0, y: boxDimsM.height / 2, z: 0 };
                  viewerApi.setModelPosition(boxId, mid, resetPos);
                  actions.setModelPositionInBox(boxId, mid, resetPos);
                }}
              >
                Reset Position
              </button>
            </div>
          </div>
        </Panel>
      )}
    </aside>
  );
}
