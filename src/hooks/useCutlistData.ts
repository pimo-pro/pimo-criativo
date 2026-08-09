/**
 * Dados agregados da cutlist e ferragens (project.boxes).
 * Usado por CutlistPanel e pelos painéis focados (Portas, Ferragens, Totais, etc.).
 *
 * FASE 2: quando `drawersLayer` existe, painéis de gaveta vêm de `cutlistComPrecoFromBox`
 * (pipeline moderno, alinhado com CNC). Caso contrário, fallback legado (`gerarModeloIndustrial`).
 *
 * Fase 1: material das portas de módulo conta 1× em Painéis; linha Portas = €0 (reservada a divisão).
 * Fase 2: madeira de gaveta em Painéis; linha Gavetas = N × montagem/gaveta (configurável).
 */

import { useMemo } from "react";
import { useProject } from "../context/useProject";
import {
  isCarcassPanelForAdminCost,
  isDoorPieceForAdminCost,
  isFallbackCarcassWoodTipo,
} from "../core/financeiro/cutlistAdminCostPartition";
import { resolveCustoMontagemPorGavetaEur } from "../core/financeiro/drawerAssemblyCost";
import { getSettings } from "../core/settings/settingsService";
import { gerarModeloIndustrial } from "../core/manufacturing/boxManufacturing";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { gerarFerragensIndustriais, agruparPorComponente } from "../core/industriais/ferragensIndustriais";
import { useComponentTypes } from "./useComponentTypes";
import { useFerragens } from "./useFerragens";
import type { Ferragem } from "../core/ferragens/ferragens";
import type { BoxModule, CutListItemComPreco } from "../core/types";
import { computeBoxProfundidadeLeituraMm } from "../utils/boxProfundidadeLeituraUi";
import {
  DRAWER_SLIDES_PER_DRAWER,
  boxUsesModernDrawerPipeline,
  isDrawerPieceTipo,
} from "../services/drawerCutlistAdapter";
import { resolveRematePieceNomeForRemate } from "../core/remate/labels";
import {
  quantidadeParafuso4x35JuntasPorCaixa,
  PARAFUSO_4X35_ID,
  PARAFUSO_4X35_PRECO,
  quantidadeParafuso4x35PorRemate,
} from "../core/ferragens/freeagemParafusos";

export { isCarcassPanelForAdminCost, isDoorPieceForAdminCost } from "../core/financeiro/cutlistAdminCostPartition";

export type PainelRow = {
  key: string;
  boxNome: string;
  tipo: string;
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  orientacaoFibra: string;
  quantidade: number;
  custo: number;
  boxProfundidadeExternaMm: number;
  boxProfundidadeInternaUtilMm: number;
};

export type PortaRow = {
  key: string;
  boxNome: string;
  tipo: string;
  largura_mm: number;
  altura_mm: number;
  espessura_mm: number;
  dobradicas: number;
  custo: number;
};

export type GavetaRow = {
  key: string;
  boxNome: string;
  largura_mm: number;
  altura_mm: number;
  profundidade_mm: number;
  espessura_mm: number;
  corrediças: number;
  custo: number;
};

export type FerragemRow = {
  key: string;
  boxNome: string;
  tipo: string;
  quantidade: number;
  precoUnitario: number;
  custo: number;
};

export type OrlaFerragemRow = {
  key: string;
  boxNome: string;
  presetNome: string;
  metros: number;
  custo: number;
  tipo: "normal" | "orla_junto";
  pieceNome?: string;
};

export type RemateRow = {
  key: string;
  boxNome: string;
  nome: string;
  material: string;
  largura_mm: number;
  altura_mm: number;
  profundidade_mm: number;
  quantidade: number;
  custo: number;
};

function cutlistItemToPainelRow(
  item: CutListItemComPreco,
  boxNome: string,
  boxProfundidadeExternaMm: number,
  boxProfundidadeInternaUtilMm: number
): PainelRow {
  return {
    key: `${item.boxId ?? "box"}-${item.id}`,
    boxNome,
    tipo: item.tipo,
    largura_mm: item.dimensoes.largura,
    altura_mm: item.dimensoes.altura,
    espessura_mm: item.espessura,
    orientacaoFibra: item.grainDirection ?? "XX",
    quantidade: item.quantidade,
    custo: item.precoTotal,
    boxProfundidadeExternaMm,
    boxProfundidadeInternaUtilMm,
  };
}

