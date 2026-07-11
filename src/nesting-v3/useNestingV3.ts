/**
 * Nesting V3 — Hook de estado da sessão.
 * Toda a lógica de estado está aqui. A UI só chama as acções.
 */

import { useCallback, useEffect, useState } from "react";
import type {
  NestingV3State,
  V3Piece,
  V3Sheet,
  V3DragState,
  V3PiecesByProject,
} from "./nestingV3Types";
import { runNestingV3AutoLayout, getPieceColor } from "./nestingV3Engine";
import type { CutPiece } from "../core/cutlayout/cutLayoutTypes";
import { loadNestingV3SettingsFromGlobal, type NestingV3Settings, allowRotationForPiece } from "./nestingV3Settings";
import { buildInitialSheetsForPieces, cloneDefaultSheet, defaultSheetFromSettings } from "./nestingSheetsFactory";
import { findValidPlacement } from "./nestingV3Placement";
import { isMaterialMadeira } from "../core/materials/nestingGrainLock";
import {
  readRotationSnapIndexFromMetadata,
  resolveV3RotationFromIndustrialMetadata,
} from "../core/remate/remateIndustrialMetadata";
import type { RemateFaceOffsets } from "../core/remate/rematePieceTypes";
import { copyHolesLocalInvariant } from "../core/cutlayout/utils/holeGeomInvariant";
import { filterHingeHolesLocalBeforeInvariant } from "../modules/drilling/hingeOffsetUtils";
import { filterDoorHolesLocalBeforeInvariant } from "../modules/drilling/doorDrillingUtils";
import { isIndustrialDoorPanelTipo } from "../core/doors/industrialDoorPanels";

function makeDefaultState(): NestingV3State {
  const settings = loadNestingV3SettingsFromGlobal();
  return {
    sheets: [defaultSheetFromSettings(settings)],
    pieces: [],
    placements: [],
    unplacedPieceIds: [],
    settings,
    kerfMm: settings.kerfMm,
    activeSheetIndex: 0,
  };
}

function stateFromV3Pieces(pieces: V3Piece[]): NestingV3State {
  const settings = loadNestingV3SettingsFromGlobal();
  const sheets = buildInitialSheetsForPieces(pieces, settings);
  return {
    sheets,
    pieces,
    placements: [],
    unplacedPieceIds: pieces.map((piece) => piece.id),
    settings,
    kerfMm: settings.kerfMm,
    activeSheetIndex: 0,
  };
}

let _pieceIdCounter = 1;
function nextPieceId() { return `v3p-${_pieceIdCounter++}`; }

// ── Converter CutPiece → V3Piece ──────────────────────────────────────────────

