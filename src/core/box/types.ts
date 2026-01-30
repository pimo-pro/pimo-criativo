/**
 * Modelo base de Box para o sistema multi-box pimo-criativo.
 * Fonte única de parâmetros: dimensões, material, tipo de borda e fundo.
 */

import type { Dimensoes, TipoBorda, TipoFundo } from "../types";

export type { TipoBorda, TipoFundo };

/** Parâmetros completos de um Box (domínio). */
export interface BoxParams {
  id: string;
  nome: string;
  dimensoes: Dimensoes;
  espessura: number;
  material: string;
  tipoBorda: TipoBorda;
  tipoFundo: TipoFundo;
}

/** Valores padrão para criação de um Box. */
export const BOX_DEFAULTS = {
  LARGURA_MIN_MM: 100,
  LARGURA_MAX_MM: 3000,
  ALTURA_MIN_MM: 100,
  ALTURA_MAX_MM: 3000,
  PROFUNDIDADE_MIN_MM: 100,
  PROFUNDIDADE_MAX_MM: 1200,
  ESPESSURA_MIN_MM: 6,
  ESPESSURA_MAX_MM: 25,
  TIPO_BORDA: "reta" as TipoBorda,
  TIPO_FUNDO: "recuado" as TipoFundo,
  MATERIAL: "MDF",
} as const;

/** Cria um BoxParams com valores padrão; overrides parciais permitidos. */
export function createBoxParams(
  id: string,
  overrides: Partial<Omit<BoxParams, "id">> & { nome: string; dimensoes: Dimensoes }
): BoxParams {
  const {
    LARGURA_MIN_MM,
    ALTURA_MIN_MM,
    PROFUNDIDADE_MIN_MM,
    ESPESSURA_MIN_MM,
    TIPO_BORDA,
    TIPO_FUNDO,
    MATERIAL,
  } = BOX_DEFAULTS;
  const dim = overrides.dimensoes;
  return {
    id,
    nome: overrides.nome ?? "Caixa",
    dimensoes: {
      largura: Math.max(LARGURA_MIN_MM, dim.largura),
      altura: Math.max(ALTURA_MIN_MM, dim.altura),
      profundidade: Math.max(PROFUNDIDADE_MIN_MM, dim.profundidade),
    },
    espessura: Math.max(ESPESSURA_MIN_MM, overrides.espessura ?? 18),
    material: overrides.material ?? MATERIAL,
    tipoBorda: overrides.tipoBorda ?? TIPO_BORDA,
    tipoFundo: overrides.tipoFundo ?? TIPO_FUNDO,
  };
}
