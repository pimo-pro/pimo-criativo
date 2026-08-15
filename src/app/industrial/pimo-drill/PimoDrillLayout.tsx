import type { ReactNode } from 'react';

import Footer from '@/components/layout/footer/Footer';
import Header from '@/components/layout/header/Header';

/**
 * Shell isolado PIMO DRILL: Header + Footer PIMO.PRO, sem TopBarTrak.
 * A rota deve viver fora de AppChromeLayout / ProtectedLayout.
 */
export default function PimoDrillLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ui-app-frame">
      <Header />
      <main className="ui-app-frame__content">{children}</main>
      <Footer />
    </div>
  );
}
