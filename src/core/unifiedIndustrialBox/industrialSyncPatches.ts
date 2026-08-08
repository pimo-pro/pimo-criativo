/**
 * Sync patches industriais (pré-cutlist). Ordem: B=10, C=20.
 * Delega 100% aos syncs existentes A–D.
 */

import type { BoxModule } from "../types";
import {
  boxUsesGavetaPortaSep,
  syncGavetaPortaSepBox,
  GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
} from "../productModes/gavetaPortaSepLayout";
import {
  boxUsesWardrobePartialSep,
  syncWardrobePartialSepBox,
  WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
} from "../wardrobe/partialSepToDiv";
import type { IndustrialSyncPatch } from "./types";

export const INDUSTRIAL_SYNC_PATCHES: readonly IndustrialSyncPatch[] = [
  {
    id: "sync.gaveta_porta_sep",
    featureId: GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
    order: 10,
    matches: (box) => boxUsesGavetaPortaSep(box),
    apply: (box) => syncGavetaPortaSepBox(box),
  },
  {
    id: "sync.wardrobe_sep_parcial",
    featureId: WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
    order: 20,
    matches: (box) => boxUsesWardrobePartialSep(box),
    apply: (box) => syncWardrobePartialSepBox(box),
  },
];

export function applyIndustrialSyncPatches<T extends BoxModule>(box: T): T {
  let next = box;
  const sorted = [...INDUSTRIAL_SYNC_PATCHES].sort((a, b) => a.order - b.order);
  for (const patch of sorted) {
    if (patch.matches(next)) next = patch.apply(next);
  }
  return next;
}
