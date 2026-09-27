/**
 * Tipos intermédios do pipeline IFC (STEP) → RoomEngine.
 */

export type IfcSchema = "IFC2X3" | "IFC4" | "IFC4X3" | "UNKNOWN";

export type IfcEntity = {
  id: number;
  type: string;
  args: IfcValue[];
};

export type IfcValue =
  | null
  | string
  | number
  | boolean
  | { ref: number }
  | IfcValue[];

export type IfcParsedDocument = {
  schema: IfcSchema;
  entities: Map<number, IfcEntity>;
  byType: Map<string, IfcEntity[]>;
};

export type IfcVec3 = { x: number; y: number; z: number };

export type IfcPlacement = {
  origin: IfcVec3;
  /** Direção local X no plano horizontal (mundo). */
  axisX: { x: number; z: number };
  elevation: number;
};

export type IfcExtractedStorey = {
  id: string;
  name: string;
  elevationM: number;
  entityId: number;
};

export type IfcExtractedWall = {
  id: string;
  name: string;
  storeyEntityId: number | null;
  startM: { x: number; z: number };
  endM: { x: number; z: number };
  heightM: number;
  thicknessM: number;
};

export type IfcExtractedOpening = {
  id: string;
  type: "door" | "window";
  name: string;
  wallEntityId: number | null;
  widthM: number;
  heightM: number;
  sillM: number;
  /** Offset ao longo da parede (m), se conhecido. */
  offsetAlongM?: number;
};

export type IfcExtractedSlab = {
  id: string;
  name: string;
  storeyEntityId: number | null;
  thicknessM: number;
  elevationM: number;
  polygonM?: Array<{ x: number; z: number }>;
};

export type IfcExtractedModel = {
  schema: IfcSchema;
  storeys: IfcExtractedStorey[];
  walls: IfcExtractedWall[];
  openings: IfcExtractedOpening[];
  slabs: IfcExtractedSlab[];
  camera?: { positionM: IfcVec3; yawDeg: number };
  warnings: string[];
};

export type IfcLoadResult = {
  ok: boolean;
  model: IfcExtractedModel | null;
  text: string;
  errors: string[];
  warnings: string[];
};
