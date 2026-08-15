import type { CSSProperties } from 'react';

export const pageMainStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
  padding: 24,
  color: 'var(--text-main, #f1f5f9)',
  background: 'var(--bg-main, #0f172a)',
  lineHeight: 1.5,
  minHeight: '100%',
};

export const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted, #94a3b8)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  lineHeight: 1.5,
};

export const titleStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--text-main, #f9fafb)',
  lineHeight: 1.5,
};

export const bodyGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 300px) 1fr',
  gap: 16,
  minHeight: 'calc(100vh - 280px)',
  alignItems: 'start',
};

export const panelStyle: CSSProperties = {
  border: '1px solid var(--border, #334155)',
  borderRadius: 8,
  background: 'var(--panel-bg, rgba(15, 23, 42, 0.4))',
  padding: 16,
  minHeight: 0,
  boxShadow:
    '0 0 0 1px #334155, 0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)',
};

export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: '#a3b2c2',
  lineHeight: 1.5,
};

export const viewersColumnStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  minHeight: 0,
};

export function toolBtnStyle(active: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    padding: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 6,
    border: '1px solid var(--border, #334155)',
    background: active ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.04)',
    color: 'var(--text-main, #f1f5f9)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 140ms ease-out',
    ...(active
      ? {
          boxShadow: '0 0 0 2px rgba(59,130,246,0.45)',
          transform: 'translateY(-2px)',
        }
      : { opacity: 0.85 }),
  };
}

export function drillAnchorBtnStyle(active: boolean): CSSProperties {
  return {
    ...toolBtnStyle(active),
    width: '100%',
    height: 36,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.6,
  };
}

export const fieldLabelStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  color: 'var(--text-muted, #94a3b8)',
};

export const fieldInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--border, #334155)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-main, #f8fafc)',
  fontSize: 12,
};

export const fieldInputDisabledStyle: CSSProperties = {
  ...fieldInputStyle,
  opacity: 0.55,
  cursor: 'default',
};

export const viewerShellStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: 420,
  background: '#020617',
  border: '1px solid var(--border, #334155)',
  borderRadius: 8,
  overflow: 'hidden',
};

export const axesOverlayStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  width: 56,
  height: 56,
  pointerEvents: 'none',
  zIndex: 2,
};

export const toolbarDividerStyle: CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  minHeight: 28,
  background: 'var(--border, #334155)',
  margin: '0 4px',
};
