import { useCallback, useMemo } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { useWallStore } from "../../../stores/wallStore";import { uiStore, useUiStore } from "../../../stores/uiStore";
import { LEFT_TOOLBAR_IDS } from "../../layout/left-toolbar/LeftToolbar";
import {
  applyProjectRoomDimensions,
  createDefaultProjectRoom,
} from "../../../3d/viewer-engine/room/RoomEngine";
import { hasPersistedRoomWalls } from "../../../utils/roomWorkspaceBounds";
import { Icon } from "@/components/icons";

/** Atalho na toolbar: mesmas dimensões padrão ao criar sala instantaneamente. */
const DEFAULT_ROOM_WIDTH_M = 4;
const DEFAULT_ROOM_DEPTH_M = 3;
const DEFAULT_ROOM_HEIGHT_M = 2.4;

export default function RoomIconButton() {
  const { viewerApi } = usePimoViewerContext();
  const { actions } = useProject();
  const setSelectedTool = useUiStore((state) => state.setSelectedTool);
  const walls = useWallStore((state) => state.walls);

  const roomPresent = useMemo(() => {
    if (viewerApi?.getRoomExists?.()) return true;
    return hasPersistedRoomWalls(walls);
  }, [viewerApi, walls]);

  const isActive = roomPresent;

  const handleClick = useCallback(() => {
    if (!roomPresent) {
      const base = createDefaultProjectRoom();
      const room = applyProjectRoomDimensions({
        ...base,
        widthMm: DEFAULT_ROOM_WIDTH_M * 1000,
        depthMm: DEFAULT_ROOM_DEPTH_M * 1000,
        heightMm: DEFAULT_ROOM_HEIGHT_M * 1000,
      });
      actions.setProjectRoom(room);
      // Navigate to HOME so room settings appear in the Início section
      setSelectedTool(LEFT_TOOLBAR_IDS.HOME);
      const scheduleReposition = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            actions.repositionWorkspaceBoxesInsideRoom();
          });
        });
      };
      scheduleReposition();
      return;
    }
    // Room already exists: toggle to SALA tab to show/manage settings
    const currentTool = uiStore.getState().selectedTool;
    if (currentTool === LEFT_TOOLBAR_IDS.SALA) {
      setSelectedTool(LEFT_TOOLBAR_IDS.HOME);
    } else {
      setSelectedTool(LEFT_TOOLBAR_IDS.SALA);
    }
  }, [actions, roomPresent, setSelectedTool, viewerApi]);

  /** Mesmo encaixe que `unifiedBubbleStyle` na barra unificada. */
  const bubbleStyle = {
    width: 28,
    height: 28,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    border: "none" as const,
    borderRadius: 4,
    cursor: "pointer" as const,
    marginLeft: 3,
    color: "var(--status-done-color)",
    background: isActive ? "var(--toolbar-pressed-bg)" : "transparent",
  };

  return (
    <button
      type="button"
      title={roomPresent ? "Remover sala e fechar painel" : "Criar sala (4×3×2,4 m) e abrir painel"}
      aria-label={roomPresent ? "Remover sala" : "Criar sala"}
      aria-pressed={isActive}
      onClick={handleClick}
      style={bubbleStyle}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? "var(--toolbar-pressed-bg)" : "transparent";
      }}
    >
      <Icon name="room" size={24} aria-hidden />
    </button>
  );
}
