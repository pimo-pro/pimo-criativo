import { useContext } from "react";
import { PimoViewerContext } from "../context/PimoViewerContext";

export const usePimoViewerContext = () => {
  const context = useContext(PimoViewerContext);
  if (!context) {
    throw new Error("usePimoViewerContext deve ser usado dentro de PimoViewerProvider.");
  }
  return context;
};
