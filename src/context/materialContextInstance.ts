import { createContext } from "react";
import type { MaterialSystemState } from "./materialUtils";
import type { MaterialCategory } from "../core/materials/materialPresets";
import type { MaterialCategoryConfig, ModelPart } from "./materialUtils";

type MaterialContextValue = {
  state: MaterialSystemState;
  setCategoryPreset: (category: MaterialCategory, presetId: string) => void;
  setCategoryOverrides: (
    category: MaterialCategory,
    overrides: Partial<MaterialCategoryConfig>
  ) => void;
  setAssignment: (part: ModelPart, category: MaterialCategory) => void;
};

export const MaterialContext = createContext<MaterialContextValue | null>(null);
