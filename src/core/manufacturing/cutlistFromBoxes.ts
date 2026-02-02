import type { AcessorioComPreco, BoxModule, CutListItemComPreco } from "../types";
import { gerarModeloIndustrial, getPieceLabel } from "./boxManufacturing";
import type { RulesConfig } from "../rules/rulesConfig";

/**
 * Gera cutlist com preço para uma caixa a partir de project.boxes (Single Source of Truth).
 * Usa gerarModeloIndustrial com rules do projeto.
 */
export function cutlistComPrecoFromBox(box: BoxModule, rules: RulesConfig): CutListItemComPreco[] {
  const modelo = gerarModeloIndustrial(box, rules);
  const material = box.material ?? "MDF Branco";
  const items: CutListItemComPreco[] = [];

  const baseItem = { sourceType: "parametric" as const, boxId: box.id };

  modelo.paineis.forEach((p) => {
    items.push({
      ...baseItem,
      id: `${box.id}-${p.id}`,
      nome: getPieceLabel(p.tipo),
      quantidade: p.quantidade,
      dimensoes: {
        largura: p.largura_mm,
        altura: p.altura_mm,
        profundidade: p.espessura_mm,
      },
      espessura: p.espessura_mm,
      material: p.material,
      tipo: p.tipo,
      precoUnitario: p.quantidade > 0 ? p.custo / p.quantidade : 0,
      precoTotal: p.custo,
    });
  });

  modelo.portas.forEach((p) => {
    items.push({
      ...baseItem,
      id: `${box.id}-${p.id}`,
      nome: "porta",
      quantidade: 1,
      dimensoes: {
        largura: p.largura_mm,
        altura: p.altura_mm,
        profundidade: p.espessura_mm,
      },
      espessura: p.espessura_mm,
      material,
      tipo: p.tipo,
      precoUnitario: p.custo,
      precoTotal: p.custo,
    });
  });

  modelo.gavetas.forEach((p) => {
    items.push({
      ...baseItem,
      id: `${box.id}-${p.id}`,
      nome: "gaveta",
      quantidade: 1,
      dimensoes: {
        largura: p.largura_mm,
        altura: p.altura_mm,
        profundidade: p.profundidade_mm,
      },
      espessura: p.espessura_mm,
      material,
      tipo: "gaveta",
      precoUnitario: p.custo,
      precoTotal: p.custo,
    });
  });

  return items;
}

/**
 * Cutlist com preço agregada de todas as caixas (project.boxes).
 */
export function cutlistComPrecoFromBoxes(boxes: BoxModule[], rules: RulesConfig): CutListItemComPreco[] {
  return boxes.flatMap((box) => cutlistComPrecoFromBox(box, rules));
}

/**
 * Ferragens (acessórios) agregadas de todas as caixas (project.boxes).
 * Cada ferragem já tem id único por caixa (f.id em boxManufacturing); a posição
 * no array modelo.ferragens não é usada — apenas mapeamos f → AcessorioComPreco.
 */
export function ferragensFromBoxes(boxes: BoxModule[], rules: RulesConfig): AcessorioComPreco[] {
  const acc: AcessorioComPreco[] = [];
  for (const box of boxes) {
    const modelo = gerarModeloIndustrial(box, rules);
    for (const f of modelo.ferragens) {
      acc.push({
        id: `${box.id}-${f.id}`,
        nome: f.tipo,
        quantidade: f.quantidade,
        precoUnitario: f.quantidade > 0 ? f.custo / f.quantidade : 0,
        precoTotal: f.custo,
        tipo: f.tipo,
      });
    }
  }
  return acc;
}
