export type {
  DivisorItem,
  SeparadorItem,
  DivisorReferenceEdge,
  SeparadorReferenceEdge,
  DivisorPosicaoRelativaAoSep,
  SeparadorAncoraHorizontal,
  DivSepBoxLike,
} from "./types";
export {
  resolvePosicaoRelativaAoSep,
  resolveAncoraHorizontal,
} from "./types";
export type {
  DivisorPrateleiraLado,
  PrateleiraDirecao,
  PrateleiraGridStepMm,
  PrateleiraGridMode,
  BoxShelfOptions,
} from "./types";
export {
  resolveAvailableShelfDirecoes,
  resolveShelfDirecao,
  resolveShelfGridStepMm,
  resolveShelfGridMode,
  resolveShelfMargemMm,
  applyShelfDirecaoToBox,
  migrateShelfOnSeparadorAncoraChange,
  mergeShelfOptions,
} from "./shelfOptions";
export {
  findSeparadorById,
  isDivisorLinkedToSeparador,
  resolveEffectiveLinkedSeparador,
  resolveSeparadorBottomY,
  resolveSeparadorTopY,
  resolveDivisorLinkedHeightMm,
  resolveDivisorBottomYAbs,
  resolveDivisorEffectiveHeightMm,
  DIV_SEP_VERTICAL_CLEARANCE_MM,
} from "./coupling";
export {
  resolveVerticalCompartments,
  separadorCutsShelfSide,
  resolveShelfGridYs,
  resolveDivShelfGridYs,
  resolveDivShelfAbsoluteCenterYs,
  resolveSepOnlyShelfAbsoluteCenterYs,
  resolveSepOnlyShelfPlacementZone,
  resolvePrimaryDivShelfPlacementZone,
  resolveShelfPlacementPlans,
  resolveShelfWidthForPlan,
  resolveShelfAbsoluteCenterYsForPlan,
  boxHasDivisorAboveSep,
  buildDivShelfDrilling,
  buildSegmentedShelfGridYs,
  resolveShelfWidthForSepOnly,
  boxUsesDivShelfMode,
  countDivShelfPanels,
} from "./shelfDrilling";
export {
  getDivSepInternalDims,
  resolveDivisorDimensions,
  resolveSeparadorDimensions,
  resolveDivisorCenterX,
  resolveSeparadorCenterX,
  resolveSeparadorCenterY,
  resolveSeparadorLeftXAbsMm,
  clampDivisorPosition,
  clampSeparadorPosition,
  resolveFullInternalShelfWidthMm,
  resolveInternalShelfDepthMm,
} from "./dimensions";
export {
  buildAutoDivisorItem,
  buildAutoSeparadorItem,
  chooseSeparadorAncoraFromDivs,
  autoLinkDivisorsToSeparador,
  pickPreferredSeparador,
} from "./autoLink";
export {
  calcularPosicaoCavilha,
  calcularPosicoesCavilha,
  getDivSepRules,
  getCavilhaDiameterMm,
  getCavilhaDepthMm,
  getParafusoDistanceFromCavilhaMm,
} from "./cavilhaRules";
export { buildDivSepDrilling, mergeDrillHoles } from "./drilling";
export { getDivSepMeshSpecs } from "./visualSpecs";
export {
  parseDivSepMeshName,
  separadorLocalYToPositionMm,
  divisorLocalXToPositionMm,
  clampSeparadorLocalY,
  clampDivisorLocalX,
} from "./dragCoords";
export type { DivSepDragKind } from "./dragCoords";
