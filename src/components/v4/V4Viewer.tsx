import type { CSSProperties } from "react";
import type { CatalogItem } from "../../catalog/catalogTypes";
import { V4ViewerCanvas } from "../../v4/viewer-engine/V4ViewerCanvas";
import type { V4RoomConfig } from "../../v4/state/V4RoomConfig";

export interface SceneItem {
  id: string;
  catalogItem: CatalogItem;
  position: [number, number, number];
}

export interface V4ViewerProps {
  style?: CSSProperties;
  sceneItems: SceneItem[];
  selectedId: string | null;
  roomConfig: V4RoomConfig;
}

/**
 * V4 Viewer wrapper.
 * Delegates to V4ViewerCanvas (src/v4/viewer-engine/) which provides
 * high-quality rendering: ACESFilmic, PCFSoft shadows, 3-point lighting.
 */
export default function V4Viewer({ style, sceneItems, selectedId, roomConfig }: V4ViewerProps) {
  return (
    <V4ViewerCanvas
      style={style}
      sceneItems={sceneItems}
      selectedId={selectedId}
      roomConfig={roomConfig}
    />
  );
}
