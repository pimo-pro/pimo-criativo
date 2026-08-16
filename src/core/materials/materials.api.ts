export type MigrationAliasAction = "manter" | "mesclar" | "renomear" | "remover";

export type MaterialAlias = {
  name: string;
  origin: string[];
  action: MigrationAliasAction;
};

export type OfficialWoodMaterial = {
  canonicalId: string;
  label: string;
  type: "wood";
  industrial: boolean;
  visual: boolean;
  aliases: MaterialAlias[];
  action: MigrationAliasAction;
  observacoes?: string;
  industrialDefaults?: {
    espessuraPadrao: number;
    custo_m2: number;
    larguraChapa: number;
    alturaChapa: number;
    densidade: number;
  };
  viewerMaterialId?: string;
  /** Metadados de produto (matérias especiais, ex. tampo cozinha). */
  productMeta?: {
    productType?: "tampo_cozinha" | string;
    /** Laminado de fábrica — sem canto vivo / orla clássica. */
    laminadoFabrica?: boolean;
    /** Largura máxima de peça (mm). */
    maxPieceWidthMm?: number;
  };
};

/** Chapa padrão industrial FASE 7J — variantes gerais 2800 × 2070 mm. */
export const INDUSTRIAL_SHEET_LF_MM = 2800;
export const INDUSTRIAL_SHEET_HF_MM = 2070;

/** MDB Laminado — chapa especial tampo cozinha. */
export const MDB_LAMINADO_SHEET_LF_MM = 3660;
export const MDB_LAMINADO_SHEET_HF_MM = 630;
export const MDB_LAMINADO_MAX_PIECE_WIDTH_MM = 630;
export const MDB_LAMINADO_CANONICAL_ID = "mdb_laminado-30";

/** Fallback da costa (10 mm, MDF Branco) quando a família do corpo não tem variante 10 mm. */
export const COSTA_INDUSTRIAL_CANONICAL_ID = "mdf_branco-10";

/** Espessura fixa da peça COSTA (mm). Costa nunca recebe orla (ver orlaIndustrialRules). */
export const COSTA_FIXED_THICKNESS_MM = 10;

/** Espessura fixa das laterais e traseira de gaveta (mm). */
export const DRAWER_SIDE_THICKNESS_MM = 16;

/** Fallback das laterais/traseira de gaveta (16 mm, MDF Branco). */
export const DRAWER_SIDE_INDUSTRIAL_CANONICAL_ID = "mdf_branco-16";

/** Espessura habitual do fundo de gaveta (mm) quando não vem do layer. */
export const DRAWER_BOTTOM_DEFAULT_THICKNESS_MM = 10;

export type CostaMaterialResolution = {
  materialId: string;
  label: string;
  thicknessMm?: number;
};

export type IndustrialMaterialFamilyOption = {
  familyKey: string;
  label: string;
};

type IndustrialSheetSeed = {
  canonicalId: string;
  label: string;
  espessuraPadrao: number;
  viewerMaterialId: string;
  custo_m2: number;
  densidade: number;
  /** Aliases extra para migração (ids/nomes antigos). */
  legacyAliases?: string[];
  /** Override chapa (default 2800×2070). */
  larguraChapa?: number;
  alturaChapa?: number;
  productType?: "tampo_cozinha" | string;
  laminadoFabrica?: boolean;
  maxPieceWidthMm?: number;
};

/**
 * Lista única de chapas industriais (FASE 7K) — sem entradas só-visuais nem legacy fora desta lista.
 */
