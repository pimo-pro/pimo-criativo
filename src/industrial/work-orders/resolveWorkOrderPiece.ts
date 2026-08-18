import { applyResultados } from '@/context/projectState';
import { reviveState } from '@/context/projectPersistence';
import { buildBoxNomeByIdFromBoxes, piecePrefixForCutLayoutPro } from '@/core/cutlayout/cutLayoutProPieceNaming';
import { buildCutlistItemsForIndustrialExport } from '@/core/fabrication/buildCutlistItemsForIndustrialExport';
import {
  buildV5BottomStripIndustrialName,
  resolveNomeIndustrialForEtiqueta,
  sanitizeIndustrialSegment,
} from '@/core/etiquetas/industrialDisplayName';
import { buildEtiquetaCodeV5 } from '@/core/etiquetas/qr/etiquetaCodeV5';
import { resolveAuthoritativeLabelNumber } from '@/core/qrcode/panelLabelNumber';
import { readOfflineProjects } from '@/core/projects/projectsOfflineStore';
import type { CutListItem } from '@/core/types';

import { resolveProjectDisplayName } from '../integration/projetos/projetosProjectLinks';

import { resolveProjectCutlist } from './resolveProjectCutlist';
import type { ProjectCutlistContext } from './resolveProjectCutlistFromRecord';
import type { CutlistPieceInput } from '../integration/cutlist/cutlistToPieces';
import type { IndustrialWorkOrderTask, WorkOrderPieceDisplay } from './types';

const METADATA_KEYS = {
  projectCode: 'project_code',
  boxCode: 'box_code',
  pieceCode: 'piece_code',
  fullIndustrialName: 'full_industrial_name',
  nqrCode: 'nqr_code',
} as const;

function cutlistItemMatchesId(item: CutListItem, pieceId: string): boolean {
  const candidates = [
    item.id,
    `${item.boxId}:${item.nome}`,
    `${item.boxId}:${item.id}`,
    (item as CutListItem & { shortCode?: string }).shortCode,
    (item as CutListItem & { panelId?: string }).panelId,
  ].filter(Boolean);
  return candidates.some((value) => String(value) === pieceId);
}

export function projectCodeFromName(projectName: string): string {
  const code = sanitizeIndustrialSegment(projectName);
  return (code || 'PROJETO').toUpperCase();
}

export function boxCodeFromName(boxName: string): string {
  return sanitizeIndustrialSegment(boxName) || 'CAIXA';
}

export function pieceCodeFromItem(item: CutListItem): string {
  return piecePrefixForCutLayoutPro(item);
}

export function displayToTaskMetadata(display: WorkOrderPieceDisplay): Record<string, string> {
  return {
    [METADATA_KEYS.projectCode]: display.projectCode,
    [METADATA_KEYS.boxCode]: display.boxCode,
    [METADATA_KEYS.pieceCode]: display.pieceCode,
    [METADATA_KEYS.fullIndustrialName]: display.fullIndustrialName,
    [METADATA_KEYS.nqrCode]: display.nqrCode,
  };
}

export function readDisplayFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): WorkOrderPieceDisplay | null {
  if (!metadata) return null;
  const fullIndustrialName = String(metadata[METADATA_KEYS.fullIndustrialName] ?? '').trim();
  if (!fullIndustrialName) return null;

  return {
    projectCode: String(metadata[METADATA_KEYS.projectCode] ?? '').trim() || '—',
    boxCode: String(metadata[METADATA_KEYS.boxCode] ?? '').trim() || '—',
    pieceCode: String(metadata[METADATA_KEYS.pieceCode] ?? '').trim() || '—',
    fullIndustrialName,
    nqrCode: String(metadata[METADATA_KEYS.nqrCode] ?? '').trim() || fullIndustrialName,
  };
}

type ProjectCutlistMatch = {
  item: CutListItem;
  projectName: string;
  boxName: string;
  cutlist: CutListItem[];
};

