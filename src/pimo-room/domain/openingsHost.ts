/**
 * Host de teclado/selecção para portas e janelas (aberturas).
 * Comportamento alinhado a CatalogItem: setas, Shift+setas, Q/E, Delete, Ctrl+D.
 */
import type { DoorWindowConfig } from "../mesh/impl/types";
import type { ProjectRoomConfig, ProjectRoomOpening } from "../../3d/viewer-engine/room/roomEngineTypes";
import { uiStore } from "../../stores/uiStore";
import { OpeningsEngine } from "./OpeningsEngine";
import { RoomConverter } from "./RoomConverter";
import {
  getRoomEngineViewerApi,
  roomEngineStore,
} from "./roomEngineStore";
import type { RoomState } from "./RoomState";

let listenersAttached = false;

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

function getSelectedOpeningId(): string | null {
  const api = getRoomEngineViewerApi();
  const fromViewer =
    (api as { viewerState?: { getSelectedRoomElementId?: () => string | null } } | null)?.viewerState
      ?.getSelectedRoomElementId?.() ?? null;
  if (fromViewer) return fromViewer;
  const sel = uiStore.getState().selectedObject;
  if (sel.type === "roomElement") return sel.id;
  return null;
}

function openingToDoorConfig(o: ProjectRoomOpening): DoorWindowConfig {
  return {
    widthMm: o.widthMm,
    heightMm: o.heightMm,
    thicknessMm: o.thicknessMm,
    kind: o.kind,
    floorOffsetMm: o.floorOffsetMm,
    horizontalOffsetMm: o.horizontalOffsetMm,
  };
}

export type OpeningKeyboardHandlers = {
  getProjectRoom: () => ProjectRoomConfig | null | undefined;
  setProjectRoom: (room: ProjectRoomConfig) => void;
};

let handlers: OpeningKeyboardHandlers | null = null;

export function registerOpeningKeyboardHandlers(next: OpeningKeyboardHandlers | null): void {
  handlers = next;
}

function ensureEngineFromProject(room: ProjectRoomConfig): RoomState {
  const store = roomEngineStore.getState();
  if (store.roomState) {
    // Preferir RoomState se IDs batem com a selecção
    return store.roomState;
  }
  return RoomConverter.fromProjectRoomConfig(room);
}

function syncViewerOpening(opening: ProjectRoomOpening, wallIndex: number): void {
  const api = getRoomEngineViewerApi();
  if (!api?.updateRoomElementConfig) return;
  const ok = api.updateRoomElementConfig(opening.id, openingToDoorConfig(opening));
  if (ok) return;
  if (opening.type === "door") {
    api.addDoorToRoom?.(wallIndex, openingToDoorConfig(opening), opening.id);
  } else {
    api.addWindowToRoom?.(wallIndex, openingToDoorConfig(opening), opening.id);
  }
}

function commitState(next: RoomState, focusId?: string | null): void {
  roomEngineStore.getState().setRoomState(next);
  const project = RoomConverter.toProjectRoomConfig(next);
  handlers?.setProjectRoom(project);
  if (focusId) {
    const opening = project.openings.find((o) => o.id === focusId);
    if (opening) {
      const wallIndex = project.walls.findIndex((w) => w.id === opening.wallId);
      if (wallIndex >= 0) syncViewerOpening(opening, wallIndex);
    }
    uiStore.getState().setSelectedObject({ type: "roomElement", id: focusId });
    getRoomEngineViewerApi()?.selectRoomElementById?.(focusId);
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (isEditableTarget(e.target)) return;
  if (roomEngineStore.getState().walkthroughActive) return;
  const openingId = getSelectedOpeningId();
  if (!openingId) return;

  const room = handlers?.getProjectRoom() ?? null;
  if (!room?.openings.some((o) => o.id === openingId)) return;

  const base = ensureEngineFromProject(room);
  // Garantir abertura no RoomState (pode existir só no ProjectRoom)
  let engine = base;
  if (!engine.openings.some((o) => o.id === openingId)) {
    engine = RoomConverter.fromProjectRoomConfig(room);
  }
  if (!engine.openings.some((o) => o.id === openingId)) return;

  const ctrl = e.ctrlKey || e.metaKey;
  const fast = e.shiftKey;
  const step = OpeningsEngine.nudgeStepMm(fast);

  if (ctrl && (e.code === "KeyD" || e.key.toLowerCase() === "d")) {
    e.preventDefault();
    const next = OpeningsEngine.duplicate(engine, openingId);
    const added = next.openings[next.openings.length - 1];
    commitState(next, added?.id ?? null);
    return;
  }

  if (e.code === "Delete" || e.code === "Backspace") {
    e.preventDefault();
    const next = OpeningsEngine.removeOpening(engine, openingId);
    roomEngineStore.getState().setRoomState(next);
    handlers?.setProjectRoom(RoomConverter.toProjectRoomConfig(next));
    uiStore.getState().clearSelection();
    getRoomEngineViewerApi()?.selectRoomElementById?.(null);
    return;
  }

  if (e.code === "KeyQ" || e.code === "KeyE") {
    e.preventDefault();
    const next = OpeningsEngine.rotate(engine, openingId, e.code === "KeyQ" ? -1 : 1);
    commitState(next, openingId);
    return;
  }

  let delta: { alongWallMm?: number; sillMm?: number } | null = null;
  if (e.code === "ArrowLeft") delta = { alongWallMm: -step };
  else if (e.code === "ArrowRight") delta = { alongWallMm: step };
  else if (e.code === "ArrowUp") delta = { sillMm: step };
  else if (e.code === "ArrowDown") delta = { sillMm: -step };

  if (!delta) return;
  e.preventDefault();
  const next = OpeningsEngine.nudge(engine, openingId, delta);
  commitState(next, openingId);
}

export function attachOpeningKeyboardListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  window.addEventListener("keydown", onKeyDown);
  listenersAttached = true;
}

export function detachOpeningKeyboardListeners(): void {
  if (!listenersAttached || typeof window === "undefined") return;
  window.removeEventListener("keydown", onKeyDown);
  listenersAttached = false;
}

/** Actualiza ProjectRoomOpening a partir do config da porta/janela (posição vinculada). */
export function patchProjectOpeningFromDoorConfig(
  room: ProjectRoomConfig,
  elementId: string,
  config: DoorWindowConfig
): ProjectRoomConfig {
  return {
    ...room,
    openings: room.openings.map((o) => {
      if (o.id !== elementId) return o;
      return {
        ...o,
        widthMm: config.widthMm,
        heightMm: config.heightMm,
        thicknessMm: config.thicknessMm ?? o.thicknessMm,
        kind: config.kind ?? o.kind,
        horizontalOffsetMm: config.horizontalOffsetMm,
        xPosMm: config.horizontalOffsetMm,
        floorOffsetMm: config.floorOffsetMm,
        verticalOffsetMm: config.floorOffsetMm,
      };
    }),
  };
}

/** Sync RoomState.opening.offsetAlongWallMm = door/window horizontalOffset. */
export function syncRoomStateOpeningFromConfig(
  state: RoomState,
  elementId: string,
  config: DoorWindowConfig
): RoomState {
  return OpeningsEngine.syncPositionFromDoorWindow(state, elementId, {
    offsetAlongWallMm: config.horizontalOffsetMm,
    sillMm: config.floorOffsetMm,
  });
}
