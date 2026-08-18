import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

type MenuItem =
  | { type: 'link'; label: string; path: string }
  | { type: 'submenu'; label: string; items: Array<{ label: string; path: string }> };

const MENU_ITEMS: MenuItem[] = [
  { type: 'link', label: 'Operador', path: '/industrial/operador' },
  { type: 'link', label: 'Tracking', path: '/industrial/tracking' },
  { type: 'link', label: 'Work Orders', path: '/industrial/work-orders' },
  { type: 'link', label: 'Supervisor', path: '/industrial/supervisor' },
  { type: 'link', label: 'Quality', path: '/industrial/quality' },
  { type: 'link', label: 'Rework', path: '/industrial/rework' },
  { type: 'link', label: 'Time Tracking', path: '/industrial/time-tracking' },
  {
    type: 'submenu',
    label: 'Operations',
    items: [
      { label: 'Todas as operações', path: '/industrial/operations' },
      { label: 'CNC', path: '/industrial/operations/cnc' },
      { label: 'Nesting', path: '/industrial/operations/nesting' },
      { label: 'Drill', path: '/industrial/operations/drill' },
      { label: 'Orlar', path: '/industrial/operations/orlar' },
      { label: 'Montagem', path: '/industrial/operations/montagem' },
      { label: 'Embalagem', path: '/industrial/operations/embalagem' },
    ],
  },
  { type: 'link', label: 'Settings Industrial', path: '/admin/settings/industrial' },
];

function IndustrialWrenchIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.7 6.3a4 4 0 0 0 0 5.7l1 1-4 4-1-1a4 4 0 0 0-5.7 0 2.8 2.8 0 0 1-4-4 4 4 0 0 0 0-5.7 4 4 0 0 1 5.7 0 4 4 0 0 0 5.7 0 2.8 2.8 0 0 1 4 4z" />
    </svg>
  );
}

export default function HeaderIndustrialMenu() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setOperationsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setOperationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
    setOperationsOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        title="PIMO-TRAK Industrial"
        aria-label="Abrir menu industrial PIMO-TRAK"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: 29,
          padding: '0 10px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: open ? 'var(--button-ghost-bg-hover, rgba(255,255,255,0.08))' : 'var(--button-ghost-bg)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        <IndustrialWrenchIcon />
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1200,
            minWidth: 220,
            padding: 6,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--navy, #0f172a)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              padding: '6px 10px 8px',
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'var(--text-muted, #94a3b8)',
              fontWeight: 600,
            }}
          >
            PIMO-TRAK
          </div>

          {MENU_ITEMS.map((item) =>
            item.type === 'link' ? (
              <button
                key={item.path}
                type="button"
                role="menuitem"
                onClick={() => goTo(item.path)}
                style={menuButtonStyle}
              >
                {item.label}
              </button>
            ) : (
              <div key={item.label}>
                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={operationsOpen}
                  onClick={() => setOperationsOpen((value) => !value)}
                  style={{
                    ...menuButtonStyle,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{item.label}</span>
                  <span aria-hidden style={{ fontSize: 10, opacity: 0.7 }}>
                    {operationsOpen ? '▲' : '▼'}
                  </span>
                </button>
                {operationsOpen
                  ? item.items.map((subItem) => (
                      <button
                        key={subItem.path}
                        type="button"
                        role="menuitem"
                        onClick={() => goTo(subItem.path)}
                        style={{
                          ...menuButtonStyle,
                          paddingLeft: 22,
                          fontSize: 12,
                        }}
                      >
                        {subItem.label}
                      </button>
                    ))
                  : null}
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

const menuButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text-main)',
  cursor: 'pointer',
  fontSize: 13,
};
