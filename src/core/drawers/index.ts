/**
 * Drawers Domain
 *
 * Sistema completo de gerenciamento de gavetas:
 * - Cálculos paramétricos (DrawerParametrics)
 * - Modelo de gavetas (Drawer)
 * - Agrupamento (DrawerGroup)
 * - Geração automática (DrawerGenerationService)
 * - Movimento e animação (DrawerMotionService)
 * - Adaptadores para layers (adapters/)
 *
 * Sistema activo: Modelo A / Sistema Unificado (clássico).
 */

// Helpers de camada activa (clássico; ignora órfãs Modelo B)
export {
  boxHasActiveDrawers,
  isDrawerModeloBActive,
  resolveActiveDrawersLayer,
  resolveActiveGavetasCount,
} from "./drawerModeloAGate";

// Feature flags (restauro: Modelo A sempre activo)
export {
  DRAWER_MODELO_A_CHANGE_EVENT,
  DRAWER_MODELO_A_DEFAULT_ENABLED,
  DRAWER_MODELO_A_STORAGE_KEY,
  DRAWER_MODELO_B_DEFAULT_MIGRATION_KEY,
  applyModeloBProductDefaultMigration,
  isDrawerModeloAActive,
  isDrawerModeloADeactivationRequested,
  setDrawerModeloADeactivated,
  setDrawerModeloAEnabled,
  subscribeDrawerModeloAFlags,
} from "./drawerSystemFlags";

// Core types
export type { DrawerDimensions, DrawerPieceSpec, DrawerCalculatedSpecs, DrawerParametricSettings, DrawerParametricOverrides } from "./DrawerParametrics";
export type { DrawerPiece, Drawer } from "./Drawer";
export type { DrawerGroup } from "./DrawerGroup";
export type { DrawerGenerationConfig } from "./DrawerGenerationService";
export type { DrawerMotionState } from "./DrawerMotionService";

// BOM types
export type {
  DrawerPieceForBom,
  DrawerHardwareForBom,
} from "./DrawerBomService";

export {
  buildDrawerParametricOverridesList,
  drawerParametricOverridesFromLayerItem,
} from "./drawerParametricOverrides";

export {
  resolveDrawerBodyHeightMm,
  resolveDrawerDisplayName,
  resolveDrawerFrontHeightMm,
  resolveDrawerFrontPieceLabel,
  resolveDrawerGroupPrefix,
  resolveDrawerPieceIndustrialLabel,
  sanitizeDrawerIndustrialName,
} from "./drawerLayerCustomization";

// Parametrics
export {
  calculateDrawerSpecs,
  validateDrawerSpecs,
  getDrawerBoundingBox,
  resolveDrawerStructuralFrontIntWoodDimsMm,
} from "./DrawerParametrics";

// Drawer
export {
  createDrawer,
  updateDrawerMotion,
  getFrontAbsolutePosition,
  getBodyAbsolutePosition,
} from "./Drawer";

export type { DrawerHeightMode } from "./drawerHeightModeTypes";
export {
  calculateErgonomicDrawerHeights,
  estimateDrawerCenterHeightsFromFloorMm,
  DEFAULT_KITCHEN_ZONE_PROFILE,
  ERGONOMIC_MIN_DRAWER_HEIGHT_MM,
  ERGONOMIC_MAX_DRAWER_HEIGHT_MM,
  type KitchenZoneProfile,
  type ErgonomicDrawerHeightsInput,
} from "./drawerErgonomicsHeights";
export { resolveDrawerErgonomicsRules } from "./drawerErgonomicsContext";
export { isErgonomicDrawerHeightMode, ERGONOMIC_DRAWER_HEIGHT_MODES } from "./drawerHeightModeTypes";

