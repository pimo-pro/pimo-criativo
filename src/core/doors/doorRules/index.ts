export type {
  DoorRulesDrillingProfile,
  DoorRulesGaps,
  DoorRulesLateralFixation,
  DoorRulesSettingsHinge,
  DoorRulesSources,
  DoorRulesValidationIssue,
  ResolvedDoorRules,
} from "./doorRulesTypes";

export {
  DOOR_ANIMATION_DURATION_MS,
  DOOR_MIN_HEIGHT_MM,
  DOOR_MIN_WIDTH_MM,
  DOOR_OVERLAY_FABRICO_MM,
  GAVETA_PORTA_SEP_DOOR_GAP_MM,
} from "./doorRulesDefaults";

export {
  resolveDefaultDoorRules,
  resolveDoorRules,
  resolveDoorRulesFromSources,
} from "./doorRulesResolver";

export {
  validateDoorGaps,
  validatePortaRanges,
  validateResolvedDoorRules,
} from "./doorRulesValidation";
