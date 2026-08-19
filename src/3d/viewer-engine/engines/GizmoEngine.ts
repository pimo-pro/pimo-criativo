import { GizmoEngine } from "../tools/GizmoEngine";
import type { ViewerTools } from "../tools/ViewerTools";

export function createViewerGizmoEngine(viewerTools: ViewerTools): GizmoEngine {
  return new GizmoEngine(viewerTools);
}
