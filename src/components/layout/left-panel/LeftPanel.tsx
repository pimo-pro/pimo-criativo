import { useEffect, useState } from "react";
import { useProject } from "../../../context/useProject";
import { LEFT_TOOLBAR_IDS } from "../left-toolbar/LeftToolbar";
import PainelMoveisUnificado from "./PainelMoveisUnificado";
import PainelModelosDaCaixa from "./PainelModelosDaCaixa";
import { useUiStore } from "../../../stores/uiStore";
import type { SavedProjectInfo } from "../../../context/projectTypes";
import { InfoPanelContent } from "./InfoPanelContent";
import { PlaceholderLeftPanel } from "./PlaceholderLeftPanel";
import { LeftPanelCalculadora } from "./LeftPanelCalculadora";
import { HomeLeftPanelEmpty } from "./HomeLeftPanelEmpty";
import { HomeLeftPanelSelected } from "./HomeLeftPanelSelected";
import RematePropertiesPanel from "../../settings/remate/RematePropertiesPanel";
import RodapePropertiesPanel from "../../settings/rodape/RodapePropertiesPanel";
import { useMaterialsForPicker } from "./hooks/useMaterialsForPicker";
import PhotoModeSettingsContent from "./PhotoModeSettingsContent";
import PainelSala from "./PainelSala";

export type LeftPanelProps = {
  activeTab?: string;
};

export default function LeftPanel({ activeTab = "home" }: LeftPanelProps) {
  const photoModePanelOpen = useUiStore((state) => state.photoModePanelOpen);
  const roomPanelOpen = useUiStore((state) => state.roomPanelOpen);
  const selectedTool = useUiStore((state) => state.selectedTool);
  const selectedObject = useUiStore((state) => state.selectedObject);
  const { project, actions } = useProject();
  const selectedBox = project.workspaceBoxes.find(
    (box) => box.id === project.selectedWorkspaceBoxId
  );

  const materialsPicker = useMaterialsForPicker();
  const [savedRecentProjects, setSavedRecentProjects] = useState<SavedProjectInfo[]>([]);
  const [loadingSavedRecent, setLoadingSavedRecent] = useState(false);

  useEffect(() => {
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      setSavedRecentProjects([]);
      setLoadingSavedRecent(false);
      return;
    }
    let active = true;
    const loadRecent = async () => {
      setLoadingSavedRecent(true);
      try {
        const projects = await actions.listSavedProjects("mine");
        if (active) setSavedRecentProjects(projects.slice(0, 4));
      } finally {
        if (active) setLoadingSavedRecent(false);
      }
    };
    void loadRecent();
    return () => {
      active = false;
    };
  }, [actions, project.lastAutosaveTime]);

  const resolvedTabRaw = selectedTool ?? activeTab;
  const resolvedTab =
    resolvedTabRaw === LEFT_TOOLBAR_IDS.LAYOUT ? LEFT_TOOLBAR_IDS.HOME : resolvedTabRaw;

  if (photoModePanelOpen) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <PhotoModeSettingsContent />
        </div>
      </div>
    );
  }

  if (roomPanelOpen || selectedObject.type === "wall" || selectedObject.type === "roomElement") {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <PainelSala />
        </div>
      </div>
    );
  }

  if (selectedObject.type === "remate") {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <RematePropertiesPanel remateId={selectedObject.id} />
        </div>
      </div>
    );
  }

  if (selectedObject.type === "rodape") {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <RodapePropertiesPanel rodapeId={selectedObject.id} />
        </div>
      </div>
    );
  }

  // Móveis = painel unificado
  if (resolvedTab === LEFT_TOOLBAR_IDS.MOVEIS) {
    return <PainelMoveisUnificado />;
  }

  // Modelos = Instâncias dentro da caixa atual
  if (resolvedTab === LEFT_TOOLBAR_IDS.MODELOS) {
    return (
      <div className="left-panel-content">
        <div className="left-panel-scroll">
          <PainelModelosDaCaixa />
        </div>
      </div>
    );
  }

  // Calculadora — criar e apagar caixas
  if (resolvedTab === LEFT_TOOLBAR_IDS.CALCULADORA) {
    return <LeftPanelCalculadora />;
  }

  if (resolvedTab === LEFT_TOOLBAR_IDS.SALA) {
    return (
      <PlaceholderLeftPanel
        title="Sala"
        description="O planeador de sala está em reconstrução. Em breve estará disponível um sistema novo."
      />
    );
  }

  // Eletrodomésticos — placeholder
  if (resolvedTab === LEFT_TOOLBAR_IDS.ELETRO) {
    return (
      <PlaceholderLeftPanel
        title="Eletrodomésticos"
        description="Modelos 3D de eletrodomésticos em preparação."
      />
    );
  }

  // Acessórios — catálogo de orlas no Viewer desativado (industrial/Admin mantém presets).
  if (resolvedTab === LEFT_TOOLBAR_IDS.ACESSORIOS) {
    return (
      <PlaceholderLeftPanel
        title="Acessórios"
        description="A visualização e edição de ORLA no Viewer está temporariamente desativada. Presets e cálculo industrial continuam ativos em Admin → Ferragens."
      />
    );
  }

  // Info — ajuda / como funciona (estrutura com tabs para futura Info Técnica)
  if (resolvedTab === LEFT_TOOLBAR_IDS.INFO) {
    return (
      <InfoPanelContent />
    );
  }

  if (resolvedTab === LEFT_TOOLBAR_IDS.HOME && !selectedBox) {
    return (
      <HomeLeftPanelEmpty
        loadingSavedRecent={loadingSavedRecent}
        savedRecentProjects={savedRecentProjects}
      />
    );
  }

  // Página inicial (HOME) com caixa selecionada — e fallback quando outras tabs não aplicam
  return <HomeLeftPanelSelected materialsPicker={materialsPicker} />;
}
