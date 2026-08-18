import { IndustrialLayout, IndustrialPlaceholderPanel, useIndustrialPageState } from '@/industrial/ui/components';
import QrScannerPanel from '@/app/industrial/work-orders/components/QrScannerPanel';

export default function IndustrialEventsRoute() {
  useIndustrialPageState();

  return (
    <IndustrialLayout title="Eventos" description="Histórico industrial e auditoria operacional.">
      <div style={{ display: 'grid', gap: 16 }}>
        <QrScannerPanel />
        <IndustrialPlaceholderPanel module="Eventos" nextStep="Ligar filtros e feed de eventos Supabase na Fase 3C.2." />
      </div>
    </IndustrialLayout>
  );
}