const INDUSTRIAL_SHEETS_SEED: IndustrialSheetSeed[] = [
  // MDF Branco
  {
    canonicalId: "mdf_branco-19",
    label: "MDF Branco 19",
    espessuraPadrao: 19,
    viewerMaterialId: "mdf_branco",
    custo_m2: 31,
    densidade: 750,
    legacyAliases: [
      "mdf_branco",
      "MDF Branco",
      "MDF",
      "Branco",
      "Branco Liso",
      "MDF Branco (legacy)",
    ],
  },
  {
    canonicalId: "mdf_branco-16",
    label: "MDF Branco 16",
    espessuraPadrao: 16,
    viewerMaterialId: "mdf_branco",
    custo_m2: 29.45,
    densidade: 750,
  },
  {
    canonicalId: "mdf_branco-10",
    label: "MDF Branco 10",
    espessuraPadrao: 10,
    viewerMaterialId: "mdf_branco",
    custo_m2: 20,
    densidade: 750,
  },
  // Laminado Linho Cancun
  {
    canonicalId: "laminado_linho_cancun-19",
    label: "Laminado Linho Cancun 19",
    espessuraPadrao: 19,
    viewerMaterialId: "laminado_linho_cancun",
    custo_m2: 38,
    densidade: 750,
    legacyAliases: ["laminado_linho_cancun", "Laminado Linho Cancun", "Cinza Industrial"],
  },
  {
    canonicalId: "laminado_linho_cancun-16",
    label: "Laminado Linho Cancun 16",
    espessuraPadrao: 16,
    viewerMaterialId: "laminado_linho_cancun",
    custo_m2: 38,
    densidade: 750,
  },
  {
    canonicalId: "laminado_linho_cancun-10",
    label: "Laminado Linho Cancun 10",
    espessuraPadrao: 10,
    viewerMaterialId: "laminado_linho_cancun",
    custo_m2: 38,
    densidade: 750,
  },
  // MDF Preto
  {
    canonicalId: "mdf_preto-19",
    label: "MDF Preto 19",
    espessuraPadrao: 19,
    viewerMaterialId: "mdf_preto",
    custo_m2: 40,
    densidade: 750,
    legacyAliases: ["mdf_preto", "MDF Preto", "Preto Fosco"],
  },
  {
    canonicalId: "mdf_preto-16",
    label: "MDF Preto 16",
    espessuraPadrao: 16,
    viewerMaterialId: "mdf_preto",
    custo_m2: 40,
    densidade: 750,
  },
  {
    canonicalId: "mdf_preto-10",
    label: "MDF Preto 10",
    espessuraPadrao: 10,
    viewerMaterialId: "mdf_preto",
    custo_m2: 40,
    densidade: 750,
  },
  // HDF Cru
  {
    canonicalId: "hdf_cru-19",
    label: "HDF CRU 19mm",
    espessuraPadrao: 19,
    viewerMaterialId: "hdf_cru",
    custo_m2: 30,
    densidade: 900,
    legacyAliases: [
      "hdf_cru",
      "hdf_cru_19",
      "HDF Cru",
      "HDF CRU",
      "HDF CRU 19mm",
    ],
  },
  // Carvalho
  {
    canonicalId: "carvalho-20",
    label: "Carvalho 20",
    espessuraPadrao: 20,
    viewerMaterialId: "carvalho_natural",
    custo_m2: 48,
    densidade: 720,
    legacyAliases: [
      "carvalho",
      "Carvalho",
      "Carvalho Natural",
      "Carvalho Escuro",
      "Madeira - Carvalho",
      "carvalho_natural",
      "carvalho_escuro",
    ],
  },
  {
    canonicalId: "carvalho-17",
    label: "Carvalho 17",
    espessuraPadrao: 17,
    viewerMaterialId: "carvalho_natural",
    custo_m2: 52,
    densidade: 720,
  },
  {
    canonicalId: "carvalho-16",
    label: "Carvalho 16",
    espessuraPadrao: 16,
    viewerMaterialId: "carvalho_natural",
    custo_m2: 52,
    densidade: 720,
  },
  {
    canonicalId: "carvalho-10",
    label: "Carvalho 10",
    espessuraPadrao: 10,
    viewerMaterialId: "carvalho_natural",
    custo_m2: 55,
    densidade: 720,
  },
  // AGL_Carvalho
  {
    canonicalId: "agl_carvalho-19",
    label: "AGL_Carvalho 19",
    espessuraPadrao: 19,
    viewerMaterialId: "agl_carvalho",
    custo_m2: 48,
    densidade: 720,
    legacyAliases: [
      "agl_carvalho",
      "AGL_Carvalho",
      "AGL Carvalho",
    ],
  },
  {
    canonicalId: "agl_carvalho-16",
    label: "AGL_Carvalho 16",
    espessuraPadrao: 16,
    viewerMaterialId: "agl_carvalho",
    custo_m2: 52,
    densidade: 720,
  },
  {
    canonicalId: "agl_carvalho-10",
    label: "AGL_Carvalho 10",
    espessuraPadrao: 10,
    viewerMaterialId: "agl_carvalho",
    custo_m2: 55,
    densidade: 720,
  },
  // Nogueira
  {
    canonicalId: "nogueira-20",
    label: "Nogueira 20",
    espessuraPadrao: 20,
    viewerMaterialId: "nogueira",
    custo_m2: 58,
    densidade: 700,
    legacyAliases: ["nogueira", "Nogueira", "Madeira - Nogueira"],
  },
  {
    canonicalId: "nogueira-16",
    label: "Nogueira 16",
    espessuraPadrao: 16,
    viewerMaterialId: "nogueira",
    custo_m2: 60,
    densidade: 700,
  },
  {
    canonicalId: "nogueira-10",
    label: "Nogueira 10",
    espessuraPadrao: 10,
    viewerMaterialId: "nogueira",
    custo_m2: 62,
    densidade: 700,
  },
  // Lacado
  {
    canonicalId: "lacado-20",
    label: "Lacado 20",
    espessuraPadrao: 20,
    viewerMaterialId: "mdf_branco",
    custo_m2: 90,
    densidade: 750,
    legacyAliases: ["lacado", "Lacado"],
  },
  {
    canonicalId: "lacado-17",
    label: "Lacado 17",
    espessuraPadrao: 17,
    viewerMaterialId: "mdf_branco",
    custo_m2: 92,
    densidade: 750,
  },
  {
    canonicalId: "lacado-16",
    label: "Lacado 16",
    espessuraPadrao: 16,
    viewerMaterialId: "mdf_branco",
    custo_m2: 91,
    densidade: 750,
  },
  {
    canonicalId: "lacado-10",
    label: "Lacado 10",
    espessuraPadrao: 10,
    viewerMaterialId: "mdf_branco",
    custo_m2: 95,
    densidade: 750,
  },
  // MDB Laminado — tampo cozinha (chapa 3660×630, esp. 30)
  {
    canonicalId: MDB_LAMINADO_CANONICAL_ID,
    label: "MDB Laminado 30",
    espessuraPadrao: 30,
    viewerMaterialId: "mdb_laminado",
    custo_m2: 30,
    densidade: 750,
    larguraChapa: MDB_LAMINADO_SHEET_LF_MM,
    alturaChapa: MDB_LAMINADO_SHEET_HF_MM,
    productType: "tampo_cozinha",
    laminadoFabrica: true,
    maxPieceWidthMm: MDB_LAMINADO_MAX_PIECE_WIDTH_MM,
    legacyAliases: ["MDB Laminado", "mdb_laminado", "MDB Laminado 30 mm"],
  },
];

