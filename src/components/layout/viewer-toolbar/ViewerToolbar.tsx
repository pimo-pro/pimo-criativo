/**
 * Toolbar superior do Viewer.
 * Ações principais do projeto.
 */

import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { useProject } from "../../../context/useProject";
import { defaultState } from "../../../context/projectState";
import { useToast } from "../../../context/ToastContext";
import { useToolbarModal } from "../../../context/ToolbarModalContext";
import { VIEWER_TOOLBAR_ITEMS } from "../../../constants/toolbarConfig";
import { subscribeProjectsSyncStatus } from "../../../core/projects/projectsClient";
import type { ToolbarActionId } from "../../../constants/toolbarConfig";
import ConfirmNewProjectModal from "../../modals/ConfirmNewProjectModal";
import { Icon } from "@/components/icons";

export type ViewerToolbarProps = {
  confirmNewOpen: boolean;
  setConfirmNewOpen: Dispatch<SetStateAction<boolean>>;
};

export default function ViewerToolbar({ confirmNewOpen, setConfirmNewOpen }: ViewerToolbarProps) {
  const { actions, project } = useProject();
  const { showToast } = useToast();
  const { openModal } = useToolbarModal();
  const autosaveRunningRef = useRef(false);
  const lastErrorToastAtRef = useRef(0);
  const lastPendingToastAtRef = useRef(0);
  const lastOfflineToastAtRef = useRef(0);
  const lastSavedLocalToastKeyRef = useRef<string>("");
  const previousSyncStateRef = useRef<string>("");

  useEffect(() => {
    const unsub = subscribeProjectsSyncStatus((status) => {
      const now = Date.now();
      const syncStateKey = `${status.state}|${status.pending}|${status.online}`;
      const isStateTransition = previousSyncStateRef.current !== syncStateKey;
      previousSyncStateRef.current = syncStateKey;

      if (status.state === "saved_local") {
        const baseKey = `${status.state}|${status.message}`;
        if (lastSavedLocalToastKeyRef.current === baseKey) return;
        lastSavedLocalToastKeyRef.current = baseKey;
        showToast("Guardado", "info", 2200);
        if (status.message === "Projeto guardado localmente" || status.message === "Snapshot criado") {
          showToast(status.message, "info", 2800);
        }
        return;
      }

      if (!status.online || status.state === "awaiting_network") {
        if (now - lastOfflineToastAtRef.current >= 60000) {
          lastOfflineToastAtRef.current = now;
          showToast("Offline (guardado localmente)", "warning", 3200);
        }
        return;
      }

      if (status.state === "error") {
        if (isStateTransition || now - lastErrorToastAtRef.current >= 60000) {
          lastErrorToastAtRef.current = now;
          showToast("Erro ao sincronizar", "error", 4000);
        }
        return;
      }

      if (status.state === "idle" && status.pending > 0) {
        if (isStateTransition || now - lastPendingToastAtRef.current >= 60000) {
          lastPendingToastAtRef.current = now;
          showToast(`${status.pending} operação(ões) pendente(s)`, "warning", 3200);
        }
        return;
      }

      if (status.state === "synced" && status.pending === 0 && isStateTransition) {
        showToast("Sincronizado", "info", 2200);
      }
    });
    return () => unsub();
  }, [showToast]);

  const viewerToolbarItems = useMemo(
    () =>
      VIEWER_TOOLBAR_ITEMS.filter(
        (item) =>
          item.id !== "novo" &&
          item.id !== "projeto" &&
          item.id !== "desfazer" &&
          item.id !== "refazer" &&
          item.id !== "imagem" &&
          item.id !== "reset-camera" &&
          item.id !== "enviar"
      ),
    []
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!project.lastAutosaveTime) return true;
    const savedAt = Date.parse(project.lastAutosaveTime);
    if (!Number.isFinite(savedAt)) return true;
    return project.changelog.some((entry) => {
      const ts = entry.timestamp instanceof Date ? entry.timestamp.getTime() : Date.parse(String(entry.timestamp));
      return Number.isFinite(ts) && ts > savedAt;
    });
  }, [project.lastAutosaveTime, project.changelog]);

  /** Modal "Novo Projeto" quando há conteúdo real, não só changelog/autosave. */
  const projectHasNonDefaultState = useMemo(() => {
    if (project.workspaceBoxes.length > 0) return true;
    if ((project.projectName?.trim() || "") !== defaultState.projectName) return true;
    if (project.room) return true;
    return false;
  }, [project.workspaceBoxes.length, project.projectName, project.room]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (autosaveRunningRef.current) return;
      if (project.estaCarregando) return;
      if (confirmNewOpen) return;
      if (!hasUnsavedChanges) return;
      autosaveRunningRef.current = true;
      Promise.resolve(actions.gerarESalvarDesign())
        .catch(() => {
          /* autosave silencioso */
        })
        .finally(() => {
          autosaveRunningRef.current = false;
        });
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [actions, project.estaCarregando, hasUnsavedChanges, confirmNewOpen]);

  const handleAction = (id: ToolbarActionId) => {
    if (id === "projeto") {
      openModal("projects");
      return;
    }
    if (id === "novo") {
      if (projectHasNonDefaultState) {
        setConfirmNewOpen(true);
      } else {
        void actions.createNewProject();
      }
      return;
    }
  };

  const handleSaveBeforeNew = async () => {
    await actions.gerarESalvarDesign();
    await actions.createNewProject();
    setConfirmNewOpen(false);
  };

  const handleDiscardBeforeNew = async () => {
    await actions.createNewProject();
    setConfirmNewOpen(false);
  };

  const handleCancelBeforeNew = () => {
    setConfirmNewOpen(false);
  };

  return (
    <div className="viewer-toolbar" role="toolbar" aria-label="Ações do Viewer">
      {viewerToolbarItems.map((item) => {
        return (
          <button
            key={item.id}
            type="button"
            title={item.tooltip}
            aria-label={item.tooltip}
            onClick={() => handleAction(item.id)}
            style={{ fontSize: 12 }}
          >
            <span className="viewer-toolbar-icon" aria-hidden>
              <Icon name={item.iconName} size={24} aria-hidden />
            </span>
          </button>
        );
      })}
      <ConfirmNewProjectModal
        open={confirmNewOpen}
        onSave={() => void handleSaveBeforeNew()}
        onDiscard={() => void handleDiscardBeforeNew()}
        onCancel={handleCancelBeforeNew}
      />
    </div>
  );
}
