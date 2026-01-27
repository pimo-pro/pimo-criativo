import { useContext } from "react";
import { MaterialContext } from "./materialContextInstance";

export const useMaterial = () => {
  const ctx = useContext(MaterialContext);
  if (!ctx) {
    throw new Error("useMaterial must be used within MaterialProvider");
  }
  return ctx;
};
