/**
 * Aparência visual da família de materiais (textura / cor).
 * Fonte: CRUD MaterialRecord → preset visual → caminhos em public/textures.
 * Não altera IDs industriais / CNC / nesting / TCN / cutlist / PI.
 */

import type { MaterialRecord } from "../materials/types";
import { getPresetById, updatePreset } from "../materials/presetService";
import { listMaterials, writeMaterialsCrudSnapshot } from "../materials/service";
import { resolveMaterial } from "../materials/materials.api";
import { invalidatePresetRegistry } from "../../3d/viewer-engine/materials/presetRegistry";
import { resolveFamiliaForCrudMaterial } from "./materiaisSsotUiMerge";
import { stripEspessuraFromFamilia } from "./materiaisSsotNormalize";

/** Caminhos públicos por defeito (Vite `public/`). */
export const DEFAULT_PUBLIC_TEXTURES = {
  mdfBranco: "/textures/mdf/mdf-branco.jpg",
  mdfCinza: "/textures/mdf/mdf-cinza.jpg",
  mdfPreto: "/textures/mdf/mdf-preto.jpg",
  carvalho: "/textures/wood/carvalho.jpg",
  nogueira: "/textures/wood/nogueira.jpg",
} as const;

const STORAGE_OVERRIDE_KEY = "pimo_materiais_familia_texture_paths_v1";

export type FamiliaAppearance = {
  familia: string;
  /** URL pública (/textures/...) ou http — nunca data-URL como fonte canónica. */
  textureUrl: string | null;
  color: string | null;
  source: "override" | "record" | "preset" | "default_map" | "color_only" | "none";
};

