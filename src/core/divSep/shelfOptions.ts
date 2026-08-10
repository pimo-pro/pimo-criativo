/**
 * Opções avançadas de prateleiras DIV/SEP — resolução e migração dinâmica.
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
  SeparadorItem,
} from "./types";
import { resolveAncoraHorizontal } from "./types";

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

function ladoFromDirecao(direcao: PrateleiraDirecao): DivisorPrateleiraLado | null {
  if (direcao === "esquerda" || direcao === "direita") return direcao;
  return null;
}

/**
 * Direcção efectiva: shelfOptions → primeiro DIV.prateleiraLado → direita.
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
 * Aplica direcção às peças DIV (lado + posição face ao SEP) e normaliza shelfOptions.
 */
export function applyShelfDirecaoToBox(
  box: DivSepBoxLike,
  direcao: PrateleiraDirecao
): {
  shelfOptions: BoxShelfOptions;
  divisores: DivisorItem[];
  separadores: SeparadorItem[];
} {
  const available = resolveAvailableShelfDirecoes(box);
  const effective = available.includes(direcao) ? direcao : available[0] ?? "direita";
  const shelfOptions: BoxShelfOptions = {
    ...(box.shelfOptions ?? {}),
    direcao: effective,
  };

  const preferSepId = box.separadores?.[box.separadores.length - 1]?.id;
  const lado = ladoFromDirecao(effective);

  const divisores = (box.divisores ?? []).map((div) => {
    let next: DivisorItem = clearExactShelfYs(div);
    if (lado) {
      next = { ...next, prateleiraLado: lado };
    }
    if (effective === "superior" && preferSepId) {
      next = {
        ...next,
        linkedSeparadorId: next.linkedSeparadorId ?? preferSepId,
        posicaoRelativaAoSep: "cima",
        alturaMm: undefined,
      };
    } else if (effective === "inferior" && preferSepId) {
      next = {
        ...next,
        linkedSeparadorId: next.linkedSeparadorId ?? preferSepId,
        posicaoRelativaAoSep: "baixo",
        alturaMm: undefined,
      };
    }
    return next;
  });

  let separadores = box.separadores ?? [];
  if (lado) {
    separadores = migrateSeparadoresAncoraToLado(separadores, lado);
  }

  return { shelfOptions, divisores, separadores };
}

/** SEP parcial segue o lado das prateleiras (migração Direita ↔ Esquerda). */
function migrateSeparadoresAncoraToLado(
  separadores: SeparadorItem[],
  lado: DivisorPrateleiraLado
): SeparadorItem[] {
  return separadores.map((sep) => {
    const ancora = resolveAncoraHorizontal(sep);
    if (ancora === "completo") return sep;
    if (ancora === lado) return sep;
    return { ...sep, ancoraHorizontal: lado, larguraMm: undefined };
  });
}

/**
 * Ao mudar âncora do SEP Esquerda ↔ Direita: prateleiras e furos migram com o lado.
 */
export function migrateShelfOnSeparadorAncoraChange(
  box: DivSepBoxLike,
  _sepId: string,
  newAncora: SeparadorAncoraHorizontal
): {
  shelfOptions: BoxShelfOptions;
  divisores: DivisorItem[];
} {
  void _sepId;
  if (newAncora !== "esquerda" && newAncora !== "direita") {
    return {
      shelfOptions: { ...(box.shelfOptions ?? {}) },
      divisores: box.divisores ?? [],
    };
  }
  const shelfOptions: BoxShelfOptions = {
    ...(box.shelfOptions ?? {}),
    direcao: newAncora,
  };
  const divisores = (box.divisores ?? []).map((div) => ({
    ...clearExactShelfYs(div),
    prateleiraLado: newAncora,
  }));
  return { shelfOptions, divisores };
}

export function mergeShelfOptions(
  current: BoxShelfOptions | undefined,
  partial: Partial<BoxShelfOptions>
): BoxShelfOptions {
  return { ...(current ?? {}), ...partial };
}
