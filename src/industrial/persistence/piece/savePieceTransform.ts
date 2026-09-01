import { supabase } from '@/industrial/infra/db';

import { PIECE_PERSISTENCE_TABLES } from '../tables';
import {
  industrialPersistBlocked,
  type IndustrialPersistResult,
} from '../shared/industrialPersistResult';
import { assertEntityId, assertPieceId, isVec3, jsonToVec3, vec3ToJson } from '../shared/validation';
import type { PieceTransformRecord } from '../shared/types';

export interface SavePieceTransformInput {
  entityId: string;
  entityType: PieceTransformRecord['entityType'];
  position: [number, number, number];
  rotation: [number, number, number];
}

export async function savePieceTransform(
  pieceId: string,
  payload: SavePieceTransformInput,
): Promise<IndustrialPersistResult> {
  assertPieceId(pieceId);
  assertEntityId(payload.entityId);
  if (!isVec3(payload.position) || !isVec3(payload.rotation)) {
    throw new Error('Transformação inválida.');
  }

  // Writes bloqueados em PROD via proxy supabase (writePolicy / client.ts).
  const { data, error } = await supabase
    .from(PIECE_PERSISTENCE_TABLES.transforms)
    .upsert(
      {
        piece_id: pieceId,
        entity_id: payload.entityId,
        entity_type: payload.entityType,
        position: vec3ToJson(payload.position),
        rotation: vec3ToJson(payload.rotation),
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

export async function loadPieceTransforms(pieceId: string): Promise<PieceTransformRecord[]> {
  assertPieceId(pieceId);
  const { data, error } = await supabase
    .from(PIECE_PERSISTENCE_TABLES.transforms)
    .select('*')
    .eq('piece_id', pieceId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    pieceId: row.piece_id as string,
    entityId: row.entity_id as string,
    entityType: row.entity_type as PieceTransformRecord['entityType'],
    position: jsonToVec3(row.position),
    rotation: jsonToVec3(row.rotation),
  }));
}
