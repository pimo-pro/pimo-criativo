import { IndustrialLayout, IndustrialPlaceholderPanel, useIndustrialPageState } from '@/industrial/ui/components';
import QrScannerPanel from '@/app/industrial/work-orders/components/QrScannerPanel';

export default function IndustrialTrackingRoute() {
  useIndustrialPageState();

  return (
    <IndustrialLayout title="Tracking" description="Acompanhamento de peças, operações e progresso.">
      <div style={{ display: 'grid', gap: 16 }}>
        <QrScannerPanel />
        <IndustrialPlaceholderPanel module="Tracking" nextStep="Ligar snapshots de tracking e realtime na Fase 3C.2." />
      </div>
    </IndustrialLayout>
  );
}
