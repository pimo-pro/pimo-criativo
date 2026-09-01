import { supabase } from '@/industrial/infra/db';

import { PIECE_PERSISTENCE_TABLES } from '../tables';
import {
  industrialPersistBlocked,
  type IndustrialPersistResult,
} from '../shared/industrialPersistResult';
import { assertEntityId, assertPieceId } from '../shared/validation';
import type { PieceRemateRecord } from '../shared/types';

export interface SavePieceRematesInput {
  entityId: string;
  entityType: 'remate' | 'rodape';
  payload: Record<string, unknown>;
}

export async function savePieceRemates(
  pieceId: string,
  input: SavePieceRematesInput,
): Promise<IndustrialPersistResult> {
  assertPieceId(pieceId);
  assertEntityId(input.entityId);
  if (!input.payload || typeof input.payload !== 'object') {
    throw new Error('Payload de remate inválido.');
  }

  const { data, error } = await supabase
    .from(PIECE_PERSISTENCE_TABLES.remates)
    .upsert(
      {
        piece_id: pieceId,
        entity_id: input.entityId,
        entity_type: input.entityType,
        payload: input.payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'piece_id,entity_id' },
    )
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PIMO_WRITE_BLOCKED') {
      return industrialPersistBlocked();
    }
    throw new Error(error.message);
  }
  return { ok: true, data };
}

export async function loadPieceRemates(pieceId: string): Promise<PieceRemateRecord[]> {
  assertPieceId(pieceId);
  const { data, error } = await supabase
    .from(PIECE_PERSISTENCE_TABLES.remates)
    .select('*')
    .eq('piece_id', pieceId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    pieceId: row.piece_id as string,
    entityId: row.entity_id as string,
    entityType: row.entity_type as 'remate' | 'rodape',
    payload: (row.payload ?? {}) as Record<string, unknown>,
  }));
}
