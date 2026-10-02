/**
 * PimoRoomRenderer (M8) — implementação IRoomRenderer do path vNext.
 * Delega ao mesmo RoomManager via ViewerRoomEngine (sem segundo WebGL).
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