function industrialSheetToOfficial(row: IndustrialSheetSeed): OfficialWoodMaterial {
  const aliases: MaterialAlias[] = [
    { name: row.label, origin: ["industrial", "ui"], action: "manter" },
    { name: row.canonicalId, origin: ["id"], action: "manter" },
    ...(row.legacyAliases ?? []).map((name) => ({ name, origin: ["legacy", "migration"], action: "mesclar" as const })),
  ];
  return {
    canonicalId: row.canonicalId,
    label: row.label,
    type: "wood",
    industrial: true,
    visual: true,
    action: "manter",
    viewerMaterialId: row.viewerMaterialId,
    industrialDefaults: {
      espessuraPadrao: row.espessuraPadrao,
      custo_m2: row.custo_m2,
      larguraChapa: row.larguraChapa ?? INDUSTRIAL_SHEET_LF_MM,
      alturaChapa: row.alturaChapa ?? INDUSTRIAL_SHEET_HF_MM,
      densidade: row.densidade,
    },
    productMeta:
      row.productType || row.laminadoFabrica || row.maxPieceWidthMm
        ? {
            productType: row.productType,
            laminadoFabrica: row.laminadoFabrica === true,
            maxPieceWidthMm: row.maxPieceWidthMm,
          }
        : undefined,
    aliases,
  };
}

export type MaterialPieceWidthValidation = {
  ok: boolean;
  maxPieceWidthMm?: number;
  message?: string;
};

/**
 * Validação industrial de largura de peça vs matéria (ex. MDB Laminado max 630 mm).
 * Pronta para a peça TAMPO; não altera cutlist nesta fase.
 */
export function validateMaterialPieceWidthMm(
  materialIdOrAlias: string,
  pieceWidthMm: number
): MaterialPieceWidthValidation {
  const mat = resolveMaterial(materialIdOrAlias);
  const max = mat?.productMeta?.maxPieceWidthMm;
  if (max == null || !Number.isFinite(max) || max <= 0) return { ok: true };
  const w = Number(pieceWidthMm);
  if (!Number.isFinite(w) || w <= max) {
    return { ok: true, maxPieceWidthMm: max };
  }
  return {
    ok: false,
    maxPieceWidthMm: max,
    message: `${mat!.label}: largura máxima ${max} mm (peça ${w} mm). Chapa ${mat!.industrialDefaults?.larguraChapa}×${mat!.industrialDefaults?.alturaChapa} mm.`,
  };
}

/** Matéria com productType tampo_cozinha (ex. mdb_laminado-30). */
export function isTampoCozinhaMaterial(idOrAlias: string): boolean {
  const m = resolveMaterial(idOrAlias);
  return m?.productMeta?.productType === "tampo_cozinha" || m?.canonicalId === MDB_LAMINADO_CANONICAL_ID;
}

