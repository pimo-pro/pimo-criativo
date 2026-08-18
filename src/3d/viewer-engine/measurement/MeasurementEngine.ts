import type { UnifiedMeasurement } from "./unifiedMeasurementTypes";
import {
  UnifiedMeasurementEngine,
  type UnifiedMeasurementEngineDeps,
} from "./UnifiedMeasurementEngine";
import { createInternalRulerFacade, type InternalRulerFacade } from "./internalRulerFacade";

export type MeasurementEngineDeps = UnifiedMeasurementEngineDeps;

/**
 * Motor canónico de medição do Viewer (Z-01.2.2).
 * Único ponto de verdade para a régua: overlay 2D, dois pontos, régua de movimento.
 * A implementação vive em `UnifiedMeasurementEngine`; o ViewerCore só fala com esta fachada.
 */
export class MeasurementEngine {
  readonly engine: UnifiedMeasurementEngine;
  readonly facade: InternalRulerFacade;

  constructor(deps: MeasurementEngineDeps) {
    this.engine = new UnifiedMeasurementEngine(deps);
    this.facade = createInternalRulerFacade(this.engine);
  }

  setEnabled(enabled: boolean): void {
    this.engine.setEnabled(enabled);
  }

  isEnabled(): boolean {
    return this.engine.isEnabled();
  }

  isActive(): boolean {
    return this.engine.isActive();
  }

  syncFromProject(entries: UnifiedMeasurement[]): void {
    this.engine.syncFromProject(entries);
  }

  onSceneContentChanged(): void {
    this.engine.onSceneContentChanged();
  }

  onSelectionChanged(nextBoxId: string | null): void {
    this.engine.onSelectionChanged(nextBoxId);
  }

  onRulerMovementTick(source: "transform" | "external"): void {
    this.engine.onRulerMovementTick(source);
  }

  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.engine.dispose();
  }
}
