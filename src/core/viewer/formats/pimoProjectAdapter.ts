import type { ProjectState } from "../../../context/projectTypes";
import type { WorkspaceBox } from "../../types";
import type { NormalizedProject, NormalizedWorkspaceBoxMm, ProjectLoadInput } from "./normalizedProject";
import type { ProjectFormatAdapter } from "./ProjectFormatAdapter";
import { resolveJson } from "./jsonInput";
import { validateNormalizedMm } from "./formatValidation";

function asState(parsed: unknown): ProjectState | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const rec = parsed as Record<string, unknown>;
  if (rec.state && typeof rec.state === "object") return rec.state as ProjectState;
  return parsed as ProjectState;
}

function mapBox(box: WorkspaceBox): NormalizedWorkspaceBoxMm {
  return {
    id: box.id,
    posicaoX_mm: box.posicaoX_mm,
    posicaoY_mm: box.posicaoY_mm,
    posicaoZ_mm: box.posicaoZ_mm ?? 0,
    dimensoes: { ...box.dimensoes },
    assetIds: (box.models ?? []).map((m) => m.id),
  };
}

function toNormalized(parsed: unknown): NormalizedProject {
  const state = asState(parsed);
  const boxes = Array.isArray(state?.workspaceBoxes) ? state.workspaceBoxes : [];
  const materials: Array<{ id: string; label?: string }> = [];
  if (state?.materialId) materials.push({ id: state.materialId, label: state.material?.tipo });
  const assets = boxes.flatMap((box) =>
    (box.models ?? [])
      .filter((m) => typeof m.modelId === "string" && m.modelId.length > 0)
      .map((m) => ({ id: m.id, kind: "glb" as const, url: m.modelId }))
  );

  return {
    version: "pimo-project-1",
    units: "mm",
    industrialReady: true,
    room: state?.room,
    workspaceBoxes: boxes.map(mapBox),
    materials,
    assets,
    source: { format: "pimo-project", warnings: [] },
    pimoProjectRef: state ?? undefined,
  };
}

export const pimoProjectAdapter: ProjectFormatAdapter = {
  id: "pimo-project",
  parse(input: ProjectLoadInput): unknown {
    return resolveJson(input) ?? input.json ?? null;
  },
  toNormalized,
  validate(normalized) {
    const base = validateNormalizedMm(normalized);
    if (!normalized.pimoProjectRef) {
      return {
        ok: false,
        errors: [...base.errors, "Adapter identidade exige um ProjectState PIMO."],
        warnings: base.warnings,
      };
    }
    return base;
  },
  toProjectState(normalized) {
    return normalized.pimoProjectRef ?? null;
  },
};
