import * as THREE from "three";
import { getDefaultOfficialMaterial } from "../../core/materials/materials.api";
import type { DrawerLayerItem } from "../../models/BoxLayers";
import { resolveDrawerExternalFrontHeightMm, resolveDrawerDisplayName, resolveDrawerInternalFrontHeightMm } from "../../core/drawers/drawerLayerCustomization";
import { devLogger } from "../../utils/devLogger";
import { PanelFactory } from "./PanelFactory";
import { getMaterialForOfficialId, resolvePanelMaterialOptions } from "./BoxMaterialApplier";
import {
  computeDrawerPieceCorredicaHoles,
  getDrawerSlideDrillingRules,
} from "../../core/drawers/drilling/DrawerDrillingRules";
import { computeDrawerHandleHoles } from "../../core/drawers/drilling/DrawerHandleDrillingRules";
import { computeDrawerMetalBoxFrontHoles } from "../../core/drawers/drilling/DrawerMetalBoxFrontDrilling";
import { resolveDrawerHandleProfile } from "../../core/drawers/drawerHandleCatalog";
import {
  isMetalBoxCatalogType,
  resolveMetalBoxProfile,
} from "../../core/drawers/drawerMetalBoxCatalog";
import { resolveHandlePlacementX, resolveHandlePlacementY } from "../../core/drawers/handlePlacement";
import {
  easeInOutCubic,
  VIEWER_DRAWER_ANIMATION_DURATION_MS,
} from "../../core/drawers/DrawerMotionService";
import {
  applyDrawerBodyPartIdentity,
  applyDrawerClickTargetIdentity,
} from "../../core/drawers/drawerMeshIdentity";
import {
  resolveDrawerBackCenterZMm,
  resolveDrawerBodyCenterOffsetYMm,
  resolveDrawerBodyCenterZMm,
  resolveDrawerBottomCenterYMm,
  resolveDrawerFrontFlushLayoutMm,
  resolveDrawerManufacturedSideMode,
  resolveDrawerSideBaseElevationMm,
  resolveDrawerViewerWoodSideLayoutMm,
  resolveDrawerViewerWoodBottomBackLayoutMm,
  resolveDrawerWoodBodyHeightMm,
  type DrawerViewerWoodBottomBackLayoutMm,
  type DrawerViewerWoodSideLayoutMm,
  shouldRenderGenericDrawerSlideRails,
} from "../../core/drawers/drawerViewerLayout";
import { resolveProfundidadeExternaFromUtilMm, resolveDrawerSideDepthMm } from "../../core/drawers/drawerSlideDepth";
import { settingsDefaults } from "../../core/settings/settingsSchema";

const drawerOpenState = new Map<string, boolean>();
const drawerPositionState = new Map<string, number>();
const drawerAnimationRaf = new Map<string, number>();
const panelFactory = new PanelFactory({ resolvePanelMaterialOptions });

export type BuildDrawerSpecsOptions = {
  showDrillingMarkers?: boolean;
  /** Profundidade útil interna da carcaça (m). */
  profundidadeUtilM?: number;
  /** Profundidade externa do módulo (m) — SSOT para Z da frente. */
  profundidadeExternaM?: number;
};

function metalBoxColor(metalBoxType?: string): number {
  switch (metalBoxType) {
    case "Blum Legrabox":
      return 0xb8c2cc;
    case "Blum Antaro":
      return 0x9aa8b8;
    case "Hettich AvanTech":
      return 0xa3adb8;
    case "Hafele Alto":
      return 0x8f9baa;
    default:
      return 0x9ca3af;
  }
}

function resolveDrawerSideRenderMode(spec: DrawerSpec) {
  return resolveDrawerManufacturedSideMode(
    spec.metalBoxType,
    (spec.leftSideWidthM ?? 0) * 1000
  );
}

export type DrawerSpec = {
  id: string;
  type: "drawer";
  widthM: number;
  heightM: number;
  depthM: number;
  frontThicknessM: number;
  frontIntWidthM?: number;
  frontIntHeightM?: number;
  frontIntThicknessM?: number;
  bodyWidthM?: number;
  bodyHeightM?: number;
  bodyDepthM?: number;
  leftSideWidthM?: number;
  leftSideHeightM?: number;
  leftSideDepthM?: number;
  rightSideWidthM?: number;
  rightSideHeightM?: number;
  rightSideDepthM?: number;
  backWidthM?: number;
  backHeightM?: number;
  backThicknessM?: number;
  bottomWidthM?: number;
  bottomDepthM?: number;
  bottomThicknessM?: number;
  sideThicknessM?: number;
  frontPosX?: number;
  frontPosY?: number;
  frontPosZ?: number;
  leftSidePosX?: number;
  leftSidePosY?: number;
  leftSidePosZ?: number;
  rightSidePosX?: number;
  rightSidePosY?: number;
  rightSidePosZ?: number;
  bottomPosX?: number;
  bottomPosY?: number;
  bottomPosZ?: number;
  backPosX?: number;
  backPosY?: number;
  backPosZ?: number;
  woodBodyHeightM?: number;
  bodyCenterOffsetYM?: number;
  /** Elevação da base do corpo vs frente (mm). Inferior = 18.5. */
  sideBaseElevationMm?: number;
  frontIntPosZ?: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  isOpen: boolean;
  pullDistanceM: number;
  handleType?: DrawerLayerItem["handleType"];
  handlePosition?: DrawerLayerItem["handlePosition"];
  handleOffsetM?: number;
  handleProfileId?: string;
  handleCenterDistanceMm?: number;
  handleOffsetXMm?: number;
  handleOffsetYMm?: number;
  handlePositionPercent?: number;
  slideType?: DrawerLayerItem["slideType"];
  metalBoxType?: DrawerLayerItem["metalBoxType"];
  metalBoxProfileId?: string;
  metalBoxHeightMm?: number;
  softClose?: boolean;
  showDrillingMarkers?: boolean;
  drawerDisplayName?: string;
  frontDisplayName?: string;
  profundidadeUtilM?: number;
  /** Profundidade externa do módulo (m). Preferida ao reconstruir Z da frente. */
  profundidadeExternaM?: number;
};

