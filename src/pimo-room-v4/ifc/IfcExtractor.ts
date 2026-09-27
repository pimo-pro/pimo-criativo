/**
 * Extrai storeys / walls / openings / slabs / câmara a partir do documento IFC parseado.
 */
import { IfcParser } from "./IfcParser";
import type {
  IfcExtractedModel,
  IfcExtractedOpening,
  IfcExtractedSlab,
  IfcExtractedStorey,
  IfcExtractedWall,
  IfcParsedDocument,
  IfcPlacement,
  IfcValue,
  IfcVec3,
} from "./IfcTypes";

function cartesianPoint(doc: IfcParsedDocument, entityId: number | null): IfcVec3 {
  if (entityId == null) return { x: 0, y: 0, z: 0 };
  const e = doc.entities.get(entityId);
  if (!e || e.type !== "IFCCARTESIANPOINT") return { x: 0, y: 0, z: 0 };
  const coords = e.args[0];
  if (!Array.isArray(coords)) return { x: 0, y: 0, z: 0 };
  return {
    x: IfcParser.asNumber(coords[0], 0),
    y: IfcParser.asNumber(coords[1], 0),
    z: IfcParser.asNumber(coords[2], 0),
  };
}

function directionXZ(doc: IfcParsedDocument, entityId: number | null): { x: number; z: number } {
  if (entityId == null) return { x: 1, z: 0 };
  const e = doc.entities.get(entityId);
  if (!e || e.type !== "IFCDIRECTION") return { x: 1, z: 0 };
  const d = e.args[0];
  if (!Array.isArray(d)) return { x: 1, z: 0 };
  const x = IfcParser.asNumber(d[0], 1);
  const z = IfcParser.asNumber(d[2] ?? d[1], 0);
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

function axis2Placement3D(doc: IfcParsedDocument, entityId: number | null): IfcPlacement {
  if (entityId == null) {
    return { origin: { x: 0, y: 0, z: 0 }, axisX: { x: 1, z: 0 }, elevation: 0 };
  }
  const e = doc.entities.get(entityId);
  if (!e || e.type !== "IFCAXIS2PLACEMENT3D") {
    return { origin: { x: 0, y: 0, z: 0 }, axisX: { x: 1, z: 0 }, elevation: 0 };
  }
  const origin = cartesianPoint(doc, IfcParser.asRefId(e.args[0]));
  const refDir = directionXZ(doc, IfcParser.asRefId(e.args[2]));
  return {
    origin,
    axisX: refDir,
    elevation: origin.y,
  };
}

function localPlacement(doc: IfcParsedDocument, entityId: number | null): IfcPlacement {
  if (entityId == null) {
    return { origin: { x: 0, y: 0, z: 0 }, axisX: { x: 1, z: 0 }, elevation: 0 };
  }
  const e = doc.entities.get(entityId);
  if (!e || e.type !== "IFCLOCALPLACEMENT") {
    return { origin: { x: 0, y: 0, z: 0 }, axisX: { x: 1, z: 0 }, elevation: 0 };
  }
  const parentId = IfcParser.asRefId(e.args[0]);
  const relativeId = IfcParser.asRefId(e.args[1]);
  const relative = axis2Placement3D(doc, relativeId);
  if (parentId == null) return relative;
  const parent = localPlacement(doc, parentId);
  // composição simplificada (translação + rotação 2D no plano XZ)
  const cos = parent.axisX.x;
  const sin = parent.axisX.z;
  const rx = relative.origin.x * cos - relative.origin.z * sin;
  const rz = relative.origin.x * sin + relative.origin.z * cos;
  const axX = relative.axisX.x * cos - relative.axisX.z * sin;
  const axZ = relative.axisX.x * sin + relative.axisX.z * cos;
  return {
    origin: {
      x: parent.origin.x + rx,
      y: parent.origin.y + relative.origin.y,
      z: parent.origin.z + rz,
    },
    axisX: { x: axX, z: axZ },
    elevation: parent.origin.y + relative.origin.y,
  };
}

function walkRepresentation(
  doc: IfcParsedDocument,
  value: IfcValue,
  visit: (_e: NonNullable<ReturnType<typeof IfcParser.get>>) => void
): void {
  const ref = IfcParser.asRefId(value);
  if (ref != null) {
    const e = doc.entities.get(ref);
    if (!e) return;
    visit(e);
    for (const a of e.args) walkRepresentation(doc, a, visit);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walkRepresentation(doc, v, visit);
  }
}

function wallDimsFromRepresentation(
  doc: IfcParsedDocument,
  representationArg: IfcValue
): { lengthM: number; thicknessM: number; heightM: number } {
  let lengthM = 4;
  let thicknessM = 0.2;
  let heightM = 2.6;
  walkRepresentation(doc, representationArg, (e) => {
    if (e.type === "IFCRECTANGLEPROFILEDEF" || e.type === "IFCRECTANGLEHOLLOWPROFILEDEF") {
      // ProfileType, ProfileName, Position, XDim, YDim
      lengthM = IfcParser.asNumber(e.args[3], lengthM);
      thicknessM = IfcParser.asNumber(e.args[4], thicknessM);
    }
    if (e.type === "IFCEXTRUDEDAREASOLID") {
      heightM = IfcParser.asNumber(e.args[3], heightM);
    }
  });
  return { lengthM, thicknessM, heightM };
}

function productGuidName(e: { args: IfcValue[] }): { guid: string; name: string } {
  const guid = IfcParser.asString(e.args[0], `e-${Math.random().toString(36).slice(2, 7)}`);
  const name = IfcParser.asString(e.args[2], guid);
  return { guid, name };
}

function buildContainment(doc: IfcParsedDocument): Map<number, number> {
  /** productEntityId → storeyEntityId */
  const map = new Map<number, number>();
  for (const rel of doc.byType.get("IFCRELCONTAINEDINSPATIALSTRUCTURE") ?? []) {
    // RelatedElements (4), RelatingStructure (5)
    const related = rel.args[4];
    const storeyRef = IfcParser.asRefId(rel.args[5]);
    const list = Array.isArray(related) ? related : [related];
    for (const item of list) {
      const pid = IfcParser.asRefId(item);
      if (pid != null && storeyRef != null) map.set(pid, storeyRef);
    }
  }
  return map;
}

function buildFills(doc: IfcParsedDocument): Map<number, number> {
  /** door/window/opening entityId → wall entityId */
  const map = new Map<number, number>();
  const openingToWall = new Map<number, number>();
  for (const rel of doc.byType.get("IFCRELVOIDSELEMENT") ?? []) {
    const wallRef = IfcParser.asRefId(rel.args[4]);
    const openingRef = IfcParser.asRefId(rel.args[5]);
    if (wallRef != null && openingRef != null) openingToWall.set(openingRef, wallRef);
  }
  for (const rel of doc.byType.get("IFCRELFILLSELEMENT") ?? []) {
    // RelatingOpeningElement (4), RelatedBuildingElement door/window (5)
    // Alguns ficheiros invertem — aceitar ambos.
    const a = IfcParser.asRefId(rel.args[4]);
    const b = IfcParser.asRefId(rel.args[5]);
    if (a == null || b == null) continue;
    const aType = doc.entities.get(a)?.type ?? "";
    const bType = doc.entities.get(b)?.type ?? "";
    if (aType.includes("WALL") && (bType.includes("DOOR") || bType.includes("WINDOW"))) {
      map.set(b, a);
    } else if (bType.includes("WALL") && (aType.includes("DOOR") || aType.includes("WINDOW"))) {
      map.set(a, b);
    } else if (aType.includes("OPENING") && (bType.includes("DOOR") || bType.includes("WINDOW"))) {
      const wall = openingToWall.get(a);
      if (wall != null) map.set(b, wall);
    } else if (bType.includes("OPENING") && (aType.includes("DOOR") || aType.includes("WINDOW"))) {
      const wall = openingToWall.get(b);
      if (wall != null) map.set(a, wall);
    } else if (aType.includes("WALL")) {
      map.set(b, a);
    } else {
      map.set(b, a);
    }
  }
  return map;
}

export function extractIfcModel(doc: IfcParsedDocument): IfcExtractedModel {
  const warnings: string[] = [];
  const containment = buildContainment(doc);
  const fills = buildFills(doc);

  const storeys: IfcExtractedStorey[] = (doc.byType.get("IFCBUILDINGSTOREY") ?? []).map((e) => {
    const { name } = productGuidName(e);
    const placement = localPlacement(doc, IfcParser.asRefId(e.args[5]));
    const elevArg = e.args[9] ?? e.args[10];
    const elevationM =
      typeof elevArg === "number" ? elevArg : placement.elevation;
    return {
      id: `storey-${e.id}`,
      name: name || `Storey ${e.id}`,
      elevationM,
      entityId: e.id,
    };
  });
  storeys.sort((a, b) => a.elevationM - b.elevationM);
  if (storeys.length === 0) {
    storeys.push({
      id: "storey-default",
      name: "Piso 0",
      elevationM: 0,
      entityId: -1,
    });
    warnings.push("IFC sem IfcBuildingStorey — criado nível default");
  }

  const wallEntities = [
    ...(doc.byType.get("IFCWALL") ?? []),
    ...(doc.byType.get("IFCWALLSTANDARDCASE") ?? []),
  ];

  const walls: IfcExtractedWall[] = wallEntities.map((e) => {
    const { guid, name } = productGuidName(e);
    const placement = localPlacement(doc, IfcParser.asRefId(e.args[5]));
    const dims = wallDimsFromRepresentation(doc, e.args[6]);
    const half = dims.lengthM / 2;
    const ax = placement.axisX;
    const startM = {
      x: placement.origin.x - ax.x * half,
      z: placement.origin.z - ax.z * half,
    };
    const endM = {
      x: placement.origin.x + ax.x * half,
      z: placement.origin.z + ax.z * half,
    };
    return {
      id: `wall-${e.id}`,
      name: name || guid,
      storeyEntityId: containment.get(e.id) ?? storeys[0]?.entityId ?? null,
      startM,
      endM,
      heightM: dims.heightM,
      thicknessM: dims.thicknessM,
    };
  });

  const openings: IfcExtractedOpening[] = [];
  for (const e of doc.byType.get("IFCDOOR") ?? []) {
    const { guid, name } = productGuidName(e);
    // IFC4: OverallHeight (8), OverallWidth (9)
    const heightM = IfcParser.asNumber(e.args[8], 2.1);
    const widthM = IfcParser.asNumber(e.args[9], 0.9);
    openings.push({
      id: `door-${e.id}`,
      type: "door",
      name: name || guid,
      wallEntityId: fills.get(e.id) ?? null,
      widthM,
      heightM,
      sillM: 0,
    });
  }
  for (const e of doc.byType.get("IFCWINDOW") ?? []) {
    const { guid, name } = productGuidName(e);
    const heightM = IfcParser.asNumber(e.args[8], 1.2);
    const widthM = IfcParser.asNumber(e.args[9], 1.2);
    openings.push({
      id: `window-${e.id}`,
      type: "window",
      name: name || guid,
      wallEntityId: fills.get(e.id) ?? null,
      widthM,
      heightM,
      sillM: 0.9,
    });
  }

  const slabs: IfcExtractedSlab[] = (doc.byType.get("IFCSLAB") ?? []).map((e) => {
    const { guid, name } = productGuidName(e);
    const placement = localPlacement(doc, IfcParser.asRefId(e.args[5]));
    let thicknessM = 0.2;
    walkRepresentation(doc, e.args[6], (node) => {
      if (node.type === "IFCEXTRUDEDAREASOLID") {
        thicknessM = IfcParser.asNumber(node.args[3], thicknessM);
      }
    });
    return {
      id: `slab-${e.id}`,
      name: name || guid,
      storeyEntityId: containment.get(e.id) ?? storeys[0]?.entityId ?? null,
      thicknessM,
      elevationM: placement.elevation,
    };
  });

  // Câmara: primeiro IfcLocalPlacement de storey activo ou origem
  let camera: IfcExtractedModel["camera"];
  const firstStorey = storeys[0];
  if (firstStorey && firstStorey.entityId > 0) {
    const storeyEnt = doc.entities.get(firstStorey.entityId);
    const pl = localPlacement(doc, storeyEnt ? IfcParser.asRefId(storeyEnt.args[5]) : null);
    camera = {
      positionM: { x: pl.origin.x, y: pl.origin.y + 1.6, z: pl.origin.z },
      yawDeg: (Math.atan2(pl.axisX.z, pl.axisX.x) * 180) / Math.PI,
    };
  } else {
    camera = { positionM: { x: 0, y: 1.6, z: 0 }, yawDeg: 0 };
  }

  if (walls.length === 0) {
    warnings.push("IFC sem paredes (IfcWall / IfcWallStandardCase)");
  }

  return {
    schema: doc.schema,
    storeys,
    walls,
    openings,
    slabs,
    camera,
    warnings,
  };
}
