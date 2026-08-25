import { applyResultados } from "@/context/projectState";
import { reviveState } from "@/context/projectPersistence";
import { buildProjetosPagePath, toProjetosPageSlug } from "@/app/PROJETOS/projetosPageSlug";
import {
  buildProjetosFocusCatalog,
  resolveProjetosFocusFromSegments,
} from "@/app/PROJETOS/projetosFocusSlug";
import { buildEtiquetaCodeV5 } from "@/core/etiquetas/qr/etiquetaCodeV5";
import { resolveNomeIndustrialForEtiqueta } from "@/core/etiquetas/industrialDisplayName";
import { resolveAuthoritativeLabelNumber } from "@/core/qrcode/panelLabelNumber";
import { buildCutlistItemsForIndustrialExport } from "@/core/fabrication/buildCutlistItemsForIndustrialExport";
import type { SavedProjectRecord } from "@/core/projects/types";
import type { CutListItemComPreco } from "@/core/types";

import type { ProjetosIndustrialRef } from "./types";

function reviveRecordState(record: SavedProjectRecord) {
  const revived = reviveState(record.snapshot?.projectState);
  if (!revived) return null;
  return applyResultados(revived);
}

function findCutlistItem(
  record: SavedProjectRecord,
  pieceId: string
): CutListItemComPreco | null {
  const state = reviveRecordState(record);
  if (!state) return null;

  const fromState = Array.isArray(state.cutList) ? state.cutList : [];
  const found = fromState.find((item) => item.id === pieceId);
  if (found) return found as CutListItemComPreco;

  const exported = buildCutlistItemsForIndustrialExport({
    boxes: state.boxes ?? [],
    rules: state.rules,
    materialId: state.materialId,
    projectName: record.name,
    remates: state.remates ?? [],
    rodapes: state.rodapes ?? [],
    extractedPartsByBoxId: state.extractedPartsByBoxId,
  });
  return (exported.find((item) => item.id === pieceId) as CutListItemComPreco | undefined) ?? null;
}

export function resolveProjetosIndustrialRef(
  record: SavedProjectRecord | null,
  pageSlug?: string,
  boxSegment?: string,
  pieceSegment?: string
): ProjetosIndustrialRef | null {
  if (!record) return null;

  const projectName = record.name?.trim() || "Projeto";
  const projectPageSlug = pageSlug?.trim() || toProjetosPageSlug(projectName);
  const focus = resolveProjetosFocusFromSegments(record, boxSegment, pieceSegment);
  const catalog = buildProjetosFocusCatalog(record);

  let etiquetaCode: string | null = null;
  let qrPayload: string | null = null;

  if (focus.pieceId) {
    const row = catalog?.rows.find((r) => r.pieceId === focus.pieceId);
    etiquetaCode = row?.industrialName ?? focus.pieceSlug ?? null;

    const item = findCutlistItem(record, focus.pieceId);
    if (item) {
      const boxNome = focus.boxId
        ? catalog?.rows.find((r) => r.boxId === focus.boxId && !r.pieceId)?.label
        : undefined;
      const nomeIndustrial = resolveNomeIndustrialForEtiqueta(item, projectName, boxNome);
      const pieceSeq = resolveAuthoritativeLabelNumber(item) ?? 1;
      const piecesInBox =
        catalog?.rows.filter((r) => r.boxId === focus.boxId && r.pieceId).length || 1;
      etiquetaCode = buildEtiquetaCodeV5({
        projectName,
        boxName: boxNome ?? "",
        nomeIndustrial,
        pieceSeq,
        totalPiecesInSheet: piecesInBox,
      });
      qrPayload = etiquetaCode;
    }
  }

  return {
    projectId: record.id,
    projectName,
    projectPageSlug,
    boxId: focus.boxId,
    boxSlug: focus.boxSlug ?? (focus.boxId ? catalog?.boxIdToSlug.get(focus.boxId) : undefined),
    pieceId: focus.pieceId,
    pieceSlug: focus.pieceSlug ?? (focus.pieceId ? catalog?.pieceIdToSlug.get(focus.pieceId) : undefined),
    etiquetaCode,
    qrPayload,
  };
}

export function buildProjetosPathFromRef(
  ref: Pick<ProjetosIndustrialRef, "projectName" | "boxSlug" | "pieceSlug">
): string {
  const base = buildProjetosPagePath({ name: ref.projectName });
  if (!ref.boxSlug) return base;
  if (!ref.pieceSlug) return `${base}/${encodeURIComponent(ref.boxSlug)}`;
  return `${base}/${encodeURIComponent(ref.boxSlug)}/${encodeURIComponent(ref.pieceSlug)}`;
}
