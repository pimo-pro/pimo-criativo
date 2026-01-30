/**
 * Adaptador: peças extraídas de GLB → CutListItem do sistema.
 * Permite integrar peças importadas à Lista de Peças e ao Calculator.
 */

import type { CutListItem } from "../types";
import type { ExtractedPart } from "./types";

/**
 * Converte peças extraídas de um GLB em itens da cut list.
 * @param parts Peças de extractPartsFromGLB
 * @param boxId ID da caixa à qual o modelo foi associado
 * @param modelInstanceId ID da instância do modelo na caixa (para agrupamento)
 * @param defaultMaterial Material padrão quando não há hint (ex: "MDF")
 * @param defaultEspessuraMm Espessura padrão em mm quando não inferível (ex: 18)
 */
export function glbPartsToCutListItems(
  parts: ExtractedPart[],
  boxId: string,
  modelInstanceId: string,
  defaultMaterial: string = "MDF",
  defaultEspessuraMm: number = 18
): CutListItem[] {
  return parts.map((p, index) => {
    const material = p.materialHint?.trim() || defaultMaterial;
    const espessura = p.espessura > 0 ? p.espessura : defaultEspessuraMm;
    return {
      id: `${boxId}-${modelInstanceId}-${p.id}-${index}`,
      nome: p.nome,
      quantidade: 1,
      dimensoes: {
        largura: p.dimensoes.largura,
        altura: p.dimensoes.altura,
        profundidade: p.dimensoes.profundidade,
      },
      espessura,
      material,
      tipo: "glb_importado",
      sourceType: "glb_importado",
      modelInstanceId,
      boxId,
    };
  });
}
