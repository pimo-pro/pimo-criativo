export interface V4RoomConfig {
  width: number;         // mm
  depth: number;         // mm
  height: number;        // mm
  wallThickness: number; // mm
  wallColor: string;     // hex
  floorColor: string;    // hex
  showCeiling: boolean;
}

export const DEFAULT_ROOM_CONFIG: V4RoomConfig = {
  width:         3000,
  depth:         3000,
  height:        2400,
  wallThickness: 100,
  wallColor:     "#e8e4de",
  floorColor:    "#c8b99a",
  showCeiling:   true,
};
