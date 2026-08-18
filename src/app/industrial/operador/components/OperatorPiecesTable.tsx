import { Link } from 'react-router-dom';

import { PROJETOS_PIECE_OPERATIONS } from '@/industrial/integration/projetos/types';
import { resolveOperationUiStatus } from '@/industrial/operador/operationMapping';
import {
  industrialActionBtnStyle,
  industrialSectionTitleStyle,
} from '@/industrial/ui/layouts/industrialStyles';

import type { OperatorSessionPiece } from '../types';
import type { UseOperatorPageReturnExtended } from '../hooks/useOperatorPage';

type Props = {
  state: UseOperatorPageReturnExtended;
};

function operationSummary(piece: OperatorSessionPiece): string {
  const labels = PROJETOS_PIECE_OPERATIONS.map((op) => {
    const status = resolveOperationUiStatus(piece.operations, piece.tasks, op.id);
    if (status === 'done') return `${op.label[0]}✓`;
    if (status === 'running') return `${op.label[0]}▶`;
    if (status === 'queued') return `${op.label[0]}…`;
    return `${op.label[0]}–`;
  });
  return labels.join(' ');
}

export default function OperatorPiecesTable({ state }: Props) {
  const isBatch = state.mode === 'batch';

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ ...industrialSectionTitleStyle, margin: 0 }}>Peças na sessão</h3>
        {isBatch ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={state.selectAllPieces} style={industrialActionBtnStyle}>
              Todas
            </button>
            <button type="button" onClick={state.clearSelection} style={industrialActionBtnStyle}>
              Limpar
            </button>
          </div>
        ) : null}
      </div>

      {state.pieces.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Nenhuma peça carregada.</p>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 220 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                {isBatch ? <th style={{ padding: '4px 6px' }} /> : null}
                <th style={{ padding: '4px 6px' }}>NQR</th>
                <th style={{ padding: '4px 6px' }}>Projecto</th>
                <th style={{ padding: '4px 6px' }}>Caixa</th>
                <th style={{ padding: '4px 6px' }}>Peça</th>
                <th style={{ padding: '4px 6px' }}>Operações</th>
                <th style={{ padding: '4px 6px' }} />
              </tr>
            </thead>
            <tbody>
              {state.pieces.map((piece) => {
                const active =
                  state.mode === 'single'
                    ? state.selectedPieceId === piece.pieceId
                    : state.selectedPieceIds.includes(piece.pieceId);

                return (
                  <tr
                    key={piece.pieceId}
                    style={{
                      background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      isBatch ? state.togglePieceSelection(piece.pieceId) : state.selectPiece(piece.pieceId)
                    }
                  >
                    {isBatch ? (
                      <td style={{ padding: '4px 6px' }}>
                        <input type="checkbox" readOnly checked={active} />
                      </td>
                    ) : null}
                    <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>
                      {piece.etiquetaCode ?? piece.pieceId.slice(0, 12)}
                    </td>
                    <td style={{ padding: '4px 6px' }}>{piece.projectName}</td>
                    <td style={{ padding: '4px 6px' }}>{piece.boxName ?? '—'}</td>
                    <td style={{ padding: '4px 6px' }}>{piece.pieceName ?? piece.pieceId}</td>
                    <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontSize: 10 }}>
                      {operationSummary(piece)}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <Link
                        to={`/industrial/piece/${encodeURIComponent(piece.pieceId)}`}
                        onClick={(event) => event.stopPropagation()}
                        style={{ color: '#38bdf8', marginRight: 8 }}
                      >
                        Ficha
                      </Link>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          state.removePiece(piece.pieceId);
                        }}
                        style={industrialActionBtnStyle}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
