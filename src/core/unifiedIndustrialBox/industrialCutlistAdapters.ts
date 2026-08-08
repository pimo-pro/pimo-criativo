/**
 * Adapters cutlist industriais. Ordem: A=10, B patch=20, D=30.
 * Delega aos extractors/layout existentes — comportamento idêntico.
 * Idempotente: não duplica se as peças da feature já existirem no cutlist.
 */

import { isIndustrialDoorPanelTipo } from "../doors/industrialDoorPanels";
import { extractCxGavCutlistFromBox } from "../cxGav/cxGavCutlistAdapter";
import { boxUsesCxGav, CX_GAV_PRODUCT_MODE_ID } from "../cxGav/cxGavGeometry";
import {
  boxUsesGavetaPortaSep,
  computeGavetaPortaSepLayout,
  GAVETA_PORTA_SEP_DOOR_GAP_MM,
  GAVETA_PORTA_SEP_FRONT_GAP_MM,
  GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
} from "../productModes/gavetaPortaSepLayout";
import { extractA1CutlistFromBox } from "../innerCabinet/a1CutlistAdapter";
import {
  boxUsesInnerCabinetA1,
  INNER_CABINET_A1_PRODUCT_MODE,
} from "../innerCabinet/a1Geometry";
import type { IndustrialCutlistAdapter, IndustrialCutlistAdapterContext } from "./types";

function sanitizeBoxLabel(name?: string): string {
  return (
    String(name || "BOX")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "")
      .slice(0, 32) || "BOX"
  );
}

export const INDUSTRIAL_CUTLIST_ADAPTERS: readonly IndustrialCutlistAdapter[] = [
  {
    id: "adapter.cx_gav.cutlist",
    featureId: CX_GAV_PRODUCT_MODE_ID,
    order: 10,
    matches: (box) => boxUsesCxGav(box),
    apply: (ctx) => {
      if (ctx.items.some((i) => String(i.tipo).startsWith("cx_gav"))) return;
      const raw = extractCxGavCutlistFromBox(
        ctx.syncedBox,
        ctx.bodyMaterialKey,
        ctx.boxName
      );
      const priced = ctx.priceRaw(raw).map((item) => ({
        ...ctx.baseItem,
        ...item,
        materialId: ctx.resolveMaterialId(item.materialId, ctx.bodyMaterialKey),
        material: item.material ?? ctx.material,
        visualMaterial: ctx.visualMaterial,
        faceMaterials: ctx.baseItem.faceMaterials,
      }));
      ctx.items.push(...priced);
    },
  },
  {
    id: "adapter.gaveta_porta_sep.patch",
    featureId: GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
    order: 20,
    matches: (box) => boxUsesGavetaPortaSep(box),
    apply: (ctx) => {
      const layout = computeGavetaPortaSepLayout(ctx.syncedBox);
      const boxLabel = sanitizeBoxLabel(ctx.boxName);
      for (const item of ctx.items) {
        if (item.tipo === "gaveta_frente_ext" || item.tipo === "gaveta_frente") {
          item.dimensoes = {
            ...item.dimensoes,
            largura: layout.drawerFrontWidthMm,
            altura: layout.drawerFrontHeightMm,
          };
          item.metadata = {
            ...(item.metadata ?? {}),
            industrialGapMm: GAVETA_PORTA_SEP_FRONT_GAP_MM,
            gavetaPortaSep: true,
          };
        }
        if (isIndustrialDoorPanelTipo(item.tipo)) {
          item.dimensoes = {
            ...item.dimensoes,
            largura: layout.doorWidthMm,
            altura: layout.doorHeightMm,
          };
          item.metadata = {
            ...(item.metadata ?? {}),
            industrialGapMm: GAVETA_PORTA_SEP_DOOR_GAP_MM,
            portaParcial: true,
            industrialLabel:
              (typeof item.metadata?.industrialLabel === "string" &&
                item.metadata.industrialLabel) ||
              `${boxLabel}_port_cima`,
          };
        }
      }
    },
  },
  {
    id: "adapter.a1.cutlist",
    featureId: INNER_CABINET_A1_PRODUCT_MODE,
    order: 30,
    matches: (box) => boxUsesInnerCabinetA1(box),
    apply: (ctx) => {
      if (ctx.items.some((i) => String(i.tipo).startsWith("a1_cx"))) return;
      const raw = extractA1CutlistFromBox(
        ctx.syncedBox,
        ctx.bodyMaterialKey,
        ctx.boxName
      );
      const priced = ctx.priceRaw(raw).map((item) => ({
        ...ctx.baseItem,
        ...item,
        materialId: ctx.resolveMaterialId(item.materialId, ctx.bodyMaterialKey),
        material: item.material ?? ctx.material,
        visualMaterial: ctx.visualMaterial,
        faceMaterials: ctx.baseItem.faceMaterials,
      }));
      ctx.items.push(...priced);
    },
  },
];

export function applyIndustrialCutlistAdapters(
  ctx: IndustrialCutlistAdapterContext
): void {
  const sorted = [...INDUSTRIAL_CUTLIST_ADAPTERS].sort((a, b) => a.order - b.order);
  for (const adapter of sorted) {
    if (adapter.matches(ctx.syncedBox)) adapter.apply(ctx);
  }
}
