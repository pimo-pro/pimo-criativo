/**
 * Motor de Layout de Corte — versão PRO.
 * Agrupamento por material + espessura, rotação, melhor encaixe simples.
 */

import type {
  CutPiece,
  CutPlacement,
  SheetDefinition,
  SheetResult,
  CutLayoutResult,
} from "./cutLayoutTypes";

const DEFAULT_KERF_MM = 3;

export type CutLayoutEngineOptions = {
  sheetLargura_mm?: number;
  sheetAltura_mm?: number;
  kerf_mm?: number;
};

/** Converte cutlist em peças 2D (face = duas maiores dimensões). */
export function cutlistToPieces(
  items: Array<{
    dimensoes: { largura: number; altura: number; profundidade: number };
    espessura: number;
    quantidade: number;
    boxId?: string;
    nome: string;
    material?: string;
    materialId?: string;
    grainDirection?: "length" | "width";
  }>
): CutPiece[] {
  return items.flatMap((item) => {
    const dims = [item.dimensoes.largura, item.dimensoes.altura, item.dimensoes.profundidade]
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.max(n, 1))
      .sort((a, b) => b - a);
    const largura = dims[0] ?? 1;
    const altura = dims[1] ?? 1;
    const esp = item.espessura ?? 19;
    const pieces: CutPiece[] = [];
    for (let i = 0; i < item.quantidade; i++) {
      pieces.push({
        largura_mm: largura,
        altura_mm: altura,
        espessura_mm: esp,
        quantidade: 1,
        boxId: item.boxId ?? "",
        partName: item.nome,
        materialId: item.materialId ?? item.material,
        materialName: item.material,
        grainDirection: item.grainDirection,
      });
    }
    return pieces;
  });
}

function expandPieces(pieces: CutPiece[]): CutPiece[] {
  const out: CutPiece[] = [];
  for (const p of pieces) {
    for (let i = 0; i < (p.quantidade ?? 1); i++) {
      out.push({ ...p, quantidade: 1 });
    }
  }
  return out;
}

function groupByMaterialAndThickness(pieces: CutPiece[]): Map<string, CutPiece[]> {
  const map = new Map<string, CutPiece[]>();
  for (const p of pieces) {
    const key = `${p.materialId ?? "material"}|${p.espessura_mm}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

type SheetState = {
  cursorX: number;
  cursorY: number;
  rowHeight: number;
};

const initialState = (): SheetState => ({ cursorX: 0, cursorY: 0, rowHeight: 0 });

export function tryPlacePiece(
  width: number,
  height: number,
  state: SheetState,
  sheet: SheetDefinition,
  kerf: number,
  piece: CutPiece,
  rotation: number,
  sheetIndex: number
): { placement: CutPlacement; newState: SheetState } | null {
  let cursorX = state.cursorX;
  let cursorY = state.cursorY;
  let rowHeight = state.rowHeight;

  const extraKerf = cursorX > 0 ? kerf : 0;
  const fitsCurrentRow =
    cursorX + extraKerf + width <= sheet.largura_mm && cursorY + height <= sheet.altura_mm;
  if (fitsCurrentRow) {
    const x = cursorX + extraKerf;
    const placement: CutPlacement = {
      x_mm: x,
      y_mm: cursorY,
      largura_mm: width,
      altura_mm: height,
      rotacao: rotation,
      sheetIndex,
      boxId: piece.boxId,
      partName: piece.partName,
      materialId: piece.materialId,
      materialName: piece.materialName,
    };
    const newState: SheetState = {
      cursorX: x + width,
      cursorY,
      rowHeight: Math.max(rowHeight, height),
    };
    return { placement, newState };
  }

  const newY = cursorY + rowHeight + (rowHeight > 0 ? kerf : 0);
  if (newY + height <= sheet.altura_mm) {
    const placement: CutPlacement = {
      x_mm: 0,
      y_mm: newY,
      largura_mm: width,
      altura_mm: height,
      rotacao: rotation,
      sheetIndex,
      boxId: piece.boxId,
      partName: piece.partName,
      materialId: piece.materialId,
      materialName: piece.materialName,
    };
    const newState: SheetState = {
      cursorX: width,
      cursorY: newY,
      rowHeight: height,
    };
    return { placement, newState };
  }

  return null;
}

function placePieceOnSheet(
  piece: CutPiece,
  sheet: SheetDefinition,
  state: SheetState,
  kerf: number,
  sheetIndex: number
): { placement: CutPlacement; newState: SheetState } | null {
  const rotationAllowed = !piece.grainDirection;
  const orientations: Array<{ width: number; height: number; rotation: number }> = [
    { width: piece.largura_mm, height: piece.altura_mm, rotation: 0 },
  ];
  if (rotationAllowed) {
    orientations.push({ width: piece.altura_mm, height: piece.largura_mm, rotation: 90 });
  }

  for (const orient of orientations) {
    const attempt = tryPlacePiece(orient.width, orient.height, state, sheet, kerf, piece, orient.rotation, sheetIndex);
    if (attempt) return attempt;
  }
  return null;
}

export function runCutLayout(
  pieces: CutPiece[],
  sheetDef: SheetDefinition,
  options?: CutLayoutEngineOptions
): CutLayoutResult {
  const kerf = options?.kerf_mm ?? DEFAULT_KERF_MM;
  const expanded = expandPieces(pieces);
  const grouped = groupByMaterialAndThickness(expanded);

  const sheets: SheetResult[] = [];

  for (const [key, groupPieces] of grouped) {
    const sortedPieces = [...groupPieces].sort(
      (a, b) => b.largura_mm * b.altura_mm - a.largura_mm * a.altura_mm
    );
    let state = initialState();
    let placements: CutPlacement[] = [];
    let sheetIndex = 0;

    const [materialId, espStr] = key.split("|");
    const sheet: SheetDefinition = {
      largura_mm: options?.sheetLargura_mm ?? sheetDef.largura_mm,
      altura_mm: options?.sheetAltura_mm ?? sheetDef.altura_mm,
      espessura_mm: Number(espStr) || sheetDef.espessura_mm,
      materialId: materialId !== "material" ? materialId : sheetDef.materialId,
      materialName: groupPieces[0]?.materialName ?? sheetDef.materialName,
    };

    const finalizeSheet = () => {
      if (placements.length === 0) return;
      sheets.push({
        sheet: { ...sheet },
        placements,
      });
      placements = [];
    };

    for (const piece of sortedPieces) {
      const attempt = placePieceOnSheet(piece, sheet, state, kerf, sheetIndex);
      if (attempt) {
        state = attempt.newState;
        placements.push(attempt.placement);
        continue;
      }
      finalizeSheet();
      sheetIndex++;
      state = initialState();
      const retry = placePieceOnSheet(piece, sheet, state, kerf, sheetIndex);
      if (retry) {
        state = retry.newState;
        placements.push(retry.placement);
        continue;
      }
      console.warn("Peça excede dimensões da chapa:", piece);
    }

    finalizeSheet();
  }

  return { sheets };
}