function buildGavetaRowsFromModernCutlist(
  box: BoxModule,
  boxNome: string,
  modernCutlist: CutListItemComPreco[],
  montagemPorGavetaEur: number
): GavetaRow[] {
  const drawerPieceIds = modernCutlist.filter((item) => isDrawerPieceTipo(item.tipo));
  const drawerIndices = new Set<number>();
  for (const item of drawerPieceIds) {
    const match = item.id.match(/-drawer-(\d+)-/);
    if (match) drawerIndices.add(Number(match[1]));
  }

  const rows: GavetaRow[] = [];
  for (const drawerIndex of [...drawerIndices].sort((a, b) => a - b)) {
    const prefix = `${box.id}-drawer-${drawerIndex}`;
    const drawerPieces = drawerPieceIds.filter((item) => item.id.startsWith(prefix));
    const front = drawerPieces.find(
      (item) => item.tipo === "gaveta_frente_ext" || item.tipo === "gaveta_frente"
    );
    if (!front) continue;

    rows.push({
      key: `${box.id}-gaveta-${drawerIndex}`,
      boxNome,
      largura_mm: front.dimensoes.largura,
      altura_mm: front.dimensoes.altura,
      profundidade_mm: front.dimensoes.profundidade,
      espessura_mm: front.espessura,
      corrediças: DRAWER_SLIDES_PER_DRAWER,
      // Fase 2: linha Gavetas = montagem; madeira já em Painéis.
      custo: montagemPorGavetaEur,
    });
  }
  return rows;
}

function sumCutlistAreaMm2(items: CutListItemComPreco[]): number {
  return items.reduce(
    (total, item) => total + item.dimensoes.largura * item.dimensoes.altura * item.quantidade,
    0
  );
}

function buildPortaRowsFromCutlist(
  boxNome: string,
  doorItems: CutListItemComPreco[],
  portasMeta: Array<{ dobradicas: number }>
): PortaRow[] {
  return doorItems.map((item, index) => ({
    key: `${item.boxId ?? "box"}-${item.id}`,
    boxNome,
    tipo: item.tipo,
    largura_mm: item.dimensoes.largura,
    altura_mm: item.dimensoes.altura,
    espessura_mm: item.espessura,
    dobradicas: portasMeta[index]?.dobradicas ?? 0,
    custo: item.precoTotal,
  }));
}

function buildPortaRowsFromDoorPanels(
  boxId: string,
  boxNome: string,
  doorPanels: Array<{
    id: string;
    tipo: string;
    largura_mm: number;
    altura_mm: number;
    espessura_mm: number;
    custo: number;
  }>,
  portasMeta: Array<{ dobradicas: number }>
): PortaRow[] {
  return doorPanels.map((panel, index) => ({
    key: `${boxId}-${panel.id}`,
    boxNome,
    tipo: panel.tipo,
    largura_mm: panel.largura_mm,
    altura_mm: panel.altura_mm,
    espessura_mm: panel.espessura_mm,
    dobradicas: portasMeta[index]?.dobradicas ?? 0,
    // Material 1× a partir do painel/cutlist — não usar gerarPortas.custo em cima.
    custo: panel.custo,
  }));
}

