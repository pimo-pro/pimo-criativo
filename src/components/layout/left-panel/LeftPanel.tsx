import { useEffect, useState } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import { useCadModels } from "../../../hooks/useCadModels";

export default function LeftPanel() {
  const { project, actions } = useProject();
  const selectedBox = project.workspaceBoxes.find(
    (box) => box.id === project.selectedWorkspaceBoxId
  );
  const selectedEspessura = selectedBox?.espessura ?? project.material.espessura;
  const selectedPrateleiras = selectedBox?.prateleiras ?? 0;
  const tipoProjeto = project.tipoProjeto;
  const { models: cadModels, reload: reloadCadModels } = useCadModels();
  const [materialTipo, setMaterialTipo] = useState(project.material.tipo);
  const [espessuraUI, setEspessuraUI] = useState(selectedEspessura);

  useEffect(() => {
    setMaterialTipo(project.material.tipo);
  }, [project.material.tipo]);

  useEffect(() => {
    setEspessuraUI(selectedEspessura);
  }, [selectedEspessura]);

  useEffect(() => {
    reloadCadModels();
  }, [reloadCadModels]);

  return (
    <aside className="panel-content panel-content--side">
      {/* Título da Secção */}
      <div className="section-title">
        Definições
      </div>

      <Panel title="NOME DE PROJETO">
        <input
          type="text"
          value={project.projectName}
          onChange={(e) => actions.setProjectName(e.target.value)}
          placeholder="Nome do projeto"
          className="input input-sm"
        />
      </Panel>

      <Panel title="Tipo de Projeto">
        <select
          value={tipoProjeto}
          onChange={(e) => {
            const value = e.target.value;
            actions.setTipoProjeto(value);
            if (value === "Caixa com porta") {
              actions.setPortaTipo("porta_simples");
            } else if (value === "Guarda-roupa com porta de correr") {
              actions.setPortaTipo("porta_correr");
            } else if (value === "Caixa sem porta") {
              actions.setPortaTipo("sem_porta");
            }
          }}
          className="select"
        >
          {[
            "Caixa sem porta",
            "Caixa com porta",
            "Guarda-roupa com porta de correr",
            "Caixa de canto esquerda",
            "Caixa de canto direita",
          ].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Panel>

      <Panel title="Modelo 3D (lista de cadModels)">
        <select
          value={selectedBox?.modelId ?? ""}
          onChange={(e) =>
            actions.updateCaixaModelId(
              project.selectedCaixaId,
              e.target.value === "" ? null : e.target.value
            )
          }
          className="select"
        >
          <option value="">Nenhum modelo</option>
          {cadModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.nome} — {model.categoria}
            </option>
          ))}
        </select>
        <button
          onClick={reloadCadModels}
          className="panel-button"
          style={{ marginTop: 8 }}
        >
          Recarregar modelos
        </button>
      </Panel>

      {/* Material */}
      <Panel title="Material">
        <div style={{ marginBottom: 8 }}>
          <select
            value={materialTipo}
            onChange={(e) => setMaterialTipo(e.target.value)}
            className="select"
          >
            <option value="MDF">MDF</option>
            <option value="Contraplacado">Contraplacado</option>
            <option value="Carvalho">Carvalho</option>
            <option value="Faia">Faia</option>
            <option value="Pinho">Pinho</option>
          </select>
        </div>
        <select
          value={espessuraUI}
          onChange={(e) => setEspessuraUI(Number(e.target.value))}
          className="select"
        >
          <option value={15}>15mm</option>
          <option value={18}>18mm</option>
          <option value={19}>19mm</option>
          <option value={25}>25mm</option>
        </select>
      </Panel>

      {/* Dimensões */}
      <Panel title="Dimensões" description="Valores em milímetros">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="panel-field-row">
            <span className="panel-label">
              Largura:
            </span>
            <input
              type="number"
              value={project.dimensoes.largura}
              onChange={(e) =>
                actions.setDimensoes({ largura: Number(e.target.value) })
              }
              className="input input-xs"
            />
          </div>
          <div className="panel-field-row">
            <span className="panel-label">
              Altura:
            </span>
            <input
              type="number"
              value={project.dimensoes.altura}
              onChange={(e) =>
                actions.setDimensoes({ altura: Number(e.target.value) })
              }
              className="input input-xs"
            />
          </div>
          <div className="panel-field-row">
            <span className="panel-label">
              Profundidade:
            </span>
            <input
              type="number"
              value={project.dimensoes.profundidade}
              onChange={(e) =>
                actions.setDimensoes({ profundidade: Number(e.target.value) })
              }
              className="input input-xs"
            />
          </div>
        </div>
      </Panel>

      <Panel title="Prateleiras" description="Quantidade por caixote">
        <input
          type="number"
          min="0"
          value={selectedPrateleiras}
          onChange={(e) => actions.setPrateleiras(Number(e.target.value))}
          className="input input-sm"
        />
      </Panel>

    </aside>
  );
}
