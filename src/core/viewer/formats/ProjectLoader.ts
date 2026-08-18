import { loadGLB } from "../../glb/glbLoader";
import type { ProjectLoadInput, ProjectLoadResult } from "./normalizedProject";
import { detectFormat, getFormatAdapter } from "./ProjectFormatAdapter";
import { normalizeGlbInput } from "./glbFormatAdapter";

/**
 * Orquestrador de formatos do Viewer (Z-01.2.5).
 * Detecta → escolhe adapter → devolve NormalizedProject em mm.
 * Não faz parse pesado (sem DXF/IFC/STEP; GLB usa o gancho `loadGLB` já existente).
 */
export class ProjectLoader {
  detect(input: ProjectLoadInput) {
    return detectFormat(input);
  }

  load(input: ProjectLoadInput): ProjectLoadResult {
    const format = detectFormat(input);
    if (!format) {
      return {
        format: null,
        normalized: null,
        validation: {
          ok: false,
          errors: ["Formato de projecto não reconhecido."],
          warnings: [],
        },
      };
    }

    const adapter = getFormatAdapter(format);
    const normalized =
      format === "glb" ? normalizeGlbInput(input) : adapter.toNormalized(adapter.parse(input));
    const extra = adapter.validate(normalized);
    return { format, normalized, validation: extra };
  }

  /**
   * Gancho GLB existente — único sítio canónico para o ViewerCore carregar a cena GLTF.
   * Não normaliza malha nem gera cutlist.
   */
  loadGlbScene(path: string) {
    return loadGLB(path);
  }
}
