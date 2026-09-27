/**
 * Carrega ficheiros IFC (texto STEP) → RoomState + modelo extraído.
 */
import { extractIfcModel } from "./IfcExtractor";
import { IfcParser } from "./IfcParser";
import { ifcModelToRoomState } from "./IfcToRoomState";
import type { IfcLoadResult } from "./IfcTypes";
import type { RoomState } from "../RoomState";

export type IfcLoaderResult = IfcLoadResult & {
  state: RoomState | null;
};

export const IfcLoader = {
  async fromText(text: string, src?: string): Promise<IfcLoaderResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      if (!text || !/ISO-10303-21|DATA;/i.test(text)) {
        errors.push("Ficheiro IFC inválido (STEP ISO-10303-21 esperado)");
        return { ok: false, model: null, state: null, text, errors, warnings };
      }
      const doc = IfcParser.parse(text);
      const model = extractIfcModel(doc);
      warnings.push(...model.warnings);
      if (model.walls.length === 0) {
        errors.push("Nenhuma parede encontrada no IFC");
        return { ok: false, model, state: null, text, errors, warnings };
      }
      let state = ifcModelToRoomState(model);
      if (src) {
        state = {
          ...state,
          sourceAssets: {
            ...state.sourceAssets,
            ifc: { ...state.sourceAssets?.ifc, src, metadata: state.sourceAssets?.ifc?.metadata },
          },
        };
      }
      return { ok: true, model, state, text, errors, warnings };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return { ok: false, model: null, state: null, text, errors, warnings };
    }
  },

  async fromFile(file: File): Promise<IfcLoaderResult> {
    const text = await file.text();
    return IfcLoader.fromText(text, file.name);
  },

  async fromUrl(url: string): Promise<IfcLoaderResult> {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        ok: false,
        model: null,
        state: null,
        text: "",
        errors: [`Falha ao obter IFC: HTTP ${res.status}`],
        warnings: [],
      };
    }
    const text = await res.text();
    return IfcLoader.fromText(text, url);
  },
};
