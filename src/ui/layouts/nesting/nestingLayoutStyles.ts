import type { CSSProperties } from 'react';

export const nestingPanelStyle: CSSProperties = {
  border: '1px solid var(--border, #e2e8f0)',
  borderRadius: 8,
  background: 'var(--panel-bg, rgba(15, 23, 42, 0.4))',
  padding: 16,
  minHeight: 0,
};

export function nestingBtnStyle(active = false): CSSProperties {
  return {
    padding: '6px 10px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid var(--border, #334155)',
    background: active ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.04)',
    color: 'var(--text-main, #f8fafc)',
    cursor: 'pointer',
  };
}
