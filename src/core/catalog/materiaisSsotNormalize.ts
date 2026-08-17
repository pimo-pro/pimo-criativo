/**
 * Normalização do SSOT Excel: propaga família/nome nas linhas em branco
 * e resolve a REF industrial existente (sem criar IDs novos).
 */

import {
  listOfficialMaterials,
  resolveMaterial,
  type OfficialWoodMaterial,
} from "../materials/materials.api";
import type { MateriaisSsotChapaRow, MateriaisSsotCatalog } from "./materiaisSsotTypes";
import { resolveChapaNomePadronizado } from "./materiaisSsotReader";

export type MateriaisSsotChapaResolved = MateriaisSsotChapaRow & {
  familia: string;
  industrialCanonicalId: string | null;
  displayLabel: string;
};

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Remove sufixo de espessura do nome de família (segurança SSOT). */
export function stripEspessuraFromFamilia(name: string): string {
  return String(name ?? "")
    .replace(/\s+\d+(?:[.,]\d+)?(?:\s*mm)?\s*$/i, "")
    .trim();
}

/** Propaga só «Nome novo padronizado» nas linhas vazias da mesma família. */
export function propagateSsotChapaFamilies(
  rows: MateriaisSsotChapaRow[]
): MateriaisSsotChapaRow[] {
  let lastFamilia = "";
  return rows.map((row) => {
    const novo = row.nomeNovoPadronizado.trim();
    if (novo) lastFamilia = novo;
    return {
      ...row,
      nomeNovoPadronizado: novo || lastFamilia,
      // Nome atual mantém-se por linha (não herda o da 1.ª espessura).
      nomeAtual: row.nomeAtual.trim(),
    };
  });
}

function familyHints(family: string): string[] {
  const k = normalizeKey(family);
  const hints: string[] = [k];
  if (k.includes("linho") || k.includes("cancun")) hints.push("laminado linho cancun", "laminado_linho_cancun");
  if (k.includes("mdf branco") || k === "mdf branco") hints.push("mdf branco", "mdf_branco");
  if (k.includes("mdf preto")) hints.push("mdf preto", "mdf_preto");
  if (k.includes("agl") && k.includes("carvalho")) hints.push("agl carvalho", "agl_carvalho");
  if (k.includes("agl") && k.includes("branco")) hints.push("agl branco", "agl_branco", "agl lam branco");
  if (k.includes("carvalho") && !k.includes("agl")) hints.push("carvalho", "carvalho natural");
  if (k.includes("nogueir")) hints.push("nogueira");
  if (k.includes("lacado")) hints.push("lacado");
  if (k.includes("hdf cru") || k === "hdf cru") hints.push("hdf cru", "hdf_cru");
  return hints;
}

function officialMatchesFamily(m: OfficialWoodMaterial, family: string): boolean {
  const hints = familyHints(family);
  const labelKey = normalizeKey(m.label.replace(/\s+\d+(?:[.,]\d+)?(?:\s*mm)?\s*$/i, ""));
  const viewer = normalizeKey(m.viewerMaterialId ?? "");
  const id = normalizeKey(m.canonicalId);
  return hints.some(
    (h) =>
      labelKey.includes(h) ||
      h.includes(labelKey) ||
      viewer.includes(h.replace(/\s/g, "_")) ||
      viewer.replace(/_/g, " ").includes(h) ||
      id.includes(h.replace(/\s/g, "_"))
  );
}

/**
 * Resolve REF industrial existente. Nunca inventa IDs — só faz match ao catálogo oficial.
 */