// DrawerGroup
export {
  calculateDrawerHeights,
  calculateDrawerPositions,
  recalculateDrawerGroupLayout,
  addDrawerToGroup,
  removeDrawerFromGroup,
  updateHeightMode,
} from "./DrawerGroup";
export {
  DRAWER_VERTICAL_BASE_OFFSET_MM,
  DRAWER_VERTICAL_GAP_MM,
  calculateEqualQuaseDrawerHeights,
  getDrawerUsableInternalHeightMm,
  resolveDrawerVerticalPosition,
  resolveDrawerVerticalPositions,
  resolveModuleFloorTopYMm,
} from "./drawerVerticalPosition";
export type { DrawerVerticalLayoutOptions } from "./drawerVerticalPosition";
export {
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
  DRAWER_GAV1_MODULE_GUIDE_AXIS_MM,
  assertGav1IndustrialSsotOrThrow,
  assertGavIndustrialSsotOrThrow,
  assertGavViewerSsotOrThrow,
  DRAWER_VIEWER_SSOT_LAYOUT_REV,
  DRAWER_PROGRESSIVAS_H800_T19_GUIDE_FROM_FLOOR_TOP_MM,
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_BODY_DELTA_UPPER_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
  DRAWER_LOWEST_SIDE_HEIGHT_RATIO,
  DRAWER_SINGLE_BODY_CLEARANCE_ABOVE_FLOOR_MM,
  DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_FRONT_LATERAL_GAP_MM,
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  DRAWER_STACK_BASE_OFFSET_MM,
  DRAWER_STACK_GAVETA1_ADJUST_MM,
} from "./drawerGeometryConstants";
export {
  resolveDrawerStackRole,
  resolveDrawerFrontStackGeometry,
  resolveLowestDrawerBodyElevationFromFrontMm,
  resolveSingleDrawerBodyElevationFromFrontMm,
  resolveDrawerBodyElevationForStackRoleMm,
  resolveClassicExteriorLowestBodyElevationFromFrontMm,
  resolveDrawerBodyDeltaForStackRoleMm,
  resolveDrawerBodyBottomFromModuleBaseMm,
  resolveGav1BodyBottomFromModuleBaseMm,
  type DrawerStackRole,
  type DrawerFrontStackGeometry,
} from "./drawerStackPosition";

// Generation Service
export {
  generateDrawerGroup,
  regenerateDrawerGroup,
  canBoxHaveDrawers,
} from "./DrawerGenerationService";

  // BOM Service
  export {
    extractDrawerPiecesForBom,
    extractDrawerHardwareForBom,
    extractDrawerGroupPiecesForBom,
    extractDrawerGroupHardwareForBom,
    summarizeDrawerPieces,
    summarizeDrawerHardware,
  } from "./DrawerBomService";

// Motion Service
export {
  setDrawerOpen,
  setDrawerOpenInGroup,
  updateDrawerProgress,
  calculateDrawerOffset,
  createDrawerAnimation,
  animateDrawer,
  easeInOutCubic,
  closeAllDrawers,
  openAllDrawers,
  canOpenDrawer,
  openDrawer,
  closeDrawer,
  resolveDrawerMaxPullMm,
  DRAWER_SEQUENTIAL_STEP_DELAY_MS,
  VIEWER_DRAWER_ANIMATION_DURATION_MS,
} from "./DrawerMotionService";
export {
  tandemCurve,
  moventoCurve,
  genericSlideCurve,
  resolveDrawerMotionCurve,
  resolveDrawerAnimationDurationMs,
} from "./DrawerMotionCurves";
export {
  canOpenDrawer as canOpenDrawerLayer,
  canToggleDrawer,
  type DrawerCollisionSceneContext,
} from "./DrawerCollisionService";

export {
  toggleDrawer,
  openAllSequential,
  closeAllSequential,
  toggleAllDrawersSequential,
  type DrawerControllerCallbacks,
  type DrawerOpenOptions,
} from "./DrawerController";

export {
  DRAWER_METAL_BOX_PROFILES,
  findMetalBoxProfileById,
  isMetalBoxCatalogType,
  listMetalBoxProfilesForType,
  normalizeDrawerMetalBoxType,
  pickCompatibleMetalDepth,
  resolveMetalBoxFrontHoleYOnPanel,
  resolveMetalBoxHeightMm,
  resolveMetalBoxProfile,
  type DrawerMetalBoxProfile,
  type MetalBoxFrontHoleTemplate,
} from "./drawerMetalBoxCatalog";

export { computeDrawerMetalBoxFrontHoles } from "./drilling/DrawerMetalBoxFrontDrilling";

// Adapters
export {
  drawerGroupToLayerItems,
  drawerToLayerItem,
  layerItemToDrawer,
  updateDrawerGroupFromLayerItems,
} from "./adapters/drawerGroupToLayerItems";
