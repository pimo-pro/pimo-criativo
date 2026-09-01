import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import IndustrialSpriteIcon from '@/components/icons/IndustrialSpriteIcon';
import { useOperatorQrScanner } from '@/app/industrial/operador/hooks/useOperatorQrScanner';
import { industrialBtnStyle, industrialListItemStyle, industrialSectionTitleStyle } from '@/industrial/ui/layouts/industrialStyles';
import { INDUSTRIAL_STATIONS, STATION_LABELS } from '@/industrial/work-orders/types';
import type { SupervisorDashboardSnapshot } from '@/industrial/persistence/supervisor/types';
import {
  resolveProjetosLinkForProjectId,
  resolveProjectDisplayName,
} from '@/industrial/integration/projetos/projetosProjectLinks';
import { orderProjectCode } from '@/industrial/persistence/supervisor/supervisorTaskDisplay';

import type { UseSupervisorDashboardReturn } from '../hooks/useSupervisorDashboard';

interface SupervisorFiltersPanelProps {
  snapshot: SupervisorDashboardSnapshot | null;
  state: UseSupervisorDashboardReturn;
}

const STATUS_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendente' },
  { id: 'in_progress', label: 'Em execução' },
  { id: 'completed', label: 'Concluído' },
  { id: 'rejected', label: 'Rejeitado' },
];

export default function SupervisorFiltersPanel({ snapshot, state }: SupervisorFiltersPanelProps) {
  const orders = snapshot?.orders ?? [];
  const projects = snapshot?.projectKpis ?? [];
  const alerts = state.alerts;
  const [nqrInput, setNqrInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const submitCode = (code: string) => {
    void state.submitNqr(code);
    setNqrInput('');
  };

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
    onScan: submitCode,
  });

  const onSubmitNqr = (event: FormEvent) => {
    event.preventDefault();
    if (nqrInput.trim()) submitCode(nqrInput);
  };

  return (
    <aside style={{ display: 'grid', gap: 14, alignContent: 'start', overflow: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
      <section style={{ display: 'grid', gap: 6 }}>
        <h3 style={industrialSectionTitleStyle}>N-QR / peça</h3>
        <form onSubmit={onSubmitNqr} style={{ display: 'grid', gap: 6 }}>
          <input
            value={nqrInput}
            onChange={(e) => setNqrInput(e.target.value)}
            placeholder="N-QR / QR / PC-…"
            autoComplete="off"
            data-operator-usb-capture="1"
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid var(--border, #334155)',
              background: 'rgba(255,255,255,0.04)',
              color: '#f8fafc',
              fontSize: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="submit" style={industrialBtnStyle(false)}>
              Procurar
            </button>
            <button
              type="button"
              onClick={() => {
                if (cameraActive) {
                  stopCamera();
                  setScannerOpen(false);
                  return;
                }
                setScannerOpen(true);
                void startCamera();
              }}
              style={industrialBtnStyle(cameraActive)}
            >
              {cameraActive ? 'Parar câmara' : 'Câmara'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (usbCaptureActive) {
                  stopUsbCapture();
                  return;
                }
                setScannerOpen(true);
                startUsbCapture();
              }}
              style={industrialBtnStyle(usbCaptureActive)}
            >
              {usbCaptureActive ? 'USB activo' : 'USB'}
            </button>
          </div>
        </form>
        {cameraActive ? (
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', display: 'block', background: '#000', borderRadius: 6, maxHeight: 140 }}
          />
        ) : null}
        {scannerError ? <p style={{ margin: 0, fontSize: 11, color: '#f87171' }}>{scannerError}</p> : null}
      </section>
      <section style={{ display: 'grid', gap: 6 }}>
        <h3 style={industrialSectionTitleStyle}>Projetos</h3>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {projects.length === 0 ? (
            <li style={{ fontSize: 12, color: '#94a3b8' }}>Sem projetos.</li>
          ) : (
            projects.map((project) => {
              const projetosLink = resolveProjetosLinkForProjectId(project.projectId);
              return (
              <li key={project.projectId}>
                <button
                  type="button"
                  onClick={() => state.setSelectedProjectId(project.projectId)}
                  style={{
                    ...industrialListItemStyle,
                    width: '100%',
                    textAlign: 'left',
                    border:
                      state.selectedProjectId === project.projectId
                        ? '1px solid #38bdf8'
                        : '1px solid transparent',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{project.projectCode || resolveProjectDisplayName(project.projectId)}</div>
                  <div style={{ color: '#94a3b8', marginTop: 2 }}>{project.progressPct}% · {project.totalTasks} tarefas</div>
                  {projetosLink ? (
                    <Link
                      to={projetosLink.href}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 11, color: '#38bdf8', display: 'inline-block', marginTop: 4 }}
                    >
                      Abrir PROJETOS
                    </Link>
                  ) : null}
                </button>
              </li>
              );
            })
          )}
        </ul>
      </section>

      <section style={{ display: 'grid', gap: 6 }}>
        <h3 style={industrialSectionTitleStyle}>Ordens de trabalho</h3>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {orders.slice(0, 12).map((order) => (
            <li
              key={order.id}
              style={industrialListItemStyle}
              onClick={() => state.openDetail(`Ordem ${order.id}`, `Estação ${STATION_LABELS[order.station]} · ${order.status}`)}
              onKeyDown={() => undefined}
              role="button"
              tabIndex={0}
            >
              <div style={{ fontWeight: 600 }}>{STATION_LABELS[order.station]}</div>
              <div style={{ color: '#94a3b8', marginTop: 2 }}>{orderProjectCode(order)} · {order.status}</div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ display: 'grid', gap: 6 }}>
        <h3 style={industrialSectionTitleStyle}>Estações</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {INDUSTRIAL_STATIONS.map((station) => (
            <button
              key={station}
              type="button"
              onClick={() => state.setSelectedStation(station)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                borderRadius: 6,
                border: '1px solid var(--border, #334155)',
                background: state.selectedStation === station ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
                color: '#f8fafc',
                cursor: 'pointer',
              }}
            >
              {STATION_LABELS[station]}
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 6 }}>
        <h3 style={industrialSectionTitleStyle}>Estado</h3>
        <select
          value={state.statusFilter}
          onChange={(e) => state.setStatusFilter(e.target.value)}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid var(--border, #334155)',
            background: 'rgba(255,255,255,0.04)',
            color: '#f8fafc',
            fontSize: 12,
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      <section style={{ display: 'grid', gap: 6 }}>
        <h3 style={industrialSectionTitleStyle}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IndustrialSpriteIcon name="industrial-alerts" size={12} />
            Alertas activos ({alerts.length})
          </span>
        </h3>
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {alerts.slice(0, 6).map((alert) => (
            <li key={alert.id} style={{ ...industrialListItemStyle, borderLeft: `3px solid ${alert.level === 'success' ? '#16a34a' : alert.level === 'error' ? '#dc2626' : '#f59e0b'}` }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{alert.title}</div>
              <div style={{ color: '#94a3b8', marginTop: 2, fontSize: 11 }}>{alert.message}</div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
