import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  extractIndustrialProjectSlug,
  industrialRailHref,
  industrialSupervisorHref,
} from '@/chrome/industrialProjectNav';
import { resolveProjectIdentity } from '@/core/projects/projectIdentity';
import StationCanvas from '@/industrial/ui/components/StationCanvas';
import StationPanel from '@/industrial/ui/components/StationPanel';
import StationSidebar from '@/industrial/ui/components/StationSidebar';
import { IndustrialThreeColumnLayout } from '@/industrial/ui/layouts/IndustrialThreeColumnLayout';
import { industrialUi, useIndustrialTone } from '@/industrial/ui/layouts/industrialTheme';
import type { IndustrialStation } from '@/industrial/work-orders/types';
import { STATION_LABELS } from '@/industrial/work-orders/types';

import { useStationPage } from '../hooks/useStationPage';
import StationHistorySidebar from './StationHistorySidebar';

interface StationPageShellProps {
  station: IndustrialStation;
  /** Pagina Ordem - Estacao — filtra a work order. */
  workOrderId?: string | null;
  /** Slug do projecto — filtra ordens/tarefas por projectCode. */
  projectSlug?: string | null;
}

export default function StationPageShell({
  station,
  workOrderId = null,
  projectSlug = null,
}: StationPageShellProps) {
  const location = useLocation();
  const page = useStationPage(station, { workOrderId, projectSlug });
  const tone = useIndustrialTone();
  const ui = industrialUi(tone);

  const resolvedProjectSlug = useMemo(() => {
    if (projectSlug?.trim()) return projectSlug.trim();
    const fromUrl = extractIndustrialProjectSlug(location.pathname);
    if (fromUrl) return fromUrl;
    const order = page.orders[0];
    if (order?.projectId) {
      return resolveProjectIdentity(order.projectId)?.slug ?? null;
    }
    return null;
  }, [projectSlug, location.pathname, page.orders]);

  if (page.loading && page.tasks.length === 0) {
    return (
      <IndustrialThreeColumnLayout
        title={page.title}
        description={page.description}
        sidebarOpen={false}
        leftLeft={<div />}
        left={
          <div style={{ color: ui.muted, fontSize: 13 }}>
            {'A carregar esta\u00e7\u00e3o\u2026'}
          </div>
        }
        right={<div />}
      />
    );
  }

  return (
    <IndustrialThreeColumnLayout
      title={page.title}
      description={page.description}
      sidebarOpen={page.sidebarOpen}
      leftLeft={
        <StationSidebar
          activeStation={station}
          projectSlug={resolvedProjectSlug}
          notificationCount={page.notifications.length}
          onToggleNotifications={() => page.setNotificationsOpen(!page.notificationsOpen)}
          onToggleChat={() => page.setChatOpen(!page.chatOpen)}
          chatOpen={page.chatOpen}
        />
      }
      history={
        <StationHistorySidebar tasks={page.tasks} orders={page.orders} eventLog={page.eventLog} />
      }
      left={
        <StationPanel
          tone={tone}
          title={page.config.panelTitle}
          description={page.description}
          sections={page.sections}
          codeInput={page.codeInput}
          onCodeInputChange={page.setCodeInput}
          onCodeSubmit={page.handleCodeSubmit}
          onCodeScanned={(code) => page.addCodeToSelection(code)}
          codeInputRef={page.codeInputRef}
          selectedTask={page.selectedTask}
          selectedTaskIds={page.selectedTaskIds}
          selectedTasks={page.selectedTasks}
          onToggleTaskSelection={page.toggleTaskSelection}
          onRemoveFromSelection={page.removeFromSelection}
          onClearSelection={page.clearSelection}
          onSelectAllTasks={page.selectAllTasks}
          onBulkAction={(action) => void page.handleBulkAction(action)}
          actionFeedback={page.actionFeedback}
          confirmLabel={page.config.confirmLabel}
          busy={page.busy}
          error={page.error}
          onConfirm={() => void page.handleConfirm()}
          onReject={() => void page.handleReject()}
          toolMode={page.toolMode}
          snapEnabled={page.snapEnabled}
          onToolMode={page.setToolMode}
          onToggleSnap={() => page.setSnapEnabled(!page.snapEnabled)}
          onReload={() => void page.reload()}
          onToggleSidebar={() => page.setSidebarOpen(!page.sidebarOpen)}
          sidebarOpen={page.sidebarOpen}
          extra={
            <div style={{ display: 'grid', gap: 6 }}>
              {workOrderId ? (
                <Link
                  to={industrialRailHref(station, resolvedProjectSlug)}
                  style={{ fontSize: 12, color: ui.link }}
                >
                  {'Ver toda a esta\u00e7\u00e3o'}
                </Link>
              ) : null}
              <Link
                to={industrialSupervisorHref(resolvedProjectSlug)}
                style={{ fontSize: 12, color: ui.link }}
              >
                Ver no Supervisor
              </Link>
            </div>
          }
        />
      }
      right={
        <StationCanvas
          pieces={page.canvasPieces}
          selectedPieceId={page.selectedPieceId}
          toolMode={page.toolMode}
          onSelectPiece={(pieceId) => {
            page.togglePieceOnCanvas(pieceId);
          }}
          onClearSelection={() => {
            page.clearSelection();
          }}
          notifications={page.notifications}
          notificationsOpen={page.notificationsOpen}
          onToggleNotifications={() => page.setNotificationsOpen(!page.notificationsOpen)}
          onDismissNotification={(id) =>
            page.setDismissedNotifications((prev) => [...prev, id])
          }
          chatOpen={page.chatOpen}
          onToggleChat={() => page.setChatOpen(!page.chatOpen)}
          conversations={page.conversations}
          activeConversationId={page.activeConversationId}
          onSelectConversation={page.setActiveConversationId}
          onSendChatMessage={page.handleSendChatMessage}
          enableSupervisorChat={page.config.enableSupervisorChat}
          stationLabel={STATION_LABELS[station]}
        />
      }
    />
  );
}
