/**
 * Reacção automática DIV↔SEP na criação/actualização (Fase D).
 * Extensão do pipeline existente — sem caminho paralelo.
 */
import {
  getDivSepInternalDims,
  resolveDivisorCenterX,
  resolveSeparadorDimensions,
} from "./dimensions";
import type {
  DivisorItem,
  DivSepBoxLike,
  SeparadorAncoraHorizontal,
  SeparadorItem,
} from "./types";

function defaultSeparadorPositionMm(box: DivSepBoxLike): number {
  const internal = getDivSepInternalDims(box);
  return Math.round(internal.alturaInterna / 2);
}

function defaultDivisorPositionMm(box: DivSepBoxLike): number {
  const internal = getDivSepInternalDims(box);
  return Math.round(internal.larguraInterna / 2);
}

/** SEP preferido para ligação automática (último criado). */
export function pickPreferredSeparador(box: DivSepBoxLike): SeparadorItem | undefined {
  const seps = box.separadores ?? [];
  if (seps.length === 0) return undefined;
  return seps[seps.length - 1];
}

/**
 * Escolhe âncora horizontal do SEP com base nos DIV existentes.
 * Preferência: lado com maior vão livre (LAT ↔ face do DIV).
 * Sem DIV → completo.
 */
export function chooseSeparadorAncoraFromDivs(box: DivSepBoxLike): SeparadorAncoraHorizontal {
  const divisores = box.divisores ?? [];
  if (divisores.length === 0) return "completo";

  const internal = getDivSepInternalDims(box);
  const half = internal.espessura / 2;
  // Usar o DIV mais recente como referência do vão.
  const div = divisores[divisores.length - 1]!;
  const cx = resolveDivisorCenterX(box, div);
  const leftBay = cx - half - internal.espessura;
  const rightBay = internal.espessura + internal.larguraInterna - (cx + half);
  return rightBay >= leftBay ? "direita" : "esquerda";
}

/** Novo DIV: se existir SEP → liga automaticamente (posição baixo). */
export function buildAutoDivisorItem(box: DivSepBoxLike, id: string): DivisorItem {
  const item: DivisorItem = {
    id,
    positionMm: defaultDivisorPositionMm(box),
    referenceEdge: "left",
  };
  const sep = pickPreferredSeparador(box);
  if (sep) {
    item.linkedSeparadorId = sep.id;
    item.posicaoRelativaAoSep = "baixo";
  }
  return item;
}

/**
 * Novo SEP: se existir DIV → âncora esq/dir (largura resolvida dinamicamente).
 * Sem DIV → completo.
 */
export function buildAutoSeparadorItem(box: DivSepBoxLike, id: string): SeparadorItem {
  const ancora = chooseSeparadorAncoraFromDivs(box);
  return {
    id,
    positionMm: defaultSeparadorPositionMm(box),
    referenceEdge: "bottom",
    ancoraHorizontal: ancora,
    // larguraMm omitida: resolveSeparadorDimensions calcula a partir da âncora + DIV.
  };
}

/**
 * Ao criar SEP: ligar DIV sem ligação explícita (altura livre / sem alturaMm).
 * DIV com alturaMm manual permanece completo (não forçar).
 */
export function autoLinkDivisorsToSeparador(
  divisores: DivisorItem[],
  sepId: string
): DivisorItem[] {
  return divisores.map((div) => {
    if (div.linkedSeparadorId) return div;
    if (div.alturaMm != null && Number.isFinite(div.alturaMm)) return div;
    return {
      ...div,
      linkedSeparadorId: sepId,
      posicaoRelativaAoSep: div.posicaoRelativaAoSep ?? "baixo",
      alturaMm: undefined,
    };
  });
}

/** Após mudar âncora do SEP: limpar largura fixa para recalcular. */
export function applySeparadorAncoraUpdate(
  item: SeparadorItem,
  partial: Partial<SeparadorItem>
): SeparadorItem {
  const merged: SeparadorItem = { ...item, ...partial };
  if (partial.ancoraHorizontal != null) {
    merged.larguraMm = undefined;
  }
  return merged;
}

/** Após ligar/desligar DIV: limpar altura livre quando ligado. */
export function applyDivisorLinkUpdate(
  item: DivisorItem,
  partial: Partial<DivisorItem>
): DivisorItem {
  const merged: DivisorItem = { ...item, ...partial };
  if ("linkedSeparadorId" in partial) {
    if (partial.linkedSeparadorId) {
      merged.alturaMm = undefined;
      if (merged.posicaoRelativaAoSep == null) {
        merged.posicaoRelativaAoSep = "baixo";
      }
    }
  }
  if (partial.posicaoRelativaAoSep != null && merged.linkedSeparadorId) {
    merged.alturaMm = undefined;
  }
  return merged;
}

/**
 * Após mover DIV: SEPs com âncora parcial e largura explícita auto
 * passam a recalcular (limpa larguraMm se âncora ≠ completo).
 */
export function refreshSeparadorWidthsAfterDivChange(
  box: DivSepBoxLike,
  separadores: SeparadorItem[]
): SeparadorItem[] {
  return separadores.map((sep) => {
    const ancora = sep.ancoraHorizontal;
    if (ancora !== "esquerda" && ancora !== "direita") return sep;
    // Forçar recálculo dinâmico a partir dos DIV.
    const next = { ...sep, larguraMm: undefined };
    // Validar que a dimensão resolve sem erro (e memoiza valor se necessário — omitido).
    void resolveSeparadorDimensions(box, next);
    return next;
  });
}