export function buildDrawerSpecs(
  items: DrawerLayerItem[],
  options: BuildDrawerSpecsOptions = {}
): DrawerSpec[] {
  return items.map((item, index) => {
    return {
      id: item.id,
      type: "drawer" as const,
      widthM: Math.max(0.001, item.width / 1000),
      heightM: Math.max(0.001, resolveDrawerExternalFrontHeightMm(item) / 1000),
      depthM: Math.max(0.001, item.depth / 1000),
      frontThicknessM: Math.max(0.001, item.frontThickness / 1000),
      frontIntWidthM: Math.max(0.001, (item.frontIntWidth ?? item.bodyWidth ?? item.width) / 1000),
      frontIntHeightM: Math.max(0.001, resolveDrawerInternalFrontHeightMm(item) / 1000),
      frontIntThicknessM: Math.max(
        0.001,
        (item.frontIntThickness ?? item.sideThickness ?? 16) / 1000
      ),
      bodyWidthM: item.bodyWidth ? Math.max(0.001, item.bodyWidth / 1000) : undefined,
      bodyHeightM: item.bodyHeight ? Math.max(0.001, item.bodyHeight / 1000) : undefined,
      bodyDepthM: item.bodyDepth ? Math.max(0.001, item.bodyDepth / 1000) : undefined,
      leftSideWidthM: item.leftSideWidth ? Math.max(0.001, item.leftSideWidth / 1000) : undefined,
      leftSideHeightM: item.leftSideHeight ? Math.max(0.001, item.leftSideHeight / 1000) : undefined,
      leftSideDepthM: item.leftSideDepth ? Math.max(0.001, item.leftSideDepth / 1000) : undefined,
      rightSideWidthM: item.rightSideWidth ? Math.max(0.001, item.rightSideWidth / 1000) : undefined,
      rightSideHeightM: item.rightSideHeight ? Math.max(0.001, item.rightSideHeight / 1000) : undefined,
      rightSideDepthM: item.rightSideDepth ? Math.max(0.001, item.rightSideDepth / 1000) : undefined,
      backWidthM: item.backWidth ? Math.max(0.001, item.backWidth / 1000) : undefined,
      backHeightM: item.backHeight ? Math.max(0.001, item.backHeight / 1000) : undefined,
      backThicknessM: item.backThickness ? Math.max(0.001, item.backThickness / 1000) : undefined,
      bottomWidthM: item.bottomWidth ? Math.max(0.001, item.bottomWidth / 1000) : undefined,
      bottomDepthM: item.bottomDepth ? Math.max(0.001, item.bottomDepth / 1000) : undefined,
      bottomThicknessM: item.bottomThickness ? Math.max(0.001, item.bottomThickness / 1000) : undefined,
      frontPosX: Number.isFinite(item.frontPosX)
        ? (item.frontPosX as number) / 1000
        : undefined,
      frontPosY: Number.isFinite(item.frontPosY)
        ? (item.frontPosY as number) / 1000
        : undefined,
      frontPosZ: Number.isFinite(item.frontPosZ)
        ? (item.frontPosZ as number) / 1000
        : undefined,
      leftSidePosX: Number.isFinite(item.leftSidePosX)
        ? (item.leftSidePosX as number) / 1000
        : undefined,
      leftSidePosY: Number.isFinite(item.leftSidePosY)
        ? (item.leftSidePosY as number) / 1000
        : undefined,
      leftSidePosZ: Number.isFinite(item.leftSidePosZ)
        ? (item.leftSidePosZ as number) / 1000
        : undefined,
      rightSidePosX: Number.isFinite(item.rightSidePosX)
        ? (item.rightSidePosX as number) / 1000
        : undefined,
      rightSidePosY: Number.isFinite(item.rightSidePosY)
        ? (item.rightSidePosY as number) / 1000
        : undefined,
      rightSidePosZ: Number.isFinite(item.rightSidePosZ)
        ? (item.rightSidePosZ as number) / 1000
        : undefined,
      bottomPosX: Number.isFinite(item.bottomPosX)
        ? (item.bottomPosX as number) / 1000
        : undefined,
      bottomPosY: Number.isFinite(item.bottomPosY)
        ? (item.bottomPosY as number) / 1000
        : undefined,
      bottomPosZ: Number.isFinite(item.bottomPosZ)
        ? (item.bottomPosZ as number) / 1000
        : undefined,
      backPosX: Number.isFinite(item.backPosX)
        ? (item.backPosX as number) / 1000
        : undefined,
      backPosY: Number.isFinite(item.backPosY)
        ? (item.backPosY as number) / 1000
        : undefined,
      backPosZ: Number.isFinite(item.backPosZ)
        ? (item.backPosZ as number) / 1000
        : undefined,
      woodBodyHeightM: item.leftSideHeight
        ? Math.max(0.001, item.leftSideHeight / 1000)
        : item.bodyHeight
          ? Math.max(0.001, item.bodyHeight / 1000)
          : item.backHeight
            ? Math.max(0.001, item.backHeight / 1000)
            : undefined,
      bodyCenterOffsetYM: Number.isFinite(item.bodyCenterOffsetY)
        ? (item.bodyCenterOffsetY as number) / 1000
        : resolveDrawerBodyCenterOffsetYMm(
            resolveDrawerExternalFrontHeightMm(item),
            undefined,
            typeof item.metadata?.sideBaseElevationMm === "number"
              ? item.metadata.sideBaseElevationMm
              : undefined
          ) / 1000,
      sideBaseElevationMm:
        typeof item.metadata?.sideBaseElevationMm === "number" &&
        Number.isFinite(item.metadata.sideBaseElevationMm)
          ? item.metadata.sideBaseElevationMm
          : undefined,
      frontIntPosZ: undefined,
      sideThicknessM: item.sideThickness ? Math.max(0.001, item.sideThickness / 1000) : undefined,
      x: (item.posX ?? 0) / 1000,
      y: (item.posY ?? 0) / 1000,
      z: (item.posZ ?? 0) / 1000,
      rotY: Number.isFinite(item.rotY) ? item.rotY : 0,
      isOpen: Boolean(item.isOpen),
      pullDistanceM: Math.max(0, (item.pullDistanceMm ?? 0) / 1000),
      handleType: item.handleType ?? "Nenhum",
      handlePosition: item.handlePosition ?? "Centro",
      handleOffsetM: (item.handleOffsetMm ?? 0) / 1000,
      handleProfileId: item.metadata?.handleProfileId,
      handleCenterDistanceMm: item.metadata?.handleCenterDistanceMm,
      handleOffsetXMm: item.metadata?.handleOffsetXMm,
      handleOffsetYMm: item.metadata?.handleOffsetYMm ?? item.handleOffsetMm,
      handlePositionPercent: item.metadata?.handlePositionPercent,
      slideType: item.slideType ?? "Hettich ArciTech",
      metalBoxType: item.metalBoxType ?? "Nenhuma",
      metalBoxProfileId: item.metadata?.metalBoxProfileId,
      metalBoxHeightMm: item.metadata?.metalBoxHeightMm,
      softClose: Boolean(item.softClose),
      showDrillingMarkers: options.showDrillingMarkers === true,
      drawerDisplayName: resolveDrawerDisplayName(item, index),
      frontDisplayName: item.metadata?.frontPieceName?.trim() || undefined,
      profundidadeUtilM:
        options.profundidadeUtilM != null &&
        Number.isFinite(options.profundidadeUtilM) &&
        options.profundidadeUtilM > 0
          ? options.profundidadeUtilM
          : undefined,
      profundidadeExternaM:
        options.profundidadeExternaM != null &&
        Number.isFinite(options.profundidadeExternaM) &&
        options.profundidadeExternaM > 0
          ? options.profundidadeExternaM
          : undefined,
    };
  });
}