/** Chapas industriais ativas (única fonte para listIndustrialWoodMaterials). */
export const INDUSTRIAL_WOOD_MATERIALS: OfficialWoodMaterial[] = INDUSTRIAL_SHEETS_SEED.map(industrialSheetToOfficial);

/** Catálogo oficial = apenas chapas industriais (FASE 7K). */
export const OFFICIAL_WOOD_MATERIALS_SEED: OfficialWoodMaterial[] = [...INDUSTRIAL_WOOD_MATERIALS];

const normalize = (value: string): string => value.trim().toLowerCase();

const OFFICIAL_INDEX = new Map<string, OfficialWoodMaterial>();
for (const material of OFFICIAL_WOOD_MATERIALS_SEED) {
  OFFICIAL_INDEX.set(normalize(material.canonicalId), material);
  OFFICIAL_INDEX.set(normalize(material.label), material);
  for (const alias of material.aliases) {
    OFFICIAL_INDEX.set(normalize(alias.name), material);
  }
}

export const OFFICIAL_WOOD_MATERIALS = OFFICIAL_WOOD_MATERIALS_SEED.filter((m) => m.action !== "remover");

export function resolveMaterial(idOrAlias: string): OfficialWoodMaterial | null {
  if (!idOrAlias || typeof idOrAlias !== "string") return null;
  return OFFICIAL_INDEX.get(normalize(idOrAlias)) ?? null;
}

export function listOfficialMaterials(): OfficialWoodMaterial[] {
  return [...OFFICIAL_WOOD_MATERIALS];
}

export function listIndustrialWoodMaterials(): OfficialWoodMaterial[] {
  return [...INDUSTRIAL_WOOD_MATERIALS];
}

export function getDefaultOfficialMaterial(): OfficialWoodMaterial {
  return resolveMaterial("mdf_branco-19") ?? INDUSTRIAL_WOOD_MATERIALS[0]!;
}

function materialFamilyKey(material: OfficialWoodMaterial): string {
  const fromViewer = material.viewerMaterialId?.trim().toLowerCase();
  if (fromViewer) return fromViewer;
  const id = material.canonicalId.trim().toLowerCase();
  const dash = id.lastIndexOf("-");
  return dash > 0 ? id.slice(0, dash) : id;
}

/**
 * Resolve variante industrial da mesma família do corpo numa espessura fixa.
 */
export function resolveIndustrialMaterialAtThickness(
  bodyMaterialId: string,
  thicknessMm: number,
  fallbackCanonicalId: string
): CostaMaterialResolution {
  const fallback = resolveMaterial(fallbackCanonicalId) ?? INDUSTRIAL_WOOD_MATERIALS[0]!;
  const body = resolveMaterial(bodyMaterialId);
  if (!body) {
    return { materialId: fallback.canonicalId, label: fallback.label };
  }
  if ((body.industrialDefaults?.espessuraPadrao ?? 0) === thicknessMm) {
    return { materialId: body.canonicalId, label: body.label };
  }
  const family = materialFamilyKey(body);
  const variant = listIndustrialWoodMaterials().find(
    (m) =>
      materialFamilyKey(m) === family &&
      (m.industrialDefaults?.espessuraPadrao ?? 0) === thicknessMm
  );
  if (variant) {
    return { materialId: variant.canonicalId, label: variant.label };
  }
  return { materialId: fallback.canonicalId, label: fallback.label };
}

/**
 * Resolve material industrial da COSTA: mesma família do corpo, espessura fixa 10 mm.
 * Nunca devolve variantes 19/20 mm.
 */
export function resolveCostaMaterial(bodyMaterialId: string): CostaMaterialResolution {
  return resolveIndustrialMaterialAtThickness(
    bodyMaterialId,
    COSTA_FIXED_THICKNESS_MM,
    COSTA_INDUSTRIAL_CANONICAL_ID
  );
}

/** Laterais e traseira de gaveta: mesma família do corpo, espessura fixa 16 mm. */
export function resolveDrawerSideMaterial(
  bodyMaterialId: string
): CostaMaterialResolution & { thicknessMm: number } {
  const resolved = resolveIndustrialMaterialAtThickness(
    bodyMaterialId,
    DRAWER_SIDE_THICKNESS_MM,
    DRAWER_SIDE_INDUSTRIAL_CANONICAL_ID
  );
  return { ...resolved, thicknessMm: DRAWER_SIDE_THICKNESS_MM };
}

