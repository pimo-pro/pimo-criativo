/**
 * Hook especializado para sala e paredes no viewer.
 * Obtém a API de sala a partir do runtime canónico (`getActiveViewerCore`).
 * Z-03.4: delegação única via ViewerCore (D-09 resolvido).
 */
import { useMemo } from "react";
import { isViewerCoreReady } from "../../core/viewer/viewerReadiness";
import { getActiveViewerCore } from "../../core/viewer/pimoViewerRuntime";

const NOOP = () => {};
const NOOP_RETURN_FALSE = () => false;
const NOOP_RETURN_EMPTY = () => "";
const NOOP_RETURN_NULL = () => null;

/** API NOOP com exatamente as mesmas chaves que a API real. Referência estável. */
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
  const viewerCore = getActiveViewerCore() ?? undefined;

  return useMemo(() => {
    if (!isViewerCoreReady(viewerCore) || !viewerCore) return ROOM_NOOP_API;

    const bindCore = <T extends (...args: never[]) => unknown>(fn: T | undefined) =>
      fn ? fn.bind(viewerCore) : undefined;

    return {
      createRoom: bindCore(viewerCore.createRoom) ?? NOOP,
      createRoomWithDimensions: bindCore(viewerCore.createRoomWithDimensions) ?? NOOP,
      removeRoom: bindCore(viewerCore.removeRoom) ?? NOOP,
      setRoomDimensions: bindCore(viewerCore.setRoomDimensions) ?? NOOP,
      addExtraWall: bindCore(viewerCore.addExtraWall) ?? NOOP,
      setRoomLocked: bindCore(viewerCore.setRoomLocked) ?? NOOP,
      selectWallByIndex: bindCore(viewerCore.selectWallByIndex) ?? NOOP,
      selectRoomElementById: bindCore(viewerCore.selectRoomElementById) ?? NOOP,
      selectRoomUtilityById: bindCore(viewerCore.selectRoomUtilityById) ?? NOOP,
      setPlacementMode: bindCore(viewerCore.setPlacementMode) ?? NOOP,
      addDoorToRoom: bindCore(viewerCore.addDoorToRoom) ?? NOOP_RETURN_EMPTY,
      addWindowToRoom: bindCore(viewerCore.addWindowToRoom) ?? NOOP_RETURN_EMPTY,
      setOnRoomElementPlaced: bindCore(viewerCore.setOnRoomElementPlaced) ?? NOOP,
      setOnRoomElementSelected: bindCore(viewerCore.setOnRoomElementSelected) ?? NOOP,
      setOnRoomUtilitySelected: bindCore(viewerCore.setOnRoomUtilitySelected) ?? NOOP,
      setOnWallSelected: bindCore(viewerCore.setOnWallSelected) ?? NOOP,
      setOnWallTransform: bindCore(viewerCore.setOnWallTransform) ?? NOOP,
      setOnRoomElementTransform: bindCore(viewerCore.setOnRoomElementTransform) ?? NOOP,
      setOnRoomUtilityTransform: bindCore(viewerCore.setOnRoomUtilityTransform) ?? NOOP,
      updateRoomElementConfig: bindCore(viewerCore.updateRoomElementConfig) ?? NOOP_RETURN_FALSE,
      setRoomFloorMode: bindCore(viewerCore.setRoomFloorMode) ?? NOOP,
      setRoomHiddenWalls: bindCore(viewerCore.setRoomHiddenWalls) ?? NOOP,
      setRoomUtilities: bindCore(viewerCore.setRoomUtilities) ?? NOOP,
      setRoomBounds: bindCore(viewerCore.setRoomBounds) ?? NOOP,
      clearRoomBounds: bindCore(viewerCore.clearRoomBounds) ?? NOOP,
      getRoomExists: bindCore(viewerCore.getRoomExists) ?? NOOP_RETURN_FALSE,
      getRoomLocked: bindCore(viewerCore.getRoomLocked) ?? NOOP_RETURN_FALSE,
      getRoomDimensions: bindCore(viewerCore.getRoomDimensions) ?? NOOP_RETURN_NULL,
      getRoomVisible: bindCore(viewerCore.getRoomVisible) ?? NOOP_RETURN_FALSE,
      hideRoom: bindCore(viewerCore.hideRoom) ?? NOOP,
      showRoom: bindCore(viewerCore.showRoom) ?? NOOP,
    };
  }, [viewerCore]);
}
