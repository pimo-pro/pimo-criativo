/** IDs dos materiais PBR reais (acabamento visual) */
export type MaterialPbrId =
  | "carvalho_natural"
  | "carvalho_escuro"
  | "nogueira"
  | "mdf_branco"
  | "mdf_cinza"
  | "mdf_preto";

export const MATERIAIS_PBR_OPCOES: { id: MaterialPbrId; label: string }[] = [
  { id: "carvalho_natural", label: "Carvalho Natural" },
  { id: "carvalho_escuro", label: "Carvalho Escuro" },
  { id: "nogueira", label: "Nogueira" },
  { id: "mdf_branco", label: "MDF Branco" },
  { id: "mdf_cinza", label: "MDF Cinza" },
  { id: "mdf_preto", label: "MDF Preto" },
];

export type MaterialIndustrial = {
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

// Chapa padrão: 2850 x 2100 mm
export const CHAPA_PADRAO_LARGURA = 2850;
export const CHAPA_PADRAO_ALTURA = 2100;
// Densidade padrão MDF: ~750 kg/m³
export const DENSIDADE_PADRAO = 750;

export const MATERIAIS_INDUSTRIAIS: MaterialIndustrial[] = [
  { nome: "MDF Branco", espessuraPadrao: 19, custo_m2: 35, larguraChapa: 2850, alturaChapa: 2100, densidade: 750 },
  { nome: "Carvalho", espessuraPadrao: 20, custo_m2: 45, larguraChapa: 2850, alturaChapa: 2100, densidade: 720 },
  { nome: "Lacado", espessuraPadrao: 20, custo_m2: 90, larguraChapa: 2850, alturaChapa: 2100, densidade: 750 },
  { nome: "Contraplacado", espessuraPadrao: 19, custo_m2: 68, larguraChapa: 2850, alturaChapa: 2100, densidade: 600 },
  { nome: "Melamina", espessuraPadrao: 19, custo_m2: 22, larguraChapa: 2850, alturaChapa: 2100, densidade: 700 },
];

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
    const found = MATERIAIS_INDUSTRIAIS.find((material) => material.nome === nome);
    if (found) return found;
  }
  return MATERIAIS_INDUSTRIAIS[0];
};
