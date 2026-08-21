import type { WorkspaceBox } from "../types";
import type { SettingsSchema } from "../settings/settingsSchema";
import type { DrawerLayerItem } from "../../models/BoxLayers";
import { canBoxHaveDrawers } from "./DrawerGenerationService";
import {
  SOFT_CLOSE_COMPATIBLE_SLIDES,
  isDrawerSlideTypeActive,
  isDrawerMetalBoxTypeActive,
} from "./drawerUiConstants";
import {
  isMetalBoxCatalogType,
  resolveMetalBoxHeightMm,
  resolveMetalBoxProfile,
} from "./drawerMetalBoxCatalog";
import { isErgonomicDrawerHeightMode } from "./drawerHeightModeTypes";
import { calculateDrawerHeights } from "./DrawerGroup";
import {
  COMFORT_REACH_MAX_MM,
  COMFORT_REACH_MIN_MM,
  ERGONOMIC_MAX_DRAWER_HEIGHT_MM,
  ERGONOMIC_MIN_DRAWER_HEIGHT_MM,
  estimateDrawerCenterHeightsFromFloorMm,
} from "./drawerErgonomicsHeights";
import { resolveDrawerErgonomicsRules } from "./drawerErgonomicsContext";
import { resolveDrawerUsableDepthMm } from "./drawerSlideDepth";

export type DrawerUiAlertLevel = "warning" | "error";

export type DrawerUiAlert = {
  level: DrawerUiAlertLevel;
  message: string;
  drawerId?: string;
};

const CUSTOM_HEIGHT_GAP_MM = 10;

/** Altura útil interna do vão de gavetas (mm): altura caixa − pés − folga base. */
export function resolveDrawerUsableInternalHeightMm(
  box: Pick<WorkspaceBox, "dimensoes" | "feetEnabled" | "feetHeight" | "pe_cm">,
  gapMm: number = CUSTOM_HEIGHT_GAP_MM
): number {
  const feetHeightMm =
    box.feetEnabled !== false ? Number(box.feetHeight ?? (box.pe_cm ?? 10) * 10) : 0;
  return Math.max(1, box.dimensoes.altura - feetHeightMm - gapMm);
}

/**
 * Profundidade útil para curso da corrediça (mm).
 * Mesmo modelo industrial: P_ext − costa − frente − folga corrediça
 * (não usar gavetaRecuoCorpoMm — provoça falso positivo no aviso de curso).
 */
export function resolveDrawerUsableInternalDepthMm(
  box: Pick<WorkspaceBox, "dimensoes">,
  settings: SettingsSchema["gavetas"]
): number {
  const depth = Number(box.dimensoes.profundidade) || 0;
  const frontThickness = Number(settings.gavetaEspessuraFrenteMm) || 0;
  const runnerClearance = Number(settings.gavetaRecuoProfundidadeCorredicaMm) || 0;
  return resolveDrawerUsableDepthMm(depth, frontThickness, runnerClearance);
}

export function validateDrawerFeetWarning(
  drawer: DrawerLayerItem,
  box: Pick<WorkspaceBox, "dimensoes" | "feetEnabled" | "feetHeight" | "pe_cm" | "drawersLayer">,
  drawerIndex: number
): DrawerUiAlert[] {
  if (drawerIndex !== 0) return [];
  const feetHeightMm =
    box.feetEnabled !== false ? Number(box.feetHeight ?? (box.pe_cm ?? 10) * 10) : 0;
  if (feetHeightMm <= 0) return [];

  const usableHeight = resolveDrawerUsableInternalHeightMm(box);
  if (feetHeightMm > usableHeight * 0.35 || feetHeightMm > drawer.height * 0.35) {
    return [
      {
        level: "warning",
        message: "Rodapé/pés demasiado altos para a gaveta inferior.",
        drawerId: drawer.id,
      },
    ];
  }
  return [];
}

