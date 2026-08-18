import type { NormalizedProject, ProjectLoadInput } from "./normalizedProject";
import type { ProjectFormatAdapter } from "./ProjectFormatAdapter";
import { validateNormalizedMm } from "./formatValidation";

const DEFAULT_CAD_BOX_MM = { largura: 600, altura: 720, profundidade: 560 };

function assetUrl(input: ProjectLoadInput, parsed: unknown): string {
  if (typeof input.url === "string" && input.url) return input.url;
  if (parsed && typeof parsed === "object" && "url" in parsed) {
    const url = (parsed as { url?: unknown }).url;
    if (typeof url === "string") return url;
  }
  return input.fileName ?? "";
}

function toNormalized(parsed: unknown, input?: ProjectLoadInput): NormalizedProject {
  const url = assetUrl(input ?? {}, parsed);
  const assetId = "asset-glb-1";
  return {
    version: "glb-visual-1",
    units: "mm",
    industrialReady: false,
    workspaceBoxes: [
      {
        id: "cad-glb-1",
        posicaoX_mm: 0,
        posicaoY_mm: DEFAULT_CAD_BOX_MM.altura / 2,
        posicaoZ_mm: 0,
        dimensoes: { ...DEFAULT_CAD_BOX_MM },
        cadOnly: true,
        assetIds: [assetId],
      },
    ],
    materials: [],
    assets: url ? [{ id: assetId, kind: "glb", url }] : [],
    source: {
      format: "glb",
      warnings: [
        "GLB é visual/CAD na caixa; não gera cutlist nem TCN/DRILL/PI.",
        "Aplicar via addModelToBox / loadGLB existente — o adapter não faz parse da malha.",
      ],
    },
  };
}

export const glbFormatAdapter: ProjectFormatAdapter = {
  id: "glb",
  parse(input: ProjectLoadInput): unknown {
    return { url: input.url ?? input.fileName ?? "" };
  },
  toNormalized(parsed) {
    return toNormalized(parsed);
  },
  validate(normalized) {
    const base = validateNormalizedMm(normalized);
    if (normalized.industrialReady) {
      return {
        ok: false,
        errors: [...base.errors, "GLB não pode ficar industrialReady."],
        warnings: base.warnings,
      };
    }
    return base;
  },
  toProjectState() {
    return null;
  },
};

/** Usado pelo ProjectLoader para o toNormalized preservar o url do input. */
export function normalizeGlbInput(input: ProjectLoadInput): NormalizedProject {
  return toNormalized(glbFormatAdapter.parse(input), input);
}
