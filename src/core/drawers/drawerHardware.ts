import type { DrawerLayerItem, DrawerLayerMetadata } from "../../models/BoxLayers";
import type {
  DrawerHandleType,
  DrawerMetalBoxType,
  DrawerSlideType,
} from "../settings/settingsSchema";
import { getSettings } from "../settings/settingsService";
import {
  isMetalBoxCatalogType,
  listMetalBoxProfilesForType,
  pickCompatibleMetalDepth,
  resolveMetalBoxHeightMm,
  resolveMetalBoxProfile,
} from "./drawerMetalBoxCatalog";
import { getDefaultProfileForHandleType } from "./drawerHandleCatalog";

/** Origem da config de ferragens na gaveta (prioridade individual vs global). */
export type DrawerHardwareSource = "global" | "individual";

/** Sistema de corrediça inicial (padrão) — Genérica permanece seleccionível. */
export const drawerHardware = {
  defaultSystem: "Hettich ArciTech" as DrawerSlideType,
} as const;

/** Rascunho / payload das Ferragens globais (campos pedidos na ficha). */
export type DrawerHardwareDraft = {
  slideType: DrawerSlideType;
  metalBoxType: DrawerMetalBoxType;
  softClose: boolean;
  handleType: DrawerHandleType;
  nominalDepth: number;
  metalBoxProfileId?: string;
  metalBoxHeightMm?: number;
  handleProfileId?: string;
  handleCenterDistanceMm?: number;
};

const HARDWARE_ITEM_KEYS = [
  "slideType",
  "metalBoxType",
  "softClose",
  "handleType",
  "handlePosition",
  "handleOffsetMm",
  "type",
  "drawerType",
  "bodyHeight",
] as const;

const HARDWARE_META_KEYS = [
  "slideType",
  "metalBoxType",
  "softClose",
  "handleType",
  "handlePosition",
  "handleOffsetMm",
  "handleProfileId",
  "handleCenterDistanceMm",
  "handleOffsetXMm",
  "handleOffsetYMm",
  "handlePositionPercent",
  "nominalDepth",
  "metalBoxProfileId",
  "metalBoxHeightMm",
  "drawerType",
] as const;

export function isDrawerHardwarePartial(partial: Partial<DrawerLayerItem>): boolean {
  for (const key of HARDWARE_ITEM_KEYS) {
    if (key in partial) return true;
  }
  const meta = partial.metadata;
  if (!meta) return false;
  return HARDWARE_META_KEYS.some((key) => key in meta);
}

export function createDefaultHardwareDraft(
  seed?: Partial<DrawerHardwareDraft> | null
): DrawerHardwareDraft {
  const settings = getSettings().gavetas;
  const metalBoxType = (seed?.metalBoxType ?? settings.gavetaTipoCaixaMetalica) as DrawerMetalBoxType;
  const profile =
    isMetalBoxCatalogType(metalBoxType)
      ? resolveMetalBoxProfile(metalBoxType, seed?.metalBoxProfileId, seed?.metalBoxHeightMm)
      : null;
  const handleType = (seed?.handleType ?? settings.gavetaTipoHandle) as DrawerHandleType;
  const defaultHandle = getDefaultProfileForHandleType(handleType);
  const depthFallback = settings.gavetaProfundidadesDisponiveisMm[0] ?? 500;
  const nominalDepth =
    seed?.nominalDepth && seed.nominalDepth > 0
      ? seed.nominalDepth
      : profile
        ? pickCompatibleMetalDepth(profile, depthFallback)
        : depthFallback;

  return {
    slideType: (seed?.slideType ??
      profile?.defaultSlideType ??
      drawerHardware.defaultSystem ??
      settings.gavetaTipoCorredica) as DrawerSlideType,
    metalBoxType,
    softClose: seed?.softClose ?? false,
    handleType,
    nominalDepth,
    metalBoxProfileId: seed?.metalBoxProfileId ?? profile?.id,
    metalBoxHeightMm:
      seed?.metalBoxHeightMm ??
      (profile ? resolveMetalBoxHeightMm(profile) : settings.gavetaAlturaCaixaMetalicaMm),
    handleProfileId: seed?.handleProfileId ?? defaultHandle?.id,
    handleCenterDistanceMm:
      seed?.handleCenterDistanceMm ?? defaultHandle?.defaultCenterDistanceMm,
  };
}

