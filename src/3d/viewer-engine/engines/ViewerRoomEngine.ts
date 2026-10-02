import { ViewerRoomEngine, type ViewerRoomManagerLike } from "../room/ViewerRoomEngine";
import { createRoomRenderer, ensureRoomRenderer } from "../../../pimo-room/createRoomRenderer";

export function createViewerRoomEngine(
  getManager: () => ViewerRoomManagerLike | null | undefined
): ViewerRoomEngine {
  return createRoomRenderer(getManager);
}

export function ensureViewerRoomEngine(
  current: ViewerRoomEngine | null,
  getManager: () => ViewerRoomManagerLike | null | undefined
): ViewerRoomEngine {
  return ensureRoomRenderer(current, getManager);
}
