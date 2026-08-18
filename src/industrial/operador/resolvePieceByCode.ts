import { buildProjetosFocusCatalog } from '@/app/PROJETOS/projetosFocusSlug';
import { toProjetosPageSlug } from '@/app/PROJETOS/projetosPageSlug';
import { resolveProjetosIndustrialRef } from '@/industrial/integration/projetos/resolveProjetosIndustrialRef';
import { parseBarcode } from '@/industrial/core/barcode/actions';
import { readOfflineProjects } from '@/core/projects/projectsOfflineStore';
import { toSavedRecordFromOffline } from '@/core/projects/projectsMappers';
import { supabase } from '@/industrial/infra/db';
import { INDUSTRIAL_VIEW_TABLES } from '@/industrial/persistence/work-orders/tables';
import { loadTasksByPiece } from '@/industrial/persistence/work-orders/loadWorkOrders';
import type { SavedProjectRecord } from '@/core/projects/types';

import { normalizeIndustrialCode, splitIndustrialCodeList } from './normalizeIndustrialCode';
import type { OperatorPieceLookupResult } from './types';

function matchesCode(candidate: string | null | undefined, code: string): boolean {
  if (!candidate) return false;
  const normalized = candidate.trim();
  if (!normalized) return false;
  if (normalized === code || normalized.toLowerCase() === code.toLowerCase()) return true;
  const codeWithoutSeq = code.replace(/-\d+$/, '');
  const candidateWithoutSeq = normalized.replace(/-\d+$/, '');
  return (
    code.startsWith(`${normalized}-`) ||
    normalized.startsWith(`${code}-`) ||
    (codeWithoutSeq !== code && candidateWithoutSeq === codeWithoutSeq)
  );
}

function lookupInProject(record: SavedProjectRecord, code: string): OperatorPieceLookupResult | null {
  const catalog = buildProjetosFocusCatalog(record);
  if (!catalog) return null;

  const projectPageSlug = toProjetosPageSlug(record.name?.trim() || 'projeto');

  for (const row of catalog.rows) {
    if (!row.pieceId) continue;

    const ref = resolveProjetosIndustrialRef(
      record,
      projectPageSlug,
      row.boxSlug,
      row.pieceSlug ?? catalog.pieceIdToSlug.get(row.pieceId),
    );

    const candidates = [
      row.pieceId,
      row.industrialName,
      row.label,
      ref?.etiquetaCode,
      ref?.qrPayload,
      ref?.pieceSlug,
    ];

    if (candidates.some((value) => matchesCode(value, code))) {
      return {
        pieceId: row.pieceId,
        projectId: record.id,
        projectName: record.name?.trim() || catalog.projectName,
        boxId: row.boxId,
        boxName: row.label,
        pieceName: row.label,
        etiquetaCode: ref?.etiquetaCode ?? row.industrialName ?? null,
        qrPayload: ref?.qrPayload ?? null,
        projectPageSlug,
        boxSlug: row.boxSlug,
        pieceSlug: ref?.pieceSlug,
      };
    }
  }

  return null;
}

type ViewLookupRow = {
  piece_id: string;
  project_id?: string | null;
  nqr_code?: string | null;
  full_industrial_name?: string | null;
  box_code?: string | null;
  piece_code?: string | null;
  project_code?: string | null;
};

function mapViewRowToLookup(row: ViewLookupRow): OperatorPieceLookupResult {
  const nqr = String(row.nqr_code ?? '').trim();
  const fullName = String(row.full_industrial_name ?? '').trim();
  return {
    pieceId: String(row.piece_id),
    projectId: String(row.project_id ?? ''),
    projectName: String(row.project_code ?? '').trim() || '—',
    boxName: String(row.box_code ?? '').trim() || undefined,
    pieceName: String(row.piece_code ?? fullName).trim() || undefined,
    etiquetaCode: nqr || fullName || row.piece_id,
    qrPayload: fullName || null,
  };
}