export function cutPieceToV3(
  cp: CutPiece,
  index: number,
  options?: {
    allowPieceRotation?: boolean;
    lockWoodGrain?: boolean;
    rotationSnapIndex?: 0 | 1 | 2 | 3;
  }
): V3Piece {
  const mappedHoles = (cp.drillHoles ?? cp.holes ?? []).map((h) => ({
    x: h.x,
    y: h.y,
    diameter: h.diameter,
    depth: h.depth,
    holeType: h.holeType,
    topDrillable: h.topDrillable,
  }));
  const preInvariant = isIndustrialDoorPanelTipo(cp.pieceTipo ?? "")
    ? filterDoorHolesLocalBeforeInvariant(
        mappedHoles,
        cp.largura_mm,
        cp.altura_mm,
        cp.pieceTipo,
        "cutPieceToV3",
        String(cp.metadata?.v3PieceId ?? cp.partName ?? "")
      )
    : filterHingeHolesLocalBeforeInvariant(
        mappedHoles,
        cp.largura_mm,
        cp.altura_mm,
        "cutPieceToV3",
        String(cp.metadata?.v3PieceId ?? cp.partName ?? "")
      );
  const holes = copyHolesLocalInvariant(preInvariant, cp.largura_mm, cp.altura_mm) ?? [];
  const metaAllow = cp.metadata?.allowPieceRotation;
  const metaLock = cp.metadata?.lockWoodGrain;
  const allowPieceRotation =
    options?.allowPieceRotation ??
    (metaAllow === true ? true : metaAllow === false ? false : undefined);
  const lockWoodGrain =
    options?.lockWoodGrain ??
    (metaLock === true
      ? true
      : metaLock === false
        ? false
        : isMaterialMadeira(cp.materialId)
          ? true
          : undefined);
  const meta = cp.metadata ?? {};
  const rotationSnapIndex =
    options?.rotationSnapIndex ?? readRotationSnapIndexFromMetadata(meta);
  const rotationResolved = resolveV3RotationFromIndustrialMetadata({
    rotationSnapIndex,
    materialId: cp.materialId,
    industrialGrainCode: cp.industrialGrainCode,
    pieceTipo: cp.pieceTipo,
    allowPieceRotation,
    lockWoodGrain,
  });
  const faceOffsets = meta.faceOffsets as RemateFaceOffsets | undefined;
  const remateId = typeof meta.remateId === "string" ? meta.remateId : undefined;
  const remateKind = typeof meta.remateKind === "string" ? meta.remateKind : undefined;
  const partIndex =
    meta.partIndex === 1 || meta.partIndex === 2 ? meta.partIndex : undefined;
  const followBox = meta.followBox === true ? true : meta.followBox === false ? false : undefined;
  const placementMode =
    meta.placementMode === "SNAPPED" || meta.placementMode === "FREE"
      ? meta.placementMode
      : undefined;
  return {
    id: nextPieceId(),
    name: cp.partName,
    widthMm: cp.largura_mm,
    heightMm: cp.altura_mm,
    thicknessMm: cp.espessura_mm,
    materialId: cp.materialId,
    materialName: cp.materialName,
    originalHoles: holes,
    rotation: rotationResolved.rotation,
    color: getPieceColor(cp.materialId, index),
    sourceBoxId: cp.boxId,
    industrialGrainCode: cp.industrialGrainCode,
    pieceTipo: cp.pieceTipo,
    allowPieceRotation,
    lockWoodGrain,
    remateId,
    partIndex,
    remateKind,
    followBox,
    placementMode,
    rotationSnapIndex: rotationResolved.rotationSnapIndex,
    faceOffsets,
  };
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useNestingV3(initialCutPieces: CutPiece[] = []) {
  const [state, setState] = useState<NestingV3State>(() => {
    const base = makeDefaultState();
    if (initialCutPieces.length === 0) return base;
    const pieces: V3Piece[] = [];
    let idx = 0;
    for (const cp of initialCutPieces) {
      const qty = cp.quantidade ?? 1;
      for (let q = 0; q < qty; q++) {
        pieces.push(cutPieceToV3(cp, idx++));
      }
    }
    return { ...stateFromV3Pieces(pieces) };
  });

  const [dragState, setDragState] = useState<V3DragState | null>(null);

  const loadPieces = useCallback((pieces: V3Piece[]) => {
    setState(stateFromV3Pieces(pieces));
    setDragState(null);
  }, []);

  const loadMultipleProjects = useCallback((_piecesByProject: V3PiecesByProject) => {
    /* preparado para fase multi-projeto */
  }, []);

  const assignProjectColor = useCallback((_projectId: string) => {
    return undefined as string | undefined;
  }, []);

  const generateOutputsGroupedByProject = useCallback(() => {
    return undefined;
  }, []);

  useEffect(() => {
    if (initialCutPieces.length === 0) return;
    const pieces: V3Piece[] = [];
    let idx = 0;
    for (const cp of initialCutPieces) {
      const qty = cp.quantidade ?? 1;
      for (let q = 0; q < qty; q++) pieces.push(cutPieceToV3(cp, idx++));
    }
    loadPieces(pieces);
  }, [initialCutPieces, loadPieces]);

  // ── Auto-layout ─────────────────────────────────────────────────────────────

  const runAutoLayout = useCallback(() => {
    setState((prev) => {
      const result = runNestingV3AutoLayout(prev.pieces, prev.sheets, prev.settings);
      const template = prev.sheets[0] ?? defaultSheetFromSettings(prev.settings);
      let newSheets = result.sheets ?? [...prev.sheets];
      if (!result.sheets) {
        while (newSheets.length < result.sheetsUsed) {
          newSheets.push(cloneDefaultSheet(newSheets.length, template));
        }
      }
      const nextPieces =
        result.pieces ??
        prev.pieces.map((piece) => {
          const rotated = result.placements.some(
            (pl) => pl.pieceId === piece.id && pl.rotated === true
          );
          const placed = result.placements.some((pl) => pl.pieceId === piece.id);
          if (!placed) return piece;
          if (!allowRotationForPiece(piece, prev.settings)) return piece;
          return { ...piece, rotation: rotated ? 90 : piece.rotation };
        });
      return {
        ...prev,
        sheets: newSheets,
        pieces: nextPieces,
        placements: result.placements,
        unplacedPieceIds: result.unplacedPieceIds,
      };
    });
  }, []);

  // ── Move piece on sheet (com validação de overlap) ───────────────────────────

  const movePiece = useCallback((
    pieceId: string,
    sheetIndex: number,
    xMm: number,
    yMm: number
  ): boolean => {
    let accepted = false;
    setState((prev) => {
      const piece = prev.pieces.find((p) => p.id === pieceId);
      const sheet = prev.sheets[sheetIndex];
      if (!piece || !sheet) return prev;

      const valid = findValidPlacement(
        pieceId, sheetIndex, xMm, yMm,
        piece, sheet, prev.placements, prev.pieces, prev.settings
      );
      if (!valid) return prev;

      accepted = true;
      const placements = prev.placements.filter((p) => p.pieceId !== pieceId);
      placements.push({ pieceId, sheetIndex, xMm: valid.xMm, yMm: valid.yMm });
      const unplaced = prev.unplacedPieceIds.filter((id) => id !== pieceId);
      return { ...prev, placements, unplacedPieceIds: unplaced };
    });
    return accepted;
  }, []);

  // ── Remove from sheet → back to sidebar ────────────────────────────────────

  const returnToSidebar = useCallback((pieceId: string) => {
    setState((prev) => ({
      ...prev,
      placements: prev.placements.filter((p) => p.pieceId !== pieceId),
      unplacedPieceIds: prev.unplacedPieceIds.includes(pieceId)
        ? prev.unplacedPieceIds
        : [...prev.unplacedPieceIds, pieceId],
    }));
  }, []);

  // ── Rotate piece ────────────────────────────────────────────────────────────

  const rotatePiece = useCallback((pieceId: string) => {
    setState((prev) => {
      const placement = prev.placements.find((p) => p.pieceId === pieceId);
      const piece = prev.pieces.find((p) => p.id === pieceId);
      if (!piece) return prev;
      if (!allowRotationForPiece(piece, prev.settings)) return prev;

      const nextRotation = ((piece.rotation + 90) % 360) as 0 | 90 | 180 | 270;
      const rotatedPiece = { ...piece, rotation: nextRotation };

      if (!placement) {
        return {
          ...prev,
          pieces: prev.pieces.map((p) => (p.id === pieceId ? rotatedPiece : p)),
        };
      }

      const sheet = prev.sheets[placement.sheetIndex];
      if (!sheet) return prev;

      const valid = findValidPlacement(
        pieceId, placement.sheetIndex, placement.xMm, placement.yMm,
        rotatedPiece, sheet, prev.placements, prev.pieces, prev.settings
      );

      const placements = prev.placements.map((p) =>
        p.pieceId === pieceId && valid
          ? { ...p, xMm: valid.xMm, yMm: valid.yMm }
          : p
      );

      return {
        ...prev,
        pieces: prev.pieces.map((p) => (p.id === pieceId ? rotatedPiece : p)),
        placements: valid ? placements : prev.placements.filter((p) => p.pieceId !== pieceId),
        unplacedPieceIds: valid
          ? prev.unplacedPieceIds.filter((id) => id !== pieceId)
          : [...new Set([...prev.unplacedPieceIds, pieceId])],
      };
    });
  }, []);

  // ── Move piece to different sheet ──────────────────────────────────────────

  const movePieceToSheet = useCallback((pieceId: string, targetSheetIndex: number) => {
    setState((prev) => {
      const piece = prev.pieces.find((p) => p.id === pieceId);
      const sheet = prev.sheets[targetSheetIndex];
      if (!piece || !sheet) return prev;

      const valid = findValidPlacement(
        pieceId, targetSheetIndex, prev.settings.marginMm, prev.settings.marginMm,
        piece, sheet, prev.placements, prev.pieces, prev.settings
      );
      if (!valid) return prev;

      const placements = prev.placements
        .filter((p) => p.pieceId !== pieceId)
        .concat({ pieceId, sheetIndex: targetSheetIndex, xMm: valid.xMm, yMm: valid.yMm });
      const unplaced = prev.unplacedPieceIds.filter((id) => id !== pieceId);
      return { ...prev, placements, unplacedPieceIds: unplaced, activeSheetIndex: targetSheetIndex };
    });
  }, []);

  // ── Add piece manually ──────────────────────────────────────────────────────

  const addManualPiece = useCallback((
    name: string,
    widthMm: number,
    heightMm: number,
    thicknessMm: number
  ) => {
    setState((prev) => {
      const piece: V3Piece = {
        id: nextPieceId(),
        name: name || `Peça ${prev.pieces.length + 1}`,
        widthMm,
        heightMm,
        thicknessMm,
        originalHoles: [],
        rotation: 0,
        color: getPieceColor(undefined, prev.pieces.length),
      };
      return {
        ...prev,
        pieces: [...prev.pieces, piece],
        unplacedPieceIds: [...prev.unplacedPieceIds, piece.id],
      };
    });
  }, []);

  // ── Remove piece entirely ───────────────────────────────────────────────────

  const removePiece = useCallback((pieceId: string) => {
    setState((prev) => ({
      ...prev,
      pieces: prev.pieces.filter((p) => p.id !== pieceId),
      placements: prev.placements.filter((p) => p.pieceId !== pieceId),
      unplacedPieceIds: prev.unplacedPieceIds.filter((id) => id !== pieceId),
    }));
  }, []);

  // ── Add / remove sheets ─────────────────────────────────────────────────────

  const addSheet = useCallback(() => {
    setState((prev) => {
      const template = prev.sheets[prev.activeSheetIndex] ?? defaultSheetFromSettings(prev.settings);
      return {
        ...prev,
        sheets: [...prev.sheets, cloneDefaultSheet(prev.sheets.length, template)],
      };
    });
  }, []);

  const removeSheet = useCallback((sheetIndex: number) => {
    setState((prev) => {
      const piecesOnSheet = prev.placements
        .filter((p) => p.sheetIndex === sheetIndex)
        .map((p) => p.pieceId);
      return {
        ...prev,
        sheets: prev.sheets.filter((_, i) => i !== sheetIndex).map((s, i) => ({ ...s, index: i })),
        placements: prev.placements.filter((p) => p.sheetIndex !== sheetIndex).map((p) =>
          p.sheetIndex > sheetIndex ? { ...p, sheetIndex: p.sheetIndex - 1 } : p
        ),
        unplacedPieceIds: [...new Set([...prev.unplacedPieceIds, ...piecesOnSheet])],
        activeSheetIndex: Math.min(prev.activeSheetIndex, Math.max(0, prev.sheets.length - 2)),
      };
    });
  }, []);

  const setActiveSheet = useCallback((idx: number) => {
    setState((prev) => ({ ...prev, activeSheetIndex: idx }));
  }, []);

  const setKerfMm = useCallback((v: number) => {
    setState((prev) => ({
      ...prev,
      kerfMm: v,
      settings: { ...prev.settings, kerfMm: v },
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<NestingV3Settings>) => {
    setState((prev) => {
      const settings = { ...prev.settings, ...patch };
      return {
        ...prev,
        settings,
        kerfMm: settings.kerfMm,
      };
    });
  }, []);

  const updateSheet = useCallback((idx: number, patch: Partial<V3Sheet>) => {
    setState((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => s.index === idx ? { ...s, ...patch } : s),
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      placements: [],
      unplacedPieceIds: prev.pieces.map((p) => p.id),
    }));
  }, []);

  const focusPiece = useCallback((pieceId: string) => {
    setState((prev) => {
      const placement = prev.placements.find((p) => p.pieceId === pieceId);
      if (!placement) return prev;
      return { ...prev, activeSheetIndex: placement.sheetIndex };
    });
  }, []);

  return {
    state,
    dragState,
    setDragState,
    loadPieces,
    loadMultipleProjects,
    assignProjectColor,
    generateOutputsGroupedByProject,
    runAutoLayout,
    movePiece,
    returnToSidebar,
    rotatePiece,
    movePieceToSheet,
    addManualPiece,
    removePiece,
    addSheet,
    removeSheet,
    setActiveSheet,
    setKerfMm,
    updateSettings,
    updateSheet,
    clearAll,
    focusPiece,
  };
}
