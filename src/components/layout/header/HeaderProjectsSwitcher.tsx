import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

type SwitcherItem =
  | { id: string; label: string; path: string }
  | { id: string; label: string; soon: true };

const PIMO_PROJECTS: SwitcherItem[] = [
  { id: "pro", label: "PIMO PRO", path: "/" },
  { id: "trak", label: "PIMO TRAK", path: "/industrial/work-orders" },
  { id: "projetos", label: "PIMO PROJETOS", path: "/PROJETOS" },
  { id: "nesting", label: "PIMO NESTING", path: "/nesting_v3" },
  { id: "industrial", label: "PIMO Industrial", path: "/industrial" },
];

function ProjectsGridIcon() {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default function HeaderProjectsSwitcher() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        title="Projetos PIMO"
        aria-label="Abrir menu de projetos PIMO"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 29,
          padding: "0 10px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          background: open
            ? "var(--button-ghost-bg-hover, rgba(255,255,255,0.08))"
            : "var(--button-ghost-bg)",
          color: "var(--text-main)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <ProjectsGridIcon />
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1200,
            minWidth: 220,
            padding: 6,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--navy, #0f172a)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              padding: "6px 10px 8px",
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--text-muted, #94a3b8)",
              fontWeight: 600,
            }}
          >
            Projetos PIMO
          </div>
          {PIMO_PROJECTS.map((item) => {
            if (!("path" in item)) {
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled
                  style={{ ...menuButtonStyle, opacity: 0.55, cursor: "default" }}
                >
                  {item.label}{" "}
                  <span style={{ fontSize: 11, opacity: 0.8 }}>(em breve)</span>
                </button>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => goTo(item.path)}
                style={menuButtonStyle}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const menuButtonStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  border: "none",
  borderRadius: "var(--pi-btn-radius, 6px)",
  background: "transparent",
  color: "var(--text-main)",
  cursor: "pointer",
  fontSize: 13,
};
