/** Borda de referência para posição do divisório vertical (mm a partir da lateral). */
export type DivisorReferenceEdge = "left" | "right";

/** Borda de referência para posição do separador horizontal (mm a partir do topo ou fundo). */
export type SeparadorReferenceEdge = "top" | "bottom";

/** Lado do compartimento onde as prateleiras são colocadas em relação ao DIV. */
export type DivisorPrateleiraLado = "esquerda" | "direita";

/** Direção das prateleiras no contexto DIV/SEP (grelha + compartimento). */
export type PrateleiraDirecao = "direita" | "esquerda" | "superior" | "inferior";

/** Passo da grelha de furos de prateleira (mm). */
export type PrateleiraGridStepMm = 32 | 64;

/** Modo de exibição da grelha de furação. */
export type PrateleiraGridMode = "continua" | "segmentada";

/**
 * Opções avançadas de prateleiras (nível caixa).
 * Omitidas ⇒ comportamento legado (direita, 32 mm, grelha contínua, margem 0).
 */
export type BoxShelfOptions = {
  direcao?: PrateleiraDirecao;
  distanciaEntreFurosMm?: PrateleiraGridStepMm;
  gridMode?: PrateleiraGridMode;
  /** Margem igual topo/base (mm). 0 = grelha padrão das regras; >0 = zona centrada. */
  margemSuperiorInferiorMm?: number;
};

/** Posição do DIV relativamente ao SEP ligado (rosto a rosto). */
export type DivisorPosicaoRelativaAoSep = "baixo" | "cima";

/** Âncora horizontal do SEP na largura interna da caixa. */
export type SeparadorAncoraHorizontal = "completo" | "esquerda" | "direita";

/** Divisório vertical (DIV) — peça interna da caixa. */
export interface DivisorItem {
  id: string;
  /** Posição em mm a partir da lateral de referência (centro da peça). */
  positionMm: number;
  referenceEdge: DivisorReferenceEdge;
  /** Altura (mm). Omitido = altura interna útil ou altura acoplada ao SEP. */
  alturaMm?: number;
  /** Profundidade (mm). Omitido = profundidade interna − folga frontal. */
  profundidadeMm?: number;
  /** ID do separador ao qual este DIV termina (ligação explícita SEP+DIV). */
  linkedSeparadorId?: string;
  /**
   * Posição relativamente ao SEP ligado.
   * Omitido + ligado ⇒ "baixo" (compatível com projectos antigos).
   * Irrelevante quando não há `linkedSeparadorId`.
   */
  posicaoRelativaAoSep?: DivisorPosicaoRelativaAoSep;
  /** Lado do compartimento com furos de prateleira quando há prateleiras no módulo. */
  prateleiraLado?: DivisorPrateleiraLado;
  /**
   * Centros Y absolutos (mm) das prateleiras escolhidos na grelha industrial.
   * Omitido = distribuição automática das N prateleiras na zona do DIV.
   */
  prateleiraYsMm?: number[];
}

/** Separador horizontal (SEP) — peça interna da caixa. */
export interface SeparadorItem {
  id: string;
  /** Posição em mm a partir do topo ou fundo (centro da peça). */
  positionMm: number;
  referenceEdge: SeparadorReferenceEdge;
  /** Largura (mm). Omitido = largura interna − folgas. */
  larguraMm?: number;
  /** Profundidade (mm). Omitido = profundidade interna − folga frontal. */
  profundidadeMm?: number;
  /**
   * Âncora horizontal: completo (centrado) | esquerda | direita.
   * Omitido ⇒ "completo" (compatível com projectos antigos).
   */
  ancoraHorizontal?: SeparadorAncoraHorizontal;
}

export type DivSepBoxLike = {
  dimensoes: { largura: number; altura: number; profundidade?: number };
  espessura: number;
  profundidadeExterna?: number;
  portaTipo?: string;
  doorsLayer?: unknown[];
  drawersLayer?: readonly { frontThickness?: number }[];
  gavetas?: number;
  costaAtiva?: boolean;
  prateleiras?: number;
  divisores?: DivisorItem[];
  separadores?: SeparadorItem[];
  /** Opções avançadas de prateleiras (grelha / direcção). */
  shelfOptions?: BoxShelfOptions;
};

/**
 * Posição efectiva do DIV face ao SEP.
 * Omitido ⇒ "baixo" (compatível com projectos antigos / ligação efectiva).
 */
export function resolvePosicaoRelativaAoSep(
  div: Pick<DivisorItem, "posicaoRelativaAoSep">
): DivisorPosicaoRelativaAoSep {
  return div.posicaoRelativaAoSep === "cima" ? "cima" : "baixo";
}

/**
 * Âncora horizontal efectiva do SEP.
 * Projectos antigos sem o campo ⇒ "completo".
 */
export function resolveAncoraHorizontal(
  sep: Pick<SeparadorItem, "ancoraHorizontal">
): SeparadorAncoraHorizontal {
  if (sep.ancoraHorizontal === "esquerda" || sep.ancoraHorizontal === "direita") {
    return sep.ancoraHorizontal;
  }
  return "completo";
}
