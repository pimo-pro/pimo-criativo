import { useEffect, useState } from 'react';

import ProjetosShowroomPanel from '@/app/PROJETOS/ProjetosShowroomPanel';
import { loadProjectRecord } from '@/core/projects/projectsClient';
import type { SavedProjectRecord } from '@/core/projects/types';
import { industrialCanvasShellStyle, industrialSectionTitleStyle } from '@/industrial/ui/layouts/industrialStyles';

import type { OperatorSessionPiece } from '../types';

type Props = {
  piece: OperatorSessionPiece | null;
};

export default function OperatorViewerPanel({ piece }: Props) {
  const projectId = piece?.projectId;

  const [loadedSnapshot, setLoadedSnapshot] = useState<SavedProjectRecord | null>(null);
  const [loadedForProjectId, setLoadedForProjectId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const snapshot = projectId && loadedForProjectId === projectId ? loadedSnapshot : null;
  const error = projectId && loadedForProjectId === projectId ? fetchError : null;
  const loading = Boolean(projectId && loadedForProjectId !== projectId);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    void loadProjectRecord(projectId)
      .then((record) => {
        if (cancelled) return;
        setLoadedForProjectId(projectId);
        setLoadedSnapshot(record);
        setFetchError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadedForProjectId(projectId);
        setLoadedSnapshot(null);
        setFetchError(err instanceof Error ? err.message : 'Falha ao carregar projecto para viewer 3D.');
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!piece) {
    return (
      <section style={industrialCanvasShellStyle}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#64748b',
            fontSize: 13,
          }}
        >
          Carregue uma peça para visualizar o modelo 3D.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 style={{ ...industrialSectionTitleStyle, marginBottom: 8 }}>Viewer 3D</h3>
      <div style={industrialCanvasShellStyle}>
        {loading ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
            A carregar modelo…
          </div>
        ) : error ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#f87171', padding: 16, textAlign: 'center' }}>
            {error}
          </div>
        ) : snapshot ? (
          <ProjetosShowroomPanel
            key={`${piece.pieceId}-${piece.projectId}`}
            snapshot={snapshot}
            focusLevel="piece"
            projectPageSlug={piece.projectPageSlug}
            boxId={piece.boxId}
            pieceId={piece.pieceId}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#64748b' }}>
            Projecto não disponível offline.
          </div>
        )}
      </div>
    </section>
  );
}
