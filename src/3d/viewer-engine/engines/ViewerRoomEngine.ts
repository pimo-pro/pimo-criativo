import { ViewerRoomEngine, type ViewerRoomManagerLike } from "../room/ViewerRoomEngine";

export function createViewerRoomEngine(
  getManager: () => ViewerRoomManagerLike | null | undefined,
): ViewerRoomEngine {
  return new ViewerRoomEngine(getManager);
}

export function ensureViewerRoomEngine(
  current: ViewerRoomEngine | null,
  getManager: () => ViewerRoomManagerLike | null | undefined,
): ViewerRoomEngine {
  return current ?? createViewerRoomEngine(getManager);
}