export function validateDrawerSlideCourseWarning(
  drawer: DrawerLayerItem,
  box: Pick<WorkspaceBox, "dimensoes">,
  settings: SettingsSchema["gavetas"]
): DrawerUiAlert[] {
  const usefulDepth = resolveDrawerUsableInternalDepthMm(box, settings);
  const pullMm =
    Number(drawer.bodyDepth) > 0
      ? Number(drawer.bodyDepth)
      : Math.max(0, (Number(drawer.depth) || 0) - (Number(drawer.frontThickness) || 0));
  if (usefulDepth > 0 && pullMm > usefulDepth) {
    return [
      {
        level: "warning",
        message: "Curso da corrediça excede a profundidade interna do módulo.",
        drawerId: drawer.id,
      },
    ];
  }
  return [];
}

export function getDrawerInternalHeightMm(boxHeightMm: number): number {
  return Math.max(1, boxHeightMm - CUSTOM_HEIGHT_GAP_MM);
}

export function validateBoxDrawerCount(
  box: Pick<WorkspaceBox, "dimensoes">,
  drawerCount: number
): DrawerUiAlert[] {
  if (drawerCount <= 0) return [];
  const check = canBoxHaveDrawers(
    box.dimensoes.largura,
    box.dimensoes.altura,
    box.dimensoes.profundidade,
    drawerCount
  );
  if (check.valid) return [];
  return [{ level: "error", message: check.reason ?? "Configuração de gavetas inválida." }];
}

export function validateCustomDrawerHeights(
  heights: number[],
  boxHeightMm: number,
  settings: SettingsSchema["gavetas"]
): DrawerUiAlert[] {
  const alerts: DrawerUiAlert[] = [];
  const internal = getDrawerInternalHeightMm(boxHeightMm);
  const sum = heights.reduce((acc, h) => acc + (Number.isFinite(h) ? h : 0), 0);
  const tolerance = 2;

  if (Math.abs(sum - internal) > tolerance) {
    alerts.push({
      level: "warning",
      message: `Soma das alturas (${Math.round(sum)} mm) difere da altura interna (${internal} mm).`,
    });
  }

  heights.forEach((height, index) => {
    if (!Number.isFinite(height) || height <= 0) {
      alerts.push({
        level: "error",
        message: `Gaveta ${index + 1}: altura inválida.`,
      });
      return;
    }
    if (height < settings.gavetaAlturaMinimaMm) {
      alerts.push({
        level: "warning",
        message: `Gaveta ${index + 1}: altura abaixo do mínimo (${settings.gavetaAlturaMinimaMm} mm).`,
      });
    }
    if (height > settings.gavetaAlturaMaximaMm) {
      alerts.push({
        level: "warning",
        message: `Gaveta ${index + 1}: altura acima do máximo (${settings.gavetaAlturaMaximaMm} mm).`,
      });
    }
  });

  return alerts;
}

