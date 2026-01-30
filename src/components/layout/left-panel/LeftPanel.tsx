import { useEffect, useState } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import Panel from "../../ui/Panel";
import { mmToM } from "../../../utils/units";
import { LEFT_TOOLBAR_IDS } from "../left-toolbar/LeftToolbar";
import PainelMoveis from "./PainelMoveis";
import PainelModelosDaCaixa from "./PainelModelosDaCaixa";

export type LeftPanelProps = {
  activeTab?: string;
};

export default function LeftPanel({ activeTab = "home" }: LeftPanelProps) {
  const { project, actions } = useProject();
  const selectedBox = project.workspaceBoxes.find(
    (box) => box.id === project.selectedWorkspaceBoxId
  );
  const selectedEspessura = selectedBox?.espessura ?? project.material.espessura;
  const selectedPrateleiras = selectedBox?.prateleiras ?? 0;
  const tipoProjeto = project.tipoProjeto;
  const { viewerApi } = usePimoViewerContext();
  const [materialTipo, setMaterialTipo] = useState(project.material.tipo);
  const [espessuraUI, setEspessuraUI] = useState(selectedEspessura);

  useEffect(() => {
    setMaterialTipo(project.material.tipo);
  }, [project.material.tipo]);

  useEffect(() => {
    setEspessuraUI(selectedEspessura);
  }, [selectedEspessura]);

  // Móveis = Catálogo CAD (biblioteca) — sempre dentro do LeftPanel
  if (activeTab === LEFT_TOOLBAR_IDS.MOVEIS) {
    return (
      <div className="left-panel-content">
        <PainelMoveis />
      </div>
    );
  }

  // Modelos = Instâncias dentro da caixa atual
  if (activeTab === LEFT_TOOLBAR_IDS.MODELOS) {
    return (
      <div className="left-panel-content">
        <PainelModelosDaCaixa />
      </div>
    );
  }

  // Calculadora — criar e apagar caixas
  if (activeTab === LEFT_TOOLBAR_IDS.CALCULADORA) {
    return (
      <div className="left-panel-content">
      <aside className="panel-content panel-content--side">
        <div className="section-title">Calculadora</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Criar e gerir caixas do projeto.
        </p>
        <Panel title="Caixas">
          <button
            type="button"
            onClick={() => actions.addWorkspaceBox()}
            className="button button-ghost"
            style={{ width: "100%", marginBottom: 12 }}
          >
            Adicionar caixote
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {project.workspaceBoxes.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Nenhuma caixa. Clique em &quot;Adicionar caixote&quot;.
              </p>
            ) : (
              project.workspaceBoxes.map((box) => {
                const isSelected = box.id === project.selectedWorkspaceBoxId;
                return (
                  <div
                    key={box.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      background: isSelected ? "rgba(56, 189, 248, 0.12)" : "var(--surface)",
                      border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      borderRadius: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => actions.selectBox(box.id)}
                      className="panel-button"
                      style={{
                        flex: 1,
                        textAlign: "left",
                        padding: "6px 8px",
                        background: "transparent",
                        border: "none",
                      }}
                    >
                      {box.nome} — {box.dimensoes.largura}×{box.dimensoes.altura}×{box.dimensoes.profundidade} mm
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.removeWorkspaceBoxById(box.id)}
                      className="panel-button"
                      style={{ padding: "4px 8px", fontSize: 11 }}
                      title="Apagar caixa"
                    >
                      Apagar
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
        <button
          type="button"
          onClick={() => actions.gerarDesign()}
          disabled={project.estaCarregando}
          className="button button-primary"
          style={{ width: "100%", marginTop: 8 }}
        >
          {project.estaCarregando ? "A calcular…" : "Gerar Design 3D"}
        </button>
      </aside>
      </div>
    );
  }

  // Layout — placeholder (cores chão/parede futuro)
  if (activeTab === LEFT_TOOLBAR_IDS.LAYOUT) {
    return (
      <div className="left-panel-content">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Layout</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            Cores de chão e parede (em breve).
          </p>
        </aside>
      </div>
    );
  }

  // Eletrodomésticos — placeholder
  if (activeTab === LEFT_TOOLBAR_IDS.ELETRO) {
    return (
      <div className="left-panel-content">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Eletrodomésticos</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            Modelos 3D de eletrodomésticos (em breve).
          </p>
        </aside>
      </div>
    );
  }

  // Acessórios — placeholder
  if (activeTab === LEFT_TOOLBAR_IDS.ACESSORIOS) {
    return (
      <div className="left-panel-content">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Acessórios</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            Acessórios (em breve).
          </p>
        </aside>
      </div>
    );
  }

  // Info — ajuda / como funciona
  if (activeTab === LEFT_TOOLBAR_IDS.INFO) {
    return (
      <div className="left-panel-content">
      <aside className="panel-content panel-content--side">
        <div className="section-title">Info</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Como funciona o PIMO.
        </p>
        <Panel title="Fluxo básico" description="Criar projeto e ver resultado 3D.">
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: "var(--text-muted)" }}>
            <li>Use <strong>Página inicial</strong> para definir nome, tipo, material e dimensões.</li>
            <li>Use <strong>Calculadora</strong> para adicionar caixas e gerar design.</li>
            <li>Use <strong>Móveis</strong> ou <strong>Modelos</strong> para adicionar modelos 3D (GLB) às caixas.</li>
            <li>O painel direito permite gerar design, adicionar/remover caixas e exportar PDF.</li>
          </ol>
        </Panel>
        <Panel title="Modelos CAD" description="Admin → Modelos CAD para registar ficheiros GLB.">
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Em Admin pode carregar ficheiros .glb; depois aparecem em Móveis/Modelos para adicionar à caixa.
          </p>
        </Panel>
      </aside>
      </div>
    );
  }

  // Página inicial (HOME)
  return (
    <div className="left-panel-content">
    <aside className="panel-content panel-content--side">
      <div className="section-title">
        {selectedBox
          ? `Caixa selecionada: ${selectedBox.nome}`
          : "Definições"}
      </div>
      {selectedBox && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Edite largura, altura, profundidade, prateleiras e material abaixo.
        </p>
      )}

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

      {/* Material */}
      <Panel title="Material">
        <div style={{ marginBottom: 8 }}>
          <select
            value={materialTipo}
            onChange={(e) => {
              const value = e.target.value;
              setMaterialTipo(value);
              actions.setMaterial({
                ...project.material,
                tipo: value,
              });
              if (project.selectedWorkspaceBoxId) {
                viewerApi?.updateBox(project.selectedWorkspaceBoxId, { materialName: value });
              }
            }}
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
          onChange={(e) => {
            const value = Number(e.target.value);
            setEspessuraUI(value);
            actions.setEspessura(value);
            if (project.selectedWorkspaceBoxId) {
              viewerApi?.updateBox(project.selectedWorkspaceBoxId, {
                thickness: mmToM(value),
              });
            }
          }}
          className="select"
        >
          <option value={15}>15mm</option>
          <option value={18}>18mm</option>
          <option value={19}>19mm</option>
          <option value={25}>25mm</option>
        </select>
      </Panel>

      {/* Tipo de borda e fundo */}
      <Panel title="Tipo de borda" description="Acabamento da borda da chapa">
        <select
          value={selectedBox?.tipoBorda ?? "reta"}
          onChange={(e) => {
            const value = e.target.value as "reta" | "biselada" | "arredondada";
            actions.setTipoBorda(value);
          }}
          className="select"
        >
          <option value="reta">Reta</option>
          <option value="biselada">Biselada</option>
          <option value="arredondada">Arredondada</option>
        </select>
      </Panel>

      <Panel title="Tipo de fundo" description="Montagem do fundo da caixa">
        <select
          value={selectedBox?.tipoFundo ?? "recuado"}
          onChange={(e) => {
            const value = e.target.value as "integrado" | "recuado" | "sem_fundo";
            actions.setTipoFundo(value);
          }}
          className="select"
        >
          <option value="integrado">Integrado</option>
          <option value="recuado">Recuado</option>
          <option value="sem_fundo">Sem fundo</option>
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
              onChange={(e) => {
                const value = Number(e.target.value);
                actions.setDimensoes({ largura: value });
                if (project.selectedWorkspaceBoxId) {
                  viewerApi?.updateBox(project.selectedWorkspaceBoxId, { width: mmToM(value) });
                }
              }}
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
              onChange={(e) => {
                const value = Number(e.target.value);
                actions.setDimensoes({ altura: value });
                if (project.selectedWorkspaceBoxId) {
                  viewerApi?.updateBox(project.selectedWorkspaceBoxId, { height: mmToM(value) });
                }
              }}
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
              onChange={(e) => {
                const value = Number(e.target.value);
                actions.setDimensoes({ profundidade: value });
                if (project.selectedWorkspaceBoxId) {
                  viewerApi?.updateBox(project.selectedWorkspaceBoxId, { depth: mmToM(value) });
                }
              }}
              className="input input-xs"
            />
          </div>
        </div>
      </Panel>

      <Panel title="Prateleiras" description="Quantidade (paramétrico); use modelos GLB para representação 3D.">
        <input
          type="number"
          min="0"
          value={selectedPrateleiras}
          onChange={(e) => actions.setPrateleiras(Number(e.target.value))}
          className="input input-sm"
        />
      </Panel>

    </aside>
    </div>
  );
}
