import type { CutListItem } from '@/core/types';
import type { RematePiece } from '@/core/remate/remateTypes';
import type { ProjectRodape } from '@/core/rodape/rodapeTypes';
import { readOfflineProjects } from '@/core/projects/projectsOfflineStore';
import { cutlistToPieces, type CutlistPieceInput } from '@/industrial/integration/cutlist/cutlistToPieces';
import { pieceToOperations } from '@/industrial/core/piece-operations/mappers';
import { createPiece } from '@/industrial/core/pieces/actions';
import type { PieceOperation } from '@/industrial/core/piece-operations/types';
import type { IndustrialPiece } from '@/industrial/core/pieces/types';

export interface ResolvedPieceContext {
  piece: IndustrialPiece;
  operations: PieceOperation[];
  remates: RematePiece[];
  rodapes: ProjectRodape[];
  projectId?: string;
  projectName?: string;
  boxName?: string;
  cutlistItem?: CutListItem;
}

function asProjectState(snapshot: unknown): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const root = snapshot as Record<string, unknown>;
  const nested = root.projectState;
  if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  return root;
}

function cutlistItemMatchesId(item: CutListItem, pieceId: string): boolean {
  const candidates = [
    item.id,
    `${item.boxId}:${item.nome}`,
    `${item.boxId}:${item.id}`,
    (item as CutListItem & { panelId?: string }).panelId,
  ].filter(Boolean);
  return candidates.some((value) => String(value) === pieceId);
}

function toCutlistInput(item: CutListItem): CutlistPieceInput {
  return {
    id: item.id,
    nome: item.nome,
    boxId: item.boxId,
    material: item.material,
    materialId: item.materialId,
    quantidade: item.quantidade,
    dimensoes: item.dimensoes,
    espessura: item.espessura,
    metadata: { tipo: item.tipo, panelId: item.id },
  };
}

function findInProjects(pieceId: string): ResolvedPieceContext | null {
  const projects = readOfflineProjects().filter((p) => !p.deleted);

  for (const project of projects) {
    const state = asProjectState(project.snapshot);
    if (!state) continue;

    const cutList = Array.isArray(state.cutList) ? (state.cutList as CutListItem[]) : [];
    const match = cutList.find((item) => cutlistItemMatchesId(item, pieceId));
    if (!match) continue;

    const workOrderId =
      typeof state.workOrderId === 'string'
        ? state.workOrderId
        : typeof (state.metadata as Record<string, unknown> | undefined)?.workOrderId === 'string'
          ? String((state.metadata as Record<string, unknown>).workOrderId)
          : undefined;

    const pieces = cutlistToPieces([toCutlistInput(match)], {
      projectId: project.id,
      workOrderId,
    });
    const piece = pieces[0] ?? createPiece({
      id: pieceId,
      sourceItemId: match.id,
      boxId: match.boxId,
      name: match.nome,
      material: match.material,
      materialId: match.materialId,
      dimensions: {
        widthMm: match.dimensoes?.largura ?? 0,
        heightMm: match.dimensoes?.altura ?? 0,
        thicknessMm: match.espessura ?? match.dimensoes?.profundidade ?? 18,
      },
      quantity: match.quantidade ?? 1,
      projectId: project.id,
      workOrderId,
    });

    const boxes = Array.isArray(state.boxes) ? (state.boxes as Array<{ id?: string; nome?: string }>) : [];
    const boxName = boxes.find((b) => b.id === match.boxId)?.nome ?? match.boxId;
    const remates = Array.isArray(state.remates) ? (state.remates as RematePiece[]) : [];
    const rodapes = Array.isArray(state.rodapes) ? (state.rodapes as ProjectRodape[]) : [];

    return {
      piece: { ...piece, id: pieceId },
      operations: pieceToOperations({ ...piece, id: pieceId }),
      remates: remates.filter((r) => r.parentBoxId === match.boxId),
      rodapes: rodapes.filter((r) => r.parentBoxId === match.boxId),
      projectId: project.id,
      projectName: typeof state.projectName === 'string' ? state.projectName : project.name,
      boxName,
      cutlistItem: match,
    };
  }

  return null;
}

export function resolvePieceContext(pieceId: string): ResolvedPieceContext {
  const fromProject = findInProjects(pieceId);
  if (fromProject) return fromProject;

  const fallback = createPiece({
    id: pieceId,
    name: `Peça ${pieceId}`,
    dimensions: { widthMm: 600, heightMm: 400, thicknessMm: 18 },
    material: 'MDF',
    operations: ['cnc', 'drill', 'orlar', 'montagem', 'embalagem'],
    metadata: { source: 'fallback' },
  });

  return {
    piece: fallback,
    operations: pieceToOperations(fallback),
    remates: [],
    rodapes: [],
    projectName: '—',
    boxName: '—',
  };
}
