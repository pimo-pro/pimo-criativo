import type { BoxModule, WorkspaceBox } from "../core/types";
import { getSettings } from "../core/settings/settingsService";
import type { DoorLayerItem, DrawerLayerItem } from "../models/BoxLayers";
import {
  generateDrawerGroup,
  drawerGroupToLayerItems,
  drawerToLayerItem,
  type DrawerGenerationConfig,
} from "../core/drawers";
import { resolveDrawerBodyCenterOffsetYMm } from "../core/drawers/drawerViewerLayout";
import { buildDrawerParametricOverridesList } from "../core/drawers/drawerParametricOverrides";
import { resolveDrawerErgonomicsRules } from "../core/drawers/drawerErgonomicsContext";
import { isErgonomicDrawerHeightMode } from "../core/drawers/drawerHeightModeTypes";
import { devLogger } from "../utils/devLogger";
import { getDefaultOfficialMaterial, resolveCostaThicknessMm } from "../core/materials/materials.api";
import {
  computeWardrobeLocalLayout,
  getWardrobeDoorCountForWidth,
  getWardrobeGroupFromBaseCabinetId,
  hasWardrobeLowerDrawers,
  hasWardrobeSideDrawerBox,
  isWardrobeModel,
} from "../core/wardrobe/wardrobeRules";
import {
  buildPartialSepToDivItems,
  isPartialSepCavilhaOnly,
  WARDROBE_PARTIAL_DIV_ID,
} from "../core/wardrobe/partialSepToDiv";
import { getCornerCabinetConfig, buildCornerDoorLayerItems } from "../core/cornerCabinet";
import {
  buildCaixaFornoDoorsLayer,
  isCaixaFornoBox,
  syncCaixaFornoOnDimensoesChange,
} from "../core/moveis/generators/caixaFornoGenerator";
import {
  backupLayerMaterials,
  restoreLayerMaterials,
} from "../core/viewer/materialPreservation";
import type { DivisorItem, SeparadorItem } from "../core/divSep/types";
import {
  boxUsesGavetaPortaSep,
  buildGavetaPortaSepSeparador,
  computeGavetaPortaSepLayout,
  GAVETA_PORTA_SEP_FRONT_GAP_MM,
  type GavetaPortaSepLayout,
} from "../core/productModes/gavetaPortaSepLayout";
import {
  boxUsesInnerCabinetA1,
  computeA1Layout,
  INNER_CABINET_A1_DEFAULT_DRAWER_COUNT,
  type A1Layout,
} from "../core/innerCabinet/a1Geometry";
import { DRAWER_FRONT_LATERAL_GAP_MM } from "../core/drawers/drawerGeometryConstants";

export interface BoxLayersState {
  doorsLayer: DoorLayerItem[];
  drawersLayer: DrawerLayerItem[];
  /** Fase B / C: SEP persistido no merge do workspace. */
  separadores?: SeparadorItem[];
  /** Fase C: DIV ligado ao SEP parcial. */
  divisores?: DivisorItem[];
}

export type RegenerateLayersOptions = {
  /** Quando true (padrão em resize), preserva materialId/material das layers existentes. */
  preserveMaterials?: boolean;
};

const MM_EPS = 1;

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const clamp = (value: number, min: number) => Math.max(min, Number.isFinite(value) ? value : min);

const _defaultMaterial = getDefaultOfficialMaterial();
const defaultDoorMaterial = _defaultMaterial.canonicalId;
const defaultDrawerMaterial = _defaultMaterial.canonicalId;

/**
 * Aplica regras de tipo de gaveta (delegando ao domínio de drawers)
 * @deprecated Use generateDrawerGroup from drawers domain instead
 */
