/**
 * Geometria industrial — caixa cavita (cx_gav).
 * Lê dimensões internas úteis existentes; não altera fórmulas globais.
 */

import { getProfundidadeInternaUtilMm } from "../box/boxDepthHelpers";
import { resolveActiveDrawersLayer, resolveActiveGavetasCount } from "../drawers";
import { resolveCostaThicknessMm } from "../materials/materials.api";
import type { BoxModule } from "../types";

export const CX_GAV_PRODUCT_MODE_ID = "cx_gav_cavita";
export const CX_GAV_CIMA_DEPTH_MM = 100;
export const CX_GAV_EDGE_INSET_MM = 20;
export const CX_GAV_FACE_FROM_REAR_MM = [30, 70] as const;

export const CX_GAV_PIECE_TIPOS = [
  "cx_gav_lat_dir",
  "cx_gav_lat_esq",
  "cx_gav_fun",
  "cx_gav_cima",
] as const;

export type CxGavPieceTipo = (typeof CX_GAV_PIECE_TIPOS)[number];

export function isCxGavPieceTipo(tipo: string): tipo is CxGavPieceTipo {
  return (CX_GAV_PIECE_TIPOS as readonly string[]).includes(tipo);
}

/**
 * Activa o path paramétrico cx_gav.
 * Nunca mistura com catálogo industrial-* / custom-model-*.
 */
export function boxUsesCxGav(box: {
  baseCabinetId?: string | null;
  customIndustrialModelId?: string | null;
}): boolean {
  const custom = box.customIndustrialModelId;
  if (
    typeof custom === "string" &&
    (custom.startsWith("industrial-") || custom.startsWith("custom-model-"))
  ) {
    return false;
  }
  const id = String(custom ?? box.baseCabinetId ?? "");
  return id === CX_GAV_PRODUCT_MODE_ID || id.includes("cx_gav_cavita");
}

export type CxGavLayout = {
  espessuraMm: number;
  larguraInternaMm: number;
  alturaInternaMm: number;
  profundidadeInternaMm: number;
  /** Altura das laterais (entre cima e fundo). */
  lateralAlturaMm: number;
  /** Largura do painel lateral = profundidade interna. */
  lateralProfundidadeMm: number;
  /** Fundo: largura × profundidade (envelope = largura interna). */
  fundoLarguraMm: number;
  fundoProfundidadeMm: number;
  /** Cima traseira: largura × 100 mm. */
  cimaLarguraMm: number;
  cimaProfundidadeMm: number;
};

/** Lê internas úteis via helpers SSOT — sem recalcular regras globais. */
export function computeCxGavLayout(box: BoxModule): CxGavLayout {
  const espessuraMm = Math.max(1, Number(box.espessura) || 19);
  const largura = Number(box.dimensoes.largura) || 0;
  const altura = Number(box.dimensoes.altura) || 0;
  const profundidadeExterna =
    Number(box.profundidadeExterna ?? box.dimensoes.profundidade) || 0;
  const larguraInternaMm = Math.max(0, largura - espessuraMm * 2);
  const alturaInternaMm = Math.max(0, altura - espessuraMm * 2);
  const profundidadeInternaMm = Math.max(
    0,
    getProfundidadeInternaUtilMm(
      {
        dimensoes: { profundidade: profundidadeExterna },
        espessura: box.espessura,
        portaTipo: box.portaTipo,
        doorsLayer: box.doorsLayer,
        drawersLayer: resolveActiveDrawersLayer(box),
        gavetas: resolveActiveGavetasCount(box),
        costaAtiva: box.costaAtiva,
      },
      resolveCostaThicknessMm(box)
    )
  );

  const lateralAlturaMm = Math.max(0, alturaInternaMm - espessuraMm * 2);
  const cimaProfundidadeMm = CX_GAV_CIMA_DEPTH_MM;

  return {
    espessuraMm,
    larguraInternaMm,
    alturaInternaMm,
    profundidadeInternaMm,
    lateralAlturaMm,
    lateralProfundidadeMm: profundidadeInternaMm,
    fundoLarguraMm: larguraInternaMm,
    fundoProfundidadeMm: profundidadeInternaMm,
    cimaLarguraMm: larguraInternaMm,
    cimaProfundidadeMm,
  };
}

export function buildCxGavIndustrialLabel(
  boxName: string,
  pieceTipo: CxGavPieceTipo
): string {
  const safeName =
    String(boxName || "BOX")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "")
      .slice(0, 32) || "BOX";
  return `${safeName}_${pieceTipo}`;
}
