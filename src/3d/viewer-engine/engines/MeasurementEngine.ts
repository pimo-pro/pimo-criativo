import { MeasurementEngine } from "../measurement/MeasurementEngine";
import type { MeasurementEngineDeps } from "../measurement/MeasurementEngine";

export function createViewerMeasurementEngine(controller: MeasurementEngineDeps): MeasurementEngine {
  return new MeasurementEngine(controller);
}

export function ensureViewerMeasurementEngine(
  current: MeasurementEngine | null,
  controller: MeasurementEngineDeps,
): MeasurementEngine {
  return current ?? createViewerMeasurementEngine(controller);
}