export const applyDrawerTypeRules = (
  box: WorkspaceBox,
  drawer: DrawerLayerItem,
  settings = getSettings()
): DrawerLayerItem => {
  // Delegando ao domínio de drawers
  const drawerSettings = settings.gavetas;
  const config: DrawerGenerationConfig = {
    boxWidth: box.dimensoes.largura,
    boxHeight: box.dimensoes.altura,
    boxDepth: box.dimensoes.profundidade,
    boxThickness: box.espessura || 18,
    boxId: box.id,
    drawerCount: 1,
    drawerType: drawer.type ?? drawer.drawerType ?? box.drawerType ?? "normal",
    heightMode: "equal",
    customHeights: [drawer.height],
    availableDepths: drawerSettings.gavetaProfundidadesDisponiveisMm,
    drawerSettings,
    materialId: drawer.materialId,
    espessuraCostaMm: resolveCostaThicknessMm(box),
    costaAtiva: box.costaAtiva,
  };

  const group = generateDrawerGroup(config);
  const layerItem = drawerToLayerItem(group.drawers[0]);

  // Preserva estado de abertura
  return {
    ...layerItem,
    isOpen: drawer.isOpen,
    posY: drawer.posY,
  };
};

export function regenerateLayersForBox(
  box: WorkspaceBox,
  options?: RegenerateLayersOptions
): BoxLayersState {
  const preserveMaterials = options?.preserveMaterials !== false;
  const materialBackup = preserveMaterials ? backupLayerMaterials(box) : null;
  const settings = getSettings();
  const boxWidth = clamp(box.dimensoes.largura, 100);
  const boxHeight = clamp(box.dimensoes.altura, 100);
  const boxDepth = clamp(box.dimensoes.profundidade, 100);
  const thickness = clamp(box.espessura, 18);

  const drawerCountRaw = Math.max(0, Math.floor(box.gavetas || 0));
  const gps = boxUsesGavetaPortaSep(box);
  const gpsLayout: GavetaPortaSepLayout | null = gps ? computeGavetaPortaSepLayout(box) : null;
  const a1 = boxUsesInnerCabinetA1(box);
  const a1Layout: A1Layout | null = a1 ? computeA1Layout(box as unknown as BoxModule) : null;
  const drawerCount = gps
    ? Math.max(1, drawerCountRaw || 1)
    : a1
      ? Math.max(
          INNER_CABINET_A1_DEFAULT_DRAWER_COUNT,
          drawerCountRaw || INNER_CABINET_A1_DEFAULT_DRAWER_COUNT
        )
      : drawerCountRaw;
  const hasDrawers = drawerCount > 0;

  if (isCaixaFornoBox(box)) {
    const synced = syncCaixaFornoOnDimensoesChange(box);
    const doorsLayer = buildCaixaFornoDoorsLayer(synced, synced.doorsLayer);
    const generated = { doorsLayer, drawersLayer: [] as DrawerLayerItem[] };
    if (materialBackup) {
      return restoreLayerMaterials(generated, materialBackup);
    }
    return generated;
  }

  const doorsLayer: DoorLayerItem[] = [];
  const drawersLayer: DrawerLayerItem[] = [];

  // PORTAS: criar se portaTipo exigir (mesmo que existam gavetas/prateleiras).
  if (box.portaTipo === "porta_simples" || box.portaTipo === "porta_dupla") {
    const gapVertical = clamp(settings.portas.portaGapVerticalMm, 0);
    const gapHorizontal = clamp(settings.portas.portaGapHorizontalMm, 0);
    const doorGap = clamp(settings.portas.portaGapDuplaMm, 0);

    const cornerCfg = getCornerCabinetConfig(box.baseCabinetId);
    if (cornerCfg && box.portaTipo === "porta_simples") {
      doorsLayer.push(...buildCornerDoorLayerItems(box, box.doorsLayer));
    } else {
    const doorHeight = clamp(boxHeight - 2 * gapVertical, MM_EPS);
    const doorWidth = clamp(boxWidth - 2 * gapHorizontal, MM_EPS);
    // Center the door vertically: Y=0 is box center
    const doorPosY = 0;
    // Door posZ: fora da caixa (face frontal externa)
    const doorPosZ = boxDepth / 2 + clamp(settings.portas.portaPosZOffsetMm, 0);
    const wardrobeGroup = getWardrobeGroupFromBaseCabinetId(box.baseCabinetId);
    // Regra de engenharia de portas (max 600mm por folha) aplica a todos os grupos de roupeiro (H/J/T).
    const forcedDoorCount = wardrobeGroup ? getWardrobeDoorCountForWidth(boxWidth) : null;

    if (forcedDoorCount === 3) {
      const leafWidth = clamp((boxWidth - 2 * gapHorizontal - 2 * doorGap) / 3, MM_EPS);
      const leftEdgeX = -boxWidth / 2 + gapHorizontal;
      const makeDoor = (
        idx: number,
        openDirection: "left" | "right",
        hingeSide: "left" | "right",
        pivot: "left-edge" | "right-edge"
      ) => {
        const doorLeft = leftEdgeX + idx * (leafWidth + doorGap);
        const pivotX = pivot === "left-edge" ? doorLeft : doorLeft + leafWidth;
        doorsLayer.push({
          id: createId("door"),
          parentBoxId: box.id,
          groupType: "dupla",
          width: leafWidth,
          height: doorHeight,
          thickness,
          materialId: defaultDoorMaterial,
          material: defaultDoorMaterial,
          openDirection,
          isOpen: false,
          hingeSide,
          pivot,
          posX: pivotX,
          posY: doorPosY,
          posZ: doorPosZ,
          rotY: 0,
        });
      };

      // Folha 1 (esquerda) abre para esquerda; folhas 2/3 para direita.
      makeDoor(0, "left", "left", "left-edge");
      makeDoor(1, "right", "right", "right-edge");
      makeDoor(2, "right", "right", "right-edge");
    } else if (box.portaTipo === "porta_dupla") {
      const leafWidth = clamp((boxWidth - 2 * gapHorizontal - doorGap) / 2, MM_EPS);
      const leftCenterX = -(leafWidth / 2 + doorGap / 2);
      const rightCenterX = leafWidth / 2 + doorGap / 2;
      const leftPivotX = leftCenterX - leafWidth / 2;
      const rightPivotX = rightCenterX + leafWidth / 2;
      // PORTAS DUPLAS: Gap de 2mm entre portas, centros conforme especificacao
      doorsLayer.push(
        {
          id: createId("door"),
          parentBoxId: box.id,
          groupType: "dupla",
          width: leafWidth,
          height: doorHeight,
          thickness,
          materialId: defaultDoorMaterial,
          material: defaultDoorMaterial,
          openDirection: "left",
          isOpen: false,
          hingeSide: "left",
          pivot: "left-edge",
          posX: leftPivotX,
          posY: doorPosY,
          posZ: doorPosZ,
          rotY: 0,
        },
        {
          id: createId("door"),
          parentBoxId: box.id,
          groupType: "dupla",
          width: leafWidth,
          height: doorHeight,
          thickness,
          materialId: defaultDoorMaterial,
          material: defaultDoorMaterial,
          openDirection: "right",
          isOpen: false,
          hingeSide: "right",
          pivot: "right-edge",
          posX: rightPivotX,
          posY: doorPosY,
          posZ: doorPosZ,
          rotY: 0,
        }
      );
    } else {
      const doorCenterX = 0;
      const doorWidthGps = gpsLayout ? gpsLayout.doorWidthMm : doorWidth;
      const doorHeightGps = gpsLayout ? gpsLayout.doorHeightMm : doorHeight;
      const doorPosYGps = gpsLayout ? gpsLayout.doorPosYMm : doorPosY;
      const doorPivotX = doorCenterX - doorWidthGps / 2;
      doorsLayer.push({
        id: createId("door"),
        parentBoxId: box.id,
        groupType: "simples",
        width: doorWidthGps,
        height: doorHeightGps,
        thickness,
        materialId: defaultDoorMaterial,
        material: defaultDoorMaterial,
        openDirection: "left",
        isOpen: false,
        hingeSide: "left",
        pivot: "left-edge",
        posX: doorPivotX,
        posY: doorPosYGps,
        posZ: doorPosZ,
        rotY: 0,
      });
    }
    }
  }

  // GAVETAS: pipeline clássico (Modelo A / Sistema Unificado)
  if (hasDrawers) {
    const drawerSettings = settings.gavetas;
    const drawerType = box.drawerType ?? "normal";
    const mode = box.drawerHeightMode ?? drawerSettings.gavetaAlturaModoPadrao;
    const espessuraCostaMm = resolveCostaThicknessMm(box);
    const costaAtiva = box.costaAtiva;
    const customHeights =
      mode === "custom"
        ? (box.drawersLayer ?? []).map((item) => item.bodyHeight ?? item.height)
        : undefined;

    // Usar o domínio de drawers para gerar gavetas
    const isWardrobe = isWardrobeModel(box.baseCabinetId);
    const wardrobeGroup = getWardrobeGroupFromBaseCabinetId(box.baseCabinetId);
    const sideDrawerBox =
      isWardrobe &&
      wardrobeGroup !== "T" &&
      hasWardrobeSideDrawerBox(box.baseCabinetId) &&
      boxWidth >= 800;
    const shouldWardrobeLowerRightDrawers =
      isWardrobe &&
      wardrobeGroup !== "T" &&
      hasWardrobeLowerDrawers(box.baseCabinetId) &&
      boxWidth >= 1200;
    const shouldWardrobeSideDrawers = sideDrawerBox || shouldWardrobeLowerRightDrawers;

    const feetHeightMm = Math.max(40, box.feetHeight ?? (box.pe_cm ?? 10) * 10);
    const drawerOverrides = buildDrawerParametricOverridesList(box.drawersLayer, drawerCount);
    const ergonomicsRules = isErgonomicDrawerHeightMode(mode)
      ? resolveDrawerErgonomicsRules()
      : undefined;

    const config: DrawerGenerationConfig = (() => {
      if (gps && gpsLayout) {
        return {
          boxWidth,
          boxHeight, // altura real do módulo (frente embutida alinhada ao floorTop real)
          boxDepth,
          boxThickness: thickness,
          boxId: box.id,
          drawerCount: 1,
          drawerType,
          heightMode: "custom" as const,
          // drawerHeight = zona (corpo); frente vem do override embutido
          customHeights: [gpsLayout.drawerZoneHeightMm],
          verticalBaseOffsetMm: gpsLayout.drawerFrontBottomFromFloorTopMm,
          interiorFrontStack: true,
          availableDepths: drawerSettings.gavetaProfundidadesDisponiveisMm,
          drawerSettings: {
            ...drawerSettings,
            gavetaFolgaFrenteMm: GAVETA_PORTA_SEP_FRONT_GAP_MM,
          },
          materialId: defaultDrawerMaterial,
          drawerOverrides: [
            {
              frontHeightMm: gpsLayout.drawerFrontHeightMm,
              sideBaseElevationMm: gpsLayout.drawerBodyElevationFromFrontMm,
              gpsEmbeddedFront: true,
            },
          ],
          ergonomicsRules,
          minDrawerHeightMm: drawerSettings.gavetaAlturaMinimaMm,
          maxDrawerHeightMm: drawerSettings.gavetaAlturaMaximaMm,
          espessuraCostaMm,
          costaAtiva,
        };
      }

      // Fase D — caixa interna a_1 (gavetas no vão SEP↔DIV, após −40 mm)
      if (a1 && a1Layout) {
        const zoneH = a1Layout.drawerZoneHeightMm;
        const frontH = Math.max(1, zoneH - 2 * DRAWER_FRONT_LATERAL_GAP_MM);
        return {
          boxWidth: a1Layout.outerWidthMm,
          boxHeight: a1Layout.heightMm,
          boxDepth: Math.max(boxDepth, a1Layout.depthMm + thickness),
          boxThickness: thickness,
          boxId: box.id,
          drawerCount: a1Layout.drawerCount,
          drawerType,
          heightMode: "custom" as const,
          customHeights: Array.from({ length: a1Layout.drawerCount }, () => zoneH),
          availableDepths: drawerSettings.gavetaProfundidadesDisponiveisMm,
          drawerSettings: {
            ...drawerSettings,
            gavetaFolgaFrenteMm: DRAWER_FRONT_LATERAL_GAP_MM,
          },
          materialId: defaultDrawerMaterial,
          drawerOverrides: Array.from({ length: a1Layout.drawerCount }, () => ({
            frontHeightMm: frontH,
          })),
          ergonomicsRules,
          minDrawerHeightMm: drawerSettings.gavetaAlturaMinimaMm,
          maxDrawerHeightMm: drawerSettings.gavetaAlturaMaximaMm,
          espessuraCostaMm,
          costaAtiva,
        };
      }

      if (!shouldWardrobeSideDrawers) {
        return {
          boxWidth,
          boxHeight,
          boxDepth,
          boxThickness: thickness,
          boxId: box.id,
          drawerCount,
          drawerType,
          heightMode: mode,
          customHeights,
          availableDepths: drawerSettings.gavetaProfundidadesDisponiveisMm,
          drawerSettings,
          materialId: defaultDrawerMaterial,
          drawerOverrides,
          ergonomicsRules,
          minDrawerHeightMm: drawerSettings.gavetaAlturaMinimaMm,
          maxDrawerHeightMm: drawerSettings.gavetaAlturaMaximaMm,
          espessuraCostaMm,
          costaAtiva,
        };
      }

      const layout = computeWardrobeLocalLayout({
        baseCabinetId: box.baseCabinetId,
        widthMm: boxWidth,
        heightMm: boxHeight,
        depthMm: boxDepth,
        feetHeightMm,
      });

      return {
        boxWidth: layout.drawerCompartmentBoxWidthForGen_mm ?? boxWidth,
        boxHeight: layout.drawerCompartmentBoxHeightForGen_mm ?? boxHeight,
        boxDepth,
        boxThickness: thickness,
        boxId: box.id,
        drawerCount,
        drawerType,
        heightMode: "equal", // regra obrigatória: gavetas distribuídas uniformemente no compartimento
        availableDepths: drawerSettings.gavetaProfundidadesDisponiveisMm,
        drawerSettings,
        materialId: defaultDrawerMaterial,
        originX: layout.drawerOriginXLocal_mm ?? 0,
        originY: layout.drawerOriginYLocal_mm ?? 0,
        customHeights: undefined,
        drawerOverrides,
        espessuraCostaMm,
        costaAtiva,
      };
    })();

    const drawerGroup = generateDrawerGroup(config);
    const generatedDrawers = drawerGroupToLayerItems(drawerGroup);

    // Preserva estado e configuração UI das gavetas existentes
    for (let i = 0; i < generatedDrawers.length; i++) {
      const existing = (box.drawersLayer ?? [])[i];
      if (existing) {
        generatedDrawers[i] = {
          ...generatedDrawers[i],
          isOpen: existing.isOpen ?? false,
          materialId: existing.materialId ?? defaultDrawerMaterial,
          material: existing.material ?? defaultDrawerMaterial,
          type: existing.type ?? existing.drawerType ?? generatedDrawers[i].type,
          drawerType: existing.drawerType ?? existing.type ?? generatedDrawers[i].drawerType,
          slideType: existing.slideType ?? generatedDrawers[i].slideType,
          metalBoxType: existing.metalBoxType ?? generatedDrawers[i].metalBoxType,
          softClose: existing.softClose ?? generatedDrawers[i].softClose,
          handleType: existing.handleType ?? generatedDrawers[i].handleType,
          handlePosition: existing.handlePosition ?? generatedDrawers[i].handlePosition,
          handleOffsetMm: existing.handleOffsetMm ?? generatedDrawers[i].handleOffsetMm,
          metadata: {
            ...generatedDrawers[i].metadata,
            ...existing.metadata,
            // Elevação corpo = SSOT industrial (nunca sobrescrever com metadata antiga).
            sideBaseElevationMm:
              generatedDrawers[i].metadata?.sideBaseElevationMm ??
              existing.metadata?.sideBaseElevationMm,
            // Modo de altura (Progressivas → guias bodyBottom+22,5).
            heightMode:
              generatedDrawers[i].metadata?.heightMode ??
              existing.metadata?.heightMode,
            ...(gpsLayout
              ? {
                  frontHeightMm: gpsLayout.drawerFrontHeightMm,
                  sideBaseElevationMm: gpsLayout.drawerBodyElevationFromFrontMm,
                  drawerFrontBottomFromFloorTopMm: gpsLayout.drawerFrontBottomFromFloorTopMm,
                  gavetaPortaSep: true,
                }
              : {}),
            ...(a1Layout
              ? {
                  frontHeightMm: Math.max(
                    1,
                    a1Layout.drawerZoneHeightMm - 2 * DRAWER_FRONT_LATERAL_GAP_MM
                  ),
                  ...({
                    innerCabinetId: "a_1",
                    a1Drawer: true,
                  } as object),
                }
              : {}),
          },
        };
        const frontOverride =
          gpsLayout?.drawerFrontHeightMm ??
          (a1Layout
            ? Math.max(1, a1Layout.drawerZoneHeightMm - 2 * DRAWER_FRONT_LATERAL_GAP_MM)
            : undefined) ??
          existing.metadata?.frontHeightMm;
        if (frontOverride != null && Number.isFinite(frontOverride) && frontOverride > 0) {
          generatedDrawers[i].height = frontOverride;
        }
        if (gpsLayout) {
          generatedDrawers[i].width = gpsLayout.drawerFrontWidthMm;
        }
        if (a1Layout) {
          generatedDrawers[i].width = Math.max(
            1,
            a1Layout.outerWidthMm - 2 * DRAWER_FRONT_LATERAL_GAP_MM
          );
        }
      } else {
        generatedDrawers[i].material = defaultDrawerMaterial;
        if (gpsLayout) {
          generatedDrawers[i] = {
            ...generatedDrawers[i],
            height: gpsLayout.drawerFrontHeightMm,
            width: gpsLayout.drawerFrontWidthMm,
            metadata: {
              ...generatedDrawers[i].metadata,
              frontHeightMm: gpsLayout.drawerFrontHeightMm,
              sideBaseElevationMm: gpsLayout.drawerBodyElevationFromFrontMm,
              drawerFrontBottomFromFloorTopMm: gpsLayout.drawerFrontBottomFromFloorTopMm,
              gavetaPortaSep: true,
            },
          };
        }
        if (a1Layout) {
          const frontH = Math.max(
            1,
            a1Layout.drawerZoneHeightMm - 2 * DRAWER_FRONT_LATERAL_GAP_MM
          );
          generatedDrawers[i] = {
            ...generatedDrawers[i],
            height: frontH,
            width: Math.max(1, a1Layout.outerWidthMm - 2 * DRAWER_FRONT_LATERAL_GAP_MM),
            metadata: {
              ...generatedDrawers[i].metadata,
              frontHeightMm: frontH,
              ...({
                innerCabinetId: "a_1",
                a1Drawer: true,
              } as object),
            },
          };
        }
      }

      // GPS embutido: posY + elevação alinhados ao layout (frente = zona − 2×folga).
      if (gpsLayout) {
        const d = generatedDrawers[i]!;
        d.height = gpsLayout.drawerFrontHeightMm;
        d.width = gpsLayout.drawerFrontWidthMm;
        d.posY = gpsLayout.drawerFrontCenterYLocalMm;
        d.bodyCenterOffsetY = resolveDrawerBodyCenterOffsetYMm(
          gpsLayout.drawerFrontHeightMm,
          d.bodyHeight,
          gpsLayout.drawerBodyElevationFromFrontMm
        );
        d.metadata = {
          ...d.metadata,
          frontHeightMm: gpsLayout.drawerFrontHeightMm,
          sideBaseElevationMm: gpsLayout.drawerBodyElevationFromFrontMm,
          drawerFrontBottomFromFloorTopMm: gpsLayout.drawerFrontBottomFromFloorTopMm,
          gavetaPortaSep: true,
        };
      }
    }

    drawersLayer.push(...generatedDrawers);
  }

  if (import.meta.env.DEV) {
    for (const door of doorsLayer) {
      devLogger.debug("door", { posX: door.posX, posY: door.posY, posZ: door.posZ, width: door.width, height: door.height, depth: door.thickness });
    }
    for (const drawer of drawersLayer) {
      devLogger.debug("drawer", { posX: drawer.posX, posY: drawer.posY, posZ: drawer.posZ, width: drawer.width, height: drawer.height, depth: drawer.depth });
    }
  }

  const generated: BoxLayersState = {
    doorsLayer,
    drawersLayer,
  };

  if (gps && gpsLayout) {
    generated.separadores = [buildGavetaPortaSepSeparador(gpsLayout)];
  } else if (hasDrawers) {
    const isWardrobe = isWardrobeModel(box.baseCabinetId);
    const wardrobeGroup = getWardrobeGroupFromBaseCabinetId(box.baseCabinetId);
    const sideDrawerBox =
      isWardrobe &&
      wardrobeGroup !== "T" &&
      hasWardrobeSideDrawerBox(box.baseCabinetId) &&
      boxWidth >= 800;
    if (sideDrawerBox) {
      const feetHeightMm = Math.max(40, box.feetHeight ?? (box.pe_cm ?? 10) * 10);
      try {
        const built = buildPartialSepToDivItems({
          baseCabinetId: box.baseCabinetId,
          widthMm: boxWidth,
          heightMm: boxHeight,
          depthMm: boxDepth,
          feetHeightMm,
          espessuraMm: thickness,
        });
        const keptSeps = (box.separadores ?? []).filter((s) => !isPartialSepCavilhaOnly(s));
        generated.separadores = [...keptSeps, built.sep];
        const keptDivs = (box.divisores ?? []).filter((d) => d.id !== WARDROBE_PARTIAL_DIV_ID);
        generated.divisores = [...keptDivs, built.div];
      } catch {
        // Sem DIV vertical (largura < 800): não injecta SEP parcial.
      }
    }
  }

  if (materialBackup) {
    const restored = restoreLayerMaterials(generated, materialBackup);
    return {
      ...restored,
      ...(generated.separadores ? { separadores: generated.separadores } : {}),
      ...(generated.divisores ? { divisores: generated.divisores } : {}),
    };
  }
  return generated;
}

