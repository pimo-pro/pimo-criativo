/**
 * Regras de validação para o modelo Box.
 */

import type { BoxParams } from "./types";
import { BOX_DEFAULTS } from "./types";
import type { TipoBorda, TipoFundo } from "../types";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const TIPOS_BORDA: TipoBorda[] = ["reta", "biselada", "arredondada"];
const TIPOS_FUNDO: TipoFundo[] = ["integrado", "recuado", "sem_fundo"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Valida e normaliza os parâmetros do Box.
 * Retorna erros se algo for inválido; dimensões e espessura são clampadas aos limites.
 */
export function validateBoxParams(params: Partial<BoxParams>): ValidationResult {
  const errors: string[] = [];

  if (!params.id || typeof params.id !== "string" || !params.id.trim()) {
    errors.push("id é obrigatório");
  }
  if (!params.nome || typeof params.nome !== "string" || !params.nome.trim()) {
    errors.push("nome é obrigatório");
  }

  const dim = params.dimensoes;
  if (dim) {
    if (!Number.isFinite(dim.largura) || dim.largura <= 0) {
      errors.push("dimensões.largura deve ser um número positivo");
    }
    if (!Number.isFinite(dim.altura) || dim.altura <= 0) {
      errors.push("dimensões.altura deve ser um número positivo");
    }
    if (!Number.isFinite(dim.profundidade) || dim.profundidade <= 0) {
      errors.push("dimensões.profundidade deve ser um número positivo");
    }
  } else {
    errors.push("dimensoes é obrigatório");
  }

  if (params.espessura !== undefined) {
    if (!Number.isFinite(params.espessura) || params.espessura <= 0) {
      errors.push("espessura deve ser um número positivo");
    }
  }

  if (params.tipoBorda !== undefined && !TIPOS_BORDA.includes(params.tipoBorda)) {
    errors.push(`tipoBorda deve ser um de: ${TIPOS_BORDA.join(", ")}`);
  }
  if (params.tipoFundo !== undefined && !TIPOS_FUNDO.includes(params.tipoFundo)) {
    errors.push(`tipoFundo deve ser um de: ${TIPOS_FUNDO.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Aplica limites mínimos e máximos às dimensões e espessura.
 * Útil antes de enviar ao viewer ou calculadora.
 */
export function clampBoxParams(params: BoxParams): BoxParams {
  const {
    LARGURA_MIN_MM,
    LARGURA_MAX_MM,
    ALTURA_MIN_MM,
    ALTURA_MAX_MM,
    PROFUNDIDADE_MIN_MM,
    PROFUNDIDADE_MAX_MM,
    ESPESSURA_MIN_MM,
    ESPESSURA_MAX_MM,
  } = BOX_DEFAULTS;

  return {
    ...params,
    dimensoes: {
      largura: clamp(params.dimensoes.largura, LARGURA_MIN_MM, LARGURA_MAX_MM),
      altura: clamp(params.dimensoes.altura, ALTURA_MIN_MM, ALTURA_MAX_MM),
      profundidade: clamp(
        params.dimensoes.profundidade,
        PROFUNDIDADE_MIN_MM,
        PROFUNDIDADE_MAX_MM
      ),
    },
    espessura: clamp(params.espessura, ESPESSURA_MIN_MM, ESPESSURA_MAX_MM),
  };
}
