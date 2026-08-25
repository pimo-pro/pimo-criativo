/**
 * Nesting V3 → etiquetas oficiais (UnifiedEtiquetaEngine / LabelSystemV5).
 * Substitui o PDF auxiliar `nestingV3Labels.ts`.
 */

import type { ProjectState } from "../context/projectTypes";
import type { BoxModule, CutListItemComPreco } from "../core/types";
import { getUeeItems } from "../core/industrial/IndustrialCenter";
import { UnifiedEtiquetaEngine } from "../core/etiquetas";
import { getSettings } from "../core/settings/settingsService";
import { resolvePieceToken } from "../core/naming/industrialNaming";
import { fixedPlacementsFromV3State } from "../core/cutlayout/integration/fixedPlacementsAdapter";
import type { NestingV3State, V3Piece } from "./nestingV3Types";

function dimsMatch(
  w1: number,
  h1: number,
  w2: number,
  h2: number,
  tol = 1.5
): boolean {
  return (
    (Math.abs(w1 - w2) <= tol && Math.abs(h1 - h2) <= tol) ||
    (Math.abs(w1 - h2) <= tol && Math.abs(h1 - w2) <= tol)
  );
}

function expandCutlistPool(items: CutListItemComPreco[]): CutListItemComPreco[] {
  const pool: CutListItemComPreco[] = [];
  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantidade) || 1));
    for (let i = 0; i < qty; i++) {
      pool.push({
        ...item,
        quantidade: 1,
        id: qty > 1 ? `${item.id}__q${i + 1}` : item.id,
      });
    }
  }
  return pool;
}

/** Encontra o item cutlist correspondente à peça V3 (box + tipo/nome + dimensões). */
export function matchV3PieceToCutlistItem(
  piece: V3Piece,
  pool: CutListItemComPreco[]
): number {
  const boxId = String(piece.sourceBoxId ?? "").trim();
  const name = String(piece.name ?? "").trim();
  const tipo = String(piece.pieceTipo ?? "").trim();
  const nameLower = name.toLowerCase();
  const tokenFromTipo = tipo ? resolvePieceToken(tipo).toLowerCase() : "";

  let bestSoft = -1;
  for (let i = 0; i < pool.length; i++) {
    const it = pool[i]!;
    if (boxId && String(it.boxId ?? "") !== boxId) continue;

    const itNome = String(it.nome ?? "");
    const itTipo = String(it.tipo ?? "");
    const dimsOk = dimsMatch(
      piece.widthMm,
      piece.heightMm,
      it.dimensoes.largura,
      it.dimensoes.altura
    );

    if (tipo && itTipo === tipo && dimsOk) return i;
    if (name && (itNome === name || itTipo === name) && dimsOk) return i;

    const itToken = resolvePieceToken(itTipo || itNome).toLowerCase();
    if (
      itToken &&
      (nameLower === itToken ||
        nameLower.endsWith(`_${itToken}`) ||
        (tokenFromTipo && tokenFromTipo === itToken))
    ) {
      if (dimsOk) return i;
      if (bestSoft < 0) bestSoft = i;
    }

    if (tipo && itTipo === tipo && bestSoft < 0) bestSoft = i;
    if (boxId && !tipo && !name && dimsOk && bestSoft < 0) bestSoft = i;
  }
  return bestSoft;
}

function syntheticItemFromV3Piece(piece: V3Piece): CutListItemComPreco {
  return {
    id: piece.id,
    nome: piece.name || piece.pieceTipo || "peca",
    tipo: piece.pieceTipo || piece.name || "peca",
    quantidade: 1,
    dimensoes: {
      largura: piece.widthMm,
      altura: piece.heightMm,
      profundidade: piece.thicknessMm,
    },
    espessura: piece.thicknessMm,
    material: piece.materialName ?? "—",
    materialId: piece.materialId,
    boxId: piece.sourceBoxId ?? "manual",
    precoUnitario: 0,
    precoTotal: 0,
  };
}

