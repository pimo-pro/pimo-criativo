// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import type { InvariantIssue, InvariantValidationInput } from "../types";

const TOLERANCE_MM = 0.5;

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/** Furos com coordenadas fora dos limites do painel (face plana). */
export function validateDrillHolesOutOfBounds(input: InvariantValidationInput): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  const cutList = input.cutList ?? input.project.cutListComPreco ?? input.project.cutList ?? [];

  for (const item of cutList) {
    const holes = item.drillHoles;
    if (!holes?.length) continue;

    const w = item.dimensoes.largura;
    const h = item.dimensoes.altura;

    for (let i = 0; i < holes.length; i++) {
      const hole = holes[i]!;
      if (hole.x < -TOLERANCE_MM || hole.x > w + TOLERANCE_MM || hole.y < -TOLERANCE_MM || hole.y > h + TOLERANCE_MM) {
        issues.push({
          ruleId: "drill-holes-out-of-bounds",
          ruleName: "Furos fora da peça",
          severity: "error",
          message: `Furo #${i + 1} em "${item.nome}" fora dos limites (${hole.x.toFixed(1)}, ${hole.y.toFixed(1)}) — peça ${w}×${h} mm.`,
          context: {
            piece: item.nome,
            pieceId: item.id,
            box: item.boxId,
            boxId: item.boxId,
            operation: "drilling",
            phase: "drilling",
          },
          phase: "drilling",
        });
      }
    }
  }

  return issues;
}

/** Dimensões zero ou negativas na cutlist. */
export function validateInvalidPieceDimensions(input: InvariantValidationInput): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  const cutList = input.cutList ?? input.project.cutListComPreco ?? input.project.cutList ?? [];

  for (const item of cutList) {
    const { largura, altura, profundidade } = item.dimensoes;
    const esp = item.espessura;
    if (largura <= 0 || altura <= 0 || profundidade <= 0 || esp <= 0) {
      issues.push({
        ruleId: "invalid-piece-dimensions",
        ruleName: "Dimensões inválidas",
        severity: "error",
        message: `Peça "${item.nome}" com dimensões inválidas: ${largura}×${altura}×${profundidade} mm, esp. ${esp} mm.`,
        context: {
          piece: item.nome,
          pieceId: item.id,
          boxId: item.boxId,
          operation: "cutlist",
          phase: input.phase,
        },
        phase: input.phase,
      });
    }
  }

  return issues;
}

/** Rotação NaN/infinito nas caixas do workspace. */
export function validateBoxRotationInconsistent(input: InvariantValidationInput): InvariantIssue[] {
  const issues: InvariantIssue[] = [];

  for (const box of input.project.workspaceBoxes) {
    const rotations = [
      { axis: "X", value: box.rotacaoX },
      { axis: "Y", value: box.rotacaoY },
      { axis: "Z", value: box.rotacaoZ },
    ];
    for (const { axis, value } of rotations) {
      if (!isFiniteNumber(value)) {
        issues.push({
          ruleId: "box-rotation-inconsistent",
          ruleName: "Rotação inconsistente",
          severity: "warning",
          message: `Caixa "${box.nome ?? box.id}" com rotação ${axis} inválida.`,
          context: {
            box: box.nome ?? box.id,
            boxId: box.id,
            operation: "transform",
            phase: "viewer",
          },
          phase: "viewer",
        });
      }
    }
  }

  return issues;
}

/** Violações de regras já calculadas no projecto. */
export function validateProjectRuleViolations(input: InvariantValidationInput): InvariantIssue[] {
  const violations = input.project.ruleViolations ?? [];
  return violations.map((v) => ({
    ruleId: "project-rule-violations",
    ruleName: "Violações de regras do projeto",
    severity: v.severity === "error" ? "error" : "warning",
    message: v.message,
    context: {
      boxId: v.boxId,
      operation: "rules",
      phase: "viewer",
    },
    phase: "viewer",
  }));
}

/** Avisos de layout de modelos CAD. */
export function validateProjectLayoutWarnings(input: InvariantValidationInput): InvariantIssue[] {
  const warnings = input.project.layoutWarnings;
  const issues: InvariantIssue[] = [];
  if (!warnings) return issues;

  for (const c of warnings.collisions ?? []) {
    issues.push({
      ruleId: "project-layout-warnings",
      ruleName: "Avisos de layout de modelos",
      severity: "info",
      message: `Colisão entre modelos ${c.modelIdA} e ${c.modelIdB} na caixa ${c.boxId}.`,
      context: {
        boxId: c.boxId,
        operation: "layout",
        phase: "viewer",
      },
      phase: "viewer",
    });
  }

  for (const o of warnings.outOfBounds ?? []) {
    issues.push({
      ruleId: "project-layout-warnings",
      ruleName: "Avisos de layout de modelos",
      severity: "warning",
      message: `Modelo ${o.modelInstanceId} fora dos limites da caixa ${o.boxId}${o.axis ? ` (eixo ${o.axis})` : ""}.`,
      context: {
        boxId: o.boxId,
        operation: "layout",
        phase: "viewer",
      },
      phase: "viewer",
    });
  }

  return issues;
}
