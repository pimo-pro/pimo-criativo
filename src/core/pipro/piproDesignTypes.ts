import type { CutListItemComPreco, PanelDrillHole } from "../types";
import type { IndustrialFeatureId } from "../unifiedIndustrialBox/types";
import type { OrlaSideId } from "../orla/orlaTypes";
import type { XmlMachineTarget } from "../drill/xmlMachineRouting";

export const PIPRO_MODEL_PREFIX = "pipro-model-";

export type PiproPieceKind =
  | "lat_dir"
  | "lat_esq"
  | "fun"
  | "cima"
  | "frente"
  | "costa"
  | "sep"
  | "div"
  | "gaveta"
  | "porta";

export type PiproDimensionsMm = {
  largura: number;
  altura: number;
  profundidade: number;
  espessura: number;
};

export type PiproGapsMm = {
  gavetaFrenteMm: number;
  portaMm: number;
};

export type PiproPieceSnapshot = {
  id: string;
  kind: PiproPieceKind;
  tipo: string;
  nome: string;
  dimensoes: { largura: number; altura: number; profundidade: number };
  espessura: number;
  materialId?: string;
  drillHoles?: PanelDrillHole[];
  orlaSides?: OrlaSideId[];
  machineTarget?: XmlMachineTarget | null;
  industrialLabel?: string;
};

export type PiproModelRecord = {
  id: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
  dimensions: PiproDimensionsMm;
  materials: { bodyMaterialId: string };
  gaps: PiproGapsMm;
  /** Features A–D activas (IDs existentes). */
  featureIds: IndustrialFeatureId[];
  ruleIds: string[];
  pieces: PiproPieceSnapshot[];
  cutlist: CutListItemComPreco[];
  metadata: {
    engine: "unified_industrial_box_engine";
    baseCabinetId: string;
    industrialLabels: string[];
  };
};
