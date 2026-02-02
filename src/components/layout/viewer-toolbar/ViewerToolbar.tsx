/**
 * Toolbar superior do Viewer.
 * Ícones com cor clara (#f1f5f9) e hover (#ffffff); ações ligadas a viewerSync/actions/openModal.
 * PROJETO → modal projetos; SALVAR → saveProjectSnapshot (inclui viewerSync.saveViewerSnapshot);
 * DESFAZER/REFAZER → undo/redo; 2D/IMAGEM/ENVIAR → modais que usam viewerSync no RightToolsBar.
 */

import { useProject } from "../../../context/useProject";
import { useToolbarModal } from "../../../context/ToolbarModalContext";
import { VIEWER_TOOLBAR_ITEMS } from "../../../constants/toolbarConfig";
import type { ToolbarActionId } from "../../../constants/toolbarConfig";

export default function ViewerToolbar() {
  const { actions } = useProject();
  const { openModal } = useToolbarModal();

  const handleAction = (id: ToolbarActionId) => {
    if (id === "projeto") {
      openModal("projects");
      return;
    }
    if (id === "salvar") {
      actions.saveProjectSnapshot();
      return;
    }
    if (id === "desfazer") {
      actions.undo();
      return;
    }
    if (id === "refazer") {
      actions.redo();
      return;
    }
    if (id === "2d") {
      openModal("2d");
      return;
    }
    if (id === "imagem") {
      openModal("image");
      return;
    }
    if (id === "enviar") {
      openModal("send");
      return;
    }
  };

  return (
    <div className="viewer-toolbar" role="toolbar" aria-label="Ações do Viewer">
      {VIEWER_TOOLBAR_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.tooltip}
          aria-label={item.tooltip}
          onClick={() => handleAction(item.id)}
          style={{ fontSize: 12 }}
        >
          <span className="viewer-toolbar-icon" aria-hidden>
            {item.icon}
          </span>
        </button>
      ))}
    </div>
  );
}
