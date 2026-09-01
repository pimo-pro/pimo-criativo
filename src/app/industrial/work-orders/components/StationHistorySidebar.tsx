import type { CSSProperties, ReactNode } from 'react';

import { getWorkOrderPieceDisplay } from '@/industrial/work-orders/resolveWorkOrderPiece';
import type { IndustrialWorkOrder, IndustrialWorkOrderTask } from '@/industrial/work-orders/types';
import {
  INDUSTRIAL_LIST_ITEM_CLASS,
  ensureIndustrialInteractionStyles,
  industrialListItemStyle,
  industrialListItemStyleLight,
  industrialSectionTitleStyle,
  industrialSectionTitleStyleLight,
} from '@/industrial/ui/layouts/industrialStyles';
import { industrialUi, useIndustrialTone } from '@/industrial/ui/layouts/industrialTheme';

interface StationHistorySidebarProps {
  tasks: IndustrialWorkOrderTask[];
  orders: IndustrialWorkOrder[];
  eventLog: Array<{ id: string; type: string; at: string }>;
}

function taskProjectId(task: IndustrialWorkOrderTask, orders: IndustrialWorkOrder[]): string {
  return orders.find((order) => order.id === task.workOrderId)?.projectId ?? '';
}

function HistorySection({
  title,
  titleStyle,
  children,
}: {
  title: string;
  titleStyle: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section style={{ display: 'grid', gap: 6 }}>
      <h3 style={titleStyle}>{title}</h3>
      {children}
    </section>
  );
}

export default function StationHistorySidebar({ tasks, orders, eventLog }: StationHistorySidebarProps) {
  ensureIndustrialInteractionStyles();
  const tone = useIndustrialTone();
  const ui = industrialUi(tone);
  const isLight = tone === 'light';
  const sectionTitleStyle = isLight ? industrialSectionTitleStyleLight : industrialSectionTitleStyle;
  const listItemStyle = isLight ? industrialListItemStyleLight : industrialListItemStyle;
  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'rejected');

  const renderTask = (task: IndustrialWorkOrderTask) => {
    const display = getWorkOrderPieceDisplay(task, taskProjectId(task, orders));
    return (
      <>
        <div style={{ fontWeight: 600, fontSize: 12, color: ui.textStrong }}>{display.fullIndustrialName}</div>
        <div style={{ color: ui.muted, marginTop: 2, fontSize: 10, fontFamily: 'monospace' }}>
          {display.nqrCode} · {task.status}
        </div>
      </>
    );
  };

  return (
    <aside
      data-station-tone={tone}
      style={{
        display: 'grid',
        gap: 14,
        alignContent: 'start',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 240px)',
        paddingRight: 4,
        color: ui.text,
      }}
    >
      <HistorySection title="Tarefas activas" titleStyle={sectionTitleStyle}>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {tasks
            .filter((t) => t.status === 'pending' || t.status === 'in_progress')
            .map((task, index) => (
              <li
                key={task.id}
                className={INDUSTRIAL_LIST_ITEM_CLASS}
                style={{ ...listItemStyle, animationDelay: `${index * 30}ms` }}
              >
                {renderTask(task)}
              </li>
            ))}
        </ul>
      </HistorySection>

      <HistorySection title="Concluídas / Rejeitadas" titleStyle={sectionTitleStyle}>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {completed.length === 0 ? (
            <li style={{ fontSize: 12, color: ui.muted }}>Sem histórico.</li>
          ) : (
            completed.slice(0, 12).map((task, index) => (
              <li
                key={task.id}
                className={INDUSTRIAL_LIST_ITEM_CLASS}
                style={{ ...listItemStyle, animationDelay: `${index * 30}ms` }}
              >
                {renderTask(task)}
              </li>
            ))
          )}
        </ul>
      </HistorySection>

      <HistorySection title="Eventos" titleStyle={sectionTitleStyle}>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {eventLog.length === 0 ? (
            <li style={{ fontSize: 12, color: ui.muted }}>Sem eventos registados.</li>
          ) : (
            eventLog.slice(0, 10).map((event, index) => (
              <li
                key={event.id}
                className={INDUSTRIAL_LIST_ITEM_CLASS}
                style={{ ...listItemStyle, animationDelay: `${index * 30}ms` }}
              >
                <div style={{ fontWeight: 600, color: ui.textStrong }}>{event.type}</div>
                <div style={{ color: ui.muted, marginTop: 2 }}>
                  {new Date(event.at).toLocaleString('pt-PT')}
                </div>
              </li>
            ))
          )}
        </ul>
      </HistorySection>
    </aside>
  );
}
