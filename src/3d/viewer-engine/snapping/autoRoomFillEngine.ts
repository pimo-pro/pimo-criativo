import type { SmartLayoutEngineDeps } from "./smartLayoutTypes";

/**
 * Auto-Room-Fill 3D — adapter do LayoutEngine.
 * Delega exclusivamente ao Kitchen 3.0 (`runProjectRoomFill`) via bridge de projecto.
 */
export class AutoRoomFillEngine {
  private readonly deps: SmartLayoutEngineDeps;

  constructor(deps: SmartLayoutEngineDeps) {
    this.deps = deps;
  }

  /** Preenchimento completo via Kitchen Layout 3.0 (canal de projecto). */
  fillRoom(_seedBoxId?: string): boolean {
    const bridge = this.deps.getBridge();
    if (!bridge) return false;
    return bridge.runProjectRoomFill?.() ?? false;
  }
}