export function validateDrawerLayerItem(
  drawer: DrawerLayerItem,
  box: Pick<WorkspaceBox, "dimensoes">,
  settings: SettingsSchema["gavetas"]
): DrawerUiAlert[] {
  const alerts: DrawerUiAlert[] = [];
  const drawerId = drawer.id;
  const height = drawer.height;
  const slideType = drawer.slideType ?? settings.gavetaTipoCorredica;
  const metalBoxType = drawer.metalBoxType ?? settings.gavetaTipoCaixaMetalica;
  const softClose = drawer.softClose ?? settings.gavetaSoftClose;
  const nominalDepth = drawer.metadata?.nominalDepth ?? drawer.depth;

  // Restrição industrial temporária: apenas Quadro V6 / AvanTech ativos.
  if (!isDrawerSlideTypeActive(slideType)) {
    alerts.push({
      level: "error",
      message: `Corrediça "${slideType}" — EM BREVE (usar Hettich Quadro V6 You M Silent System).`,
      drawerId,
    });
  }
  if (metalBoxType !== "Nenhuma" && !isDrawerMetalBoxTypeActive(metalBoxType)) {
    alerts.push({
      level: "error",
      message: `Caixa metálica "${metalBoxType}" — EM BREVE (usar Hettich AvanTech).`,
      drawerId,
    });
  }

  if (height < settings.gavetaAlturaMinimaMm) {
    alerts.push({
      level: "warning",
      message: `Altura abaixo do mínimo (${settings.gavetaAlturaMinimaMm} mm).`,
      drawerId,
    });
  }
  if (height > settings.gavetaAlturaMaximaMm) {
    alerts.push({
      level: "warning",
      message: `Altura acima do máximo (${settings.gavetaAlturaMaximaMm} mm).`,
      drawerId,
    });
  }

  if (
    settings.gavetaValidarSoftCloseCompativel &&
    softClose &&
    !SOFT_CLOSE_COMPATIBLE_SLIDES.has(slideType)
  ) {
    alerts.push({
      level: "warning",
      message: `Soft-close pode ser incompatível com ${slideType}.`,
      drawerId,
    });
  }

  if (isMetalBoxCatalogType(metalBoxType)) {
    const profile = resolveMetalBoxProfile(
      metalBoxType,
      drawer.metadata?.metalBoxProfileId,
      drawer.metadata?.metalBoxHeightMm
    );
    const metalHeight = profile
      ? resolveMetalBoxHeightMm(profile, drawer.metadata?.metalBoxHeightMm)
      : settings.gavetaAlturaCaixaMetalicaMm;
    if (metalHeight > 0 && height < metalHeight) {
      alerts.push({
        level: "warning",
        message: `Altura insuficiente para caixa metálica (${metalHeight} mm).`,
        drawerId,
      });
    }
    const compatibleDepths = profile?.compatibleDepthsMm ?? settings.gavetaProfundidadesCompativeisMm;
    if (
      settings.gavetaValidarProfundidadeCompativel &&
      nominalDepth > 0 &&
      compatibleDepths.length > 0 &&
      !compatibleDepths.includes(nominalDepth)
    ) {
      alerts.push({
        level: "warning",
        message: `Profundidade ${nominalDepth} mm pode ser incompatível com ${metalBoxType}.`,
        drawerId,
      });
    }
  } else if (metalBoxType !== "Nenhuma") {
    if (
      settings.gavetaAlturaCaixaMetalicaMm > 0 &&
      height < settings.gavetaAlturaCaixaMetalicaMm
    ) {
      alerts.push({
        level: "warning",
        message: `Altura insuficiente para caixa metálica (${settings.gavetaAlturaCaixaMetalicaMm} mm).`,
        drawerId,
      });
    }
    const compatibleDepths = settings.gavetaProfundidadesCompativeisMm;
    if (
      settings.gavetaValidarProfundidadeCompativel &&
      nominalDepth > 0 &&
      compatibleDepths.length > 0 &&
      !compatibleDepths.includes(nominalDepth)
    ) {
      alerts.push({
        level: "warning",
        message: `Profundidade ${nominalDepth} mm pode ser incompatível com ${metalBoxType}.`,
        drawerId,
      });
    }
  }

  const availableDepths = settings.gavetaProfundidadesDisponiveisMm;
  if (
    nominalDepth > 0 &&
    availableDepths.length > 0 &&
    !availableDepths.includes(nominalDepth)
  ) {
    alerts.push({
      level: "warning",
      message: `Profundidade ${nominalDepth} mm fora da lista disponível.`,
      drawerId,
    });
  }

  if (box.dimensoes.profundidade < 100) {
    alerts.push({
      level: "error",
      message: "Profundidade do módulo insuficiente para gavetas.",
      drawerId,
    });
  }

  for (const warning of drawer.drawerWarnings ?? []) {
    alerts.push({ level: "warning", message: warning, drawerId });
  }

  return alerts;
}

export function validateDrawerLayerItemWithIndex(
  drawer: DrawerLayerItem,
  box: WorkspaceBox,
  settings: SettingsSchema["gavetas"],
  drawerIndex: number
): DrawerUiAlert[] {
  return [
    ...validateDrawerLayerItem(drawer, box, settings),
    ...validateDrawerFeetWarning(drawer, box, drawerIndex),
    ...validateDrawerSlideCourseWarning(drawer, box, settings),
  ];
}

