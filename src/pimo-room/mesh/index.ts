/**
 * pimo-room/mesh — geometria WebGL do path vNext.
 * Builders + RoomMeshEngine (substituto estrutural do RoomManager quando flag ON).
 */
export {
  wallMeshBuilder,
  buildExtraWallMesh,
  repositionMainWallMeshes,
  buildWallGeometry,
  refreshWallMiters,
  getWallThicknessM,
  setWallThicknessM,
  Room,
  type RoomNumWalls,
  type WallMeshBuildOptions,
} from "./wallMeshBuilder";

export {
  floorMeshBuilder,
  buildRectFloorShape,
  type FloorMeshAppearance,
  type FloorBoundsM,
  type FloorMeshBuildResult,
} from "./floorMeshBuilder";

export {
  ceilingMeshBuilder,
  type CeilingMaterialConfig,
  type CeilingBoundsM,
} from "./ceilingMeshBuilder";

export {
  openingsMeshBuilder,
  buildDoorOpeningMesh,
  buildWindowOpeningMesh,
  DoorElement,
  WindowElement,
  type OpeningMeshKind,
  type OpeningMeshResult,
} from "./openingsMeshBuilder";

export {
  RoomMeshEngine,
  type RoomBounds,
  type WallEntryForViewer,
  type IRoomManagerViewer,
} from "./RoomMeshEngine";
