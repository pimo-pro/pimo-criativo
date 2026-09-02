import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type SelectedObject =
  | { type: "none" }
  | { type: "box"; id: string }
  | { type: "remate"; id: string }
  | { type: "rodape"; id: string }
  | { type: "wall"; id: string }
  | { type: "roomElement"; id: string }
  | { type: "roomUtility"; id: string };

export interface UiStoreState {
  selectedTool: string;
  selectedObject: SelectedObject;
  /** IDs codificados (box:, door:, remate:, etc.) para multi-seleção. */
  selectedObjects: string[];
  /** Painel esquerdo: definições de captura (Photo Mode); o viewport principal é a pré-visualização. */
  photoModePanelOpen: boolean;
  setPhotoModePanelOpen: (_open: boolean) => void;
  /** Painel esquerdo: configurações da sala (pimo-room / Salão). */
  roomPanelOpen: boolean;
  setRoomPanelOpen: (_open: boolean) => void;
  /** Painel lateral da Workspace Industrial de Design (furos / validação). */
  industrialDesignPanelOpen: boolean;
  setIndustrialDesignPanelOpen: (_open: boolean) => void;
  setSelectedTool: (_toolId: string) => void;
  setSelectedObject: (_selected: SelectedObject) => void;
  setSelectedObjects: (_ids: string[]) => void;
  toggleSelectedObject: (_id: string) => void;
  addSelectedObject: (_id: string) => void;
  removeSelectedObject: (_id: string) => void;
  clearSelection: () => void;
  clearMultiSelection: () => void;
}

const logUiStore = (event: string, payload?: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  console.info("[uiStore]", event, payload ?? {});
};

function isValidSelectedObject(value: SelectedObject): boolean {
  if (!value || typeof value !== "object" || typeof value.type !== "string") return false;
  if (value.type === "none") return true;
  return typeof (value as { id?: unknown }).id === "string" && ((value as { id: string }).id?.trim()?.length ?? 0) > 0;
}

export const uiStore = createStore<UiStoreState>((set) => ({
  selectedTool: "home",
  selectedObject: { type: "none" },
  selectedObjects: [],
  photoModePanelOpen: false,
  roomPanelOpen: false,
  industrialDesignPanelOpen: false,
  setPhotoModePanelOpen: (open) => {
    set((state) => {
      if (state.photoModePanelOpen === open) return state;
      return { ...state, photoModePanelOpen: open, roomPanelOpen: open ? false : state.roomPanelOpen };
    });
  },
  setRoomPanelOpen: (open) => {
    set((state) => {
      if (state.roomPanelOpen === open) return state;
      return { ...state, roomPanelOpen: open, photoModePanelOpen: open ? false : state.photoModePanelOpen };
    });
  },
  setIndustrialDesignPanelOpen: (open) => {
    set((state) => {
      if (state.industrialDesignPanelOpen === open) return state;
      return { ...state, industrialDesignPanelOpen: open };
    });
  },
  setSelectedTool: (toolId) => {
    set((state) => {
      if (state.selectedTool === toolId) return state;
      return { ...state, selectedTool: toolId };
    });
  },
  setSelectedObject: (selected) => {
    if (!isValidSelectedObject(selected)) {
      logUiStore("invalid-selected-object", { selected });
      return;
    }
    set((state) => {
      if (
        state.selectedObject.type === selected.type &&
        ((state.selectedObject.type === "none" && selected.type === "none") ||
          (state.selectedObject.type !== "none" &&
            selected.type !== "none" &&
            state.selectedObject.id === selected.id))
      ) {
        return state;
      }
      return { ...state, selectedObject: selected };
    });
  },
  setSelectedObjects: (ids) => {
    const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0)));
    set((state) => {
      if (
        state.selectedObjects.length === unique.length &&
        state.selectedObjects.every((id, i) => id === unique[i])
      ) {
        return state;
      }
      return { ...state, selectedObjects: unique };
    });
  },
  toggleSelectedObject: (id) => {
    if (!id?.trim()) return;
    set((state) => {
      const exists = state.selectedObjects.includes(id);
      const selectedObjects = exists
        ? state.selectedObjects.filter((item) => item !== id)
        : [...state.selectedObjects, id];
      return { ...state, selectedObjects };
    });
  },
  addSelectedObject: (id) => {
    if (!id?.trim()) return;
    set((state) => {
      if (state.selectedObjects.includes(id)) return state;
      return { ...state, selectedObjects: [...state.selectedObjects, id] };
    });
  },
  removeSelectedObject: (id) => {
    set((state) => {
      if (!state.selectedObjects.includes(id)) return state;
      return { ...state, selectedObjects: state.selectedObjects.filter((item) => item !== id) };
    });
  },
  clearSelection: () => {
    set((state) => {
      if (state.selectedObject.type === "none" && state.selectedObjects.length === 0) return state;
      return { ...state, selectedObject: { type: "none" }, selectedObjects: [] };
    });
  },
  clearMultiSelection: () => {
    set((state) => {
      if (state.selectedObjects.length === 0) return state;
      return { ...state, selectedObjects: [] };
    });
  },
}));

export function useUiStore<T>(selector: (_state: UiStoreState) => T): T {
  return useStore(uiStore, selector);
}