async function fetchViewByColumn(
  column: 'nqr_code' | 'full_industrial_name' | 'piece_id',
  value: string,
): Promise<OperatorPieceLookupResult | null> {
  if (!value) return null;
  const { data, error } = await supabase
    .from(INDUSTRIAL_VIEW_TABLES.tasksView)
    .select('piece_id, project_id, nqr_code, full_industrial_name, box_code, piece_code, project_code')
    .eq(column, value)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapViewRowToLookup(data as ViewLookupRow);
}

async function lookupRemoteByPieceId(pieceId: string): Promise<OperatorPieceLookupResult | null> {
  try {
    const tasks = await loadTasksByPiece(pieceId);
    if (tasks.length === 0) return null;
    const display = tasks[0]?.display;
    return {
      pieceId,
      projectId: '',
      projectName: display?.projectCode ?? '—',
      boxName: display?.boxCode,
      pieceName: display?.pieceCode,
      etiquetaCode: display?.nqrCode ?? pieceId,
      qrPayload: display?.fullIndustrialName ?? null,
    };
  } catch {
    return null;
  }
}

async function lookupRemoteByCode(code: string): Promise<OperatorPieceLookupResult | null> {
  const barcode = parseBarcode(code);
  const pieceId = barcode?.entityType === 'piece' ? barcode.id : code;
  const nameWithoutSeq = code.replace(/-\d+$/, '');

  const fromNqr = await fetchViewByColumn('nqr_code', code);
  if (fromNqr) return fromNqr;

  const fromName = await fetchViewByColumn('full_industrial_name', code);
  if (fromName) return fromName;

  if (nameWithoutSeq !== code) {
    const fromNameSeq = await fetchViewByColumn('full_industrial_name', nameWithoutSeq);
    if (fromNameSeq) return fromNameSeq;
  }

  const fromPieceId = await fetchViewByColumn('piece_id', pieceId);
  if (fromPieceId) return fromPieceId;

  return lookupRemoteByPieceId(pieceId);
}

/**
 * Resolve peça por N-QR v5, payload QR, nome industrial, barcode PC-* ou piece_id.
 * Pesquisa projectos offline; fallback na view industrial (nqr_code / full_industrial_name).
 */
export async function resolvePieceByCodeAsync(rawCode: string): Promise<OperatorPieceLookupResult | null> {
  const sync = resolvePieceByCode(rawCode);
  if (sync) return sync;

  const code = normalizeIndustrialCode(rawCode);
  if (!code) return null;

  return lookupRemoteByCode(code);
}

export function resolvePieceByCode(rawCode: string): OperatorPieceLookupResult | null {
  const code = normalizeIndustrialCode(rawCode);
  if (!code) return null;

  const barcode = parseBarcode(code);
  if (barcode?.entityType === 'piece' && barcode.id) {
    for (const project of readOfflineProjects().filter((p) => !p.deleted)) {
      const match = lookupInProject(toSavedRecordFromOffline(project), barcode.id);
      if (match) return match;
    }
    return {
      pieceId: barcode.id,
      projectId: '',
      projectName: '—',
      etiquetaCode: code,
    };
  }

  for (const project of readOfflineProjects().filter((p) => !p.deleted)) {
    const match = lookupInProject(toSavedRecordFromOffline(project), code);
    if (match) return match;
  }

  return null;
}

export function resolvePiecesByCodes(rawCodes: string[]): OperatorPieceLookupResult[] {
  const seen = new Set<string>();
  const results: OperatorPieceLookupResult[] = [];

  for (const raw of rawCodes) {
    const parts = splitIndustrialCodeList(raw);

    for (const part of parts.length > 0 ? parts : [normalizeIndustrialCode(raw)]) {
      const resolved = resolvePieceByCode(part);
      if (!resolved || seen.has(resolved.pieceId)) continue;
      seen.add(resolved.pieceId);
      results.push(resolved);
    }
  }

  return results;
}
