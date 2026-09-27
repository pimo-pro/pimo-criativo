/**
 * Estado de um item colocado na sala (instância).
 */
import type { LevelId, Vec3Mm } from "../RoomState";
import type { CatalogItemScale, CatalogItemType } from "./CatalogItem";

export type CatalogItemState = {
  id: string;
  catalogId: string;
  levelId: LevelId;
  type: CatalogItemType;
  name: string;
  positionMm: Vec3Mm;
  rotationDeg: number;
  scale: CatalogItemScale;
  /** Ligação opcional a parede (wall-hosted). */
  wallId?: string;
  /** Asset path override. */
  src?: string;
};

export const DEFAULT_ITEM_SCALE: CatalogItemScale = { x: 1, y: 1, z: 1 };
