/**
 * Presets de estilo AI (Auto-Design).
 */
import type { CatalogItemType } from "../catalog/CatalogItem";

export type AiPresetId = "moderno" | "minimalista" | "classico" | "industrial";

export type AiPresetItemSpec = {
  catalogId: string;
  type: CatalogItemType;
  /** Papel no agrupamento espacial. */
  role: "anchor" | "partner" | "seat" | "accent" | "fill";
};

export type AiPreset = {
  id: AiPresetId;
  label: string;
  description: string;
  items: AiPresetItemSpec[];
};

export const AI_PRESETS: AiPreset[] = [
  {
    id: "moderno",
    label: "Moderno",
    description: "Sofá + mesa + cadeiras + candeeiro",
    items: [
      { catalogId: "sofa-2s", type: "sofa", role: "anchor" },
      { catalogId: "table-dining", type: "table", role: "partner" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "lamp-floor", type: "lamp", role: "accent" },
    ],
  },
  {
    id: "minimalista",
    label: "Minimalista",
    description: "Poucos volumes, circulação ampla",
    items: [
      { catalogId: "sofa-2s", type: "sofa", role: "anchor" },
      { catalogId: "table-dining", type: "table", role: "partner" },
      { catalogId: "lamp-floor", type: "lamp", role: "accent" },
    ],
  },
  {
    id: "classico",
    label: "Clássico",
    description: "Mesa central com cadeiras e sofá",
    items: [
      { catalogId: "table-dining", type: "table", role: "anchor" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "sofa-2s", type: "sofa", role: "partner" },
      { catalogId: "lamp-floor", type: "lamp", role: "accent" },
    ],
  },
  {
    id: "industrial",
    label: "Industrial",
    description: "Blocos + mesa + iluminação",
    items: [
      { catalogId: "table-dining", type: "table", role: "anchor" },
      { catalogId: "custom-box", type: "custom", role: "fill" },
      { catalogId: "custom-box", type: "custom", role: "fill" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "chair-basic", type: "chair", role: "seat" },
      { catalogId: "lamp-floor", type: "lamp", role: "accent" },
    ],
  },
];

export function getAiPreset(id: string): AiPreset | undefined {
  return AI_PRESETS.find((p) => p.id === id);
}

export function isAiPresetId(v: unknown): v is AiPresetId {
  return (
    v === "moderno" || v === "minimalista" || v === "classico" || v === "industrial"
  );
}
