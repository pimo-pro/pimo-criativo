/**
 * Sistema de furação baseado em regras de marcenaria.
 * Fonte única para cálculo de furos e mapeamento DrillFace ↔ PanelFace (A/B).
 * Referência: docs/matriz-faces-A-B-FINAL.md — face interna = B, face externa = A.
 *
 * Top drilling: furos pela parte superior (topDrillable). Alinhado ao BoxBuilder/Viewer 3D,
 * Layout de Corte PRO e TCN: mesmas regras e distâncias (margemFrente/margemFundo, etc.).
 *
 * Prateleira (modelo mínimo FINAL): face interna = B = face que olha para baixo (interior da caixa);
 * face externa = A = face que olha para cima. getInternalFace("prateleira") = "fundo".
 */

import {
  computeDrawerPieceCorredicaHoles,
  computeDrawerCostaStructuralHoles,
  computeDrawerFrenteIntStructuralHoles,
  computeDrawerLateralStructuralHoles,
  getDrawerSlideDrillingRules,
} from "../drawers/drilling/DrawerDrillingRules";
import { computeDrawerHandleHoles } from "../drawers/drilling/DrawerHandleDrillingRules";
import { computeDrawerMetalBoxFrontHoles } from "../drawers/drilling/DrawerMetalBoxFrontDrilling";
import { isMetalBoxCatalogType } from "../drawers/drawerMetalBoxCatalog";
import type { RulesConfig } from "../rules/rulesConfig";
import { getNumDobradicas, getHingeYPositions, MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM } from "../rules/rulesConfig";
import { getSettings } from "../settings/settingsService";
import type { DrillFace, DrillType, PanelFace, TechnicalDrillHole } from "../types";
import { shouldTraceHingePiece, traceHingeDrilling } from "../../modules/drilling/hingeDrillingTrace";

export type PieceType =
  | "cima"
  | "fundo"
  | "lateral_esquerda"
  | "lateral_direita"
  | "prateleira"
  | "porta"
  | "porta_simples"
  | "porta_dupla"
  | "porta_correr"
  | "gaveta"
  | "gaveta_frente"
  | "gaveta_frente_int"
  | "gaveta_frente_ext"
  | "gaveta_lat_esq"
  | "gaveta_lat_dir"
  | "gaveta_fundo"
  | "gaveta_traseira"
  | string;

