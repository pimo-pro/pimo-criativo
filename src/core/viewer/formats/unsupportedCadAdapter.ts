import type { FormatId, NormalizedProject } from "./normalizedProject";
import type { ProjectFormatAdapter } from "./ProjectFormatAdapter";

export function unsupportedCadAdapter(format: FormatId): ProjectFormatAdapter {
  return {
    id: format,
    parse: () => null,
    toNormalized(): NormalizedProject {
      return {
        version: "cad-future-0",
        units: "mm",
        industrialReady: false,
        workspaceBoxes: [],
        materials: [],
        assets: [],
        source: {
          format,
          warnings: [`Formato ${format.toUpperCase()} reservado a Z-01.3+. Sem parser nesta fase.`],
        },
      };
    },
    validate(normalized) {
      return {
        ok: false,
        errors: [`${format.toUpperCase()} não está implementado (Z-01.3+).`],
        warnings: normalized.source.warnings,
      };
    },
    toProjectState: () => null,
  };
}
