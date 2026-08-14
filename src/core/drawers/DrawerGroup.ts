/**
 * DrawerGroup
 * 
 * Representa um conjunto de gavetas em um box, com distribuição
 * automática de alturas e posicionamento vertical.
 */

import type { DrawerHeightMode } from "./drawerHeightModeTypes";
import { isErgonomicDrawerHeightMode } from "./drawerHeightModeTypes";
import {
  calculateErgonomicDrawerHeights,
  type ErgonomicHeightRules,
  type KitchenZoneProfile,
} from "./drawerErgonomicsHeights";
import type { Drawer } from "./Drawer";
import {
  resolveDrawerVerticalPositions,
  calculateEqualQuaseDrawerHeights,
  DRAWER_VERTICAL_BASE_OFFSET_MM,
  DRAWER_VERTICAL_GAP_MM,
  getDrawerUsableInternalHeightMm,
} from "./drawerVerticalPosition";

export { calculateEqualQuaseDrawerHeights };

export interface DrawerGroup {
  id: string;
  parentBoxId: string;
  drawers: Drawer[];
  
  // Configuração de distribuição
  heightMode: DrawerHeightMode;
  customHeights?: number[];
  
  // Dimensões do box de referência
  boxDimensions: {
    width: number;
    height: number;
    depth: number;
    thickness: number;
  };
}

export type CalculateDrawerHeightsOptions = {
  customHeights?: number[];
  ergonomicsRules?: ErgonomicHeightRules;
  kitchenZoneProfile?: KitchenZoneProfile;
  minHeightMm?: number;
  maxHeightMm?: number;
  /** Espessura CIMA (validação overlay; não força alturas fixas). */
  topPanelThicknessMm?: number;
};

/**
 * Calcula a distribuição de alturas para as gavetas
 */
export function calculateDrawerHeights(
  count: number,
  totalHeight: number,
  mode: DrawerHeightMode,
  customHeights?: number[],
  options?: Omit<CalculateDrawerHeightsOptions, "customHeights">
): number[] {
  if (count <= 0) return [];

  const usable = getDrawerUsableInternalHeightMm(totalHeight);
  const gapTotal = Math.max(0, count - 1) * DRAWER_VERTICAL_GAP_MM;
  const distributable = Math.max(1, usable - gapTotal);

  if (isErgonomicDrawerHeightMode(mode)) {
    return calculateErgonomicDrawerHeights({
      drawerCount: count,
      usableHeightMm: usable,
      mode,
      minHeightMm: options?.minHeightMm,
      maxHeightMm: options?.maxHeightMm,
      gapMm: DRAWER_VERTICAL_GAP_MM,
      ergonomicsRules: options?.ergonomicsRules,
      kitchenZoneProfile: options?.kitchenZoneProfile,
    });
  }

  // Modo custom
  const custom = customHeights;
  if (mode === "custom" && custom && custom.length > 0) {
    const raw = Array.from({ length: count }, (_, index) => {
      const value = custom[index];
      return Number.isFinite(value) && value! > 0 ? value! : distributable / count;
    });
    const sum = raw.reduce((acc, v) => acc + v, 0);
    const target = distributable;
    if (sum <= 0) return Array.from({ length: count }, () => target / count);
    const scale = target / sum;
    return raw.map((v) => v * scale);
  }

  // Modo equal — Diff 3: equal_quase interno (1.ª frente −2 mm)
  if (mode === "equal" || count === 1) {
    return calculateEqualQuaseDrawerHeights(count, distributable);
  }

  // Modo progressivo (2 gavetas) — índice 0 = inferior (maior), último = superior (menor)
  if (count === 2) {
    const upper = distributable * 0.4;
    const lower = distributable - upper;
    return [lower, upper];
  }

  // Modo progressivo (3+ gavetas) — índice 0 = inferior (peso maior)
  const upperWeight = 0.2;
  const lowerWeight = 0.4;
  const middleWeight = 1 - upperWeight - lowerWeight;
  const middleCount = count - 2;
  const middleEach = middleWeight / middleCount;
  const weights = [lowerWeight, ...Array.from({ length: middleCount }, () => middleEach), upperWeight];
  const heights = weights.map((w) => w * distributable);

  const sum = heights.reduce((acc, value) => acc + value, 0);
  const diff = distributable - sum;
  heights[0] += diff;

  return heights;
}

/**
 * Calcula as posições Y das gavetas a partir da base do box
 */
export function calculateDrawerPositions(
  heights: number[],
  boxHeight: number,
  baseOffset: number = DRAWER_VERTICAL_BASE_OFFSET_MM,
  options?: { topPanelThicknessMm?: number }
): number[] {
  return resolveDrawerVerticalPositions(heights, boxHeight, baseOffset, options);
}

/**
 * Recalcula o layout de todas as gavetas do grupo
 */
export function recalculateDrawerGroupLayout(group: DrawerGroup): DrawerGroup {
  const heights = calculateDrawerHeights(
    group.drawers.length,
    group.boxDimensions.height,
    group.heightMode,
    group.customHeights,
    { topPanelThicknessMm: group.boxDimensions.thickness }
  );

  const positions = calculateDrawerPositions(
    heights,
    group.boxDimensions.height,
    DRAWER_VERTICAL_BASE_OFFSET_MM,
    { topPanelThicknessMm: group.boxDimensions.thickness }
  );

  const updatedDrawers = group.drawers.map((drawer, index) => ({
    ...drawer,
    position: {
      ...drawer.position,
      y: positions[index],
    },
  }));

  return {
    ...group,
    drawers: updatedDrawers,
  };
}

/**
 * Adiciona uma gaveta ao grupo
 */
export function addDrawerToGroup(group: DrawerGroup, drawer: Drawer): DrawerGroup {
  return recalculateDrawerGroupLayout({
    ...group,
    drawers: [...group.drawers, drawer],
  });
}

/**
 * Remove uma gaveta do grupo
 */
export function removeDrawerFromGroup(group: DrawerGroup, drawerId: string): DrawerGroup {
  return recalculateDrawerGroupLayout({
    ...group,
    drawers: group.drawers.filter((d) => d.id !== drawerId),
  });
}

/**
 * Atualiza o modo de distribuição de alturas
 */
export function updateHeightMode(
  group: DrawerGroup,
  mode: DrawerHeightMode,
  customHeights?: number[]
): DrawerGroup {
  return recalculateDrawerGroupLayout({
    ...group,
    heightMode: mode,
    customHeights,
  });
}