type PieceInput = {
  tipo: PieceType;
  largura: number;
  altura: number;
  espessura: number;
  handleType?: string;
  handleProfileId?: string;
  handleCenterDistanceMm?: number;
  handlePosition?: "Centro" | "Topo" | "Inferior" | "Percentual";
  handlePositionPercent?: number;
  handleOffsetXMm?: number;
  handleOffsetYMm?: number;
  handleOffsetMm?: number;
  slideType?: string;
  metalBoxType?: string;
  metalBoxProfileId?: string;
  metalBoxHeightMm?: number;
  softClose?: boolean;
  /** Gaveta mais baixa do módulo (índice 0 = inferior). */
  isLowestDrawer?: boolean;
  /** Se false, desativa explicitamente os furos de prateleira para a peça. */
  shelfHolesEnabled?: boolean;
  hingeSide?: "left" | "right" | "top" | "bottom";
  /**
   * Dobradiças em abertura left/right (eixo vertical):
   * distâncias em mm a partir da BASE da peça (industrial / getHingeYPositions).
   * No motor de furação do painel, Y=0 no TOPO e Y cresce para baixo → y_furo = altura - offset.
   * Em abertura top/bottom: posições ao longo da largura (offset a partir da borda “inferior” do eixo = esquerda).
   */
  hingePositionsMm?: number[];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Offsets de dobradiça (mm desde a base da peça) válidos para a altura real do painel.
 * Evita oy negativos (vão maior que porta) ou oy > altura que geram yLocal fora da peça.
 */
export function sanitizeHingeOffsetsFromPieceHeight(
  offsets: number[] | undefined,
  pieceAlturaMm: number,
  marginMm: number = MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM
): number[] {
  if (!Array.isArray(offsets) || !Number.isFinite(pieceAlturaMm) || pieceAlturaMm <= 0) return [];
  const min = marginMm;
  const max = Math.max(min, pieceAlturaMm - marginMm);
  return offsets
    .map((o) => Number(o))
    .filter((o) => Number.isFinite(o) && o >= min && o <= max);
}

/** Y no referencial topo→baixo do painel, sempre dentro de [raio .. altura−raio]. */
export function clampTopDownYMm(y: number, alturaMm: number, diameter = 5): number {
  const r = Math.max(0.25, diameter / 2);
  return clamp(y, r, Math.max(r, alturaMm - r));
}

/** X no referencial local do painel, sempre dentro de [raio .. largura−raio]. */
export function clampLocalXMm(x: number, larguraMm: number, diameter = 5): number {
  const r = Math.max(0.25, diameter / 2);
  return clamp(x, r, Math.max(r, larguraMm - r));
}

/** Centro do furo em relação à borda esquerda/direita em cima/fundo: override em regras, senão metade da espessura do painel. */
function lateralInsetTopBottomMm(cfgSide: number | undefined, espessuraMm: number): number {
  const fromCfg = Number(cfgSide);
  if (Number.isFinite(fromCfg) && fromCfg > 0) return fromCfg;
  const e = Number(espessuraMm);
  const half = (Number.isFinite(e) && e > 0 ? e : 18) / 2;
  return Math.max(0.25, half);
}

/**
 * Modelo 2D dobradiça Sensys 8645i (lado da porta):
 * - Copo: Ø35 mm, profundidade 13 mm, distância da borda 3 mm (inset) → centro do copo ≈ 22.5 mm.
 * - Dois furos de fixação a 52 mm entre si.
 * Usado para gerar furos na porta (master); laterais copiam posições.
 */
export const SENSYS_8645I_DOOR = {
  canecoDiametroMm: 35,
  canecoProfundidadeMm: 13,
  /** Distância da borda da porta ao centro do copo (mm). Padrão industrial 22.5 (≈ 3 mm inset + semi-diâmetro). */
  canecoCentroBordaMm: 22.5,
  distânciaBordaMm: 3,
  fixacaoPortaDiametroMm: 10,
  fixacaoPortaProfundidadeMm: 12,
  fixacaoPortaCentroBordaMm: 28,
  fixacaoPortaEntreCentrosMm: 52,
} as const;

/**
 * Base C00 (lado da caixa): retângulo 3D simples, 2 furos a 32 mm entre si, 37 mm da borda, altura 5–8 mm.
 */
export const SENSYS_BASE_C00 = {
  distanciaDaBordaMm: 37,
  distanciaEntreFurosCalcoMm: 32,
  alturaPeçaMm: 6,
  lateralDiametroMm: 5,
  lateralProfundidadeMm: 12,
  uniaoLateralBordaMm: 53,
} as const;

/**
 * Terceiro furo da base da dobradiça (parafuso união): apenas marcation de posição para montagem.
 * Não estrutural; não deve atravessar a peça. Regra industrial obrigatória.
 */
export const DOBRADICA_TERCEIRO_FURO = {
  diametroMm: 5,
  profundidadeMm: 0.5,
} as const;

/** @deprecated Use SENSYS_8645I_DOOR e SENSYS_BASE_C00 */
const SENSYS_8645I_C00 = {
  ...SENSYS_8645I_DOOR,
  calcoLateralBordaMm: SENSYS_BASE_C00.distanciaDaBordaMm,
  uniaoLateralBordaMm: SENSYS_BASE_C00.uniaoLateralBordaMm,
  lateralDiametroMm: SENSYS_BASE_C00.lateralDiametroMm,
  lateralProfundidadeMm: SENSYS_BASE_C00.lateralProfundidadeMm,
} as const;

function pushHole(
  out: TechnicalDrillHole[],
  piece: PieceInput,
  x: number,
  y: number,
  diametro: number,
  profundidade: number,
  tipo: DrillType,
  face: DrillFace,
  _skipClamp?: boolean
) {
  const xSafe = clampLocalXMm(x, piece.largura, diametro);
  const ySafe = clampTopDownYMm(y, piece.altura, diametro);
  out.push({
    x: xSafe,
    y: ySafe,
    diametro: Math.max(0.5, diametro),
    profundidade: Math.max(0.5, profundidade),
    tipo,
    face,
  });
}

/**
 * Face geométrica (DrillFace) que é a face interna do painel (lado para dentro do móvel).
 * Única fonte para semântica A/B: essa face recebe PanelFace "B"; as demais "A".
 */
export function getInternalFace(pieceType: PieceType): DrillFace {
  if (pieceType === "cima") return "fundo";
  if (pieceType === "fundo") return "cima";
  if (pieceType === "lateral_esquerda") return "direita";
  if (pieceType === "lateral_direita") return "esquerda";
  if (pieceType.startsWith("porta")) return "tras";
  if (pieceType === "gaveta_lat_esq") return "direita";
  if (pieceType === "gaveta_lat_dir") return "esquerda";
  if (pieceType === "gaveta_frente_int" || pieceType === "gaveta_frente" || pieceType === "gaveta") return "tras";
  if (pieceType === "gaveta_frente_ext") return "frente";
  if (pieceType === "gaveta_fundo") return "cima";   // face interior = topo do painel (lado para dentro da gaveta)
  if (pieceType === "gaveta_traseira") return "frente"; // face interior = frente do painel (lado para dentro da gaveta)
  if (pieceType === "prateleira") return "fundo";   // FINAL: face interna = baixo (B), face externa = cima (A)
  return "frente";
}

/** Furos de cavilha (dowel). Cima/fundo: eixo a 60 mm dos bordos frente/fundo; centro a sideOffset (opcional nas regras) ou espessura/2. */
function calcCavilha(piece: PieceInput, rules: RulesConfig, out: TechnicalDrillHole[]) {
  if (!rules?.furos?.tecnicos?.cavilha) return;
  const cfg = rules.furos.tecnicos.cavilha;
  if (!cfg.enabled) return;
  const diametro = Number(cfg.diametro) > 0 ? Number(cfg.diametro) : 8;
  const profundidade = Number(cfg.profundidade) > 0 ? Number(cfg.profundidade) : Math.min(13, piece.espessura);
  const face = getInternalFace(piece.tipo);
  const insetLateral = lateralInsetTopBottomMm(cfg.sideOffset, piece.espessura);

  if ((piece.tipo === "cima" || piece.tipo === "fundo") && (cfg.aplicarEm.cima || cfg.aplicarEm.fundo)) {
    const xLeft = insetLateral;
    const xRight = piece.largura - insetLateral;
    const distFrente = Number(cfg.distanciaFrente) > 0 ? Number(cfg.distanciaFrente) : 60;
    const distFundo = Number(cfg.distanciaFundo) > 0 ? Number(cfg.distanciaFundo) : 60;
    const yFront = distFrente;
    const yBack = piece.altura - distFundo;
    pushHole(out, piece, xLeft, yFront, diametro, profundidade, "cavilha", face);
    pushHole(out, piece, xLeft, yBack, diametro, profundidade, "cavilha", face);
    pushHole(out, piece, xRight, yFront, diametro, profundidade, "cavilha", face);
    pushHole(out, piece, xRight, yBack, diametro, profundidade, "cavilha", face);
  }
  /* Laterais: apenas furos de prateleira e fixação de dobradiça (calcPrateleira32mm e calcDobradicaFixacao). Sem cavilha nas laterais. */
}

/** Furos de parafuso (confirmat). União topo/base: mesma linha lateral que cavilha (offset = regra ou espessura/2), eixo conforme distâncias frente/fundo. */
function calcParafuso(piece: PieceInput, rules: RulesConfig, out: TechnicalDrillHole[]) {
  if (!rules?.furos?.tecnicos?.parafuso) return;
  const cfg = rules.furos.tecnicos.parafuso;
  if (!cfg.enabled) return;
  if (piece.tipo !== "cima" && piece.tipo !== "fundo") return;
  if ((piece.tipo === "cima" && !cfg.aplicarEm.cima) || (piece.tipo === "fundo" && !cfg.aplicarEm.fundo)) return;
  const face = getInternalFace(piece.tipo);
  const diametro = Number(cfg.diametro) > 0 ? Number(cfg.diametro) : 4;
  const cfgDepth = Number(cfg.profundidade) > 0 ? Number(cfg.profundidade) : piece.espessura;
  const depth = cfg.profundidadeIgualEspessura ? piece.espessura : Math.min(piece.espessura, cfgDepth);
  const sideOffset = lateralInsetTopBottomMm(cfg.sideOffset, piece.espessura);
  const xLeft = sideOffset;
  const xRight = piece.largura - sideOffset;
  if (process.env.NODE_ENV === "development" && cfg.distanciaFrente == null) {
    console.warn("[drilling] parafuso distanciaFrente is undefined, using fallback");
  }
  const yFront = cfg.distanciaFrente ?? 90;
  const yBack = piece.altura - (cfg.distanciaFundo ?? 90);
  pushHole(out, piece, xLeft, yFront, diametro, depth, "parafuso", face);
  pushHole(out, piece, xLeft, yBack, diametro, depth, "parafuso", face);
  pushHole(out, piece, xRight, yFront, diametro, depth, "parafuso", face);
  pushHole(out, piece, xRight, yBack, diametro, depth, "parafuso", face);
}

/**
 * Furação da dobradiça na porta (todas as medidas ao CENTRO do furo):
 * - Caneco: Ø35 mm, 13 mm prof., centro a 22.5 mm da borda da porta.
 * - Dois furos de fixação: centro a 28 mm da borda, 52 mm entre centros, Ø10 mm, 12 mm prof.
 * - left/right: borda vertical (eixo X fixo, posições ao longo de Y).
 * - top/bottom: borda horizontal (Sensys 8645i rotacionado 90°: eixo Y fixo, posições ao longo de X).
 */
function calcDobradica(piece: PieceInput, rules: RulesConfig, out: TechnicalDrillHole[]) {
  if (!rules?.furos?.tecnicos?.dobradica) return;
  const cfg = rules.furos.tecnicos.dobradica;
  if (!cfg.enabled) return;
  if (!piece.tipo.startsWith("porta")) return;
  const face: DrillFace = "tras";
  // Centro do caneco: referência geométrica principal (22.5 mm). Ignora legado ambíguo em distanciaBordaLateral.
  const distCentroCaneco =
    Number(cfg.distanciaCentroDaBorda) > 0
      ? Number(cfg.distanciaCentroDaBorda)
      : SENSYS_8645I_C00.canecoCentroBordaMm;
  // Regras da Porta: número de dobradiças por altura/largura (mm). Fallback: config técnica.
  const numHinges =
    piece.hingeSide === "top" || piece.hingeSide === "bottom"
      ? getNumDobradicas(piece.largura, rules)
      : getNumDobradicas(piece.altura, rules);
  const numHingesClamped = Math.max(2, numHinges);
  const diametroCaneco = Number(cfg.diametro) > 0 ? Number(cfg.diametro) : SENSYS_8645I_C00.canecoDiametroMm;
  const profundidadeCaneco = Math.min(
    piece.espessura,
    Number(cfg.profundidade) > 0 ? Number(cfg.profundidade) : SENSYS_8645I_C00.canecoProfundidadeMm
  );
  const distCentroFixacao = Number(cfg.distanciaFurosFixacaoBorda) > 0
    ? Number(cfg.distanciaFurosFixacaoBorda)
    : SENSYS_8645I_C00.fixacaoPortaCentroBordaMm;
  const distEntreCentrosFixacao = Number(cfg.distanciaEntreFurosFixacao) > 0
    ? Number(cfg.distanciaEntreFurosFixacao)
    : SENSYS_8645I_C00.fixacaoPortaEntreCentrosMm;
  const halfFix = distEntreCentrosFixacao / 2;
  const diametroFixacao = Number(cfg.diametroFurosFixacao) > 0
    ? Number(cfg.diametroFurosFixacao)
    : SENSYS_8645I_C00.fixacaoPortaDiametroMm;
  const profundidadeFixacao = Math.min(
    piece.espessura,
    Number(cfg.profundidadeFurosFixacao) > 0 ? Number(cfg.profundidadeFurosFixacao) : SENSYS_8645I_C00.fixacaoPortaProfundidadeMm
  );

  /* Porta superior ou inferior: dobradiça na borda top/bottom (eixo Y fixo, posições ao longo da largura = X).
   * Convenção: Y=0 no topo da peça, Y cresce para baixo. Borda superior = Y pequeno, borda inferior = Y grande. */
  if (piece.hingeSide === "top" || piece.hingeSide === "bottom") {
    const offsetsX = getHingeYPositions(piece.largura, numHingesClamped, rules);
    if (offsetsX.length === 0) return;
    /* top = borda SUPERIOR = menor Y → y = dist. bottom = borda INFERIOR = maior Y → y = altura - dist. */
    const yCaneco = piece.hingeSide === "top" ? distCentroCaneco : piece.altura - distCentroCaneco;
    const yFixacao = piece.hingeSide === "top" ? distCentroFixacao : piece.altura - distCentroFixacao;
    for (const ox of offsetsX) {
      pushHole(out, piece, ox, yCaneco, diametroCaneco, profundidadeCaneco, "dobradica", face, true);
      pushHole(out, piece, ox - halfFix, yFixacao, diametroFixacao, profundidadeFixacao, "dobradica_fixacao", face, true);
      pushHole(out, piece, ox + halfFix, yFixacao, diametroFixacao, profundidadeFixacao, "dobradica_fixacao", face, true);
    }
    return;
  }

  /* Laterais (left/right): offsets verticais = mm a partir da base (getHingeYPositions); Y do painel = topo→baixo. */
  const hingeSide = piece.hingeSide === "left" || piece.hingeSide === "right" ? piece.hingeSide : "left";
  const offsetsFromBase = sanitizeHingeOffsetsFromPieceHeight(
    piece.hingePositionsMm && piece.hingePositionsMm.length > 0
      ? piece.hingePositionsMm
      : getHingeYPositions(piece.altura, numHingesClamped, rules),
    piece.altura
  );
  if (offsetsFromBase.length === 0) return;
  const xCaneco = hingeSide === "left" ? piece.largura - distCentroCaneco : piece.largura - distCentroCaneco;
  const xFixacao = hingeSide === "left" ? piece.largura - distCentroFixacao : piece.largura - distCentroFixacao;

  for (const oy of offsetsFromBase) {
    const yTopDown = clampTopDownYMm(piece.altura - oy, piece.altura, diametroCaneco);
    pushHole(out, piece, xCaneco, yTopDown, diametroCaneco, profundidadeCaneco, "dobradica", face, true);
    pushHole(out, piece, xFixacao, clampTopDownYMm(yTopDown - halfFix, piece.altura, diametroFixacao), diametroFixacao, profundidadeFixacao, "dobradica_fixacao", face, true);
    pushHole(out, piece, xFixacao, clampTopDownYMm(yTopDown + halfFix, piece.altura, diametroFixacao), diametroFixacao, profundidadeFixacao, "dobradica_fixacao", face, true);
  }
  if (shouldTraceHingePiece(piece.largura, piece.altura)) {
    const hingeHoles = out.filter((h) => h.tipo === "dobradica" || h.tipo === "dobradica_fixacao");
    traceHingeDrilling({
      stage: "calcDobradica",
      tipo: piece.tipo,
      larguraMm: piece.largura,
      alturaMm: piece.altura,
      hingeSide: piece.hingeSide,
      offsetsIn: piece.hingePositionsMm ? [...piece.hingePositionsMm] : undefined,
      offsetsAfterSanitize: [...offsetsFromBase],
      oySamples: offsetsFromBase.map((oy) => ({
        oy,
        yTopDown: clampTopDownYMm(piece.altura - oy, piece.altura, diametroCaneco),
      })),
      holesOut: hingeHoles.map((h) => ({ x: h.x, y: h.y, tipo: h.tipo })),
    });
  }
}

/** Furos de corredica de gaveta: laterais, frente e traseira da gaveta europeia. */
function calcCorredica(piece: PieceInput, rules: RulesConfig, out: TechnicalDrillHole[]) {
  if (!rules?.furos?.tecnicos?.corredica) return;

  const gavetas = getSettings().gavetas;
  const slideRules = getDrawerSlideDrillingRules(piece.slideType, piece.metalBoxType, {
    softClose: piece.softClose === true,
    mode: "drawer_piece",
    corredicaConfig: rules.furos.tecnicos.corredica,
    gavetasSettings: gavetas,
  });
  if (!slideRules.enabled) return;

  const specs = computeDrawerPieceCorredicaHoles({
    pieceType: piece.tipo,
    largura: piece.largura,
    altura: piece.altura,
    rules: slideRules,
  });

  for (const spec of specs) {
    pushHole(
      out,
      piece,
      spec.x,
      spec.y,
      spec.diametro,
      spec.profundidade,
      "corredica",
      spec.face
    );
  }
}

function calcHandle(piece: PieceInput, out: TechnicalDrillHole[]) {
  if (
    piece.tipo !== "gaveta_frente_ext" &&
    piece.tipo !== "gaveta_frente" &&
    piece.tipo !== "gaveta"
  ) {
    return;
  }
  const handleHoles = computeDrawerHandleHoles(piece);
  out.push(...handleHoles);
}

/**
 * Sistema 32 variável para furos de prateleira nas laterais.
 * Exatamente 2 linhas: frente (margemFrente) e fundo (margemFundo). Lateral esquerda com X espelhado.
 */
function calcPrateleira32mm(piece: PieceInput, rules: RulesConfig, out: TechnicalDrillHole[]) {
  if (!rules?.furos?.tecnicos?.prateleira) return;
  const cfg = rules.furos.tecnicos.prateleira;
  if (!cfg.enabled) return;
  if (piece.shelfHolesEnabled === false) return;
  if (piece.tipo !== "lateral_esquerda" && piece.tipo !== "lateral_direita") return;
  const face = piece.tipo === "lateral_esquerda" ? "direita" : "esquerda";

  const diametro = cfg.diametro ?? 5;
  const profundidade = cfg.profundidade ?? 13;
  const margemFrente = cfg.margemFrente ?? cfg.distanciaDaBorda ?? 60;
  const margemFundo = cfg.margemFundo ?? cfg.distanciaDaBorda ?? 60;

  const margemTopo = cfg.margemTopo ?? 200;
  const margemBase = cfg.margemBase ?? 200;
  const minFuros = cfg.minFurosPorColuna ?? 6;
  const maxFuros = cfg.maxFurosPorColuna ?? 40;

  const zonaUtil = Math.max(0, piece.altura - margemTopo - margemBase);
  if (zonaUtil <= 0) return;

  const numFurosBruto = Math.ceil(zonaUtil / 32);
  let numFuros = clamp(numFurosBruto, minFuros, maxFuros);
  const espacamento = numFuros > 1 ? zonaUtil / (numFuros - 1) : 0;
  const espacamentoClamped = clamp(espacamento, 30, 50);
  if (numFuros > 1 && espacamentoClamped !== espacamento) {
    numFuros = Math.floor(zonaUtil / espacamentoClamped) + 1;
    numFuros = clamp(numFuros, minFuros, maxFuros);
  }

  const isEsquerda = piece.tipo === "lateral_esquerda";
  const xFrente = isEsquerda ? piece.largura - margemFrente : margemFrente;
  const xFundo = isEsquerda ? margemFundo : piece.largura - margemFundo;

  const step = numFuros > 1 ? zonaUtil / (numFuros - 1) : zonaUtil;
  for (let i = 0; i < numFuros; i++) {
    const y = margemTopo + (numFuros > 1 ? i * step : zonaUtil / 2);
    pushHole(out, piece, xFrente, y, diametro, profundidade, "prateleira", face);
    pushHole(out, piece, xFundo, y, diametro, profundidade, "prateleira", face);
  }
}

/** Furos de fixação da dobradiça na lateral: 3 por dobradiça (2 principais calço + 1 parafuso união). Padrão ferragem: 37 mm da borda lateral (calço), 53 mm da borda frontal (parafuso união), 16 mm entre eles. */
const DEFAULTS_DOBRADICA_FIXACAO = {
  distanciaDaBordaCalco: SENSYS_8645I_C00.calcoLateralBordaMm,
  distanciaDaBordaParafusoUniao: SENSYS_8645I_C00.uniaoLateralBordaMm,
} as const;

function calcDobradicaFixacao(piece: PieceInput, rules: RulesConfig, out: TechnicalDrillHole[]) {
  const cfg = rules?.furos?.tecnicos?.dobradica_fixacao;
  if (!cfg?.enabled) return;

  /* Painel superior (hingeSide top): furos no cima, posições X = hingePositionsMm (cópia da porta), Y = dist da borda da dobradiça (frente). */
  if (piece.tipo === "cima" && (piece.hingeSide === "top") && (piece.hingePositionsMm?.length ?? 0) > 0) {
    const face: DrillFace = "fundo";
    let yCalco = Number(cfg.distanciaDaBordaCalco);
    if (!Number.isFinite(yCalco) || yCalco <= 0) yCalco = DEFAULTS_DOBRADICA_FIXACAO.distanciaDaBordaCalco;
    let yUniao = Number(cfg.distanciaDaBordaParafusoUniao);
    if (!Number.isFinite(yUniao) || yUniao <= 0) yUniao = DEFAULTS_DOBRADICA_FIXACAO.distanciaDaBordaParafusoUniao;
    /* Borda da dobradiça no painel cima = frente (Y pequeno). Furos a dist e distUniao dessa borda. */
    const distEntre = cfg.distanciaEntreFurosCalco ?? cfg.distanciaEntreFuros ?? 32;
    const halfDist = distEntre / 2;
    const diametroCalco = cfg.diametro ?? SENSYS_8645I_C00.lateralDiametroMm;
    const profundidadeCalco = cfg.profundidadeFuro ?? SENSYS_8645I_C00.lateralProfundidadeMm;
    for (const hingeX of piece.hingePositionsMm!) {
      pushHole(out, piece, hingeX - halfDist, yCalco, diametroCalco, profundidadeCalco, "dobradica_fixacao", face, true);
      pushHole(out, piece, hingeX + halfDist, yCalco, diametroCalco, profundidadeCalco, "dobradica_fixacao", face, true);
      pushHole(out, piece, hingeX, yUniao, DOBRADICA_TERCEIRO_FURO.diametroMm, DOBRADICA_TERCEIRO_FURO.profundidadeMm, "dobradica_parafuso_uniao", face, true);
    }
    return;
  }

  /* Painel inferior (hingeSide bottom): furos de fixação da base da dobradiça no fundo. X = cópia da porta (porta = master), Y = dist da borda da dobradiça (frente). */
  if (piece.tipo === "fundo" && piece.hingeSide === "bottom") {
    const numHinges = Math.max(2, getNumDobradicas(piece.largura, rules));
    const positionsX = (piece.hingePositionsMm?.length ?? 0) > 0
      ? piece.hingePositionsMm!
      : getHingeYPositions(piece.largura, numHinges, rules);
    if (positionsX.length === 0) return;

    const face: DrillFace = "cima";
    let yCalco = Number(cfg.distanciaDaBordaCalco);
    if (!Number.isFinite(yCalco) || yCalco <= 0) yCalco = DEFAULTS_DOBRADICA_FIXACAO.distanciaDaBordaCalco;
    let yUniao = Number(cfg.distanciaDaBordaParafusoUniao);
    if (!Number.isFinite(yUniao) || yUniao <= 0) yUniao = DEFAULTS_DOBRADICA_FIXACAO.distanciaDaBordaParafusoUniao;
    /* Borda da dobradiça no painel fundo = frente (Y pequeno). Mesma convenção que cima. */
    const distEntre = cfg.distanciaEntreFurosCalco ?? cfg.distanciaEntreFuros ?? 32;
    const halfDist = distEntre / 2;
    const diametroCalco = cfg.diametro ?? SENSYS_8645I_C00.lateralDiametroMm;
    const profundidadeCalco = cfg.profundidadeFuro ?? SENSYS_8645I_C00.lateralProfundidadeMm;
    for (const hingeX of positionsX) {
      pushHole(out, piece, hingeX - halfDist, yCalco, diametroCalco, profundidadeCalco, "dobradica_fixacao", face, true);
      pushHole(out, piece, hingeX + halfDist, yCalco, diametroCalco, profundidadeCalco, "dobradica_fixacao", face, true);
      pushHole(out, piece, hingeX, yUniao, DOBRADICA_TERCEIRO_FURO.diametroMm, DOBRADICA_TERCEIRO_FURO.profundidadeMm, "dobradica_parafuso_uniao", face, true);
    }
    return;
  }

  /* Laterais (left/right): comportamento existente inalterado. */
  if (piece.tipo !== "lateral_esquerda" && piece.tipo !== "lateral_direita") return;

  const face = piece.tipo === "lateral_esquerda" ? "direita" : "esquerda";
  let xCalco = Number(cfg.distanciaDaBordaCalco);
  if (!Number.isFinite(xCalco) || xCalco <= 0) xCalco = DEFAULTS_DOBRADICA_FIXACAO.distanciaDaBordaCalco;
  let xUniao = Number(cfg.distanciaDaBordaParafusoUniao);
  if (!Number.isFinite(xUniao) || xUniao <= 0) xUniao = DEFAULTS_DOBRADICA_FIXACAO.distanciaDaBordaParafusoUniao;
  if (piece.tipo === "lateral_esquerda" || piece.tipo === "lateral_direita") {
    xCalco = piece.largura - xCalco;
    xUniao = piece.largura - xUniao;
  }
  const distEntre = cfg.distanciaEntreFurosCalco ?? cfg.distanciaEntreFuros ?? 32;
  const halfDist = distEntre / 2;
  const diametroCalco = cfg.diametro ?? SENSYS_8645I_C00.lateralDiametroMm;
  const profundidadeCalco = cfg.profundidadeFuro ?? SENSYS_8645I_C00.lateralProfundidadeMm;

  const hingesFromBase = sanitizeHingeOffsetsFromPieceHeight(piece.hingePositionsMm, piece.altura);
  for (const oy of hingesFromBase) {
    const yTopDown = clampTopDownYMm(piece.altura - oy, piece.altura, diametroCalco);
    pushHole(out, piece, xCalco, clampTopDownYMm(yTopDown - halfDist, piece.altura, diametroCalco), diametroCalco, profundidadeCalco, "dobradica_fixacao", face, true);
    pushHole(out, piece, xCalco, clampTopDownYMm(yTopDown + halfDist, piece.altura, diametroCalco), diametroCalco, profundidadeCalco, "dobradica_fixacao", face, true);
    pushHole(out, piece, xUniao, yTopDown, DOBRADICA_TERCEIRO_FURO.diametroMm, DOBRADICA_TERCEIRO_FURO.profundidadeMm, "dobradica_parafuso_uniao", face, true);
  }
  if (
    shouldTraceHingePiece(piece.largura, piece.altura) &&
    (piece.tipo === "lateral_esquerda" || piece.tipo === "lateral_direita")
  ) {
    const hingeHoles = out.filter(
      (h) =>
        h.tipo === "dobradica_fixacao" ||
        h.tipo === "dobradica_parafuso_uniao" ||
        h.tipo === "dobradica"
    );
    traceHingeDrilling({
      stage: "calcDobradicaFixacao",
      tipo: piece.tipo,
      larguraMm: piece.largura,
      alturaMm: piece.altura,
      hingeSide: piece.hingeSide,
      offsetsIn: piece.hingePositionsMm ? [...piece.hingePositionsMm] : undefined,
      offsetsAfterSanitize: [...hingesFromBase],
      oySamples: hingesFromBase.map((oy) => ({
        oy,
        yTopDown: clampTopDownYMm(piece.altura - oy, piece.altura, diametroCalco),
      })),
      holesOut: hingeHoles.map((h) => ({ x: h.x, y: h.y, tipo: h.tipo })),
      note: `xCalco=${xCalco} xUniao=${xUniao}`,
    });
  }
}

/** Furação estrutural de montagem das peças de gaveta (cavilha, fixação lateral, rasgos de fundo). */
function calcDrawerStructural(piece: PieceInput, out: TechnicalDrillHole[]) {
  const drawerPieceTypes = [
    "gaveta_lat_esq", "gaveta_lat_dir",
    "gaveta_traseira", "gaveta_frente", "gaveta_frente_int",
  ];
  if (!drawerPieceTypes.includes(piece.tipo)) return;
  if (piece.tipo === "gaveta_lat_esq" || piece.tipo === "gaveta_lat_dir") {
    const holes = computeDrawerLateralStructuralHoles({
      largura: piece.largura,
      altura: piece.altura,
      espessura: piece.espessura,
      side: piece.tipo === "gaveta_lat_esq" ? "esq" : "dir",
    });
    out.push(...holes);
  } else if (piece.tipo === "gaveta_traseira") {
    const holes = computeDrawerCostaStructuralHoles({
      largura: piece.largura,
      altura: piece.altura,
      espessura: piece.espessura,
    });
    out.push(...holes);
  } else if (piece.tipo === "gaveta_frente_int" || piece.tipo === "gaveta_frente") {
    if (isMetalBoxCatalogType(piece.metalBoxType)) {
      const holes = computeDrawerMetalBoxFrontHoles({
        tipo: piece.tipo,
        largura: piece.largura,
        altura: piece.altura,
        espessura: piece.espessura,
        metalBoxType: piece.metalBoxType,
        metalBoxProfileId: piece.metalBoxProfileId,
        metalBoxHeightMm: piece.metalBoxHeightMm,
      });
      out.push(...holes);
    } else {
      const holes = computeDrawerFrenteIntStructuralHoles({
        largura: piece.largura,
        altura: piece.altura,
        espessura: piece.espessura,
        isLowestDrawer: piece.isLowestDrawer === true,
      });
      out.push(...holes);
    }
  }
}

export function calculateTechnicalDrillingsForPiece(
  piece: PieceInput,
  rules: RulesConfig
): TechnicalDrillHole[] {
  const out: TechnicalDrillHole[] = [];
  if (!piece || !piece.tipo || !Number.isFinite(piece.largura) || !Number.isFinite(piece.altura)) return out;
  if (!rules || !rules.furos) return out;
  try {
    calcCavilha(piece, rules, out);
    calcParafuso(piece, rules, out);
    calcDobradica(piece, rules, out);
    calcCorredica(piece, rules, out);
    calcHandle(piece, out);
    calcPrateleira32mm(piece, rules, out);
    calcDobradicaFixacao(piece, rules, out);
    calcDrawerStructural(piece, out);
  } catch (err) {
    console.warn(`[drillingService] Error calculating drills for ${piece.tipo}:`, err);
  }
  const hingeTypes = new Set<DrillType>(["dobradica", "dobradica_fixacao", "dobradica_parafuso_uniao"]);
  const isDoorPiece = piece.tipo.startsWith("porta");
  return out.filter((h) => {
    if (isDoorPiece) {
      return (
        h.x >= -0.2 &&
        h.y >= -0.2 &&
        h.x <= piece.largura + 0.2 &&
        h.y <= piece.altura + 0.2
      );
    }
    if (!hingeTypes.has(h.tipo)) return true;
    return (
      h.x >= -0.2 &&
      h.y >= -0.2 &&
      h.x <= piece.largura + 0.2 &&
      h.y <= piece.altura + 0.2
    );
  });
}

/**
 * Converte DrillFace (geometria) em PanelFace (A/B). Regra FINAL: face interna do painel = B.
 * Única fonte desta conversão no projeto; drillingAdapter reutiliza esta função.
 */
export function drillFaceToPanelFace(face: DrillFace, pieceType: PieceType): PanelFace {
  return face === getInternalFace(pieceType) ? "B" : "A";
}

export function isTopDrillable(face: DrillFace): boolean {
  return face === "cima" || face === "fundo";
}