export type NestingV3OfficialLabelsInput = {
  state: NestingV3State;
  project: Pick<
    ProjectState,
    | "projectName"
    | "boxes"
    | "rules"
    | "materialId"
    | "extractedPartsByBoxId"
    | "industrialPieceEdits"
    | "remates"
    | "rodapes"
    | "pieceObservacoes"
    | "industrialDocumentOverrides"
  >;
  projectName?: string;
};

/**
 * Constrói itens + placements para o UEE a partir do layout V3 colocado.
 */
export function buildNestingV3EtiquetaPayload(input: NestingV3OfficialLabelsInput): {
  items: CutListItemComPreco[];
  placements: Array<{
    partName: string;
    boxId: string;
    sheetIndex: number;
    x_mm: number;
    y_mm: number;
  }>;
  projectName: string;
  boxes: BoxModule[];
} {
  const projectName =
    String(input.projectName ?? input.project.projectName ?? "Projeto").trim() || "Projeto";
  const boxes = (input.project.boxes ?? []) as BoxModule[];
  const cncItems = getUeeItems(input.project as ProjectState);
  const pool = expandCutlistPool(cncItems);

  const { result } = fixedPlacementsFromV3State(input.state);
  const items: CutListItemComPreco[] = [];
  const placements: Array<{
    partName: string;
    boxId: string;
    sheetIndex: number;
    x_mm: number;
    y_mm: number;
  }> = [];

  for (const sheetResult of result.sheets) {
    for (const pl of sheetResult.placements) {
      const v3Id = String(
        (pl.metadata as { v3PieceId?: string } | undefined)?.v3PieceId ?? ""
      );
      const piece =
        (v3Id ? input.state.pieces.find((p) => p.id === v3Id) : undefined) ??
        input.state.pieces.find(
          (p) =>
            (p.sourceBoxId ?? "manual") === (pl.boxId ?? "") &&
            p.name === pl.partName
        );

      let item: CutListItemComPreco;
      if (piece) {
        const idx = matchV3PieceToCutlistItem(piece, pool);
        if (idx >= 0) {
          item = pool.splice(idx, 1)[0]!;
        } else {
          item = syntheticItemFromV3Piece(piece);
        }
      } else {
        item = {
          id: `orphan-${placements.length}`,
          nome: pl.partName || "peca",
          tipo: pl.partName || "peca",
          quantidade: 1,
          dimensoes: {
            largura: pl.largura_mm,
            altura: pl.altura_mm,
            profundidade: pl.espessura_mm ?? 18,
          },
          espessura: pl.espessura_mm ?? 18,
          material: pl.materialName ?? "—",
          materialId: pl.materialId,
          boxId: pl.boxId ?? "manual",
          precoUnitario: 0,
          precoTotal: 0,
        };
      }

      items.push(item);
      placements.push({
        partName: item.nome,
        boxId: item.boxId ?? pl.boxId ?? "",
        sheetIndex: pl.sheetIndex,
        x_mm: pl.x_mm,
        y_mm: pl.y_mm,
      });
    }
  }

  return { items, placements, projectName, boxes };
}

/** Gera o PDF oficial de etiquetas (UEE / LabelSystemV5). */
export async function buildNestingV3OfficialLabelsPdf(
  input: NestingV3OfficialLabelsInput
): Promise<import("jspdf").default> {
  const { items, placements, projectName, boxes } = buildNestingV3EtiquetaPayload(input);
  if (items.length === 0) {
    throw new Error("Nenhuma peça colocada para gerar etiquetas.");
  }
  return UnifiedEtiquetaEngine.build({
    projectName,
    boxes,
    rules: input.project.rules,
    materialId: input.project.materialId,
    settings: getSettings(),
    precomputedItems: items,
    cutLayoutPlacements: placements,
    pieceObservacoes: input.project.pieceObservacoes,
    labelSystemV5: input.project.rules.labelSystemV5,
  });
}

/** Download do PDF oficial de etiquetas a partir do Nesting V3. */
export async function downloadNestingV3OfficialLabels(
  input: NestingV3OfficialLabelsInput
): Promise<void> {
  const doc = await buildNestingV3OfficialLabelsPdf(input);
  const slug = (input.projectName ?? input.project.projectName ?? "Projeto")
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
  doc.save(`${slug || "Projeto"}_etiquetas.pdf`);
}
