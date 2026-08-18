import type { FormatId, ProjectLoadInput } from "./normalizedProject";
import type { NormalizedProject, FormatValidationResult } from "./normalizedProject";
import type { ProjectState } from "../../../context/projectTypes";
import { FUTURE_CAD_FORMATS } from "./normalizedProject";
import { resolveJson } from "./jsonInput";
import { pimoProjectAdapter } from "./pimoProjectAdapter";
import { glbFormatAdapter } from "./glbFormatAdapter";
import { unsupportedCadAdapter } from "./unsupportedCadAdapter";

/**
 * Contrato de um adaptador de formato (Z-01.2.5).
 * O loader orquestra; o adapter converte para `NormalizedProject` em mm.
 * Não gera TCN/DRILL/PI.
 */
export type ProjectFormatAdapter = {
  id: FormatId;
  parse: (_input: ProjectLoadInput) => unknown;
  toNormalized: (_parsed: unknown) => NormalizedProject;
  validate: (_normalized: NormalizedProject) => FormatValidationResult;
  toProjectState: (_normalized: NormalizedProject) => ProjectState | null;
};

const ADAPTERS: Record<FormatId, ProjectFormatAdapter> = {
  "pimo-project": pimoProjectAdapter,
  glb: glbFormatAdapter,
  "json-externo": pimoProjectAdapter,
  dxf: unsupportedCadAdapter("dxf"),
  ifc: unsupportedCadAdapter("ifc"),
  step: unsupportedCadAdapter("step"),
};

export function getFormatAdapter(format: FormatId): ProjectFormatAdapter {
  return ADAPTERS[format];
}

export function detectFormat(input: ProjectLoadInput): FormatId | null {
  if (input.format) return input.format;

  const names = [input.fileName, input.url].filter((v): v is string => typeof v === "string" && v.length > 0);
  for (const name of names) {
    const lower = name.toLowerCase().split(/[?#]/)[0] ?? "";
    if (lower.endsWith(".glb") || lower.endsWith(".gltf") || lower.includes("model/gltf")) return "glb";
    if (lower.endsWith(".dxf")) return "dxf";
    if (lower.endsWith(".ifc")) return "ifc";
    if (lower.endsWith(".step") || lower.endsWith(".stp")) return "step";
    if (lower.endsWith(".json")) {
      const json = resolveJson(input);
      if (json && typeof json === "object" && !Array.isArray(json)) {
        const rec = json as Record<string, unknown>;
        if (Array.isArray(rec.workspaceBoxes) || typeof rec.projectName === "string") return "pimo-project";
      }
      return "pimo-project";
    }
  }

  const json = resolveJson(input);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    if (rec.format === "glb") return "glb";
    if (typeof rec.format === "string" && FUTURE_CAD_FORMATS.has(rec.format as FormatId)) {
      return rec.format as FormatId;
    }
    if (Array.isArray(rec.workspaceBoxes) || typeof rec.projectName === "string") {
      return "pimo-project";
    }
  }

  return null;
}
