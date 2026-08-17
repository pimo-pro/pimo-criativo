/**
 * Agrupamento local de materiais para UI (Admin + editor).
 * Não altera IDs canónicos, pipeline industrial nem materials.api.
 * Preferência: família do SSOT Excel (runtime) → mapeamento estático legado.
 */

import { getSsotFamiliaForMaterialId } from "../../../core/catalog/materiaisSsotStore";

/** Nome base (sem espessura) → nome industrial padronizado (UI) — fallback legado. */
export const MATERIAL_NOME_PADRONIZADO_MAP: Record<string, string> = {
  agl_carvalho: "AGL CARVALHO",
  "agl carvalho": "AGL CARVALHO",
  agl_branco: "AGL LAM BRANCO",
  "agl branco": "AGL LAM BRANCO",
  "agl lam branco": "AGL LAM BRANCO",
  carvalho: "HDF FOLHEADO CARVALHO",
  "hdf cru": "HDF CRU",
  hdf_cru: "HDF CRU",
  lacado: "HDF LACADO",
  "laminado linho cancun": "AGL LAM Linho Cancun",
  "mdf branco": "MDF Branco",
  "mdf preto": "MDF Preto",
  nogueira: "HDF FOLHEADO NOGUEIRA",
};

export type MaterialGrupoPadronizado<T> = {
  materialPadronizado: string;
  listaDeEspessuras: T[];
};

export type MaterialLikeForGrouping = {
  label: string;
  espessura?: number;
  industrialDefaults?: { espessuraPadrao?: number };
  canonicalId?: string;
  id?: string;
  industrialMaterialId?: string;
};

/** Remove sufixo de espessura do label (ex.: "MDF Branco 19" → "MDF Branco"). */
export function extractMaterialBaseName(label: string): string {
  return String(label ?? "")
    .replace(/\s+\d+(?:[.,]\d+)?(?:\s*mm)?\s*$/i, "")
    .trim();
}

function normalizeBaseKey(baseName: string): string {
  return baseName
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Mapeia nome base → nome padronizado; fallback = base original. */
export function toMaterialPadronizado(
  baseNameOrLabel: string,
  opts?: { canonicalId?: string; id?: string; industrialMaterialId?: string }
): string {
  const keys = [opts?.canonicalId, opts?.industrialMaterialId, opts?.id, baseNameOrLabel]
    .map((k) => String(k ?? "").trim())
    .filter(Boolean);
  for (const key of keys) {
    const fromSsot = getSsotFamiliaForMaterialId(key);
    if (fromSsot) {
      // Garante família sem espessura mesmo se o runtime tiver displayLabel poluído.
      return extractMaterialBaseName(fromSsot) || fromSsot.trim();
    }
  }
  const base = extractMaterialBaseName(baseNameOrLabel);
  const key = normalizeBaseKey(base);
  return MATERIAL_NOME_PADRONIZADO_MAP[key] ?? base;
}

export function getMaterialEspessuraMm(material: MaterialLikeForGrouping): number {
  const fromRecord = Number(material.espessura);
  if (Number.isFinite(fromRecord) && fromRecord > 0) return fromRecord;
  const fromIndustrial = Number(material.industrialDefaults?.espessuraPadrao);
  if (Number.isFinite(fromIndustrial) && fromIndustrial > 0) return fromIndustrial;
  return 0;
}

/**
 * Agrupa materiais existentes pelo nome padronizado.
 * Não cria espessuras novas — só reorganiza a lista recebida.
 */
export function groupMaterialsByPadronizado<T extends MaterialLikeForGrouping>(
  materials: T[]
): MaterialGrupoPadronizado<T>[] {
  const byKey = new Map<string, T[]>();
  for (const material of materials) {
    const padronizado = toMaterialPadronizado(material.label, {
      canonicalId: material.canonicalId,
      id: material.id,
      industrialMaterialId: material.industrialMaterialId,
    });
    const list = byKey.get(padronizado);
    if (list) list.push(material);
    else byKey.set(padronizado, [material]);
  }
  return [...byKey.entries()]
    .map(([materialPadronizado, listaDeEspessuras]) => ({
      materialPadronizado,
      listaDeEspessuras: [...listaDeEspessuras].sort(
        (a, b) => getMaterialEspessuraMm(a) - getMaterialEspessuraMm(b)
      ),
    }))
    .sort((a, b) =>
      a.materialPadronizado.localeCompare(b.materialPadronizado, "pt", {
        sensitivity: "base",
      })
    );
}

export function findGrupoByMaterialId<T extends MaterialLikeForGrouping>(
  grupos: MaterialGrupoPadronizado<T>[],
  materialId: string
): MaterialGrupoPadronizado<T> | null {
  const id = String(materialId ?? "").trim();
  if (!id) return null;
  for (const grupo of grupos) {
    const hit = grupo.listaDeEspessuras.find(
      (m) => m.canonicalId === id || m.id === id || m.label === id
    );
    if (hit) return grupo;
  }
  return null;
}

export function resolveVariantInGrupo<T extends MaterialLikeForGrouping>(
  grupo: MaterialGrupoPadronizado<T>,
  preferredThicknessMm?: number
): T | null {
  if (grupo.listaDeEspessuras.length === 0) return null;
  if (preferredThicknessMm != null && preferredThicknessMm > 0) {
    const exact = grupo.listaDeEspessuras.find(
      (m) => getMaterialEspessuraMm(m) === preferredThicknessMm
    );
    if (exact) return exact;
  }
  return grupo.listaDeEspessuras[0] ?? null;
}
