import type { ReactNode } from 'react';

import { nestingPanelStyle } from './nestingLayoutStyles';

export interface NestingThreeColumnLayoutProps {
  title: string;
  description?: string;
  sidebarOpen?: boolean;
  leftLeft: ReactNode;
  left: ReactNode;
  right: ReactNode;
  history?: ReactNode;
}

export function NestingThreeColumnLayout({
  title,
  description,
  sidebarOpen = true,
  leftLeft,
  left,
  right,
  history,
}: NestingThreeColumnLayoutProps) {
  const gridTemplateColumns = sidebarOpen && history ? '56px 260px 300px 1fr' : '56px 300px 1fr';

  return (
    <main style={{ display: 'grid', gap: 24, padding: 24 }}>
      <header>
        <p style={{ margin: 0, color: '#64748b', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
          Nesting V3
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: 28 }}>{title}</h1>
        {description ? <p style={{ margin: '8px 0 0', color: '#475569' }}>{description}</p> : null}
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          gap: 16,
          minHeight: 'calc(100vh - 220px)',
        }}
      >
        <div style={{ ...nestingPanelStyle, padding: 8, display: 'grid', alignContent: 'start' }}>
          {leftLeft}
        </div>
        {sidebarOpen && history ? <div style={nestingPanelStyle}>{history}</div> : null}
        <div style={nestingPanelStyle}>{left}</div>
        <div style={{ minHeight: 0 }}>{right}</div>
      </div>
    </main>
  );
}
