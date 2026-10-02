/**
 * Factory IRoomRenderer (M8).
 * Flag off → ViewerRoomEngine (legado / RoomManager).
 * Flag on → PimoRoomRenderer (vNext / RoomMeshEngine).
 */
import { isRoomEngineVNextEnabled } from "../core/features";
import {
  ViewerRoomEngine,
  type ViewerRoomManagerLike,
} from "../3d/viewer-engine/room/ViewerRoomEngine";
import { PimoRoomRenderer } from "./PimoRoomRenderer";

export function createRoomRenderer(
  getManager: () => ViewerRoomManagerLike | null | undefined
): ViewerRoomEngine {
  if (isRoomEngineVNextEnabled()) {
    return new PimoRoomRenderer(getManager);
  }
  return new ViewerRoomEngine(getManager);
}

export function ensureRoomRenderer(
  current: ViewerRoomEngine | null,
  getManager: () => ViewerRoomManagerLike | null | undefined
): ViewerRoomEngine {
  const wantVNext = isRoomEngineVNextEnabled();
  if (current) {
    const isVNext = current instanceof PimoRoomRenderer;
    if (isVNext === wantVNext) return current;
  }
  return createRoomRenderer(getManager);
}
