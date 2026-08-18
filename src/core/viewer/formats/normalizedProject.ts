import type { ProjectState } from "../../../context/projectTypes";
import type { Dimensoes } from "../../types";

export type FormatId =
  | "pimo-project"
  | "glb"
  | "json-externo"
  | "dxf"
  | "ifc"
  | "step";

export const FUTURE_CAD_FORMATS: ReadonlySet<FormatId> = new Set(["dxf", "ifc", "step"]);

export type ProjectLoadInput = {
  format?: FormatId;
  fileName?: string;
  url?: string;
  json?: unknown;
  text?: string;
};

export type NormalizedWorkspaceBoxMm = {
  id: string;
  posicaoX_mm: number;
  posicaoY_mm: number;
  posicaoZ_mm: number;
  dimensoes: Dimensoes;
  cadOnly?: boolean;
  assetIds: string[];
};

export type NormalizedAsset = {
  id: string;
  kind: "glb";
  url: string;
};

export type NormalizedProject = {
  version: string;
  units: "mm";
  industrialReady: boolean;
  room?: unknown;
  workspaceBoxes: NormalizedWorkspaceBoxMm[];
  materials: Array<{ id: string; label?: string }>;
  assets: NormalizedAsset[];
  source: {
    format: FormatId;
    warnings: string[];
  };
  /**
   * Só no adapter identidade: referência ao ProjectState original.
   * Não é uma cópia nem um schema novo — `toProjectState` devolve este objecto.
   */
  pimoProjectRef?: ProjectState;
};

export type FormatValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type ProjectLoadResult = {
  format: FormatId | null;
  normalized: NormalizedProject | null;
  validation: FormatValidationResult;
};