export function resolveIndustrialCanonicalId(input: {
  ref: string;
  nomeAtual: string;
  familia: string;
  espessuraMm: number | null;
}): string | null {
  const byRef = resolveMaterial(input.ref);
  if (byRef?.industrial && byRef.canonicalId) return byRef.canonicalId;

  const byNome = resolveMaterial(input.nomeAtual);
  if (byNome?.industrial && byNome.canonicalId) return byNome.canonicalId;

  const esp = input.espessuraMm;
  if (esp == null || !(esp > 0)) return null;

  const official = listOfficialMaterials().filter((m) => m.industrial && m.industrialDefaults);
  const sameThickness = official.filter(
    (m) => Number(m.industrialDefaults?.espessuraPadrao) === esp
  );
  const familyHit = sameThickness.find((m) => officialMatchesFamily(m, input.familia));
  if (familyHit) return familyHit.canonicalId;

  // Último recurso: REF com sufixo -espessura igual a um canónico conhecido
  const refLower = input.ref.trim().toLowerCase();
  const bySuffix = official.find((m) => {
    const id = m.canonicalId.toLowerCase();
    return id.endsWith(`-${esp}`) && officialMatchesFamily(m, input.familia);
  });
  if (bySuffix) return bySuffix.canonicalId;

  // Match directo por canonicalId exacto na lista
  const exact = official.find((m) => m.canonicalId.toLowerCase() === refLower);
  return exact?.canonicalId ?? null;
}

export function resolveSsotChapas(
  catalog: MateriaisSsotCatalog
): MateriaisSsotChapaResolved[] {
  const propagated = propagateSsotChapaFamilies(catalog.chapas);
  return propagated
    .filter((r) => r.ref.trim() || r.nomeAtual.trim() || r.nomeNovoPadronizado.trim())
    .map((row) => {
      const familiaRaw =
        resolveChapaNomePadronizado(row) ||
        row.nomeNovoPadronizado.trim() ||
        row.nomeAtual.trim();
      const familia = stripEspessuraFromFamilia(familiaRaw) || familiaRaw;
      const industrialCanonicalId = resolveIndustrialCanonicalId({
        ref: row.ref,
        nomeAtual: row.nomeAtual,
        familia,
        espessuraMm: row.espessuraMm,
      });
      const official = industrialCanonicalId ? resolveMaterial(industrialCanonicalId) : null;
      const esp = row.espessuraMm ?? official?.industrialDefaults?.espessuraPadrao ?? null;
      // displayLabel só para CRUD/match — a carta de família usa `familia` sem espessura.
      const displayLabel =
        (familia && esp != null ? `${familia} ${esp}` : "") ||
        row.nomeAtual.trim() ||
        official?.label ||
        familia ||
        row.ref;
      return {
        ...row,
        familia,
        industrialCanonicalId,
        displayLabel,
        espessuraMm: esp,
      };
    });
}

export type MateriaisSsotFamiliaGrupo = {
  /** Nome novo padronizado (família UI). */
  familia: string;
  espessuras: MateriaisSsotChapaResolved[];
};

/** Agrupa chapas SSOT por «Nome novo padronizado» (uma carta por família). */
export function groupSsotChapasByFamilia(
  rows: MateriaisSsotChapaResolved[]
): MateriaisSsotFamiliaGrupo[] {
  const byFam = new Map<string, MateriaisSsotChapaResolved[]>();
  for (const row of rows) {
    const familia = row.familia.trim() || "Sem família";
    const list = byFam.get(familia);
    if (list) list.push(row);
    else byFam.set(familia, [row]);
  }
  return [...byFam.entries()]
    .map(([familia, espessuras]) => ({
      familia,
      espessuras: [...espessuras].sort(
        (a, b) => (a.espessuraMm ?? 0) - (b.espessuraMm ?? 0)
      ),
    }))
    .sort((a, b) => a.familia.localeCompare(b.familia, "pt", { sensitivity: "base" }));
}

export function parseMedidaChapaMm(medida: string): { widthMm: number; heightMm: number } | null {
  const m = String(medida ?? "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const widthMm = Number(String(m[1]).replace(",", "."));
  const heightMm = Number(String(m[2]).replace(",", "."));
  if (!(widthMm > 0) || !(heightMm > 0)) return null;
  return { widthMm, heightMm };
}
