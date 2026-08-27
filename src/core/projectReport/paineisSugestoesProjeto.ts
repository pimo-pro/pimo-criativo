/**
 * Sugestões de «tipo» para o datalist de Painéis (camada visual).
 * Não alimenta totais Unificado nem lineOverrides.
 */

import type { ProjectState } from "@/context/projectTypes";
import type { ProductionRelease } from "@/core/industrial/productionRelease";
import type { RematePiece } from "@/core/remate/rematePieceTypes";

import { buildPaineisChapasDetalhe } from "./paineisChapasDetalhe";

function pushUnique(out: string[], seen: Set<string>, raw: unknown) {
  const s = String(raw ?? "").trim();
  if (!s || seen.has(s)) return;
  seen.add(s);
  out.push(s);
}

/** Rótulo amigável a partir de productType industrial (só sugestão). */
export function labelFromRemateProductType(
  productType: string | undefined
): string | null {
  if (!productType) return null;
  switch (productType) {
    case "TAMPO_COZINHA":
      return "TAMPO";
    case "RODAPE":
    case "RODAPE_L":
      return "RODAPE";
    case "AVISTA":
      return "AVISTA";
    case "COMPLETO":
      return "COMPLETO";
    case "L":
      return "L";
    default: {
      const t = productType.replace(/_/g, " ").trim();
      return t || null;
    }
  }
}

export function collectSugestoesFromRemates(
  remates: RematePiece[] | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of remates ?? []) {
    pushUnique(out, seen, r.tipo);
    pushUnique(out, seen, labelFromRemateProductType(r.productType));
  }
  return out;
}

/**
 * Aceita nomes de peça curtos (ex. TAMPO, LATERAL_ESQ).
 * Rejeita medidas, códigos longos e texto livre com espaços/números dimensionais.
 */
export function isCutlistNomeSugestaoSegura(nome: string): boolean {
  const s = String(nome || "").trim();
  if (!s || s.length > 28) return false;
  // Medidas / unidades / preços
  if (/\d+\s*[x×]\s*\d+/i.test(s)) return false;
  if (/\b(mm|cm|m²|m2|eur|€)\b/i.test(s)) return false;
  if (/\d{3,}/.test(s)) return false; // códigos/IDs numéricos longos
  // Preferir token industrial: letras/underscore, opcionalmente um sufixo curto
  if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_\-]{0,27}$/.test(s)) return false;
  // Evitar nomes que são só material genérico em minúsculas com espaços (já cobertos)
  return true;
}

/** Tipos/nomes de peça na cutlist — `tipo` sempre; `nome` só se passar o filtro anti-ruído. */
export function collectSugestoesFromCutlistTipos(
  state: ProjectState | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const items = Array.isArray(state?.cutList) ? state!.cutList : [];
  for (const item of items) {
    const tipo = String(item.tipo ?? "").trim();
    const nome = String(item.nome ?? "").trim();
    if (tipo) pushUnique(out, seen, tipo);
    if (nome && isCutlistNomeSugestaoSegura(nome)) {
      pushUnique(out, seen, nome);
    }
  }
  return out;
}

/**
 * Fontes (dedupe mantém a 1ª ocorrência):
 * 1) Materiais de chapa do detalhe nesting
 * 2) Remates: tipo + productType (TAMPO, …)
 * 3) Cutlist: tipo / nome filtrado
 * 4) Rodapés (id/nome se existirem)
 */
export function collectPaineisSugestoesProjeto(
  projectId: string,
  state: ProjectState | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  if (projectId.trim()) {
    try {
      for (const t of buildPaineisChapasDetalhe(projectId, state).map(
        (d) => d.tipo
      )) {
        pushUnique(out, seen, t);
      }
    } catch {
      /* ignore — só sugestões */
    }
  }

  for (const t of collectSugestoesFromRemates(state?.remates)) {
    pushUnique(out, seen, t);
  }

  for (const t of collectSugestoesFromCutlistTipos(state)) {
    pushUnique(out, seen, t);
  }

  for (const r of state?.rodapes ?? []) {
    pushUnique(out, seen, "RODAPE");
    if (r.nomePersonalizado && isCutlistNomeSugestaoSegura(r.nomePersonalizado)) {
      pushUnique(out, seen, r.nomePersonalizado);
    } else if (r.name && isCutlistNomeSugestaoSegura(r.name)) {
      pushUnique(out, seen, r.name);
    }
  }

  return out;
}

/**
 * F2 — sugestões só a partir do productionRelease (última geração TCN).
 * Não lê remates/cutlist live do ProjectState.
 */
export function collectPaineisSugestoesFromRelease(
  release: ProductionRelease | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (!release) return out;
  for (const sheet of release.chapas?.sheets ?? []) {
    pushUnique(out, seen, sheet.material);
    for (const piece of sheet.pieces ?? []) {
      const nome = String(piece.nome ?? "").trim();
      if (/tampo/i.test(nome)) pushUnique(out, seen, "TAMPO");
      if (isCutlistNomeSugestaoSegura(nome)) pushUnique(out, seen, nome);
    }
  }
  return out;
}
