import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { safeGetItem, safeParseJson, safeSetItem } from "../utils/storage";
import type { MaterialCategory } from "../core/materials/materialPresets";
import { getPresetById } from "../core/materials/materialPresets";

export type ModelPart = "wood" | "metal" | "glass" | "panel" | "door" | "drawer";

export type MaterialCategoryConfig = {
  presetId: string;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  color: string;
};

export type MaterialSystemState = {
  categories: Record<MaterialCategory, MaterialCategoryConfig>;
  assignments: Record<ModelPart, MaterialCategory>;
};

type MaterialContextValue = {
  state: MaterialSystemState;
  setCategoryPreset: (category: MaterialCategory, presetId: string) => void;
  setCategoryOverrides: (
    category: MaterialCategory,
    overrides: Partial<MaterialCategoryConfig>
  ) => void;
  setAssignment: (part: ModelPart, category: MaterialCategory) => void;
};

const STORAGE_KEY = "pimo_material_system_v1";

const defaultState: MaterialSystemState = {
  categories: {
    wood: {
      presetId: "wood_oak",
      roughness: 0.55,
      metalness: 0.05,
      envMapIntensity: 0.9,
      color: "#c9a27a",
    },
    metal: {
      presetId: "metal_steel",
      roughness: 0.2,
      metalness: 0.9,
      envMapIntensity: 1.2,
      color: "#cbd5f5",
    },
    glass: {
      presetId: "glass_clear",
      roughness: 0.05,
      metalness: 0.0,
      envMapIntensity: 1.2,
      color: "#e2e8f0",
    },
    plastic: {
      presetId: "plastic_matte",
      roughness: 0.7,
      metalness: 0.0,
      envMapIntensity: 0.4,
      color: "#e5e7eb",
    },
    marble: {
      presetId: "marble_white",
      roughness: 0.3,
      metalness: 0.0,
      envMapIntensity: 0.9,
      color: "#f8fafc",
    },
    stone: {
      presetId: "stone_granite",
      roughness: 0.75,
      metalness: 0.0,
      envMapIntensity: 0.4,
      color: "#9ca3af",
    },
  },
  assignments: {
    wood: "wood",
    metal: "metal",
    glass: "glass",
    panel: "wood",
    door: "wood",
    drawer: "wood",
  },
};

const normalizeState = (value: unknown): MaterialSystemState => {
  if (!value || typeof value !== "object") return defaultState;
  const partial = value as Partial<MaterialSystemState>;
  const categories = { ...defaultState.categories };
  if (partial.categories) {
    (Object.keys(categories) as MaterialCategory[]).forEach((category) => {
      const incoming = partial.categories?.[category];
      if (!incoming) return;
      const preset = getPresetById(incoming.presetId);
      categories[category] = {
        presetId: preset?.id ?? categories[category].presetId,
        roughness: Number.isFinite(incoming.roughness)
          ? Number(incoming.roughness)
          : categories[category].roughness,
        metalness: Number.isFinite(incoming.metalness)
          ? Number(incoming.metalness)
          : categories[category].metalness,
        envMapIntensity: Number.isFinite(incoming.envMapIntensity)
          ? Number(incoming.envMapIntensity)
          : categories[category].envMapIntensity,
        color: typeof incoming.color === "string" ? incoming.color : categories[category].color,
      };
    });
  }
  const assignments = { ...defaultState.assignments, ...(partial.assignments ?? {}) };
  return { categories, assignments };
};

const MaterialContext = createContext<MaterialContextValue | null>(null);

export function MaterialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MaterialSystemState>(() => {
    const stored = safeParseJson<unknown>(safeGetItem(STORAGE_KEY));
    return normalizeState(stored);
  });

  useEffect(() => {
    safeSetItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setCategoryPreset = useCallback((category: MaterialCategory, presetId: string) => {
    const preset = getPresetById(presetId);
    if (!preset) return;
    setState((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          presetId: preset.id,
          roughness: preset.defaults.roughness,
          metalness: preset.defaults.metalness,
          envMapIntensity: preset.defaults.envMapIntensity,
          color: preset.defaults.color,
        },
      },
    }));
  }, []);

  const setCategoryOverrides = useCallback(
    (category: MaterialCategory, overrides: Partial<MaterialCategoryConfig>) => {
      setState((prev) => ({
        ...prev,
        categories: {
          ...prev.categories,
          [category]: {
            ...prev.categories[category],
            ...overrides,
          },
        },
      }));
    },
    []
  );

  const setAssignment = useCallback((part: ModelPart, category: MaterialCategory) => {
    setState((prev) => ({
      ...prev,
      assignments: {
        ...prev.assignments,
        [part]: category,
      },
    }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      setCategoryPreset,
      setCategoryOverrides,
      setAssignment,
    }),
    [state, setCategoryPreset, setCategoryOverrides, setAssignment]
  );

  return <MaterialContext.Provider value={value}>{children}</MaterialContext.Provider>;
}

export const useMaterialSystem = () => {
  const ctx = useContext(MaterialContext);
  if (!ctx) {
    throw new Error("useMaterialSystem must be used within MaterialProvider");
  }
  return ctx;
};

export const materialCategoryOptions: { id: MaterialCategory; label: string }[] = [
  { id: "wood", label: "Madeira" },
  { id: "metal", label: "Metal" },
  { id: "glass", label: "Vidro" },
  { id: "plastic", label: "Plástico" },
  { id: "marble", label: "Mármore" },
  { id: "stone", label: "Pedra" },
];

export const modelPartOptions: { id: ModelPart; label: string }[] = [
  { id: "wood", label: "Superfícies de madeira" },
  { id: "metal", label: "Superfícies metálicas" },
  { id: "glass", label: "Vidro" },
  { id: "panel", label: "Painéis" },
  { id: "door", label: "Portas" },
  { id: "drawer", label: "Gavetas" },
];
