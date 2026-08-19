import { useState, useCallback } from "react";
import { DEFAULT_ROOM_CONFIG, type V4RoomConfig } from "./V4RoomConfig";

interface UseV4RoomReturn {
  roomConfig: V4RoomConfig;
  updateRoomConfig: (partial: Partial<V4RoomConfig>) => void;
}

export default function useV4Room(): UseV4RoomReturn {
  const [roomConfig, setRoomConfig] = useState<V4RoomConfig>(DEFAULT_ROOM_CONFIG);

  const updateRoomConfig = useCallback((partial: Partial<V4RoomConfig>) => {
    setRoomConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  return { roomConfig, updateRoomConfig };
}
