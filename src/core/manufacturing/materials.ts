import { PANEL_DEFAULTS } from "../panel/panelConstants";
import {
  getDefaultOfficialMaterial,
  listIndustrialWoodMaterials,
  resolveMaterial,
} from "../materials/materials.api";

/** IDs dos materiais PBR reais (acabamento visual) */
export type MaterialPbrId =
  | "carvalho_natural"
  | "carvalho_escuro"
  | "agl_carvalho"
  | "nogueira"
  | "mdf_branco"
  | "mdb_laminado"
  | "laminado_linho_cancun"
  | "mdf_preto"
  | "hdf_cru"
  | "hdf_lacado";

export const MATERIAIS_PBR_OPCOES: { id: MaterialPbrId; label: string }[] = [
  { id: "carvalho_natural", label: "Carvalho" },
  { id: "carvalho_escuro", label: "Carvalho" },
  { id: "agl_carvalho", label: "AGL_Carvalho" },
  { id: "nogueira", label: "Nogueira" },
  { id: "mdf_branco", label: "MDF Branco" },
  { id: "mdb_laminado", label: "MDB Laminado" },
  { id: "laminado_linho_cancun", label: "Laminado Linho Cancun" },
  { id: "mdf_preto", label: "MDF Preto" },
  { id: "hdf_cru", label: "HDF Cru" },
  { id: "hdf_lacado", label: "HDF Lacado" },
];

export type MaterialIndustrial = {
  /** ID canónico (ex.: mdf_branco-19). */
  id: string;
  nome: string;
  espessuraPadrao: number;
  custo_m2: number;
  /** Material PBR real (acabamento visual); substitui cor sólida. */
  materialPbrId?: MaterialPbrId;
  /** @deprecated Use materialPbrId. Cor sólida — mantido para compatibilidade com dados antigos. */
  cor?: string;
  // Dimensões da chapa (mm)
  larguraChapa?: number;
  alturaChapa?: number;
  // Densidade (kg/m³)
  densidade?: number;
};

/** Chapa padrão MDF PT (LF×HF) */
export const CHAPA_PADRAO_LARGURA = PANEL_DEFAULTS.largura_mm;
export const CHAPA_PADRAO_ALTURA = PANEL_DEFAULTS.altura_mm;
// Densidade padrão MDF: ~750 kg/m³
export const DENSIDADE_PADRAO = 750;

const espessuraIndustrialFallbackMm = (): number =>
  getDefaultOfficialMaterial().industrialDefaults!.espessuraPadrao;

export const MATERIAIS_INDUSTRIAIS: MaterialIndustrial[] = listIndustrialWoodMaterials().map((m) => ({
  id: m.canonicalId,
  nome: m.label,
  espessuraPadrao: m.industrialDefaults?.espessuraPadrao ?? espessuraIndustrialFallbackMm(),
  custo_m2: m.industrialDefaults?.custo_m2 ?? 0,
  materialPbrId: (m.viewerMaterialId as MaterialPbrId | undefined) ?? undefined,
  larguraChapa: m.industrialDefaults?.larguraChapa ?? PANEL_DEFAULTS.largura_mm,
  alturaChapa: m.industrialDefaults?.alturaChapa ?? PANEL_DEFAULTS.altura_mm,
  densidade: m.industrialDefaults?.densidade ?? DENSIDADE_PADRAO,
}));

/**
 * Ferramentas industriais (serras, fresas, etc.)
 * Kerf = espessura de corte em mm
 */
export type IndustrialTool = {
  id: string;
  nome: string;
  kerf: number; // espessura de corte em mm
  tipoMaquina: string;
  diametro?: number; // tamanho/diâmetro opcional em mm
};

export const FERRAMENTAS_INDUSTRIAIS_PADRAO: IndustrialTool[] = [
  { id: "serra_esquadrejadeira", nome: "Serra Esquadrejadeira", kerf: 3.2, tipoMaquina: "Serra" },
  { id: "serra_circular", nome: "Serra Circular", kerf: 3.0, tipoMaquina: "Serra", diametro: 250 },
  { id: "cnc_fresa_6mm", nome: "Fresa CNC 6mm", kerf: 6.0, tipoMaquina: "CNC", diametro: 6 },
  { id: "cnc_fresa_8mm", nome: "Fresa CNC 8mm", kerf: 8.0, tipoMaquina: "CNC", diametro: 8 },
];

export const getMaterial = (nome?: string): MaterialIndustrial => {
  if (nome) {
    const resolved = resolveMaterial(nome);
    if (resolved?.industrial) {
      return {
        id: resolved.canonicalId,
        nome: resolved.label,
        espessuraPadrao: resolved.industrialDefaults?.espessuraPadrao ?? espessuraIndustrialFallbackMm(),
        custo_m2: resolved.industrialDefaults?.custo_m2 ?? 0,
        materialPbrId: (resolved.viewerMaterialId as MaterialPbrId | undefined) ?? undefined,
        larguraChapa: resolved.industrialDefaults?.larguraChapa ?? PANEL_DEFAULTS.largura_mm,
        alturaChapa: resolved.industrialDefaults?.alturaChapa ?? PANEL_DEFAULTS.altura_mm,
        densidade: resolved.industrialDefaults?.densidade ?? DENSIDADE_PADRAO,
      };
    }
    const found = MATERIAIS_INDUSTRIAIS.find((material) => material.nome === nome || material.id === nome);
    if (found) return found;
  }
  const fallback = getDefaultOfficialMaterial();
  return {
    id: fallback.canonicalId,
    nome: fallback.label,
    espessuraPadrao: fallback.industrialDefaults?.espessuraPadrao ?? espessuraIndustrialFallbackMm(),
    custo_m2: fallback.industrialDefaults?.custo_m2 ?? 0,
    materialPbrId: (fallback.viewerMaterialId as MaterialPbrId | undefined) ?? "mdf_branco",
    larguraChapa: fallback.industrialDefaults?.larguraChapa ?? PANEL_DEFAULTS.largura_mm,
    alturaChapa: fallback.industrialDefaults?.alturaChapa ?? PANEL_DEFAULTS.altura_mm,
    densidade: fallback.industrialDefaults?.densidade ?? DENSIDADE_PADRAO,
  };
};