export function useCutlistData() {
  const { project } = useProject();
  const { componentTypes } = useComponentTypes();
  const { ferragens } = useFerragens();
  const boxes = useMemo(() => project.boxes ?? [], [project.boxes]);

  const resolveFerragemPrecoUnitario = useMemo(() => {
    const byId = new Map(ferragens.map((f) => [f.id, f]));
    const idAliases: Record<string, string[]> = {
      dobradicas: ["dobradica_35mm"],
      corredicas: ["corredica_esq", "corredica_dir"],
      suportes_prateleira: ["suporte_prateleira"],
      pe_plastico: ["pe_plastico"],
      pe_regulavel: ["pe_plastico"],
      parafuso_3x30: ["parafuso_3x30"],
      parafuso_4x35: ["parafuso_4x35"],
      parafuso_5x50: ["parafuso_5x50"],
      puxa_8mm: ["puxa_8mm"],
    };
    const categoryAliases: Record<string, Ferragem["categoria"]> = {
      dobradicas: "dobradica",
      corredicas: "corredica",
      suportes_prateleira: "suporte",
    };

    return (tipo: string): number | null => {
      for (const id of idAliases[tipo] ?? []) {
        const preco = byId.get(id)?.precoUnitario;
        if (typeof preco === "number") return preco;
      }

      const categoria = categoryAliases[tipo];
      if (!categoria) return null;
      const ferragem = ferragens.find((item) => item.categoria === categoria);
      return typeof ferragem?.precoUnitario === "number" ? ferragem.precoUnitario : null;
    };
  }, [ferragens]);

  const ferragensIndustriaisDetalhado = useMemo(
    () => gerarFerragensIndustriais(componentTypes, ferragens),
    [componentTypes, ferragens]
  );
  const ferragensPorComponente = useMemo(
    () => agruparPorComponente(ferragensIndustriaisDetalhado),
    [ferragensIndustriaisDetalhado]
  );

  const aggregated = useMemo(() => {
    let totalAreaMm2 = 0;
    let totalPaineisQty = 0;
    let totalPortasQty = 0;
    let totalGavetasQty = 0;
    let totalFerragensQty = 0;
    let custoTotalPaineis = 0;
    let custoTotalPortas = 0;
    let custoTotalGavetas = 0;
    let custoTotalFerragens = 0;
    const allPaineis: PainelRow[] = [];
    const allPortas: PortaRow[] = [];
    const allGavetas: GavetaRow[] = [];
    const allFerragens: FerragemRow[] = [];
    const allOrlaFerragens: OrlaFerragemRow[] = [];
    const allRemates: RemateRow[] = [];

    const montagemPorGavetaEur = resolveCustoMontagemPorGavetaEur();
    let industrialChapasMode = false;
    try {
      industrialChapasMode =
        getSettings().orcamentos?.custosIndustriais?.materialCostMode === "por_chapas_reais";
    } catch {
      industrialChapasMode = false;
    }

    boxes.forEach((box) => {
      const { profundidadeExternaMm, profundidadeInternaUtilMm } = computeBoxProfundidadeLeituraMm(
        box,
        project.rules
      );
      const modelo = gerarModeloIndustrial(box, project.rules);
      const boxNome = box.nome || box.id;
      const useModernDrawers = boxUsesModernDrawerPipeline(box);

      if (useModernDrawers) {
        const modernCutlist = cutlistComPrecoFromBox(box, project.rules, project.materialId);
        totalAreaMm2 += sumCutlistAreaMm2(modernCutlist);

        const doorItems = modernCutlist.filter((item) => isDoorPieceForAdminCost(item.tipo));
        for (const item of modernCutlist) {
          // Modo chapas: Painéis = só carcaça; porta/gaveta/remate madeira = 0 (nas chapas).
          if (industrialChapasMode) {
            if (!isFallbackCarcassWoodTipo(item.tipo)) continue;
          } else if (!isCarcassPanelForAdminCost(item.tipo)) {
            continue;
          }
          totalPaineisQty += item.quantidade;
          custoTotalPaineis += item.precoTotal;
          allPaineis.push(
            cutlistItemToPainelRow(item, boxNome, profundidadeExternaMm, profundidadeInternaUtilMm)
          );
        }

        // Listagem de fabrico; material já em Painéis — linha financeira Portas = €0 (divisão futura).
        const portaRows = buildPortaRowsFromCutlist(boxNome, doorItems, modelo.portas);
        for (const porta of portaRows) {
          totalPortasQty += 1;
          allPortas.push({ ...porta, custo: 0 });
        }

        const gavetaRows = buildGavetaRowsFromModernCutlist(
          box,
          boxNome,
          modernCutlist,
          montagemPorGavetaEur
        );
        for (const gaveta of gavetaRows) {
          totalGavetasQty += 1;
          custoTotalGavetas += gaveta.custo;
          allGavetas.push(gaveta);
        }
      } else {
        totalAreaMm2 += modelo.cutlist.areaTotal_mm2;
        const doorPanels = modelo.paineis.filter((p) => isDoorPieceForAdminCost(p.tipo));
        modelo.paineis.forEach((p) => {
          if (industrialChapasMode) {
            if (!isFallbackCarcassWoodTipo(p.tipo)) return;
          } else if (!isCarcassPanelForAdminCost(p.tipo)) {
            return;
          }
          totalPaineisQty += p.quantidade;
          custoTotalPaineis += p.custo;
          allPaineis.push({
            ...p,
            key: `${box.id}-${p.id}`,
            boxNome,
            boxProfundidadeExternaMm: profundidadeExternaMm,
            boxProfundidadeInternaUtilMm: profundidadeInternaUtilMm,
          });
        });

        // Listagem de fabrico; material já em Painéis — linha financeira Portas = €0.
        const portaRows = buildPortaRowsFromDoorPanels(box.id, boxNome, doorPanels, modelo.portas);
        for (const porta of portaRows) {
          totalPortasQty += 1;
          allPortas.push({ ...porta, custo: 0 });
        }

        modelo.gavetas.forEach((p) => {
          totalGavetasQty += 1;
          // Fase 2: legado PI — linha Gavetas = montagem; madeira (se existir) já em painéis via cutlist.
          custoTotalGavetas += montagemPorGavetaEur;
          allGavetas.push({ ...p, key: `${box.id}-${p.id}`, boxNome, custo: montagemPorGavetaEur });
        });
      }

      modelo.ferragens.forEach((f) => {
        const precoUnitario = resolveFerragemPrecoUnitario(f.tipo);
        const custo = precoUnitario != null ? precoUnitario * f.quantidade : f.custo;
        totalFerragensQty += f.quantidade;
        custoTotalFerragens += custo;
        allFerragens.push({
          ...f,
          key: `${box.id}-${f.id}`,
          boxNome,
          precoUnitario: precoUnitario ?? (f.quantidade > 0 ? f.custo / f.quantidade : 0),
          custo,
        });
      });
    });

    // Freeagem project-level: juntas + remates (4×35) — não duplicar altura (já em gerarFerragens).
    const juntasPorCaixa = quantidadeParafuso4x35JuntasPorCaixa(boxes, project.workspaceBoxes);
    for (const [boxId, qty] of juntasPorCaixa) {
      if (qty <= 0) continue;
      const box = boxes.find((b) => b.id === boxId);
      const boxNome = box?.nome || boxId;
      const custo = PARAFUSO_4X35_PRECO * qty;
      totalFerragensQty += qty;
      custoTotalFerragens += custo;
      allFerragens.push({
        key: `${boxId}-junta-${PARAFUSO_4X35_ID}`,
        boxNome,
        tipo: PARAFUSO_4X35_ID,
        quantidade: qty,
        precoUnitario: PARAFUSO_4X35_PRECO,
        custo,
      });
    }
    for (const remate of project.remates ?? []) {
      const qty = quantidadeParafuso4x35PorRemate(remate);
      if (qty <= 0) continue;
      const box = boxes.find((b) => b.id === remate.parentBoxId);
      const boxNome = box?.nome ?? remate.parentBoxId ?? "Remates";
      const custo = PARAFUSO_4X35_PRECO * qty;
      totalFerragensQty += qty;
      custoTotalFerragens += custo;
      allFerragens.push({
        key: `${remate.id}-${PARAFUSO_4X35_ID}`,
        boxNome,
        tipo: PARAFUSO_4X35_ID,
        quantidade: qty,
        precoUnitario: PARAFUSO_4X35_PRECO,
        custo,
      });
    }

    (project.ferragemOrla?.linhas ?? []).forEach((linha) => {
      allOrlaFerragens.push({
        key: linha.id,
        boxNome: linha.boxNome ?? "—",
        presetNome: linha.presetNome,
        metros: linha.metros,
        custo: linha.custo,
        tipo: linha.tipo,
        pieceNome: linha.pieceNome,
      });
    });

    const remateBoxNameById: Record<string, string> = {};
    for (const b of boxes) {
      if (b?.id) remateBoxNameById[b.id] = typeof b.nome === "string" ? b.nome : b.id;
    }

    (project.remates ?? []).forEach((remate) => {
      const box = boxes.find((b) => b.id === remate.parentBoxId);
      allRemates.push({
        key: remate.id,
        boxNome: box?.nome ?? remate.parentBoxId ?? "Standalone",
        nome: resolveRematePieceNomeForRemate(remate, remateBoxNameById),
        material: remate.materialPresetId,
        largura_mm: remate.width,
        altura_mm: remate.height,
        profundidade_mm: remate.depth,
        quantidade: 1,
        // Modo industrial: madeira nas chapas — sem preço próprio de remate.
        custo: industrialChapasMode
          ? 0
          : project.cutListComPreco?.find((item) => item.id === remate.id)?.precoTotal ?? 0,
      });
    });

    const totalPecas = totalPaineisQty + totalPortasQty;
    const totalOrlaMetros = allOrlaFerragens.reduce((s, l) => s + l.metros, 0);
    const custoTotalOrla = allOrlaFerragens.reduce((s, l) => s + l.custo, 0);
    const custoTotalRemates = allRemates.reduce((s, l) => s + l.custo, 0);
    const totalAreaM2 = totalAreaMm2 / 1_000_000;
    const custoTotal =
      custoTotalPaineis + custoTotalPortas + custoTotalGavetas + custoTotalFerragens + custoTotalOrla + custoTotalRemates;

    return {
      boxes,
      allPaineis,
      allPortas,
      allGavetas,
      allFerragens,
      allOrlaFerragens,
      allRemates,
      ferragensIndustriaisDetalhado,
      ferragensPorComponente,
      totalAreaMm2,
      totalAreaM2,
      totalPaineisQty,
      totalPortasQty,
      totalGavetasQty,
      totalFerragensQty,
      totalPecas,
      custoTotalPaineis,
      custoTotalPortas,
      custoTotalGavetas,
      custoTotalFerragens,
      totalOrlaMetros,
      custoTotalOrla,
      custoTotalRemates,
      custoTotal,
    };
  }, [boxes, project.rules, project.materialId, project.ferragemOrla, project.remates, project.workspaceBoxes, project.cutListComPreco, ferragensIndustriaisDetalhado, ferragensPorComponente, resolveFerragemPrecoUnitario]);

  return aggregated;
}
