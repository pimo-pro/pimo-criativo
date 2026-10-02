/**
 * Domínio pimo-room — API unificada (AI / IFC / Catalog / Bridge / Converter).
 * Preparação para remoção futura de pimo-room-v4 (M10).
 */
export * from "./AIHost";
export * from "./IFCHost";
export * from "./CatalogHost";
export { RoomBridge } from "./Bridge";
export { RoomConverter } from "./Converter";

export type { RoomState } from "../../pimo-room-v4/RoomState";
export {
  startWalkthrough,
  stopWalkthrough,
  syncLevelGhosts,
} from "../../pimo-room-v4/walkthrough/walkthroughHost";
export {
  RoomIndustrialAdapter,
  type RoomIndustrialConstraints,
  type RoomFurnitureHint,
  type RoomIndustrialSyncResult,
} from "../../pimo-room-v4/RoomIndustrialAdapter";
