/**
 * Opções avançadas de prateleiras DIV/SEP — resolução e migração dinâmica.
 *
 * REGRA INDUSTRIAL: a direcção das prateleiras NÃO move DIV nem SEP.
 * Apenas actualiza shelfOptions e limpa posições exactas inválidas.
 */
import type {
  BoxShelfOptions,
  DivisorItem,
  DivisorPrateleiraLado,
  DivSepBoxLike,
  PrateleiraDirecao,
  PrateleiraGridMode,
  PrateleiraGridStepMm,
  SeparadorAncoraHorizontal,
} from "./types";

export function boxHasDivisores(box: DivSepBoxLike): boolean {
  return (box.divisores?.length ?? 0) > 0;
}

export function boxHasSeparadores(box: DivSepBoxLike): boolean {
  return (box.separadores?.length ?? 0) > 0;
}

/** Direcções visíveis na UI conforme presença de DIV/SEP. */
export function resolveAvailableShelfDirecoes(box: DivSepBoxLike): PrateleiraDirecao[] {
  const hasDiv = boxHasDivisores(box);
  const hasSep = boxHasSeparadores(box);
  if (hasDiv && hasSep) return ["direita", "esquerda", "superior", "inferior"];
  if (hasDiv) return ["direita", "esquerda"];
  if (hasSep) return ["superior", "inferior"];
  return [];
}

export function resolveShelfGridStepMm(box: DivSepBoxLike): PrateleiraGridStepMm {
  return box.shelfOptions?.distanciaEntreFurosMm === 64 ? 64 : 32;
}

export function resolveShelfGridMode(box: DivSepBoxLike): PrateleiraGridMode {
  return box.shelfOptions?.gridMode === "segmentada" ? "segmentada" : "continua";
}

export function resolveShelfMargemMm(box: DivSepBoxLike): number {
  const raw = Number(box.shelfOptions?.margemSuperiorInferiorMm);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw);
}

/**
 * Direcção efectiva: shelfOptions → primeiro DIV.prateleiraLado (legado) → direita.
 * Se a direcção guardada não estiver disponível, escolhe a primeira válida.
 */
export function resolveShelfDirecao(box: DivSepBoxLike): PrateleiraDirecao {
  const available = resolveAvailableShelfDirecoes(box);
  if (available.length === 0) return "direita";

  const fromOpts = box.shelfOptions?.direcao;
  if (fromOpts && available.includes(fromOpts)) return fromOpts;

  const fromDiv = box.divisores?.[0]?.prateleiraLado;
  if (fromDiv && available.includes(fromDiv)) return fromDiv;

  return available[0]!;
}

export function direcaoToPrateleiraLado(direcao: PrateleiraDirecao): DivisorPrateleiraLado {
  return direcao === "esquerda" ? "esquerda" : "direita";
}

/** True se a direcção selecciona a zona acima do SEP. */
export function shelfDirecaoIsSuperior(direcao: PrateleiraDirecao): boolean {
  return direcao === "superior";
}

/** True se a direcção selecciona a zona abaixo do SEP. */
export function shelfDirecaoIsInferior(direcao: PrateleiraDirecao): boolean {
  return direcao === "inferior";
}

function clearExactShelfYs(div: DivisorItem): DivisorItem {
  if (div.prateleiraYsMm == null) return div;
  const { prateleiraYsMm: _removed, ...rest } = div;
  void _removed;
  return rest;
}

/**
 * Aplica direcção das prateleiras SEM alterar geometria estrutural (DIV/SEP).
 * Campos preservados: positionMm, referenceEdge, alturaMm, profundidadeMm,
 * linkedSeparadorId, posicaoRelativaAoSep, ancoraHorizontal, larguraMm.
 * — actualiza apenas shelfOptions.direcao
 * — limpa prateleiraYsMm (posições exactas deixam de ser válidas na nova zona)
 */
export function applyShelfDirecaoToBox(
  box: DivSepBoxLike,
  direcao: PrateleiraDirecao
): {
  shelfOptions: BoxShelfOptions;
  divisores: DivisorItem[];
  separadores: NonNullable<DivSepBoxLike["separadores"]>;
} {
  const available = resolveAvailableShelfDirecoes(box);
  const effective = available.includes(direcao) ? direcao : available[0] ?? "direita";
  const shelfOptions: BoxShelfOptions = {
    ...(box.shelfOptions ?? {}),
    direcao: effective,
  };

  const divisores = (box.divisores ?? []).map((div) => {
    const cleared = clearExactShelfYs(div);
    // Garantia: nenhum campo estrutural é reescrito.
    return {
      ...cleared,
      positionMm: div.positionMm,
      referenceEdge: div.referenceEdge,
      alturaMm: div.alturaMm,
      profundidadeMm: div.profundidadeMm,
      linkedSeparadorId: div.linkedSeparadorId,
      posicaoRelativaAoSep: div.posicaoRelativaAoSep,
      prateleiraLado: div.prateleiraLado,
    };
  });

  // SEP intacto (mesma referência / mesmos campos).
  const separadores = (box.separadores ?? []).map((sep) => ({ ...sep }));

  return { shelfOptions, divisores, separadores };
}

/**
 * Ao mudar âncora do SEP: NÃO migra prateleiras nem reescreve direcção.
 * Apenas limpa posições exactas (grelha pode ter mudado de compartimento).
 * Prateleiras permanecem independentes da estrutura.
 */
export function migrateShelfOnSeparadorAncoraChange(
  box: DivSepBoxLike,
  _sepId: string,
  _newAncora: SeparadorAncoraHorizontal
): {
  shelfOptions: BoxShelfOptions;
  divisores: DivisorItem[];
} {
  void _sepId;
  void _newAncora;
  return {
    shelfOptions: { ...(box.shelfOptions ?? {}) },
    divisores: (box.divisores ?? []).map((div) => clearExactShelfYs(div)),
  };
}

export function mergeShelfOptions(
  current: BoxShelfOptions | undefined,
  partial: Partial<BoxShelfOptions>
): BoxShelfOptions {
  return { ...(current ?? {}), ...partial };
}