function normalizeFam(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isUsableTextureUrl(url: string | undefined | null): url is string {
  const u = String(url ?? "").trim();
  if (!u) return false;
  if (u.startsWith("data:")) return false;
  return (
    u.startsWith("/textures/") ||
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("/assets/")
  );
}

function readOverrideMap(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && isUsableTextureUrl(v)) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function writeOverrideMap(map: Record<string, string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

/** Guarda caminho público da textura da família (não data-URL). */
export function setFamiliaTexturePath(familia: string, textureUrl: string): void {
  const key = normalizeFam(familia);
  const url = String(textureUrl ?? "").trim();
  if (!key || !isUsableTextureUrl(url)) return;
  const map = readOverrideMap();
  map[key] = url;
  writeOverrideMap(map);
}

export function clearFamiliaTexturePath(familia: string): void {
  const key = normalizeFam(familia);
  if (!key) return;
  const map = readOverrideMap();
  delete map[key];
  writeOverrideMap(map);
}

export function getFamiliaTextureOverride(familia: string): string | null {
  const key = normalizeFam(familia);
  if (!key) return null;
  return readOverrideMap()[key] ?? null;
}

/** Mapa família SSOT → textura pública por defeito. */
export function defaultTextureForFamilia(familia: string): string | null {
  const k = normalizeFam(familia);
  if (k.includes("mdf branco") || k === "mdf branco") return DEFAULT_PUBLIC_TEXTURES.mdfBranco;
  if (k.includes("mdf preto") || k === "mdf preto") return DEFAULT_PUBLIC_TEXTURES.mdfPreto;
  if (k.includes("linho") || k.includes("cancun")) return DEFAULT_PUBLIC_TEXTURES.mdfCinza;
  if (k.includes("nogueir")) return DEFAULT_PUBLIC_TEXTURES.nogueira;
  if (k.includes("agl") && k.includes("branco")) return DEFAULT_PUBLIC_TEXTURES.mdfBranco;
  if (k.includes("carvalho")) return DEFAULT_PUBLIC_TEXTURES.carvalho;
  if (k.includes("lacado")) return DEFAULT_PUBLIC_TEXTURES.mdfBranco;
  if (k.includes("hdf cru") || k === "hdf cru") return DEFAULT_PUBLIC_TEXTURES.mdfBranco;
  return null;
}

function materialsOfFamilia(familia: string, materials: MaterialRecord[]): MaterialRecord[] {
  const target = normalizeFam(familia);
  const byResolve = materials.filter(
    (m) => normalizeFam(resolveFamiliaForCrudMaterial(m)) === target
  );
  if (byResolve.length) return byResolve;
  return materials.filter((m) => {
    const base = normalizeFam(stripEspessuraFromFamilia(m.label ?? ""));
    return base === target || base.startsWith(`${target} `) || target.startsWith(`${base} `);
  });
}

/**
 * Resolve textura e cor reais da família para a carta Admin / 3D.
 */
export function resolveFamiliaAppearance(
  familia: string,
  materials: MaterialRecord[]
): FamiliaAppearance {
  const fam = stripEspessuraFromFamilia(familia) || familia.trim();
  if (!fam) {
    return { familia: "", textureUrl: null, color: null, source: "none" };
  }

  const override = getFamiliaTextureOverride(fam);
  if (override) {
    const members = materialsOfFamilia(fam, materials);
    const color =
      members.find((m) => m.color && /^#/.test(m.color))?.color ??
      null;
    return { familia: fam, textureUrl: override, color, source: "override" };
  }

  const members = materialsOfFamilia(fam, materials);
  for (const m of members) {
    if (isUsableTextureUrl(m.textureUrl)) {
      return {
        familia: fam,
        textureUrl: m.textureUrl!.trim(),
        color: m.color ?? null,
        source: "record",
      };
    }
  }

  for (const m of members) {
    const presetId =
      m.visualPresetId?.trim() ||
      (m.industrialMaterialId
        ? resolveMaterial(m.industrialMaterialId)?.viewerMaterialId
        : undefined);
    if (!presetId) continue;
    const preset = getPresetById(presetId);
    if (preset && isUsableTextureUrl(preset.textureUrl)) {
      return {
        familia: fam,
        textureUrl: preset.textureUrl!.trim(),
        color: m.color ?? preset.color ?? null,
        source: "preset",
      };
    }
    if (preset?.color) {
      return {
        familia: fam,
        textureUrl: null,
        color: m.color ?? preset.color,
        source: "color_only",
      };
    }
  }

  const defTex = defaultTextureForFamilia(fam);
  if (defTex) {
    const color = members.find((m) => m.color)?.color ?? null;
    return { familia: fam, textureUrl: defTex, color, source: "default_map" };
  }

  const colorOnly = members.find((m) => m.color && /^#/.test(String(m.color)))?.color ?? null;
  if (colorOnly) {
    return { familia: fam, textureUrl: null, color: colorOnly, source: "color_only" };
  }

  return { familia: fam, textureUrl: null, color: null, source: "none" };
}

/**
 * Aplica textura pública a todos os materiais CRUD da família + presets visual ligados.
 * Assim a carta e o 3D (MaterialEngine / VisualMaterial) usam a mesma URL.
 */
export function applyFamiliaTextureToMaterialsSystem(
  familia: string,
  textureUrl: string
): { updatedMaterials: number; updatedPresets: number } {
  const url = String(textureUrl ?? "").trim();
  if (!isUsableTextureUrl(url)) {
    return { updatedMaterials: 0, updatedPresets: 0 };
  }

  setFamiliaTexturePath(familia, url);

  const list = listMaterials();
  const members = materialsOfFamilia(familia, list);
  let updatedMaterials = 0;
  const presetIds = new Set<string>();

  const next = list.map((m) => {
    if (!members.some((x) => x.id === m.id)) return m;
    updatedMaterials++;
    if (m.visualPresetId?.trim()) presetIds.add(m.visualPresetId.trim());
    if (m.industrialMaterialId) {
      const off = resolveMaterial(m.industrialMaterialId);
      if (off?.viewerMaterialId) presetIds.add(off.viewerMaterialId);
    }
    return { ...m, textureUrl: url };
  });

  if (updatedMaterials > 0) {
    writeMaterialsCrudSnapshot(next);
  }

  let updatedPresets = 0;
  for (const id of presetIds) {
    if (updatePreset(id, { textureUrl: url })) updatedPresets++;
  }
  if (updatedPresets > 0) {
    invalidatePresetRegistry();
  }

  return { updatedMaterials, updatedPresets };
}

/** Extensão segura a partir do mime/nome. */
export function textureExtensionFromFile(fileName: string, mimeType: string): string {
  const fromMime =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/jpeg" || mimeType === "image/jpg"
          ? "jpg"
          : null;
  if (fromMime) return fromMime;
  const m = String(fileName ?? "").toLowerCase().match(/\.([a-z0-9]+)$/);
  if (m && ["jpg", "jpeg", "png", "webp"].includes(m[1]!)) {
    return m[1] === "jpeg" ? "jpg" : m[1]!;
  }
  return "jpg";
}

export function slugFamiliaForTextureFile(familia: string): string {
  return normalizeFam(familia)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "familia";
}
