import { useState, type CSSProperties, type FormEvent, type ReactNode, type Ref } from 'react';

import { useOperatorQrScanner } from '@/app/industrial/operador/hooks/useOperatorQrScanner';
import type { IndustrialWorkOrderTask } from '@/industrial/work-orders/types';
import {
  INDUSTRIAL_LIST_ITEM_CLASS,
  INDUSTRIAL_PANEL_MOTION_CLASS,
  INDUSTRIAL_VISION_ACTIVE_CLASS,
  INDUSTRIAL_VISION_SECONDARY_CLASS,
  ensureIndustrialInteractionStyles,
  industrialActionBtnStyle,
  industrialActionBtnStyleLight,
  industrialBtnStyle,
  industrialBtnStyleLight,
  industrialConfirmBtnStyle,
  industrialListItemStyle,
  industrialListItemStyleLight,
  industrialPanelDepthStyle,
  industrialSectionTitleStyle,
  industrialSectionTitleStyleLight,
  industrialVisionActiveStyle,
  industrialVisionSecondaryStyle,
} from '@/industrial/ui/layouts/industrialStyles';
import { useIndustrialTone } from '@/industrial/ui/layouts/industrialTheme';

import type { StationActionFeedback, StationBulkAction, StationListSection } from './stationTypes';
import StationToolbar from './StationToolbar';
import type { StationToolMode } from './stationTypes';

/**
 * Painel operacional da estação: QR/bulk, lista de tarefas, selecção e
 * Iniciar / Concluir / Rejeitar. Sem engines/scores/timelines decorativos.
 */

interface StationPanelProps {
  title: string;
  description?: string;
  sections: StationListSection[];
  codeInput: string;
  onCodeInputChange: (value: string) => void;
  onCodeSubmit: (event: FormEvent) => void;
  onCodeScanned?: (code: string) => void;
  codeInputRef?: Ref<HTMLInputElement>;
  selectedTask: IndustrialWorkOrderTask | null;
  selectedTaskIds: string[];
  selectedTasks: IndustrialWorkOrderTask[];
  onToggleTaskSelection: (taskId: string) => void;
  onRemoveFromSelection: (taskId: string) => void;
  onClearSelection: () => void;
  onSelectAllTasks?: () => void;
  onBulkAction: (action: StationBulkAction) => void;
  actionFeedback?: StationActionFeedback | null;
  confirmLabel: string;
  rejectLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onReject?: () => void;
  toolMode: StationToolMode;
  snapEnabled: boolean;
  onToolMode: (mode: StationToolMode) => void;
  onToggleSnap: () => void;
  onReload?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  extra?: ReactNode;
  /** Tema do painel. Omitido → segue o toggle global (ThemeContext). */
  tone?: 'light' | 'dark';
}

const STATUS_LABEL: Record<IndustrialWorkOrderTask['status'], string> = {
  pending: 'Pendente',
  in_progress: 'Em execução',
  completed: 'Concluído',
  rejected: 'Rejeitado',
};

function chipStyle(active: boolean, color: string | undefined, isLight: boolean): CSSProperties {
  const idleBorder = isLight ? '#cbd5e1' : '#334155';
  const activeBg = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)';
  const idleBg = 'rgba(255,255,255,0.03)';
  const activeText = isLight ? '#1e1e1e' : '#f1f5f9';
  const idleText = isLight ? '#475569' : '#94a3b8';
  return {
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.5,
    border: `1px solid ${active ? color ?? 'rgba(59,130,246,0.55)' : idleBorder}`,
    background: active ? activeBg : idleBg,
    color: active ? activeText : idleText,
    boxShadow: active ? `0 0 0 2px ${color ?? 'rgba(59,130,246,0.45)'}` : undefined,
    opacity: active ? 1 : 0.85,
    transition: 'all 140ms ease-out',
  };
}

