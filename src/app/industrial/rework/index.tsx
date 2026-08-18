import { IndustrialLayout, IndustrialPlaceholderPanel, useIndustrialPageState } from '@/industrial/ui/components';
import QrScannerPanel from '@/app/industrial/work-orders/components/QrScannerPanel';

export default function IndustrialReworkRoute() {
  useIndustrialPageState();

  return (
    <IndustrialLayout title="Retrabalho" description="Pedidos, origem, destino e resolução de retrabalho.">
      <div style={{ display: 'grid', gap: 16 }}>
        <QrScannerPanel />
        <IndustrialPlaceholderPanel module="Rework" nextStep="Ligar fila de retrabalho e decisões de qualidade na Fase 3C.2." />
      </div>
    </IndustrialLayout>
  );
}