export type DrawerObjectMaterials = {
  front: THREE.Material;
  body: THREE.Material;
  /** Id canónico/viewer do material da face (para mapas PBR no clone). */
  frontMaterialId?: string;
};

export type DrawerStructureMaterials = {
  frontMaterial: string;
  bodyMaterial: string;
};

function normalizeDrawerObjectMaterials(
  materials: DrawerObjectMaterials | THREE.Material
): DrawerObjectMaterials {
  if (
    typeof materials === "object" &&
    materials !== null &&
    "front" in materials &&
    "body" in materials
  ) {
    return materials;
  }
  const shared = materials as THREE.Material;
  return { front: shared, body: shared };
}

/**
 * Índice do material da face larga (legado edge/face). Com singleMaterial (portas) = 0.
 * Mantido para viewerGrainOrientation.applyDrawerFrontFaceGrain.
 */
/** Faces BoxGeometry: 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z (paridade PanelFactory front). */
export const DRAWER_FRONT_EXTERIOR_FACE_INDEX = 4;
export const DRAWER_FRONT_INTERIOR_FACE_INDEX = 5;

export function resolveDrawerFrontFaceMaterialIndex(mesh: THREE.Mesh): number {
  if (Array.isArray(mesh.material) && mesh.material.length >= 2) {
    const groups = (mesh.geometry as THREE.BufferGeometry).groups;
    if (groups?.length >= 6) {
      const faceGroup = groups.find((g) => g.materialIndex === 1) ?? groups[4];
      return faceGroup?.materialIndex ?? 1;
    }
  }
  return 0;
}

/**
 * Atribui matéria à frente — paridade portas: clone do material oficial, singleMaterial.
 * O caminho principal no Viewer é rebuild via updateDrawerMaterial (como updateDoorMaterial);
 * esta função existe para sync/testes pontuais.
 */
