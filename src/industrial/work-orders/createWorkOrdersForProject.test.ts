import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { IndustrialPiece } from '../core/pieces/types';

vi.mock('./resolveProjectCutlist', () => ({
  resolveProjectCutlist: vi.fn(),
}));

vi.mock('../persistence/work-orders/persistWorkOrder', () => ({
  persistWorkOrderDraft: vi.fn(),
}));

vi.mock('../persistence/work-orders/loadWorkOrders', () => ({
  loadWorkOrders: vi.fn(),
}));

vi.mock('./woIdempotencyConfig', () => ({
  woIdempotencyConfig: {
    skipExistingStationOrders: false,
    warnOnDuplicate: false,
  },
}));

import { createWorkOrdersForProject } from './createWorkOrdersForProject';
import { resolveProjectCutlist } from './resolveProjectCutlist';
import { persistWorkOrderDraft } from '../persistence/work-orders/persistWorkOrder';
import { loadWorkOrders } from '../persistence/work-orders/loadWorkOrders';

function samplePiece(id: string): IndustrialPiece {
  return {
    id,
    name: `Peça ${id}`,
    dimensions: { widthMm: 600, heightMm: 720, thicknessMm: 19 },
    quantity: 1,
    operations: ['cnc', 'drill', 'orlar', 'montagem', 'embalagem'],
    status: 'pending',
    metadata: {},
    createdAt: '2026-06-23T09:00:00Z',
    updatedAt: '2026-06-23T09:00:00Z',
  };
}

describe('createWorkOrdersForProject', () => {
  beforeEach(() => {
    vi.mocked(resolveProjectCutlist).mockReset();
    vi.mocked(persistWorkOrderDraft).mockReset();
    vi.mocked(loadWorkOrders).mockReset();
    vi.mocked(loadWorkOrders).mockResolvedValue([]);
  });

  it('lança erro se projecto sem cutlist', async () => {
    vi.mocked(resolveProjectCutlist).mockReturnValue(null);
    await expect(createWorkOrdersForProject('missing')).rejects.toThrow(/não encontrado/);
  });

  it('gera ordens para estações com tarefas e ignora estações vazias', async () => {
    vi.mocked(resolveProjectCutlist).mockReturnValue({
      projectId: 'proj-1',
      projectName: 'Cozinha Teste',
      pieces: [samplePiece('piece-1')],
      cutlist: [],
      cutListItems: [],
      boxNameById: {},
    });

    let callIndex = 0;
    vi.mocked(persistWorkOrderDraft).mockImplementation(async (projectId, draft) => {
      callIndex += 1;
      return {
        id: `wo-${draft.station}`,
        projectId,
        station: draft.station,
        status: 'pending',
        pieceIds: draft.pieceIds,
        operationTypes: draft.operationTypes,
        metadata: {},
        createdAt: '2026-06-23T10:00:00Z',
        updatedAt: '2026-06-23T10:00:00Z',
      };
    });

    const result = await createWorkOrdersForProject('proj-1');
    expect(result.projectId).toBe('proj-1');
    expect(result.orders.length).toBeGreaterThan(0);
    expect(persistWorkOrderDraft).toHaveBeenCalled();
    expect(callIndex).toBe(result.orders.length);
  });

  it('usa factory — warehouse e nesting incluem todas as peças', async () => {
    vi.mocked(resolveProjectCutlist).mockReturnValue({
      projectId: 'proj-2',
      projectName: 'Armário',
      pieces: [samplePiece('p1'), samplePiece('p2')],
      cutlist: [],
      cutListItems: [],
      boxNameById: {},
    });

    const drafts: Array<{ station: string; tasks: unknown[] }> = [];
    vi.mocked(persistWorkOrderDraft).mockImplementation(async (_projectId, draft) => {
      drafts.push({ station: draft.station, tasks: draft.tasks });
      return {
        id: `wo-${draft.station}`,
        projectId: 'proj-2',
        station: draft.station,
        status: 'pending',
        pieceIds: draft.pieceIds,
        operationTypes: draft.operationTypes,
        metadata: {},
        createdAt: '2026-06-23T10:00:00Z',
        updatedAt: '2026-06-23T10:00:00Z',
      };
    });

    await createWorkOrdersForProject('proj-2');
    const warehouse = drafts.find((d) => d.station === 'warehouse');
    const nesting = drafts.find((d) => d.station === 'nesting');
    expect(warehouse?.tasks.length).toBe(2);
    expect(nesting?.tasks.length).toBe(2);
  });
});
