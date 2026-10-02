/**
 * PimoRoomRenderer (M8/vNext) — implementação IRoomRenderer do path novo.
 * Delega ao RoomMeshEngine (via getManager do ViewerCore) — mesma superfície IRoomRenderer.
 */
import {
  ViewerRoomEngine,
  type ViewerRoomManagerLike,
} from "../3d/viewer-engine/room/ViewerRoomEngine";

export class PimoRoomRenderer extends ViewerRoomEngine {
  readonly rendererKind = "pimo-room-vnext" as const;

  constructor(getManager: () => ViewerRoomManagerLike | null | undefined) {
    super(getManager);
  }

  static ensure(
    current: PimoRoomRenderer | null,
    getManager: () => ViewerRoomManagerLike | null | undefined
  ): PimoRoomRenderer {
    return current ?? new PimoRoomRenderer(getManager);
  }
}