export default function StationPanel({
  title,
  description,
  sections,
  codeInput,
  onCodeInputChange,
  onCodeSubmit,
  onCodeScanned,
  codeInputRef,
  selectedTask,
  selectedTaskIds,
  selectedTasks,
  onToggleTaskSelection,
  onRemoveFromSelection,
  onClearSelection,
  onSelectAllTasks,
  onBulkAction,
  actionFeedback,
  confirmLabel,
  rejectLabel = 'Rejeitar',
  busy = false,
  error,
  onConfirm,
  onReject,
  toolMode,
  snapEnabled,
  onToolMode,
  onToggleSnap,
  onReload,
  onToggleSidebar,
  sidebarOpen,
  extra,
  tone: toneProp,
}: StationPanelProps) {
  const themeTone = useIndustrialTone();
  const [scannerOpen, setScannerOpen] = useState(false);
  const {
    videoRef,
    cameraActive,
    usbCaptureActive,
    error: scannerError,
    startCamera,
    stopCamera,
    startUsbCapture,
    stopUsbCapture,
  } = useOperatorQrScanner({
    enabled: scannerOpen,
    continuous: true,
    onScan: (code) => {
      onCodeScanned?.(code);
    },
  });
  const tone = toneProp ?? themeTone;
  const isLight = tone === 'light';
  const textPrimary = isLight ? '#1e1e1e' : '#f1f5f9';
  const textMuted = isLight ? '#475569' : '#94a3b8';
  const textBody = isLight ? '#334155' : '#cbd5e1';
  const surface = isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)';
  const borderCol = isLight ? '#cbd5e1' : '#334155';
  const trackBg = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)';
  const sectionTitleStyle = isLight ? industrialSectionTitleStyleLight : industrialSectionTitleStyle;
  const listItemStyle = isLight ? industrialListItemStyleLight : industrialListItemStyle;
  const actionBtnStyle = isLight ? industrialActionBtnStyleLight : industrialActionBtnStyle;
  const panelDepth = isLight
    ? { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' }
    : industrialPanelDepthStyle;
  ensureIndustrialInteractionStyles();

  const hasSelection = selectedTaskIds.length > 0;
  const selectionCount = selectedTaskIds.length;
  const selectableCount = sections.reduce(
    (total, section) => total + section.items.filter((item) => Boolean(item.taskId)).length,
    0,
  );
  const qrVisual: 'válido' | 'inválido' | 'pendente' = error
    ? 'inválido'
    : hasSelection || selectedTask
      ? 'válido'
      : 'pendente';
  const qrColor = qrVisual === 'válido' ? '#16a34a' : qrVisual === 'inválido' ? '#f87171' : '#f59e0b';
  const scannerBtnStyle = isLight ? industrialBtnStyleLight : industrialBtnStyle;

  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
      setScannerOpen(false);
      return;
    }
    setScannerOpen(true);
    void startCamera();
  };

  const toggleUsb = () => {
    if (usbCaptureActive) {
      stopUsbCapture();
      return;
    }
    setScannerOpen(true);
    startUsbCapture();
  };

  return (
    <section
      className={INDUSTRIAL_PANEL_MOTION_CLASS}
      data-station-tone={tone}
      style={{
        display: 'grid',
        gap: 14,
        alignContent: 'start',
        color: textPrimary,
        lineHeight: 1.5,
        ...panelDepth,
        borderRadius: 8,
        padding: 8,
      }}
    >
      <div
        className={selectedTask ? INDUSTRIAL_VISION_ACTIVE_CLASS : undefined}
        style={{
          display: 'grid',
          gap: 6,
          ...(selectedTask ? industrialVisionActiveStyle : industrialVisionSecondaryStyle),
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: textPrimary, lineHeight: 1.5 }}>{title}</h2>
        {description ? (
          <div style={{ fontSize: 12, fontWeight: 400, color: textMuted, lineHeight: 1.5 }}>{description}</div>
        ) : null}
        {busy ? <div style={{ fontSize: 11, color: '#38bdf8', lineHeight: 1.5 }}>A processar…</div> : null}
      </div>

      <StationToolbar
        toolMode={toolMode}
        snapEnabled={snapEnabled}
        onToolMode={onToolMode}
        onToggleSnap={onToggleSnap}
        onReload={onReload}
        onToggleSidebar={onToggleSidebar}
        sidebarOpen={sidebarOpen}
      />

      <form
        onSubmit={onCodeSubmit}
        style={{
          display: 'grid',
          gap: 8,
          ...(qrVisual === 'válido' ? industrialVisionActiveStyle : {}),
          borderLeft: `2px solid ${qrColor}`,
          paddingLeft: 8,
          transition: 'all 140ms ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <h3 style={sectionTitleStyle}>Leitura N-QR / QR</h3>
          <span style={chipStyle(true, qrColor, isLight)}>
            {selectionCount > 0 ? `${selectionCount} seleccionada(s)` : `QR ${qrVisual}`}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: textMuted, lineHeight: 1.4 }}>
          Introduza o N-QR, o payload do QR ou o nome industrial (Enter adiciona). Câmara e USB também lêem.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            ref={codeInputRef}
            value={codeInput}
            onChange={(e) => onCodeInputChange(e.target.value)}
            placeholder="N-QR / QR / nome industrial · Enter = adicionar"
            autoComplete="off"
            data-operator-usb-capture="1"
            style={{
              flex: 1,
              minWidth: 140,
              padding: '8px 10px',
              borderRadius: 6,
              border: `1px solid ${qrVisual === 'inválido' ? '#f87171' : qrVisual === 'válido' ? 'rgba(59,130,246,0.55)' : borderCol}`,
              background: surface,
              color: textPrimary,
              fontSize: 12,
              boxShadow: qrVisual === 'válido' ? '0 0 0 2px rgba(59,130,246,0.45)' : undefined,
              outline: qrVisual === 'válido' ? '2px solid rgba(59,130,246,0.55)' : undefined,
              transition: 'all 140ms ease-out',
            }}
          />
          <button type="submit" style={{ ...industrialConfirmBtnStyle, background: '#334155', padding: '8px 12px' }}>
            Ler
          </button>
          <button type="button" onClick={toggleCamera} style={scannerBtnStyle(cameraActive)}>
            {cameraActive ? 'Parar câmara' : 'Ler QR (câmara)'}
          </button>
          <button type="button" onClick={toggleUsb} style={scannerBtnStyle(usbCaptureActive)}>
            {usbCaptureActive ? 'USB activo' : 'Leitor USB'}
          </button>
        </div>
        {cameraActive ? (
          <div
            style={{
              borderRadius: 8,
              overflow: 'hidden',
              border: `1px solid ${borderCol}`,
              maxHeight: 180,
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: '100%', display: 'block', background: '#000' }}
            />
          </div>
        ) : null}
        {scannerError ? (
          <p style={{ margin: 0, fontSize: 11, color: '#f87171' }}>{scannerError}</p>
        ) : null}
      </form>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          disabled={busy || !onSelectAllTasks || selectableCount === 0}
          onClick={() => onSelectAllTasks?.()}
          style={{
            ...actionBtnStyle,
            padding: '6px 10px',
            opacity: busy || !onSelectAllTasks || selectableCount === 0 ? 0.45 : 1,
            cursor: busy || !onSelectAllTasks || selectableCount === 0 ? 'not-allowed' : 'pointer',
          }}
          title="Seleccionar todas as peças activas desta ordem / estação"
        >
          Seleccionar tudo
        </button>
        <button
          type="button"
          disabled={!hasSelection || busy}
          onClick={onClearSelection}
          style={{
            ...actionBtnStyle,
            padding: '6px 10px',
            opacity: !hasSelection || busy ? 0.45 : 1,
            cursor: !hasSelection || busy ? 'not-allowed' : 'pointer',
          }}
          title="Desmarcar todas as peças seleccionadas"
        >
          Desmarcar tudo
        </button>
      </div>

      {hasSelection ? (
        <div
          style={{
            display: 'grid',
            gap: 8,
            borderLeft: '2px solid rgba(34,197,94,0.55)',
            paddingLeft: 8,
            ...industrialVisionActiveStyle,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Peças seleccionadas ({selectionCount})</h3>
            <button type="button" onClick={onClearSelection} style={actionBtnStyle} title="Limpar selecção">
              Limpar
            </button>
          </div>
          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4, maxHeight: 160, overflow: 'auto' }}>
            {selectedTasks.map((task) => (
              <li
                key={task.id}
                style={{
                  ...listItemStyle,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: textPrimary, fontSize: 12 }}>{task.pieceId}</div>
                  <div style={{ color: textMuted, fontSize: 11 }}>
                    {task.operationType} · {STATUS_LABEL[task.status]}
                    {task.display?.nqrCode ? ` · ${task.display.nqrCode}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFromSelection(task.id)}
                  style={actionBtnStyle}
                  title="Remover da selecção"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p
          className={INDUSTRIAL_VISION_SECONDARY_CLASS}
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 400,
            color: textMuted,
            lineHeight: 1.5,
            ...industrialVisionSecondaryStyle,
          }}
        >
          Leia códigos ou marque checkboxes para seleccionar peças.
        </p>
      )}

      {selectedTask && !hasSelection ? (
        <dl
          className={INDUSTRIAL_VISION_ACTIVE_CLASS}
          style={{ margin: 0, display: 'grid', gap: 6, fontSize: 12, ...industrialVisionActiveStyle }}
        >
          <div>
            <dt style={{ color: textMuted }}>Peça seleccionada</dt>
            <dd style={{ margin: 0, color: textPrimary }}>{selectedTask.pieceId}</dd>
          </div>
          <div>
            <dt style={{ color: textMuted }}>Operação</dt>
            <dd style={{ margin: 0, color: textPrimary }}>{selectedTask.operationType}</dd>
          </div>
          <div>
            <dt style={{ color: textMuted }}>Estado</dt>
            <dd style={{ margin: 0, color: textPrimary }}>{STATUS_LABEL[selectedTask.status]}</dd>
          </div>
        </dl>
      ) : null}

      {sections.map((section) => (
        <div
          key={section.title}
          className={hasSelection || selectedTask ? INDUSTRIAL_VISION_SECONDARY_CLASS : undefined}
          style={{
            display: 'grid',
            gap: 6,
            ...(hasSelection || selectedTask ? industrialVisionSecondaryStyle : {}),
            borderLeft: '2px solid rgba(59,130,246,0.25)',
            paddingLeft: 8,
            transition: 'all 140ms ease-out',
          }}
        >
          <h3 style={sectionTitleStyle}>{section.title}</h3>
          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {section.items.length === 0 ? (
              <li style={{ fontSize: 12, color: textMuted, lineHeight: 1.5 }}>Sem itens.</li>
            ) : (
              section.items.map((item, index) => {
                const taskId = item.taskId;
                const selectable = Boolean(taskId);
                const checked = taskId ? selectedTaskIds.includes(taskId) : false;
                const focused =
                  (taskId && selectedTask?.id === taskId) ||
                  (item.pieceId && selectedTask?.pieceId === item.pieceId);

                return (
                  <li
                    key={item.id}
                    className={INDUSTRIAL_LIST_ITEM_CLASS}
                    style={{
                      ...listItemStyle,
                      animationDelay: `${index * 30}ms`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      cursor: selectable ? 'pointer' : 'default',
                      ...(checked || focused
                        ? {
                            boxShadow: '0 0 0 2px rgba(59,130,246,0.45)',
                            outline: '2px solid rgba(59,130,246,0.55)',
                            background: trackBg,
                            transform: 'translateY(-2px)',
                          }
                        : {}),
                    }}
                    data-active={checked || focused ? 'true' : undefined}
                    onClick={() => {
                      if (taskId) onToggleTaskSelection(taskId);
                    }}
                  >
                    {selectable ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleTaskSelection(taskId!)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: 2, flexShrink: 0 }}
                        aria-label={`Seleccionar ${item.primary}`}
                      />
                    ) : null}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: textPrimary }}>{item.primary}</div>
                      {item.secondary ? (
                        <div style={{ color: textBody, marginTop: 2, lineHeight: 1.5 }}>{item.secondary}</div>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ))}

      {extra}

      {error ? <p style={{ margin: 0, color: '#f87171', fontSize: 12 }}>{error}</p> : null}

      {actionFeedback ? (
        <p
          style={{
            margin: 0,
            color: actionFeedback.ok ? '#16a34a' : '#f87171',
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 10px',
            borderRadius: 6,
            background: actionFeedback.ok ? 'rgba(22,163,74,0.12)' : 'rgba(248,113,113,0.12)',
            border: `1px solid ${actionFeedback.ok ? 'rgba(22,163,74,0.35)' : 'rgba(248,113,113,0.35)'}`,
          }}
        >
          {actionFeedback.message}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!hasSelection || busy}
          onClick={() => onBulkAction('start')}
          style={{
            ...industrialConfirmBtnStyle,
            background: '#0369a1',
            opacity: !hasSelection ? 0.4 : 1,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Iniciar
        </button>
        <button
          type="button"
          disabled={!hasSelection || busy}
          onClick={onConfirm}
          style={{
            ...industrialConfirmBtnStyle,
            opacity: !hasSelection ? 0.4 : 1,
            cursor: busy ? 'wait' : 'pointer',
          }}
          title={confirmLabel}
        >
          Concluir
        </button>
        <button
          type="button"
          disabled={!hasSelection || busy}
          onClick={() => (onReject ? onReject() : onBulkAction('reject'))}
          style={{
            ...actionBtnStyle,
            padding: '10px 18px',
            cursor: busy ? 'wait' : 'pointer',
            opacity: !hasSelection ? 0.4 : 1,
          }}
        >
          {rejectLabel}
        </button>
      </div>
    </section>
  );
}
