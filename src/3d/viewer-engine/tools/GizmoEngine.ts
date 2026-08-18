/**
 * GizmoEngine (Z-01.2.7 B) — attachment do TransformControls / GroupGizmo.
 * Delega ao ViewerTools existente; o clamp continua a chamar SnapEngine no Core.
 */
import type { ViewerTools } from "./ViewerTools";

export class GizmoEngine {
  private readonly tools: ViewerTools;

  constructor(tools: ViewerTools) {
    this.tools = tools;
  }

  refreshAttachment(): void {
    this.tools.updateTransformControlsAttachment();
  }

  restorePivot(): void {
    this.tools.restoreTransformGizmoPivot();
  }
}
