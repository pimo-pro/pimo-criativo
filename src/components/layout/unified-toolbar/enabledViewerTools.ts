import type { Tool3DId } from "../../../constants/toolbarConfig";

const INDUSTRIAL_TOOLS: Tool3DId[] = ["select", "move", "rotate"];
const SCALABLE_TOOLS: Tool3DId[] = ["select", "move", "rotate", "scale"];

/**
 * Ferramentas activas na UnifiedTopToolbar.
 * Scale só entra para elementos não-industriais (GLB / cadOnly).
 */
export function resolveEnabledViewerTools(input: {
  pieceLocked: boolean;
  remateSelected: boolean;
  nonIndustrialScalable: boolean;
}): Tool3DId[] {
  if (input.pieceLocked && !input.remateSelected) return ["select"];
  if (input.remateSelected) return INDUSTRIAL_TOOLS;
  if (input.nonIndustrialScalable) return SCALABLE_TOOLS;
  return INDUSTRIAL_TOOLS;
}
