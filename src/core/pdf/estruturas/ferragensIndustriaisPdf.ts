/**
 * Estrutura para exportação de Ferragens Industriais para PDF técnico.
 * Preparado para: tabela de ferragens, tabela de furos, tabela de montagem, tabela CNC (futura).
 */

import type { FerragemIndustrial } from "../../industriais/ferragensIndustriais";

export interface DadosFerragensParaPdf {
  componente_id: string;
  itens: Array<{
    ferragem_id: string;
    quantidade: number;
    aplicar_em: string;
    tipo_furo: string;
    profundidade: string;
  }>;
}

/**
 * Agrupa por componente e ordena por ferragem_id.
 * Prepara dados para tabelas do PDF técnico.
 */
export function prepararFerragensIndustriaisParaPdf(
  lista: FerragemIndustrial[]
): DadosFerragensParaPdf[] {
  const porComponente = new Map<string, FerragemIndustrial[]>();
  for (const item of lista) {
    const arr = porComponente.get(item.componente_id) ?? [];
    arr.push(item);
    porComponente.set(item.componente_id, arr);
  }

  return Array.from(porComponente.entries()).map(([componente_id, itens]) => {
    const itensOrdenados = [...itens].sort((a, b) =>
      a.ferragem_id.localeCompare(b.ferragem_id)
    );
    return {
      componente_id,
      itens: itensOrdenados.map((item) => ({
        ferragem_id: item.ferragem_id,
        quantidade: item.quantidade,
        aplicar_em: item.aplicar_em.length > 0 ? item.aplicar_em.join(", ") : "—",
        tipo_furo: item.tipo_furo ?? "—",
        profundidade:
          item.profundidade != null ? `${item.profundidade} mm` : "—",
      })),
    };
  });
}

/**
 * Exporta Ferragens Industriais para PDF.
 * Estrutura vazia — geração real será implementada na Fase 6.
 */
export function exportarFerragensIndustriaisParaPdf(
  _lista: FerragemIndustrial[]
): void {
  // TODO Fase 6: integrar com jspdf/jspdf-autotable
  // const dados = prepararFerragensIndustriaisParaPdf(lista);
  // ...
}
