import { IndustrialLayout, IndustrialPlaceholderPanel, useIndustrialPageState } from '@/industrial/ui/components';
import QrScannerPanel from '@/app/industrial/work-orders/components/QrScannerPanel';

export default function IndustrialQualityRoute() {
  useIndustrialPageState();

  return (
    <IndustrialLayout title="Qualidade" description="Inspeções, bloqueios e decisões de qualidade.">
      <div style={{ display: 'grid', gap: 16 }}>
        <QrScannerPanel />
        <IndustrialPlaceholderPanel module="Qualidade" nextStep="Ligar inspeções e rework automático na Fase 3C.2." />
      </div>
    </IndustrialLayout>
  );
}