function findCutlistMatch(projectId: string, pieceId: string): ProjectCutlistMatch | null {
  const project = readOfflineProjects().find((p) => !p.deleted && p.id === projectId);
  if (!project) return null;

  const revived = reviveState(project.snapshot?.projectState);
  if (!revived) return null;
  const state = applyResultados(revived);
  const projectName = project.name?.trim() || state.projectName?.trim() || 'Projeto';

  const fromState = Array.isArray(state.cutList) ? (state.cutList as CutListItem[]) : [];
  const cutlist =
    fromState.length > 0
      ? fromState
      : buildCutlistItemsForIndustrialExport({
          boxes: state.boxes ?? [],
          rules: state.rules,
          materialId: state.materialId,
          projectName,
          remates: state.remates ?? [],
          rodapes: state.rodapes ?? [],
          extractedPartsByBoxId: state.extractedPartsByBoxId,
        });

  const item = cutlist.find((row) => cutlistItemMatchesId(row, pieceId));
  if (!item) return null;

  const boxNomeById = buildBoxNomeByIdFromBoxes(state.boxes ?? []);
  const boxName = boxNomeById[item.boxId ?? ''] ?? item.boxId ?? 'Caixa';

  return { item, projectName, boxName, cutlist };
}

function cutlistInputMatchesId(item: CutlistPieceInput, pieceId: string): boolean {
  const candidates = [
    item.id,
    `${item.boxId}:${item.nome}`,
    `${item.boxId}:${item.name}`,
    `${item.boxId}:${item.id}`,
    item.shortCode,
  ].filter(Boolean);
  return candidates.some((value) => String(value) === pieceId);
}

function buildDisplayFromCutlistItem(
  item: CutListItem,
  projectName: string,
  boxName: string,
  cutlist: CutListItem[],
): WorkOrderPieceDisplay {
  const nomeIndustrial = resolveNomeIndustrialForEtiqueta(item, projectName, boxName);
  const projectCode = projectCodeFromName(projectName);
  const boxCode = boxCodeFromName(boxName);
  const pieceCode = pieceCodeFromItem(item);
  const fullIndustrialName = buildV5BottomStripIndustrialName(projectName, boxName, nomeIndustrial);
  const piecesInBox = cutlist.filter((row) => row.boxId === item.boxId).length || 1;
  const pieceSeq = resolveAuthoritativeLabelNumber(item) ?? 1;

  const nqrCode = buildEtiquetaCodeV5({
    projectName,
    boxName,
    nomeIndustrial,
    pieceSeq,
    totalPiecesInSheet: piecesInBox,
  });

  return {
    projectCode,
    boxCode,
    pieceCode,
    fullIndustrialName,
    nqrCode,
  };
}

function cutlistInputToItem(input: CutlistPieceInput, pieceId: string): CutListItem {
  return {
    id: input.id ?? pieceId,
    nome: input.nome ?? input.name ?? 'Peca',
    boxId: input.boxId,
    tipo: String(input.metadata?.tipo ?? ''),
    material: input.material,
    materialId: input.materialId,
    quantidade: input.quantidade ?? 1,
    dimensoes: {
      largura: input.dimensoes?.largura ?? 0,
      altura: input.dimensoes?.altura ?? 0,
      profundidade: input.dimensoes?.profundidade ?? 0,
    },
    espessura: input.espessura,
  };
}

function resolveDisplayFromContext(
  context: ProjectCutlistContext,
  pieceId: string,
): WorkOrderPieceDisplay | null {
  const { projectName, cutListItems, cutlist, boxNameById, pieces } = context;

  let cutListItem = cutListItems.find((row) => cutlistItemMatchesId(row, pieceId));
  if (!cutListItem) {
    const piece = pieces.find((row) => row.id === pieceId);
    if (piece?.sourceItemId) {
      cutListItem = cutListItems.find((row) => cutlistItemMatchesId(row, piece.sourceItemId!));
    }
  }
  if (!cutListItem) {
    const input = cutlist.find((row) => cutlistInputMatchesId(row, pieceId));
    if (!input) {
      const piece = pieces.find((row) => row.id === pieceId);
      const fallbackInput = piece?.sourceItemId
        ? cutlist.find((row) => row.id === piece.sourceItemId)
        : undefined;
      if (!fallbackInput) return null;
      const pseudoItem = cutlistInputToItem(fallbackInput, pieceId);
      const boxName = boxNameById[pseudoItem.boxId ?? ''] ?? pseudoItem.boxId ?? 'Caixa';
      return buildDisplayFromCutlistItem(pseudoItem, projectName, boxName, cutListItems);
    }
    const pseudoItem = cutlistInputToItem(input, pieceId);
    const boxName = boxNameById[pseudoItem.boxId ?? ''] ?? pseudoItem.boxId ?? 'Caixa';
    return buildDisplayFromCutlistItem(pseudoItem, projectName, boxName, cutListItems);
  }

  const boxName = boxNameById[cutListItem.boxId ?? ''] ?? cutListItem.boxId ?? 'Caixa';
  return buildDisplayFromCutlistItem(cutListItem, projectName, boxName, cutListItems);
}