export function validateErgonomicDrawerHeights(
  box: Pick<WorkspaceBox, "dimensoes" | "feetEnabled" | "feetHeight" | "pe_cm" | "drawerHeightMode" | "gavetas">,
  settings: SettingsSchema["gavetas"]
): DrawerUiAlert[] {
  const count = box.gavetas ?? 0;
  if (count <= 0) return [];

  const mode = box.drawerHeightMode ?? settings.gavetaAlturaModoPadrao;
  if (!isErgonomicDrawerHeightMode(mode)) return [];

  const heights = calculateDrawerHeights(count, box.dimensoes.altura, mode, undefined, {
    ergonomicsRules: resolveDrawerErgonomicsRules(),
    minHeightMm: settings.gavetaAlturaMinimaMm,
    maxHeightMm: settings.gavetaAlturaMaximaMm,
  });
  const alerts: DrawerUiAlert[] = [];

  const minH = settings.gavetaAlturaMinimaMm ?? ERGONOMIC_MIN_DRAWER_HEIGHT_MM;
  const maxH = settings.gavetaAlturaMaximaMm ?? ERGONOMIC_MAX_DRAWER_HEIGHT_MM;

  heights.forEach((h, index) => {
    if (h < minH - 0.5) {
      alerts.push({
        level: "warning",
        message: `Gaveta ${index + 1}: altura ${Math.round(h)} mm abaixo do mínimo ergonómico (${minH} mm).`,
      });
    }
    if (h > maxH + 0.5) {
      alerts.push({
        level: "warning",
        message: `Gaveta ${index + 1}: altura ${Math.round(h)} mm acima do máximo (${maxH} mm).`,
      });
    }
  });

  const feetMm = box.feetEnabled !== false ? Number(box.feetHeight ?? (box.pe_cm ?? 10) * 10) : 0;
  const rules = resolveDrawerErgonomicsRules();
  const centers = estimateDrawerCenterHeightsFromFloorMm(
    heights,
    rules.baseCabinetHeightMm ?? box.dimensoes.altura,
    feetMm
  );
  const comfortDrawer = centers.findIndex(
    (c) => c >= COMFORT_REACH_MIN_MM && c <= COMFORT_REACH_MAX_MM
  );
  if (comfortDrawer < 0 && count >= 2) {
    alerts.push({
      level: "warning",
      message: `Nenhuma gaveta centra na zona de alcance confortável (${COMFORT_REACH_MIN_MM}–${COMFORT_REACH_MAX_MM} mm).`,
    });
  }

  if (heights.length > 0 && heights[heights.length - 1]! < minH * 1.1) {
    alerts.push({
      level: "warning",
      message: "Gaveta inferior demasiado baixa — evitar zona de pegada desconfortável.",
    });
  }

  return alerts;
}

export function validateBoxDrawerConfiguration(
  box: WorkspaceBox,
  settings: SettingsSchema["gavetas"]
): DrawerUiAlert[] {
  const alerts: DrawerUiAlert[] = [];
  const count = box.gavetas ?? 0;
  if (count <= 0) return alerts;

  alerts.push(...validateBoxDrawerCount(box, count));

  const mode = box.drawerHeightMode ?? settings.gavetaAlturaModoPadrao;
  if (mode === "custom") {
    const heights = (box.drawersLayer ?? []).map((d) => d.height);
    alerts.push(...validateCustomDrawerHeights(heights, box.dimensoes.altura, settings));
  } else if (isErgonomicDrawerHeightMode(mode)) {
    alerts.push(...validateErgonomicDrawerHeights(box, settings));
  }

  for (let index = 0; index < (box.drawersLayer ?? []).length; index++) {
    const drawer = box.drawersLayer![index]!;
    alerts.push(...validateDrawerLayerItemWithIndex(drawer, box, settings, index));
  }

  return alerts;
}