export function draftFromDrawer(drawer: DrawerLayerItem): DrawerHardwareDraft {
  const settings = getSettings().gavetas;
  return createDefaultHardwareDraft({
    slideType:
      drawer.slideType ??
      drawer.metadata?.slideType ??
      drawerHardware.defaultSystem ??
      settings.gavetaTipoCorredica,
    metalBoxType: drawer.metalBoxType ?? drawer.metadata?.metalBoxType ?? settings.gavetaTipoCaixaMetalica,
    softClose: Boolean(drawer.softClose ?? drawer.metadata?.softClose),
    handleType: drawer.handleType ?? drawer.metadata?.handleType ?? settings.gavetaTipoHandle,
    nominalDepth: drawer.metadata?.nominalDepth ?? drawer.depth,
    metalBoxProfileId: drawer.metadata?.metalBoxProfileId,
    metalBoxHeightMm: drawer.metadata?.metalBoxHeightMm,
    handleProfileId: drawer.metadata?.handleProfileId,
    handleCenterDistanceMm: drawer.metadata?.handleCenterDistanceMm,
  });
}

/**
 * Constrói o partial de layer a partir do draft global.
 * `hardwareSource: "global"` limpa a prioridade individual.
 */
export function buildHardwarePartialFromDraft(
  draft: DrawerHardwareDraft,
  source: DrawerHardwareSource,
  current?: DrawerLayerItem
): Partial<DrawerLayerItem> {
  const settings = getSettings().gavetas;
  const metalBoxType = draft.metalBoxType;
  let slideType = draft.slideType;
  let bodyHeight: number | undefined;
  let metalBoxProfileId = draft.metalBoxProfileId;
  let metalBoxHeightMm = draft.metalBoxHeightMm;
  let nominalDepth = draft.nominalDepth;

  if (metalBoxType === "Nenhuma") {
    metalBoxProfileId = undefined;
    metalBoxHeightMm = undefined;
  } else if (isMetalBoxCatalogType(metalBoxType)) {
    const profiles = listMetalBoxProfilesForType(metalBoxType);
    const profile =
      resolveMetalBoxProfile(metalBoxType, metalBoxProfileId, metalBoxHeightMm) ??
      profiles[0] ??
      null;
    if (profile) {
      metalBoxProfileId = profile.id;
      metalBoxHeightMm = resolveMetalBoxHeightMm(profile, metalBoxHeightMm);
      bodyHeight = metalBoxHeightMm;
      slideType = (profile.defaultSlideType ?? slideType) as DrawerSlideType;
      nominalDepth = pickCompatibleMetalDepth(
        profile,
        nominalDepth || current?.metadata?.nominalDepth || current?.depth || settings.gavetaProfundidadesDisponiveisMm[0]
      );
    }
  }

  const handleType = draft.handleType;
  const defaultHandle = getDefaultProfileForHandleType(handleType);
  const handleProfileId = draft.handleProfileId ?? defaultHandle?.id;
  const handleCenterDistanceMm =
    draft.handleCenterDistanceMm ?? defaultHandle?.defaultCenterDistanceMm;

  const metadata: DrawerLayerMetadata = {
    ...(current?.metadata ?? {}),
    slideType,
    metalBoxType,
    softClose: draft.softClose,
    handleType,
    nominalDepth,
    metalBoxProfileId,
    metalBoxHeightMm,
    handleProfileId,
    handleCenterDistanceMm,
    hardwareSource: source,
  };

  const partial: Partial<DrawerLayerItem> = {
    slideType,
    metalBoxType,
    softClose: draft.softClose,
    handleType,
    metadata,
  };

  if (bodyHeight != null && bodyHeight > 0) {
    const frontOverride = current?.metadata?.frontHeightMm;
    partial.bodyHeight = bodyHeight;
    partial.height =
      frontOverride != null && frontOverride > 0 ? frontOverride : bodyHeight;
  }

  return partial;
}

export function markHardwareSourceIndividual(
  partial: Partial<DrawerLayerItem>
): Partial<DrawerLayerItem> {
  if (!isDrawerHardwarePartial(partial)) return partial;
  return {
    ...partial,
    metadata: {
      ...(partial.metadata ?? {}),
      hardwareSource: "individual",
    },
  };
}
