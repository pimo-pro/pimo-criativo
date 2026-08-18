import { Navigate } from 'react-router-dom';

import { useIndustrialPageState } from '@/industrial/ui/components';

export default function IndustrialCncOperationRoute() {
  useIndustrialPageState();
  return <Navigate to="/industrial/work-orders/nesting" replace />;
}
