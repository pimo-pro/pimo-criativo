import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type SelectedObject =
  | { type: "none" }
  | { type: "box"; id: string }
  | { type: "wall"; id: string }
  | { type: "roomElement"; id: string };

export interface UiStoreState {
  selectedTool: string;
  selectedObject: SelectedObject;
  setSelectedTool: (toolId: string) => void;
  setSelectedObject: (selected: SelectedObject) => void;
  clearSelection: () => void;
}

export const uiStore = createStore<UiStoreState>((set) => ({
  selectedTool: "layout",
  selectedObject: { type: "none" },
  setSelectedTool: (toolId) => {
    set({ selectedTool: toolId });
  },
  setSelectedObject: (selected) => {
    set({ selectedObject: selected });
  },
  clearSelection: () => {
    set({ selectedObject: { type: "none" } });
  },
}));

export function useUiStore<T>(selector: (state: UiStoreState) => T): T {
  return useStore(uiStore, selector);
}