export function applyDrawerFrontMaterialToMesh(
  mesh: THREE.Mesh,
  materialId: string,
  onMapsApplied?: () => void
): void {
  const mat = getMaterialForOfficialId(materialId).clone();
  mat.needsUpdate = true;
  mesh.material = mat;
  mesh.userData.drawerFrontMaterialId = materialId;
  if (mesh.geometry instanceof THREE.BufferGeometry) {
    mesh.geometry.clearGroups();
  }
  // Remover caps legados (patches v8/v9) se existirem.
  for (const child of [...mesh.children]) {
    if (child.userData?.isDrawerFrontExteriorCap === true) {
      mesh.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
  }
  onMapsApplied?.();
}

function resolveDrawerFlushLayoutM(spec: DrawerSpec) {
  if (
    spec.profundidadeUtilM == null ||
    !Number.isFinite(spec.profundidadeUtilM) ||
    spec.profundidadeUtilM <= 0
  ) {
    return null;
  }
  const frontThicknessMm = spec.frontThicknessM * 1000;
  const profundidadeUtilMm = spec.profundidadeUtilM * 1000;
  const profundidadeExternaMm =
    spec.profundidadeExternaM != null &&
    Number.isFinite(spec.profundidadeExternaM) &&
    spec.profundidadeExternaM > 0
      ? spec.profundidadeExternaM * 1000
      : resolveProfundidadeExternaFromUtilMm(profundidadeUtilMm, frontThicknessMm);
  const folgaCorredicaMm = settingsDefaults.gavetas.gavetaRecuoProfundidadeCorredicaMm;
  return resolveDrawerFrontFlushLayoutMm(
    profundidadeExternaMm,
    profundidadeUtilMm,
    frontThicknessMm,
    folgaCorredicaMm
  );
}

function resolveViewerBodyDepthM(spec: DrawerSpec): number | undefined {
  const flush = resolveDrawerFlushLayoutM(spec);
  if (flush) return flush.bodyDepthMm / 1000;
  if (spec.bodyDepthM != null && spec.bodyDepthM > 0) return spec.bodyDepthM;
  return undefined;
}

function resolveSpecBodyCenterZM(spec: DrawerSpec): number {
  const flush = resolveDrawerFlushLayoutM(spec);
  if (flush) return flush.bodyCenterLocalZ / 1000;
  if (Number.isFinite(spec.bottomPosZ)) return spec.bottomPosZ as number;
  const structuralFrontMm = isMetalBoxCatalogType(spec.metalBoxType)
    ? (spec.frontIntThicknessM ?? 0) * 1000
    : 0;
  const combinedFrontMm = spec.frontThicknessM * 1000 + structuralFrontMm;
  const bodyDepthMm = (resolveViewerBodyDepthM(spec) ?? spec.bodyDepthM ?? spec.depthM) * 1000;
  return resolveDrawerBodyCenterZMm(combinedFrontMm, bodyDepthMm) / 1000;
}

function resolveSpecSideCenterZM(spec: DrawerSpec): number {
  if (Number.isFinite(spec.leftSidePosZ)) return spec.leftSidePosZ as number;
  const structuralFrontMm = isMetalBoxCatalogType(spec.metalBoxType)
    ? (spec.frontIntThicknessM ?? 0) * 1000
    : 0;
  const combinedFrontMm = spec.frontThicknessM * 1000 + structuralFrontMm;
  const slideLengthMm = (spec.bodyDepthM ?? resolveViewerBodyDepthM(spec) ?? spec.depthM) * 1000;
  const sideDepthMm =
    (spec.leftSideDepthM ?? 0) > 0
      ? spec.leftSideDepthM! * 1000
      : resolveDrawerSideDepthMm(slideLengthMm);
  return resolveDrawerBodyCenterZMm(combinedFrontMm, sideDepthMm) / 1000;
}

function resolveSpecBackCenterZM(spec: DrawerSpec): number {
  const flush = resolveDrawerFlushLayoutM(spec);
  const structuralFrontMm = isMetalBoxCatalogType(spec.metalBoxType)
    ? (spec.frontIntThicknessM ?? 0) * 1000
    : 0;
  const combinedFrontMm = spec.frontThicknessM * 1000 + structuralFrontMm;
  const backMm = (spec.backThicknessM ?? 0.016) * 1000;
  const slideLengthMm = flush
    ? flush.bodyDepthMm
    : (resolveViewerBodyDepthM(spec) ?? spec.bodyDepthM ?? spec.depthM) * 1000;
  const sideDepthMm =
    (spec.leftSideDepthM ?? 0) > 0
      ? spec.leftSideDepthM! * 1000
      : resolveDrawerSideDepthMm(slideLengthMm);
  if (Number.isFinite(spec.backPosZ)) return spec.backPosZ as number;
  return resolveDrawerBackCenterZMm(combinedFrontMm, sideDepthMm, backMm) / 1000;
}

function resolveSpecBottomCenterYM(spec: DrawerSpec): number {
  if (Number.isFinite(spec.bottomPosY)) return spec.bottomPosY as number;
  const frontHm = spec.heightM;
  const woodHm = spec.woodBodyHeightM ?? spec.leftSideHeightM ?? spec.bodyHeightM ?? 0.1;
  const offsetYm =
    spec.bodyCenterOffsetYM ??
    resolveDrawerBodyCenterOffsetYMm(frontHm * 1000, woodHm * 1000) / 1000;
  return (
    resolveDrawerBottomCenterYMm(
      woodHm * 1000,
      (spec.bottomThicknessM ?? 0.01) * 1000,
      offsetYm * 1000
    ) / 1000
  );
}

function resolveSpecSideBaseElevationMm(spec: DrawerSpec): number {
  if (
    spec.sideBaseElevationMm != null &&
    Number.isFinite(spec.sideBaseElevationMm)
  ) {
    return resolveDrawerSideBaseElevationMm(spec.sideBaseElevationMm);
  }
  const frontH = spec.heightM * 1000;
  const bodyHMm =
    (spec.leftSideHeightM ??
      spec.bodyHeightM ??
      resolveDrawerWoodBodyHeightMm(frontH) / 1000) * 1000;
  if (Number.isFinite(spec.bodyCenterOffsetYM) && bodyHMm > 0) {
    return resolveDrawerSideBaseElevationMm(
      (spec.bodyCenterOffsetYM as number) * 1000 + (frontH - bodyHMm) / 2
    );
  }
  return resolveDrawerSideBaseElevationMm();
}

function resolveSpecSideCenterYM(spec: DrawerSpec): number {
  if (Number.isFinite(spec.leftSidePosY)) return spec.leftSidePosY as number;
  const frontHm = spec.heightM;
  return (
    spec.bodyCenterOffsetYM ??
    resolveDrawerBodyCenterOffsetYMm(
      frontHm * 1000,
      undefined,
      resolveSpecSideBaseElevationMm(spec)
    ) / 1000
  );
}

const DRAWER_VIEWER_LAYOUT_REV = "drawer-body-elev-18-5-industrial-sideh";

export function getDrawerStructureFingerprint(
  spec: DrawerSpec,
  materials?: DrawerStructureMaterials | string
): string {
  const legacyName = typeof materials === "string" ? materials : undefined;
  const frontMaterial =
    typeof materials === "object" && materials?.frontMaterial
      ? materials.frontMaterial
      : legacyName ?? getDefaultOfficialMaterial().canonicalId;
  const bodyMaterial =
    typeof materials === "object" && materials?.bodyMaterial
      ? materials.bodyMaterial
      : legacyName ?? frontMaterial;
  // Incluir Z efectivo do flush: mudanças em resolveDrawerFrontFlushLayoutMm
  // devem invalidar o fingerprint (senão o BoxUpdater reutiliza meshes enterrados).
  const flush = resolveDrawerFlushLayoutM(spec);
  return JSON.stringify({
    drawerViewerLayoutRev: DRAWER_VIEWER_LAYOUT_REV,
    id: spec.id,
    widthM: spec.widthM,
    heightM: spec.heightM,
    depthM: spec.depthM,
    frontThicknessM: spec.frontThicknessM,
    bodyWidthM: spec.bodyWidthM,
    bodyHeightM: spec.bodyHeightM,
    bodyDepthM: spec.bodyDepthM,
    leftSideWidthM: spec.leftSideWidthM,
    leftSideHeightM: spec.leftSideHeightM,
    leftSideDepthM: spec.leftSideDepthM,
    rightSideWidthM: spec.rightSideWidthM,
    rightSideHeightM: spec.rightSideHeightM,
    rightSideDepthM: spec.rightSideDepthM,
    backWidthM: spec.backWidthM,
    backHeightM: spec.backHeightM,
    backThicknessM: spec.backThicknessM,
    bottomWidthM: spec.bottomWidthM,
    bottomDepthM: spec.bottomDepthM,
    bottomThicknessM: spec.bottomThicknessM,
    frontPosX: spec.frontPosX,
    frontPosY: spec.frontPosY,
    frontPosZ: spec.frontPosZ,
    leftSidePosX: spec.leftSidePosX,
    leftSidePosY: spec.leftSidePosY,
    leftSidePosZ: spec.leftSidePosZ,
    rightSidePosX: spec.rightSidePosX,
    rightSidePosY: spec.rightSidePosY,
    rightSidePosZ: spec.rightSidePosZ,
    bottomPosX: spec.bottomPosX,
    bottomPosY: spec.bottomPosY,
    bottomPosZ: spec.bottomPosZ,
    backPosX: spec.backPosX,
    backPosY: spec.backPosY,
    backPosZ: spec.backPosZ,
    sideBaseElevationMm: spec.sideBaseElevationMm ?? resolveSpecSideBaseElevationMm(spec),
    bodyCenterOffsetYM: spec.bodyCenterOffsetYM,
    x: spec.x,
    y: spec.y,
    z: spec.z,
    rotY: spec.rotY,
    handleType: spec.handleType,
    handlePosition: spec.handlePosition,
    handleOffsetM: spec.handleOffsetM,
    slideType: spec.slideType,
    metalBoxType: spec.metalBoxType,
    softClose: spec.softClose,
    showDrillingMarkers: spec.showDrillingMarkers,
    frontMaterial,
    bodyMaterial,
    profundidadeUtilM: spec.profundidadeUtilM,
    profundidadeExternaM: spec.profundidadeExternaM,
    viewerFlushFrontPosZMm: flush?.frontPosZ ?? null,
    viewerFlushFrontOuterZMm: flush?.frontOuterZ ?? null,
  });
}

/** @deprecated Use getDrawerStructureFingerprint + getDrawerMotionKey */
export function getDrawerSpecFingerprint(
  spec: DrawerSpec,
  materials?: DrawerStructureMaterials | string
): string {
  return `${getDrawerStructureFingerprint(spec, materials)}|${getDrawerMotionKey(spec)}`;
}

export function getDrawerMotionKey(spec: Pick<DrawerSpec, "isOpen" | "pullDistanceM">): string {
  return JSON.stringify({ isOpen: spec.isOpen, pullDistanceM: spec.pullDistanceM });
}

function findDrawerBodyGroup(drawerLayerGroup: THREE.Object3D, drawerId: string): THREE.Object3D | null {
  const byName = drawerLayerGroup.children.find((child) => child.name === `drawer-body-${drawerId}`);
  if (byName) return byName;
  return drawerLayerGroup.children.find((child) => child.name.startsWith("drawer-body-")) ?? null;
}

function animateDrawerBodyZ(drawerId: string, drawerGroup: THREE.Object3D, targetPullOffset: number): void {
  const prevIsOpen = drawerOpenState.get(drawerId);
  const prevPosition = drawerPositionState.get(drawerId);
  const startPosition = Number.isFinite(prevPosition) ? (prevPosition as number) : drawerGroup.position.z;
  const shouldAnimate = prevIsOpen === undefined ? targetPullOffset !== 0 : prevIsOpen !== (targetPullOffset > 0);

  if (shouldAnimate) {
    const existingRaf = drawerAnimationRaf.get(drawerId);
    if (existingRaf != null) cancelAnimationFrame(existingRaf);
    const start = performance.now();
    const durationMs = VIEWER_DRAWER_ANIMATION_DURATION_MS;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeInOutCubic(t);
      drawerGroup.position.z = startPosition + (targetPullOffset - startPosition) * eased;
      drawerPositionState.set(drawerId, drawerGroup.position.z);
      if (t < 1) drawerAnimationRaf.set(drawerId, requestAnimationFrame(animate));
      else drawerAnimationRaf.delete(drawerId);
    };
    drawerAnimationRaf.set(drawerId, requestAnimationFrame(animate));
  } else {
    drawerGroup.position.z = targetPullOffset;
    drawerPositionState.set(drawerId, targetPullOffset);
  }

  drawerOpenState.set(drawerId, targetPullOffset > 0);
}

