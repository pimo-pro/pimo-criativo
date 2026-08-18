import { IndustrialLayout, IndustrialPlaceholderPanel, useIndustrialPageState } from '@/industrial/ui/components';
import QrScannerPanel from '@/app/industrial/work-orders/components/QrScannerPanel';

export default function IndustrialTimeTrackingRoute() {
  useIndustrialPageState();

  return (
    <IndustrialLayout title="Tempo de Operação" description="Registo de start/stop por estação e operador.">
      <div style={{ display: 'grid', gap: 16 }}>
        <QrScannerPanel />
        <IndustrialPlaceholderPanel module="Time Tracking" nextStep="Ligar timers operacionais na Fase 3C.2." />
      </div>
    </IndustrialLayout>
  );
}
