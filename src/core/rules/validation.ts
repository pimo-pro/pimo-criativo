/**
 * Validação de regras dinâmicas para modelos GLB dentro de uma caixa.
 * Produz lista de violações (RuleViolation) para feedback no estado e na UI.
 */

import type { Dimensoes } from "../types";
import { getRulesForModel } from "./modelRules";
import type {
  DimensionRule,
  MaterialRule,
  CompatibilityRule,
  ValidationContext,
  RuleViolation,
  RuleSeverity,
} from "./types";

const SEVERITY_ERROR: RuleSeverity = "error";
const SEVERITY_WARNING: RuleSeverity = "warning";

function violationId(boxId: string, modelInstanceId: string, ruleId: string): string {
  return `violation-${boxId}-${modelInstanceId}-${ruleId}`;
}

function validateDimensionRule(
  ctx: ValidationContext,
  rule: DimensionRule
): RuleViolation | null {
  const dim = rule.dimension;
  const boxVal = ctx.boxDimensoes[dim];
  if (boxVal == null) return null;

  let minMm = rule.minMm;
  let maxMm = rule.maxMm;
  if (rule.relativeToBox && boxVal > 0) {
    if (rule.minPercent != null) minMm = (boxVal * rule.minPercent) / 100;
    if (rule.maxPercent != null) maxMm = (boxVal * rule.maxPercent) / 100;
  }

  const modelVal = ctx.modelDimensoesMm?.[dim];
  if (modelVal == null) return null; // sem dimensão do modelo, não validar esta regra

  if (minMm != null && modelVal < minMm) {
    return {
      id: violationId(ctx.boxId, ctx.modelInstanceId, rule.id),
      ruleKind: "dimension",
      ruleId: rule.id,
      severity: SEVERITY_ERROR,
      message: rule.message ?? `${dim}: valor ${modelVal} mm é menor que o mínimo ${minMm} mm`,
      boxId: ctx.boxId,
      modelInstanceId: ctx.modelInstanceId,
      modelId: ctx.modelId,
      details: { dimension: dim, value: modelVal, min: minMm, max: maxMm },
    };
  }
  if (maxMm != null && modelVal > maxMm) {
    return {
      id: violationId(ctx.boxId, ctx.modelInstanceId, rule.id),
      ruleKind: "dimension",
      ruleId: rule.id,
      severity: SEVERITY_ERROR,
      message: rule.message ?? `${dim}: valor ${modelVal} mm é maior que o máximo ${maxMm} mm`,
      boxId: ctx.boxId,
      modelInstanceId: ctx.modelInstanceId,
      modelId: ctx.modelId,
      details: { dimension: dim, value: modelVal, min: minMm, max: maxMm },
    };
  }
  return null;
}

function validateMaterialRule(
  ctx: ValidationContext,
  rule: MaterialRule
): RuleViolation | null {
  if (rule.allowedMaterials.length === 0) return null;
  const material = ctx.material?.trim() || "";
  if (!material) return null;
  const allowed = rule.allowedMaterials.map((m) => m.toLowerCase().trim());
  if (allowed.includes(material.toLowerCase())) return null;
  return {
    id: violationId(ctx.boxId, ctx.modelInstanceId, rule.id),
    ruleKind: "material",
    ruleId: rule.id,
    severity: SEVERITY_WARNING,
    message: rule.message ?? `Material "${material}" não permitido para este modelo. Permitidos: ${rule.allowedMaterials.join(", ")}`,
    boxId: ctx.boxId,
    modelInstanceId: ctx.modelInstanceId,
    modelId: ctx.modelId,
    details: { material, allowed: rule.allowedMaterials },
  };
}

function validateCompatibilityRule(
  ctx: ValidationContext,
  rule: CompatibilityRule
): RuleViolation | null {
  if (rule.maxInstancesPerBox != null) {
    const sameModelCount = ctx.boxModels.filter((m) => m.modelId === ctx.modelId).length;
    if (sameModelCount > rule.maxInstancesPerBox) {
      return {
        id: violationId(ctx.boxId, ctx.modelInstanceId, rule.id),
        ruleKind: "compatibility",
        ruleId: rule.id,
        severity: SEVERITY_ERROR,
        message: rule.message ?? `Máximo ${rule.maxInstancesPerBox} instância(s) deste modelo por caixa. Atual: ${sameModelCount}`,
        boxId: ctx.boxId,
        modelInstanceId: ctx.modelInstanceId,
        modelId: ctx.modelId,
        details: { count: sameModelCount, max: rule.maxInstancesPerBox },
      };
    }
  }
  return null;
}

/** Valida todas as regras ativas do modelo no contexto e retorna violações. */
export function validateModelRules(ctx: ValidationContext): RuleViolation[] {
  const rules = getRulesForModel(ctx.modelId);
  const violations: RuleViolation[] = [];
  for (const rule of rules) {
    let v: RuleViolation | null = null;
    switch (rule.kind) {
      case "dimension":
        v = validateDimensionRule(ctx, rule as DimensionRule);
        break;
      case "material":
        v = validateMaterialRule(ctx, rule as MaterialRule);
        break;
      case "compatibility":
        v = validateCompatibilityRule(ctx, rule as CompatibilityRule);
        break;
      case "position":
      case "behavior":
        // position/behavior podem ser usados para auto-positioning; violações opcionais
        break;
      default:
        break;
    }
    if (v) violations.push(v);
  }
  return violations;
}

/** Valida todas as instâncias de modelos de uma caixa (boxDimensoes + boxModels + extractedParts ou modelDimensoes). */
export function validateBoxModels(
  boxId: string,
  boxDimensoes: Dimensoes,
  boxModels: Array<{ id: string; modelId: string; material?: string; categoria?: string }>,
  modelDimensoesByInstanceId?: Record<string, Dimensoes>
): RuleViolation[] {
  const all: RuleViolation[] = [];
  for (const model of boxModels) {
    const ctx: ValidationContext = {
      boxId,
      boxDimensoes,
      boxModels,
      modelInstanceId: model.id,
      modelId: model.modelId,
      material: model.material,
      categoria: model.categoria,
      modelDimensoesMm: modelDimensoesByInstanceId?.[model.id],
    };
    all.push(...validateModelRules(ctx));
  }
  return all;
}