/** Actualiza só o movimento Z da gaveta (sem rebuild de meshes). */
export function syncDrawerLayerMotion(drawerLayerGroup: THREE.Object3D, spec: DrawerSpec): boolean {
  const drawerGroup = findDrawerBodyGroup(drawerLayerGroup, spec.id);
  if (!drawerGroup) return false;
  const targetPullOffset = spec.isOpen ? spec.pullDistanceM : 0;
  animateDrawerBodyZ(spec.id, drawerGroup, targetPullOffset);
  return true;
}

export function createDrawerObject(
  spec: DrawerSpec,
  materials: DrawerObjectMaterials | THREE.Material
): THREE.Object3D {
  const { front: frontMaterial, body: bodyMaterial, frontMaterialId } =
    normalizeDrawerObjectMaterials(materials);
  // Paridade portas: usar o material passado directamente (singleMaterial), sem clone PBR extra / caps.
  const frontFaceMaterial = frontMaterial;
  frontFaceMaterial.needsUpdate = true;
  const bodyPanelMaterial = bodyMaterial.clone();
  bodyPanelMaterial.needsUpdate = true;

  const frontIntMaterial = bodyMaterial.clone();
  frontIntMaterial.needsUpdate = true;

  const flushLayout = resolveDrawerFlushLayoutM(spec);
  const groupPosZ = flushLayout ? flushLayout.frontPosZ / 1000 : spec.z;

  if (import.meta.env.DEV && flushLayout) {
    const carcassFrontZ = (spec.profundidadeUtilM ?? 0) * 1000 / 2;
    devLogger.debug("[DRAWER-Z] flush viewer", {
      id: spec.id,
      carcassFrontZ,
      frontOuterZ: flushLayout.frontOuterZ,
      frontPosZ: flushLayout.frontPosZ,
      bodyCenterLocalZ: flushLayout.bodyCenterLocalZ,
      groupPosZMm: groupPosZ * 1000,
      frontLocalZ: 0,
      outerMinusCarcass: flushLayout.frontOuterZ - carcassFrontZ,
      innerMinusCarcass: flushLayout.frontOuterZ - spec.frontThicknessM * 1000 - carcassFrontZ,
    });
  }

  const group = new THREE.Group();
  group.name = `drawer-layer-${spec.id}`;
  group.userData.drawerDisplayName = spec.drawerDisplayName;
  group.userData.pieceDisplayName = spec.frontDisplayName ?? spec.drawerDisplayName;
  group.userData.drawerSpec = spec;
  group.position.set(spec.x, spec.y, groupPosZ);
  if (spec.rotY !== 0) group.rotation.y = spec.rotY;

  const drawerGroup = new THREE.Group();
  drawerGroup.name = `drawer-body-${spec.id}`;

  const targetPullOffset = spec.isOpen ? spec.pullDistanceM : 0;
  const prevPosition = drawerPositionState.get(spec.id);
  drawerGroup.position.set(0, 0, Number.isFinite(prevPosition) ? (prevPosition as number) : targetPullOffset);
  animateDrawerBodyZ(spec.id, drawerGroup, targetPullOffset);

  const frontLocalX = Number.isFinite(spec.frontPosX) ? (spec.frontPosX as number) : 0;
  const frontLocalZ = 0;
  let woodSideLayout: DrawerViewerWoodSideLayoutMm | null = null;
  let frontLocalY = Number.isFinite(spec.frontPosY) ? (spec.frontPosY as number) : 0;

  if (
    resolveDrawerSideRenderMode(spec) === "wood" &&
    spec.bodyWidthM &&
    spec.bodyHeightM &&
    spec.bodyDepthM
  ) {
    const frontPosYMm = frontLocalY * 1000;
    const slideLengthMm = (spec.bodyDepthM ?? resolveViewerBodyDepthM(spec) ?? 0) * 1000;
    woodSideLayout = resolveDrawerViewerWoodSideLayoutMm({
      frontPosYMm,
      frontHeightMm: spec.heightM * 1000,
      bodyWidthMm: spec.bodyWidthM * 1000,
      sideThicknessMm: (spec.leftSideWidthM ?? spec.sideThicknessM ?? 0.016) * 1000,
      slideLengthMm,
      baseElevationMm: resolveSpecSideBaseElevationMm(spec),
      sideHeightMm:
        (spec.leftSideHeightM ?? spec.woodBodyHeightM ?? spec.bodyHeightM ?? 0) * 1000 ||
        undefined,
    });
  }

  // Exactamente como portas: PanelFactory + singleMaterial (todas as faces, sem caps).
  const frontExt = panelFactory.createPanel(
    spec.widthM,
    spec.heightM,
    spec.frontThicknessM,
    `drawer-front-ext-${spec.id}`,
    "front",
    { singleMaterial: frontFaceMaterial }
  );
  frontExt.position.set(frontLocalX, frontLocalY, frontLocalZ);
  applyDrawerClickTargetIdentity(frontExt, spec.id, "front");
  if (frontMaterialId && frontMaterialId.trim()) {
    frontExt.userData.drawerFrontMaterialId = frontMaterialId.trim();
  }
  if (spec.frontDisplayName) {
    frontExt.userData.pieceDisplayName = spec.frontDisplayName;
  }
  drawerGroup.add(frontExt);

  if (
    isMetalBoxCatalogType(spec.metalBoxType) &&
    spec.frontIntWidthM &&
    spec.frontIntHeightM &&
    (spec.frontIntThicknessM ?? 0) > 0.001
  ) {
    const frontInt = panelFactory.createPanel(
      spec.frontIntWidthM,
      spec.frontIntHeightM,
      spec.frontIntThicknessM,
      `drawer-front-int-${spec.id}`,
      "front",
      { singleMaterial: frontIntMaterial }
    );
    frontInt.position.set(
      0,
      frontLocalY,
      Number.isFinite(spec.frontIntPosZ)
        ? (spec.frontIntPosZ as number)
        : -spec.frontThicknessM / 2 - (spec.frontIntThicknessM ?? 0) / 2
    );
    applyDrawerBodyPartIdentity(frontInt, "front-int");
    drawerGroup.add(frontInt);
  }

  // Sem mesh auxiliar drawer-click-* (película 2 mm): a frente real
  // (drawerPart=front) já é o alvo de clique/raycast. Evita matéria do módulo
  // e picking fantasma quando gav_frente está oculta.

  if (spec.handleType && spec.handleType !== "Nenhum") {
    const frontHeightMm = spec.heightM * 1000;
    const frontWidthMm = spec.widthM * 1000;
    const placementInput = {
      larguraMm: frontWidthMm,
      alturaMm: frontHeightMm,
      handlePosition: spec.handlePosition,
      handlePositionPercent: spec.handlePositionPercent,
      handleOffsetXMm: spec.handleOffsetXMm,
      handleOffsetYMm: spec.handleOffsetYMm,
      handleOffsetMm: (spec.handleOffsetM ?? 0) * 1000,
    };
    const anchorYMm = resolveHandlePlacementY(placementInput);
    const centerXMm = resolveHandlePlacementX(placementInput);
    const anchorYLocal = frontHeightMm / 2000 - anchorYMm / 1000;
    const centerXLocal = centerXMm / 1000 - frontWidthMm / 2000;

    const profile = resolveDrawerHandleProfile(
      spec.handleType,
      spec.handleProfileId,
      spec.handleCenterDistanceMm
    );
    const ccM = (spec.handleCenterDistanceMm ?? profile?.defaultCenterDistanceMm ?? 80) / 1000;

    const handleMaterial = new THREE.MeshStandardMaterial({
      color: spec.handleType === "Cava" ? 0x111827 : 0xb6bcc6,
      roughness: 0.45,
      metalness: spec.handleType === "Perfil Alumínio" || spec.handleType === "Puxador" ? 0.6 : 0.1,
    });

    if (spec.handleType === "Cava" || spec.handleType === "Perfil Alumínio") {
      const grooveLengthM = Math.min(
        (profile?.groove?.maxLengthMm ?? frontWidthMm * 0.5) / 1000,
        spec.widthM * (profile?.groove?.lengthRatio ?? 0.5)
      );
      const grooveHeightM = (profile?.groove?.grooveWidth ?? 30) / 1000;
      const grooveDepthM = 0.008;
      const groove = panelFactory.createPanel(
        grooveLengthM,
        grooveHeightM,
        grooveDepthM,
        `drawer-handle-${spec.id}`,
        "front",
        { singleMaterial: handleMaterial }
      );
      groove.position.set(
        centerXLocal,
        anchorYLocal + frontLocalY,
        spec.frontThicknessM / 2 + grooveDepthM / 2
      );
      applyDrawerClickTargetIdentity(groove, spec.id, "handle");
      drawerGroup.add(groove);
    } else {
      const handleWidth = Math.max(0.06, Math.min(ccM, spec.widthM * 0.7));
      const handleHeight = 0.024;
      const handleDepth = 0.026;
      const handle = panelFactory.createPanel(
        handleWidth,
        handleHeight,
        handleDepth,
        `drawer-handle-${spec.id}`,
        "front",
        { singleMaterial: handleMaterial }
      );
      handle.position.set(
        centerXLocal,
        anchorYLocal + frontLocalY,
        spec.frontThicknessM / 2 + handleDepth / 2
      );
      applyDrawerClickTargetIdentity(handle, spec.id, "handle");
      drawerGroup.add(handle);
    }
  }

  if (spec.bodyWidthM && spec.bodyHeightM && spec.bodyDepthM) {
    const viewerBodyDepthM = resolveViewerBodyDepthM(spec) ?? spec.bodyDepthM;
    const bodyCenterZm = resolveSpecBodyCenterZM(spec);
    const sideCenterZm = resolveSpecSideCenterZM(spec);
    const sideCenterYm = resolveSpecSideCenterYM(spec);
    const woodSideHeightM = spec.woodBodyHeightM ?? spec.leftSideHeightM ?? spec.bodyHeightM;
    const sideMode = resolveDrawerSideRenderMode(spec);
    let woodBottomBackLayout: DrawerViewerWoodBottomBackLayoutMm | null = null;
    const structuralFrontMm = isMetalBoxCatalogType(spec.metalBoxType)
      ? (spec.frontIntThicknessM ?? 0) * 1000
      : 0;
    const combinedFrontMm = spec.frontThicknessM * 1000 + structuralFrontMm;

    if (sideMode === "metal") {
      const metalMaterial = new THREE.MeshStandardMaterial({
        color: metalBoxColor(spec.metalBoxType),
        roughness: 0.28,
        metalness: 0.82,
      });
      const metalThicknessM = 0.012;
      const sideHeightM = Math.max(0.04, woodSideHeightM ?? 0.04);
      const leftMetal = panelFactory.createPanel(
        metalThicknessM,
        sideHeightM,
        viewerBodyDepthM,
        `drawer-metal-left-${spec.id}`,
        "left",
        { singleMaterial: metalMaterial }
      );
      leftMetal.position.set(-spec.bodyWidthM / 2 + metalThicknessM / 2, sideCenterYm, bodyCenterZm);
      applyDrawerBodyPartIdentity(leftMetal, "metal-box");
      drawerGroup.add(leftMetal);
      const rightMetal = panelFactory.createPanel(
        metalThicknessM,
        sideHeightM,
        viewerBodyDepthM,
        `drawer-metal-right-${spec.id}`,
        "right",
        { singleMaterial: metalMaterial }
      );
      rightMetal.position.set(spec.bodyWidthM / 2 - metalThicknessM / 2, sideCenterYm, bodyCenterZm);
      applyDrawerBodyPartIdentity(rightMetal, "metal-box");
      drawerGroup.add(rightMetal);
    } else if (sideMode === "wood") {
      if (!woodSideLayout) {
        const frontPosYMm = frontLocalY * 1000;
        woodSideLayout = resolveDrawerViewerWoodSideLayoutMm({
          frontPosYMm,
          frontHeightMm: spec.heightM * 1000,
          bodyWidthMm: spec.bodyWidthM * 1000,
          sideThicknessMm: (spec.leftSideWidthM ?? spec.sideThicknessM ?? 0.016) * 1000,
          slideLengthMm: (spec.bodyDepthM ?? viewerBodyDepthM) * 1000,
          baseElevationMm: resolveSpecSideBaseElevationMm(spec),
          sideHeightMm:
            (spec.leftSideHeightM ?? spec.woodBodyHeightM ?? spec.bodyHeightM ?? 0) * 1000 ||
            undefined,
        });
      }
      const viewerSideHeightM = woodSideLayout.sideHeightMm / 1000;
      // Preferir posY industrial da layer (leftSidePosY / bodyCenterOffset) quando existe.
      const viewerSidePosYM = Number.isFinite(spec.leftSidePosY)
        ? (spec.leftSidePosY as number)
        : Number.isFinite(spec.bodyCenterOffsetYM)
          ? (spec.bodyCenterOffsetYM as number)
          : woodSideLayout.sidePosYMm / 1000;
      const sideDepthM = (spec.leftSideDepthM ?? woodSideLayout.sideDepthMm / 1000);
      const sidePosYMm = viewerSidePosYM * 1000;
      woodBottomBackLayout = resolveDrawerViewerWoodBottomBackLayoutMm({
        sidePosYMm,
        sideHeightMm: woodSideLayout.sideHeightMm,
        internalWidthMm: woodSideLayout.internalWidthMm,
        sideThicknessMm: (spec.leftSideWidthM ?? spec.sideThicknessM ?? 0.016) * 1000,
        bodyDepthMm: woodSideLayout.bodyDepthMm,
        sideDepthMm: woodSideLayout.sideDepthMm,
        combinedFrontThicknessMm: combinedFrontMm,
        floorThicknessMm: (spec.bottomThicknessM ?? 0.01) * 1000,
        backThicknessMm: (spec.backThicknessM ?? 0.016) * 1000,
      });

      if (spec.leftSideWidthM && spec.leftSideHeightM && spec.leftSideDepthM) {
        const leftSide = panelFactory.createPanel(
          spec.leftSideWidthM,
          viewerSideHeightM,
          sideDepthM,
          `drawer-left-${spec.id}`,
          "left",
          { singleMaterial: bodyPanelMaterial }
        );
        leftSide.position.set(
          woodSideLayout.leftPosXMm / 1000,
          viewerSidePosYM,
          sideCenterZm
        );
        applyDrawerBodyPartIdentity(leftSide, "left-side");
        drawerGroup.add(leftSide);
      }
      if (spec.rightSideWidthM && spec.rightSideHeightM && spec.rightSideDepthM) {
        const rightSide = panelFactory.createPanel(
          spec.rightSideWidthM,
          viewerSideHeightM,
          sideDepthM,
          `drawer-right-${spec.id}`,
          "right",
          { singleMaterial: bodyPanelMaterial }
        );
        rightSide.position.set(
          woodSideLayout.rightPosXMm / 1000,
          viewerSidePosYM,
          sideCenterZm
        );
        applyDrawerBodyPartIdentity(rightSide, "right-side");
        drawerGroup.add(rightSide);
      }
    }
    if (spec.bottomWidthM && spec.bottomDepthM && spec.bottomThicknessM) {
      if (woodBottomBackLayout) {
        const floor = woodBottomBackLayout;
        const bottom = panelFactory.createPanel(
          floor.floorWidthMm / 1000,
          floor.floorThicknessMm / 1000,
          floor.floorDepthMm / 1000,
          `drawer-bottom-${spec.id}`,
          "bottom",
          { singleMaterial: bodyPanelMaterial }
        );
        bottom.position.set(0, floor.floorPosYMm / 1000, floor.floorPosZMm / 1000);
        applyDrawerBodyPartIdentity(bottom, "bottom");
        drawerGroup.add(bottom);
      } else {
        const bottom = panelFactory.createPanel(
          spec.bottomWidthM,
          spec.bottomThicknessM,
          viewerBodyDepthM,
          `drawer-bottom-${spec.id}`,
          "bottom",
          { singleMaterial: bodyPanelMaterial }
        );
        bottom.position.set(
          Number.isFinite(spec.bottomPosX) ? (spec.bottomPosX as number) : 0,
          resolveSpecBottomCenterYM(spec),
          bodyCenterZm
        );
        applyDrawerBodyPartIdentity(bottom, "bottom");
        drawerGroup.add(bottom);
      }
    }
    if (spec.backWidthM && spec.backHeightM && spec.backThicknessM) {
      if (woodBottomBackLayout) {
        const backLayout = woodBottomBackLayout;
        const back = panelFactory.createPanel(
          backLayout.backWidthMm / 1000,
          spec.backHeightM ?? backLayout.backHeightMm / 1000,
          backLayout.backThicknessMm / 1000,
          `drawer-back-${spec.id}`,
          "back",
          { singleMaterial: bodyPanelMaterial }
        );
        back.position.set(0, backLayout.backPosYMm / 1000, backLayout.backPosZMm / 1000);
        applyDrawerBodyPartIdentity(back, "back");
        drawerGroup.add(back);
      } else {
        const back = panelFactory.createPanel(
          spec.backWidthM,
          spec.backHeightM,
          spec.backThicknessM,
          `drawer-back-${spec.id}`,
          "back",
          { singleMaterial: bodyPanelMaterial }
        );
        back.position.set(
          Number.isFinite(spec.backPosX) ? (spec.backPosX as number) : 0,
          sideCenterYm,
          resolveSpecBackCenterZM(spec)
        );
        applyDrawerBodyPartIdentity(back, "back");
        drawerGroup.add(back);
      }
    }

    if (
      shouldRenderGenericDrawerSlideRails(spec.slideType, sideMode) &&
      spec.bodyWidthM &&
      spec.bodyHeightM &&
      spec.bodyDepthM
    ) {
      const metalProfile = isMetalBoxCatalogType(spec.metalBoxType)
        ? resolveMetalBoxProfile(spec.metalBoxType, spec.metalBoxProfileId, spec.metalBoxHeightMm)
        : null;
      const slideOffsetM = (metalProfile?.slideOffsetFrontMm ?? 37) / 1000;
      const railMaterial = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.5,
        metalness: 0.45,
      });
      const railW = 0.012;
      const railH = Math.max(0.03, spec.bodyHeightM * 0.85);
      const railD = viewerBodyDepthM;
      const bodyCenterZm = resolveSpecBodyCenterZM(spec);
      const leftRail = panelFactory.createPanel(railW, railH, railD, `drawer-rail-left-${spec.id}`, "left", {
        singleMaterial: railMaterial,
      });
      leftRail.position.set(-spec.bodyWidthM / 2 - railW / 2 - slideOffsetM * 0.1, resolveSpecSideCenterYM(spec), bodyCenterZm);
      leftRail.userData.drawerPart = "slide-rail";
      drawerGroup.add(leftRail);
      const rightRail = panelFactory.createPanel(railW, railH, railD, `drawer-rail-right-${spec.id}`, "right", {
        singleMaterial: railMaterial,
      });
      rightRail.position.set(spec.bodyWidthM / 2 + railW / 2 + slideOffsetM * 0.1, resolveSpecSideCenterYM(spec), bodyCenterZm);
      rightRail.userData.drawerPart = "slide-rail";
      drawerGroup.add(rightRail);
    }
  }

  if (spec.showDrillingMarkers && spec.bodyDepthM && spec.bodyHeightM) {
    const rules = getDrawerSlideDrillingRules(spec.slideType, spec.metalBoxType, {
      softClose: spec.softClose === true,
      mode: "drawer_piece",
    });
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      roughness: 0.4,
      metalness: 0.1,
    });
    const handleMarkerMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1e3a8a,
      roughness: 0.4,
      metalness: 0.1,
    });
    const pieceTypes = ["gaveta_lat_esq", "gaveta_frente_int", "gaveta_traseira"] as const;
    for (const pieceType of pieceTypes) {
      const larguraMm =
        pieceType === "gaveta_frente_int"
          ? (spec.frontIntWidthM ?? spec.bodyWidthM ?? spec.widthM) * 1000
          : (spec.bodyDepthM ?? spec.depthM) * 1000;
      const alturaMm =
        pieceType === "gaveta_frente_int"
          ? (spec.frontIntHeightM ?? spec.bodyHeightM ?? spec.heightM) * 1000
          : (spec.bodyHeightM ?? spec.heightM) * 1000;
      const holes = computeDrawerPieceCorredicaHoles({
        pieceType,
        largura: larguraMm,
        altura: alturaMm,
        rules,
      });
      for (const hole of holes) {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), markerMaterial);
        const x = (hole.x / 1000) - larguraMm / 2000;
        const y = alturaMm / 2000 - hole.y / 1000;
        const z =
          pieceType === "gaveta_frente_int"
            ? -spec.frontThicknessM - (spec.frontIntThicknessM ?? 0) / 2
            : -(spec.frontThicknessM + (spec.frontIntThicknessM ?? 0) / 2 + (spec.bodyDepthM ?? spec.depthM) / 2) +
              hole.x / 1000;
        sphere.position.set(x, y, z);
        sphere.userData.drawerPart = "drill-marker";
        drawerGroup.add(sphere);
      }
    }

    if (spec.handleType && spec.handleType !== "Nenhum") {
      const frontWidthMm = spec.widthM * 1000;
      const frontHeightMm = spec.heightM * 1000;
      const handleHoles = computeDrawerHandleHoles({
        tipo: "gaveta_frente_ext",
        largura: frontWidthMm,
        altura: frontHeightMm,
        espessura: spec.frontThicknessM * 1000,
        handleType: spec.handleType,
        handleProfileId: spec.handleProfileId,
        handleCenterDistanceMm: spec.handleCenterDistanceMm,
        handlePosition: spec.handlePosition,
        handlePositionPercent: spec.handlePositionPercent,
        handleOffsetXMm: spec.handleOffsetXMm,
        handleOffsetYMm: spec.handleOffsetYMm,
        handleOffsetMm: (spec.handleOffsetM ?? 0) * 1000,
      });
      for (const hole of handleHoles) {
        if (hole.holeSubtype === "groove") continue;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 8), handleMarkerMaterial);
        const x = hole.x / 1000 - frontWidthMm / 2000;
        const y = frontHeightMm / 2000 - hole.y / 1000;
        sphere.position.set(x, y, spec.frontThicknessM / 2 + 0.002);
        sphere.userData.drawerPart = "handle-drill-marker";
        drawerGroup.add(sphere);
      }
    }

    if (isMetalBoxCatalogType(spec.metalBoxType)) {
      const metalMarkerMaterial = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x14532d,
        roughness: 0.4,
        metalness: 0.1,
      });
      const metalHoles = computeDrawerMetalBoxFrontHoles({
        tipo: "gaveta_frente_int",
        largura: (spec.frontIntWidthM ?? spec.bodyWidthM ?? spec.widthM) * 1000,
        altura: (spec.frontIntHeightM ?? spec.bodyHeightM ?? spec.heightM) * 1000,
        espessura: (spec.frontIntThicknessM ?? 0.016) * 1000,
        metalBoxType: spec.metalBoxType,
        metalBoxProfileId: spec.metalBoxProfileId,
        metalBoxHeightMm: spec.metalBoxHeightMm,
      });
      for (const hole of metalHoles) {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 8), metalMarkerMaterial);
        const intWidthM = spec.frontIntWidthM ?? spec.bodyWidthM ?? spec.widthM;
        const intHeightM = spec.frontIntHeightM ?? spec.bodyHeightM ?? spec.heightM;
        const x = hole.x / 1000 - intWidthM / 2;
        const y = intHeightM / 2 - hole.y / 1000;
        sphere.position.set(x, y, -spec.frontThicknessM - (spec.frontIntThicknessM ?? 0) / 2 - 0.002);
        sphere.userData.drawerPart = "metal-fixation-drill-marker";
        drawerGroup.add(sphere);
      }
    }
  }

  group.add(drawerGroup);
  if (import.meta.env.DEV) devLogger.debug("[BoxLayers][DrawerFactory.createDrawerObject] final", { id: spec.id });
  return group;
}

/** Extrai DrawerSpec guardado no grupo (paridade getDoorSpecFromGroup). */
export function getDrawerSpecFromGroup(group: THREE.Object3D): DrawerSpec | null {
  const stored = group.userData?.drawerSpec as DrawerSpec | undefined;
  if (stored && typeof stored.id === "string" && stored.id.length > 0) {
    return stored;
  }
  const idFromName =
    typeof group.name === "string" && group.name.startsWith("drawer-layer-")
      ? group.name.slice("drawer-layer-".length)
      : null;
  if (!idFromName) return null;
  return null;
}