export function createManualDoor(box: WorkspaceBox): DoorLayerItem {
  const settings = getSettings();
  const thickness = clamp(box.espessura, 18);
  const gapVertical = clamp(settings.portas.portaGapVerticalMm, 0);
  const gapHorizontal = clamp(settings.portas.portaGapHorizontalMm, 0);
  const doorHeight = clamp(box.dimensoes.altura - 2 * gapVertical, 120);
  const doorWidth = clamp(box.dimensoes.largura - 2 * gapHorizontal, 80);
  return {
    id: createId("door"),
    parentBoxId: box.id,
    groupType: "simples",
    width: doorWidth,
    height: doorHeight,
    thickness,
    materialId: defaultDoorMaterial,
    material: defaultDoorMaterial,
    openDirection: "left",
    isOpen: false,
    hingeSide: "left",
    pivot: "left-edge",
    posX: -doorWidth / 2,
    posY: 0,  // Centered at box center
    posZ: box.dimensoes.profundidade / 2 + clamp(settings.portas.portaPosZOffsetMm, 0),
    rotY: 0,
  };
}

export function createManualDrawer(box: WorkspaceBox): DrawerLayerItem {
  const settings = getSettings();
  const thickness = clamp(box.espessura, 18);
  const drawerSettings = settings.gavetas;
  const drawerType = box.drawerType ?? "normal";
  const mode = box.drawerHeightMode ?? drawerSettings.gavetaAlturaModoPadrao;

  // Usar o domínio de drawers
  const config: DrawerGenerationConfig = {
    boxWidth: box.dimensoes.largura,
    boxHeight: box.dimensoes.altura,
    boxDepth: box.dimensoes.profundidade,
    boxThickness: thickness,
    boxId: box.id,
    drawerCount: 1,
    drawerType,
    heightMode: mode,
    availableDepths: drawerSettings.gavetaProfundidadesDisponiveisMm,
    drawerSettings,
    materialId: defaultDrawerMaterial,
  };

  const drawerGroup = generateDrawerGroup(config);
  return { ...drawerToLayerItem(drawerGroup.drawers[0]), material: defaultDrawerMaterial };
}