/** Fundo de gaveta: mesma família do corpo na espessura do sistema (normalmente 10 mm). */
export function resolveDrawerBottomMaterial(
  bodyMaterialId: string,
  thicknessMm: number = DRAWER_BOTTOM_DEFAULT_THICKNESS_MM
): CostaMaterialResolution & { thicknessMm: number } {
  const resolved = resolveIndustrialMaterialAtThickness(
    bodyMaterialId,
    thicknessMm,
    COSTA_INDUSTRIAL_CANONICAL_ID
  );
  return { ...resolved, thicknessMm };
}

export function resolveCostaThicknessMm(
  box: { costaThicknessMm?: number } | undefined
): number {
  const custom = Number(box?.costaThicknessMm);
  if (Number.isFinite(custom) && custom > 0) return custom;
  return COSTA_FIXED_THICKNESS_MM;
}

/** Material e espessura efectivos da COSTA (override da caixa ou família do corpo + 10 mm). */
/** Material do separador horizontal: override da caixa ou mesmo material do corpo. */
export function resolveSeparadorMaterialForBox(
  box: { separadorMaterialId?: string } | undefined,
  bodyMaterialId: string
): CostaMaterialResolution {
  const customId = box?.separadorMaterialId?.trim();
  if (customId) {
    const chosen = resolveMaterial(customId);
    if (chosen) {
      return {
        materialId: chosen.canonicalId,
        label: chosen.label,
      };
    }
  }
  const body = resolveMaterial(bodyMaterialId) ?? getDefaultOfficialMaterial();
  return {
    materialId: body.canonicalId,
    label: body.label,
  };
}

/** Material da frente fixa (canto v2): override da caixa ou mesmo material do corpo. */
export function resolveFrenteFixaMaterialForBox(
  box: { frenteFixaMaterialId?: string } | undefined,
  bodyMaterialId: string
): CostaMaterialResolution {
  const customId = box?.frenteFixaMaterialId?.trim();
  if (customId) {
    const chosen = resolveMaterial(customId);
    if (chosen) {
      return {
        materialId: chosen.canonicalId,
        label: chosen.label,
      };
    }
  }
  const body = resolveMaterial(bodyMaterialId) ?? getDefaultOfficialMaterial();
  return {
    materialId: body.canonicalId,
    label: body.label,
  };
}

export function resolveCostaMaterialForBox(
  box: { costaMaterialId?: string; costaThicknessMm?: number } | undefined,
  bodyMaterialId: string
): CostaMaterialResolution & { thicknessMm: number } {
  const thicknessMm = resolveCostaThicknessMm(box);
  const customId = box?.costaMaterialId?.trim();
  if (customId) {
    const chosen = resolveMaterial(customId);
    if (chosen) {
      return {
        materialId: chosen.canonicalId,
        label: chosen.label,
        thicknessMm,
      };
    }
  }
  const auto = resolveCostaMaterial(bodyMaterialId);
  return {
    materialId: auto.materialId,
    label: auto.label,
    thicknessMm,
  };
}

export function listIndustrialMaterialFamilyOptions(): IndustrialMaterialFamilyOption[] {
  const byFamily = new Map<string, string>();
  for (const m of listIndustrialWoodMaterials()) {
    const key = materialFamilyKey(m);
    if (byFamily.has(key)) continue;
    const baseLabel = m.label.replace(/\s+\d+(?:[.,]\d+)?(?:\s*mm)?\s*$/i, "").trim();
    byFamily.set(key, baseLabel || m.label);
  }
  return [...byFamily.entries()]
    .map(([familyKey, label]) => ({ familyKey, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));
}

export function listIndustrialThicknessOptionsForFamily(familyKey: string): number[] {
  const thicknesses = new Set<number>();
  for (const m of listIndustrialWoodMaterials()) {
    if (materialFamilyKey(m) !== familyKey) continue;
    const t = m.industrialDefaults?.espessuraPadrao ?? 0;
    if (t > 0) thicknesses.add(t);
  }
  return [...thicknesses].sort((a, b) => a - b);
}

export function resolveIndustrialMaterialVariant(
  familyKey: string,
  thicknessMm: number
): OfficialWoodMaterial | null {
  return (
    listIndustrialWoodMaterials().find(
      (m) =>
        materialFamilyKey(m) === familyKey &&
        (m.industrialDefaults?.espessuraPadrao ?? 0) === thicknessMm
    ) ?? null
  );
}

export function materialFamilyKeyFromMaterialId(materialId: string): string | null {
  const resolved = resolveMaterial(materialId);
  return resolved ? materialFamilyKey(resolved) : null;
}
