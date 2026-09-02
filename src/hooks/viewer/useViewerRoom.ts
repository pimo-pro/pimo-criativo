/**
 * STUB — useViewerRoom sempre NOOP (feature/sala-rebuild-opensource).
 */
import { useMemo } from "react";

const NOOP = () => {};
const NOOP_RETURN_FALSE = () => false;
const NOOP_RETURN_EMPTY = () => "";
const NOOP_RETURN_NULL = () => null;

const ROOM_NOOP_API = {
  createRoom: NOOP,
  createRoomWithDimensions: NOOP,
  removeRoom: NOOP,
  setRoomDimensions: NOOP,
  addExtraWall: NOOP,
  setRoomLocked: NOOP,
  selectWallByIndex: NOOP,
  selectRoomElementById: NOOP,
  selectRoomUtilityById: NOOP,
  setPlacementMode: NOOP,
  addDoorToRoom: NOOP_RETURN_EMPTY,
  addWindowToRoom: NOOP_RETURN_EMPTY,
  setOnRoomElementPlaced: NOOP,
  setOnRoomElementSelected: NOOP,
  setOnRoomUtilitySelected: NOOP,
  setOnWallSelected: NOOP,
  setOnWallTransform: NOOP,
  setOnRoomElementTransform: NOOP,
  setOnRoomUtilityTransform: NOOP,
  updateRoomElementConfig: NOOP_RETURN_FALSE,
  setRoomFloorMode: NOOP,
  setRoomHiddenWalls: NOOP,
  setRoomUtilities: NOOP,
  setRoomBounds: NOOP,
  clearRoomBounds: NOOP,
  getRoomExists: NOOP_RETURN_FALSE,
  getRoomLocked: NOOP_RETURN_FALSE,
  getRoomDimensions: NOOP_RETURN_NULL,
  getRoomVisible: NOOP_RETURN_FALSE,
  hideRoom: NOOP,
  showRoom: NOOP,
} as const;

export function useViewerRoom() {
  return useMemo(() => ROOM_NOOP_API, []);
}