/** Mapa pieceId → nomenclatura industrial a partir do contexto PROJETOS (PIMO-TRAK). */
export function buildWorkOrderDisplayMapFromContext(
  context: ProjectCutlistContext,
): Map<string, WorkOrderPieceDisplay> {
  const map = new Map<string, WorkOrderPieceDisplay>();
  for (const piece of context.pieces) {
    const display = resolveDisplayFromContext(context, piece.id);
    if (display) map.set(piece.id, display);
  }
  return map;
}

export function buildTaskMetadataForPiece(
  pieceId: string,
  projectId: string,
  displayOverride?: WorkOrderPieceDisplay | null,
): Record<string, string> {
  if (displayOverride) return displayToTaskMetadata(displayOverride);
  const display = resolveWorkOrderPieceDisplay(pieceId, projectId);
  return display ? displayToTaskMetadata(display) : {};
}

/** Resolve nomenclatura industrial a partir da cutlist local (igual à etiqueta). */
export function resolveWorkOrderPieceDisplay(
  pieceId: string,
  projectId: string,
): WorkOrderPieceDisplay | null {
  const match = findCutlistMatch(projectId, pieceId);
  if (!match) return null;

  const { item, projectName, boxName, cutlist } = match;
  return buildDisplayFromCutlistItem(item, projectName, boxName, cutlist);
}

export function resolveWorkOrderPieceFromTask(
  task: IndustrialWorkOrderTask,
  projectId: string,
): WorkOrderPieceDisplay {
  const fromMeta = readDisplayFromMetadata(task.metadata);
  if (fromMeta) return fromMeta;

  const fromCutlist = resolveWorkOrderPieceDisplay(task.pieceId, projectId);
  if (fromCutlist) return fromCutlist;

  return {
    projectCode: projectCodeFromName(resolveProjectDisplayName(projectId)),
    boxCode: '—',
    pieceCode: task.pieceId.slice(0, 16),
    fullIndustrialName: task.pieceId,
    nqrCode: task.pieceId,
  };
}

export function getWorkOrderPieceDisplay(
  task: IndustrialWorkOrderTask,
  projectId: string,
): WorkOrderPieceDisplay {
  return task.display ?? resolveWorkOrderPieceFromTask(task, projectId);
}

export function buildWorkOrderPieceDisplayMap(
  projectId: string,
  pieceIds: string[],
): Map<string, WorkOrderPieceDisplay> {
  const map = new Map<string, WorkOrderPieceDisplay>();
  for (const pieceId of pieceIds) {
    const display = resolveWorkOrderPieceDisplay(pieceId, projectId);
    if (display) map.set(pieceId, display);
  }
  return map;
}

export function attachDisplayToTasks(
  tasks: IndustrialWorkOrderTask[],
  projectIdByWorkOrderId: Map<string, string>,
): IndustrialWorkOrderTask[] {
  return tasks.map((task) => {
    const projectId = projectIdByWorkOrderId.get(task.workOrderId) ?? '';
    const display = resolveWorkOrderPieceFromTask(task, projectId);
    return { ...task, display };
  });
}

export function resolveWorkOrderProjectDisplay(projectId: string): string {
  const ctx = resolveProjectCutlist(projectId);
  if (ctx) return projectCodeFromName(ctx.projectName);
  const display = resolveProjectDisplayName(projectId);
  if (
    !display ||
    display === '\u2014' ||
    display === '-' ||
    display.startsWith('pimo') ||
    display.startsWith('local')
  ) {
    return 'PROJETO';
  }
  return projectCodeFromName(display);
}

export function resolveProjectIdByProjectCode(projectCode: string): string | null {
  const normalized = projectCode.trim().toUpperCase();
  if (!normalized) return null;

  for (const project of readOfflineProjects()) {
    if (project.deleted) continue;
    const name = project.name?.trim() || 'Projeto';
    if (projectCodeFromName(name) === normalized) return project.id;
  }
  return null;
}

export function resolveOrderProjectCode(
  order: { projectId: string; metadata?: Record<string, unknown> },
  tasks: IndustrialWorkOrderTask[] = [],
): string {
  const fromMeta = String(order.metadata?.project_code ?? '').trim();
  if (fromMeta) return fromMeta;

  const fromTask = tasks.find((task) => task.display?.projectCode)?.display?.projectCode;
  if (fromTask) return fromTask;

  return resolveWorkOrderProjectDisplay(order.projectId);
}
