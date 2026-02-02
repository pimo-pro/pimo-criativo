/**
 * Ferragens Industriais — lista completa de ferragens e furos por caixa.
 * Combina Component Types (ferragens_default + regras_de_furo) para gerar
 * a lista industrial usada em Cutlist, PDF técnico e CNC.
 */

import type { ComponentType } from "../components/componentTypes";
import type { Ferragem } from "../ferragens/ferragens";

export interface FerragemIndustrial {
  componente_id: string;
  ferragem_id: string;
  quantidade: number;
  aplicar_em: string[];
  tipo_furo?: string;
  profundidade?: number;
}

type RegraFuro = NonNullable<ComponentType["regras_de_furo"]>[number];
type FerragemDefault = NonNullable<ComponentType["ferragens_default"]>[number];

/** Mapeamento ferragem_id → diâmetro esperado (para desambiguar quando há várias regras do mesmo tipo) */
const FERRAGEM_DIAMETRO: Record<string, number> = {
  parafuso_4x50: 3,
  parafuso_puxador: 5,
  cavilha_8mm: 8,
  dobradica_35mm: 35,
  suporte_prateleira: 5,
  corredica_esq: 5,
  corredica_dir: 5,
  prego_costa: 1,
};

/** Mapeamento categoria ferragem → tipo regra_de_furo */
const CATEGORIA_TO_TIPO: Record<string, RegraFuro["tipo"]> = {
  parafuso: "parafuso",
  cavilha: "cavilha",
  dobradica: "dobradica",
  corredica: "corredica",
  suporte: "suporte_prateleira",
  prego: "prego",
  acessorio: "parafuso",
};

function findRegraParaFerragem(
  regras: RegraFuro[],
  ferragemId: string,
  ferragemCategoria: string
): RegraFuro | undefined {
  const tipoEsperado = CATEGORIA_TO_TIPO[ferragemCategoria];
  if (!tipoEsperado) return undefined;

  const candidatas = regras.filter((r) => r.tipo === tipoEsperado);
  if (candidatas.length === 0) return undefined;
  if (candidatas.length === 1) return candidatas[0];

  const diametroEsperado = FERRAGEM_DIAMETRO[ferragemId];
  if (diametroEsperado !== undefined) {
    const match = candidatas.find((r) => r.diametro === diametroEsperado);
    if (match) return match;
  }
  return candidatas[0];
}

function calcularQuantidade(f: FerragemDefault, lados: string[]): number {
  if (f.quantidade_fixa !== undefined && f.quantidade_fixa > 0) return f.quantidade_fixa;
  if (f.quantidade_por_lado !== undefined && f.aplicar_em?.length) {
    return f.quantidade_por_lado * f.aplicar_em.length;
  }
  if (f.quantidade_por_lado !== undefined && lados.length) {
    return f.quantidade_por_lado * lados.length;
  }
  return 1;
}

/**
 * Gera a lista industrial completa de ferragens e furos por componente,
 * a partir dos Component Types e do catálogo de ferragens.
 *
 * Preparado para uso em:
 * - Cutlist Industrial
 * - PDF técnico
 * - CNC (instruções de furação)
 */
export function gerarFerragensIndustriais(
  componentTypes: ComponentType[],
  ferragens: Ferragem[]
): FerragemIndustrial[] {
  const ferragemById = Object.fromEntries(ferragens.map((f) => [f.id, f]));
  const resultado: FerragemIndustrial[] = [];

  for (const ct of componentTypes) {
    const ferragensDefault = ct.ferragens_default ?? [];
    const regras = ct.regras_de_furo ?? [];
    const lados = ct.lados ?? [];

    for (const f of ferragensDefault) {
      const ferragem = ferragemById[f.ferragem_id];
      if (!ferragem) continue;

      const regra = findRegraParaFerragem(regras, f.ferragem_id, ferragem.categoria);
      const aplicarEm =
        (f.aplicar_em?.length ? f.aplicar_em : regra?.aplicar_em ?? []) as string[];
      const quantidade = calcularQuantidade(f, aplicarEm.length ? aplicarEm : lados);

      resultado.push({
        componente_id: ct.id,
        ferragem_id: f.ferragem_id,
        quantidade,
        aplicar_em: aplicarEm,
        tipo_furo: regra?.diametro !== undefined ? `${regra.diametro}mm` : undefined,
        profundidade: regra?.profundidade,
      });
    }
  }

  return resultado;
}

/**
 * Agrupa FerragemIndustrial por componente_id.
 * Útil para exibição e exportação.
 */
export function agruparPorComponente(
  lista: FerragemIndustrial[]
): Map<string, FerragemIndustrial[]> {
  const map = new Map<string, FerragemIndustrial[]>();
  for (const item of lista) {
    const arr = map.get(item.componente_id) ?? [];
    arr.push(item);
    map.set(item.componente_id, arr);
  }
  return map;
}
