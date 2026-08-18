/**
 * Módulo de seleção (estado selectedBoxId + seleção interna) do Viewer Engine.
 */
export { ViewerSelectionManager } from "./SelectionManager";
export type {
  InternalSelectionHit,
  InternalSelectionState,
  InternalSelectionType,
} from "./internalSelectionTypes";
export { cloneInternalSelectionState } from "./internalSelectionTypes";
export { InternalSelectionOutline } from "./InternalSelectionOutline";
export { SelectionEngine } from "./SelectionEngine";
