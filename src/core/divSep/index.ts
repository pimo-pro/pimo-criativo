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
  getDivSepInternalDims,
  resolveDivisorDimensions,
  resolveSeparadorDimensions,
  resolveDivisorCenterX,
  resolveSeparadorCenterX,
  resolveSeparadorCenterY,
  resolveSeparadorLeftXAbsMm,
  clampDivisorPosition,
  clampSeparadorPosition,
} from "./dimensions";
export {
  buildAutoDivisorItem,
  buildAutoSeparadorItem,
  chooseSeparadorAncoraFromDivs,
  autoLinkDivisorsToSeparador,
  pickPreferredSeparador,
} from "./autoLink";
export {
  resolveVerticalCompartments,
  separadorCutsShelfSide,
  resolveShelfGridYs,
  resolveDivShelfGridYs,
  resolveDivShelfAbsoluteCenterYs,
  resolvePrimaryDivShelfPlacementZone,
  boxHasDivisorAboveSep,
  buildDivShelfDrilling,
} from "./shelfDrilling";
export {
  calcularPosicaoCavilha,
  calcularPosicoesCavilha,
  getDivSepRules,
  getCavilhaDiameterMm,
  getCavilhaDepthMm,
  getParafusoDistanceFromCavilhaMm,
} from "./cavilhaRules";
export { buildDivSepDrilling, mergeDrillHoles } from "./drilling";
export { buildDivSepIndustrialLabel } from "./labels";
export { getDivSepMeshSpecs } from "./visualSpecs";
export {
  parseDivSepMeshName,
  separadorLocalYToPositionMm,
  divisorLocalXToPositionMm,
  clampSeparadorLocalY,
  clampDivisorLocalX,
} from "./dragCoords";
export type { DivSepDragKind } from "./dragCoords";
