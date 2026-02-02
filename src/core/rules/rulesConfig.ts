/**
 * Configuração central de todas as regras dinâmicas do projeto.
 * Controla: portas, prateleiras, pés, divisores, furos, madeira/estrutura.
 * Editável via Admin; afeta todo o projeto automaticamente.
 */

export type PortaRange = {
  /** Altura mínima da porta (cm). */
  min: number;
  /** Altura máxima da porta (cm). */
  max: number;
  /** Número de dobradiças para este range. */
  dobradicas: number;
};

export type PeRange = {
  /** Largura mínima da caixa (cm). */
  min: number;
  /** Largura máxima da caixa (cm). */
  max: number;
  /** Número de pés para este range. */
  pes: number;
};

export type RulesConfig = {
  portas: {
    /** Ranges de altura → número de dobradiças. */
    ranges: PortaRange[];
  };
  prateleiras: {
    /** Suportes por prateleira (4 = 1 em cada canto). */
    suportesPorPrateleira: number;
  };
  pes: {
    /** Ranges de largura → número de pés. */
    ranges: PeRange[];
  };
  altura: {
    /** Altura mínima para permitir divisor transversal (cm). */
    divisorTransversalMin: number;
  };
  largura: {
    /** Largura mínima para permitir divisor longitudinal (cm). */
    divisorLongitudinalMin: number;
  };
  furos: {
    /** Margem do topo para primeira fila de furos (mm). */
    margemTopo: number;
    /** Margem da base para última fila de furos (mm). */
    margemBase: number;
    /** Recuo da borda lateral (mm). */
    recuoBorda: number;
    /** Distância vertical entre furos (mm). */
    distanciaEntreFuros: number;
    /** Profundidade dos furos (mm). */
    profundidadeFuro: number;
    /** Diâmetro dos furos (mm). */
    diametroFuro: number;
  };
  madeira: {
    /** Espessura fixa da COSTA (mm). */
    espessuraCosta: number;
    /** Se true, altura lateral = altura_total - (espessura_cima + espessura_fundo). */
    calcularAlturaLaterais: boolean;
    /** Se true, profundidade das peças não muda com dimensões (futuro uso). */
    profundidadeFixa: boolean;
  };
};

/** Regras padrão do projeto (defaults; carregadas ao iniciar ou ao resetar). */
export const defaultRulesConfig: RulesConfig = {
  portas: {
    ranges: [
      { min: 10, max: 50, dobradicas: 2 },
      { min: 51, max: 100, dobradicas: 3 },
      { min: 101, max: 150, dobradicas: 3 },
      { min: 151, max: 200, dobradicas: 4 },
    ],
  },
  prateleiras: {
    suportesPorPrateleira: 4,
  },
  pes: {
    ranges: [
      { min: 10, max: 90, pes: 4 },
      { min: 91, max: 150, pes: 6 },
      { min: 151, max: 200, pes: 8 },
    ],
  },
  altura: {
    divisorTransversalMin: 150,
  },
  largura: {
    divisorLongitudinalMin: 150,
  },
  furos: {
    margemTopo: 200,
    margemBase: 200,
    recuoBorda: 50,
    distanciaEntreFuros: 50,
    profundidadeFuro: 10,
    diametroFuro: 5,
  },
  madeira: {
    espessuraCosta: 10,
    calcularAlturaLaterais: true,
    profundidadeFixa: true,
  },
};

/**
 * Calcula o número de dobradiças para uma porta com base na altura (cm).
 */
export function getNumDobradicas(alturaCm: number, rules: RulesConfig): number {
  const range = rules.portas.ranges.find((r) => alturaCm >= r.min && alturaCm <= r.max);
  return range?.dobradicas ?? 2;
}

/**
 * Calcula o número de pés para uma caixa com base na largura (cm).
 */
export function getNumPes(larguraCm: number, rules: RulesConfig): number {
  const range = rules.pes.ranges.find((r) => larguraCm >= r.min && larguraCm <= r.max);
  return range?.pes ?? 4;
}

/**
 * Verifica se a altura permite divisor transversal (cm).
 */
export function permiteDivisorTransversal(alturaCm: number, rules: RulesConfig): boolean {
  return alturaCm >= rules.altura.divisorTransversalMin;
}

/**
 * Verifica se a largura permite divisor longitudinal (cm).
 */
export function permiteDivisorLongitudinal(larguraCm: number, rules: RulesConfig): boolean {
  return larguraCm >= rules.largura.divisorLongitudinalMin;
}

/**
 * Gera lista de posições Y (mm) para furos verticais nas laterais.
 */
export function calcularPosicoesFurosVerticais(
  alturaTotalMm: number,
  rules: RulesConfig
): number[] {
  const { margemTopo, margemBase, distanciaEntreFuros } = rules.furos;
  const posicoes: number[] = [];
  let y = margemTopo;
  while (y <= alturaTotalMm - margemBase) {
    posicoes.push(y);
    y += distanciaEntreFuros;
  }
  return posicoes;
}
