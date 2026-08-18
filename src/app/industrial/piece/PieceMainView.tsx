import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { CSSProperties } from 'react';

import { useAuth } from '@/auth/useAuth';
import { IndustrialLayout } from '@/industrial/ui/components';
import QrScannerPanel from '@/app/industrial/work-orders/components/QrScannerPanel';

import PieceCanvas from './components/PieceCanvas';
import PieceControlPanel from './components/PieceControlPanel';
import PieceSidebar from './components/PieceSidebar';
import { usePieceData } from './hooks/usePieceData';
import { usePieceInteraction } from './hooks/usePieceInteraction';
import { usePieceTransform } from './hooks/usePieceTransform';
import { usePieceWorkOrderTasks } from './hooks/usePieceWorkOrderTasks';

const panelStyle: CSSProperties = {
  border: '1px solid var(--border, #e2e8f0)',
  borderRadius: 8,
  background: 'var(--panel-bg, rgba(15, 23, 42, 0.4))',
  padding: 16,
  minHeight: 0,
};

export default function PieceMainView() {
  const { pieceId } = useParams<{ pieceId: string }>();
  const { user } = useAuth();
  const data = usePieceData(pieceId);
  const workOrderTasks = usePieceWorkOrderTasks(pieceId);

  const interaction = usePieceInteraction({
    pieceId,
    workOrderId: data.piece?.workOrderId,
    userId: user?.id,
    onPersisted: data.reload,
  });

  const transform = usePieceTransform(interaction.selection?.id ?? null, {
    pieceId,
    selectedType: interaction.selection?.type ?? null,
    workOrderId: data.piece?.workOrderId,
    userId: user?.id,
    initialTransforms: data.persistedTransforms,
    onPersisted: data.reload,
  });

  const selectedLabel = useMemo(() => {
    if (!interaction.selection || !data.piece) return undefined;
    if (interaction.selection.type === 'piece') return data.piece.name;
    if (interaction.selection.type === 'remate') {
      return data.remates.find((r) => r.id === interaction.selection?.id)?.name ?? interaction.selection.id;
    }
    return data.rodapes.find((r) => r.id === interaction.selection?.id)?.name ?? interaction.selection.id;
  }, [data.piece, data.remates, data.rodapes, interaction.selection]);

  if (data.loading) {
    return (
      <IndustrialLayout title="Peça industrial" description="A carregar dados operacionais…">
        <div style={{ display: 'grid', gap: 16 }}>
          <QrScannerPanel />
          <div style={{ padding: 24, color: 'var(--text-muted, #94a3b8)' }}>A carregar peça…</div>
        </div>
      </IndustrialLayout>
    );
  }

  if (data.error || !data.piece) {
    return (
      <IndustrialLayout title="Peça industrial" description="Erro ao carregar a peça.">
        <div style={{ display: 'grid', gap: 16 }}>
          <QrScannerPanel />
          <div style={{ padding: 24, color: '#f87171' }}>{data.error ?? 'Peça não encontrada.'}</div>
        </div>
      </IndustrialLayout>
    );
  }

  return (
    <IndustrialLayout
      title={data.piece.name}
      description={`Peça ${data.piece.id} · ${data.projectName ?? 'Projeto'} · ${data.boxName ?? 'Caixa'}`}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <QrScannerPanel />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: interaction.sidebarOpen ? '260px 300px 1fr' : '300px 1fr',
            gap: 16,
            minHeight: 'calc(100vh - 220px)',
          }}
        >
        {interaction.sidebarOpen ? (
          <div style={panelStyle}>
            <PieceSidebar
              operations={data.operations}
              events={data.events}
              tracking={data.tracking}
              timeEntries={data.timeEntries}
              quality={data.quality}
              rework={data.rework}
              workOrderTasks={workOrderTasks.tasks}
              workOrderTasksLoading={workOrderTasks.loading}
              workOrderTasksError={workOrderTasks.error}
              saving={data.saving || transform.persisting}
              onStartTime={(operationId) => {
                void data.startTime(operationId);
              }}
              onStopTime={() => {
                void data.stopTime();
              }}
            />
          </div>
        ) : null}

        <div style={panelStyle}>
          <PieceControlPanel
            piece={data.piece}
            operations={data.operations}
            quality={data.quality}
            timeEntries={data.timeEntries}
            qrPayload={data.qrPayload}
            projectName={data.projectName}
            boxName={data.boxName}
            toolMode={transform.toolMode}
            snapEnabled={transform.snapEnabled}
            saving={data.saving || transform.persisting}
            selectedLabel={selectedLabel}
            onToolMode={transform.setToolMode}
            onToggleSnap={() => transform.setSnapEnabled(!transform.snapEnabled)}
            onReload={data.reload}
            onResetTransform={transform.resetSelected}
            onSavePosition={() => {
              void transform.savePosition();
            }}
            onSaveRotation={() => {
              void transform.saveRotation();
            }}
            onSaveSelectedPart={() => {
              void interaction.saveSelectedPart();
            }}
            onTrackingAction={(operationId, action, reason) => {
              void data.runTrackingAction(operationId, action, reason);
            }}
            onQualityDecision={(decision, reason) => {
              void data.runQualityDecision(decision, reason);
            }}
            onToggleSidebar={interaction.toggleSidebar}
            sidebarOpen={interaction.sidebarOpen}
          />
        </div>

        <PieceCanvas
          piece={data.piece}
          remates={data.remates}
          rodapes={data.rodapes}
          selectedId={interaction.selection?.id ?? null}
          selectedType={interaction.selection?.type ?? null}
          toolMode={transform.toolMode}
          transforms={transform.transforms}
          onSelect={interaction.selectEntity}
          onClearSelection={interaction.clearSelection}
          onApplyMatrix={transform.applyMatrix}
        />
        </div>
      </div>
    </IndustrialLayout>
  );
}
