/**
 * Módulo Box – modelo base para o sistema multi-box.
 */

export {
  BOX_DEFAULTS,
  createBoxParams,
  type BoxParams,
  type TipoBorda,
  type TipoFundo,
} from "./types";
export {
  clampBoxParams,
  validateBoxParams,
  type ValidationResult,
} from "./boxValidation";
