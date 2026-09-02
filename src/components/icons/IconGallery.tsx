import { useCallback, useMemo, useState } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./types";

const DEFAULT_GALLERY_SIZE = 16;

const ICON_GROUPS: { id: string; label: string; names: IconName[] }[] = [
  {
    id: "header",
    label: "Header",
    names: [
      "themeSun",
      "themeMoon",
      "user",
      "upload",
      "projects",
      "settings",
    ],
  },
  {
    id: "leftToolbar",
    label: "LeftToolbar",
    names: [
      "home",
      "furniture",
      "models",
      "calculator",
      "electro",
      "accessories",
      "info",
    ],
  },
  {
    id: "viewer",
    label: "Viewer",
    names: [
      "camera",
      "highlight",
      "ruler",
      "grid",
      "room",
      "roomSnap",
      "roomDoor",
      "roomWindow",
      "roomVertex",
      "orbit",
      "pan",
      "select",
      "move",
      "rotate",
      "scale",
      "pieces",
      "dimensions",
      "industrialDesign",
    ],
  },
  {
    id: "contextMenu",
    label: "ContextMenu",
    names: [
      "delete",
      "rename",
      "duplicate",
      "lock",
      "unlock",
      "alignFront",
      "alignBottom",
      "material",
      "mouse",
      "chevronRight",
      "check",
    ],
  },
  {
    id: "toolbar",
    label: "Toolbar",
    names: [
      "undo",
      "redo",
      "photoMode",
      "resetCamera",
      "send",
      "displayMenu",
      "displayCheck",
      "lock3D",
      "exploded",
    ],
  },
  {
    id: "admin",
    label: "Admin",
    names: [
      "adminWood",
      "adminChecklist",
      "adminScrew",
      "adminPuzzle",
      "adminRuler",
      "adminSettings",
      "adminBook",
      "adminFolder",
      "adminArchive",
      "adminLab",
      "adminTools",
      "adminTag",
      "adminSave",
      "adminChart",
      "adminDocs",
    ],
  },
  {
    id: "alerts",
    label: "Alerts",
    names: ["alertWarning", "alertInfo", "alertError"],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    names: ["blueprint"],
  },
];

const ALL_NAMES: IconName[] = ICON_GROUPS.flatMap((g) => g.names);

export function IconGallery() {
  const [tab, setTab] = useState<string>("header");
  const [search, setSearch] = useState("");
  const [size, setSize] = useState(DEFAULT_GALLERY_SIZE);
  const [hex, setHex] = useState("#475569");
  const [previewDark, setPreviewDark] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const visibleNames = useMemo(() => {
    const group = ICON_GROUPS.find((g) => g.id === tab);
    const base = group ? group.names : ALL_NAMES;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((n) => n.toLowerCase().includes(q));
  }, [tab, search]);

  const handleCopy = useCallback((name: IconName) => {
    const snippet = `<Icon name="${name}" size={${size}} />`;
    void navigator.clipboard.writeText(snippet);
    setCopied(name);
    window.setTimeout(() => setCopied(null), 1500);
  }, [size]);

  const cardBg = previewDark ? "#1e293b" : "#f8fafc";
  const cardFg = previewDark ? "#f1f5f9" : "#0f172a";

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "system-ui, sans-serif",
        color: cardFg,
        background: previewDark ? "#0f172a" : "#e2e8f0",
        minHeight: "100%",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ margin: "0 0 16px", fontSize: 20 }}>PIMO Icon Gallery</h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Grupo
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            style={{ minWidth: 160, padding: 6 }}
          >
            {ICON_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, flex: 1, minWidth: 200 }}>
          Pesquisar
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome do ícone…"
            style={{ padding: 6 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Tamanho ({size}px)
          <input
            type="range"
            min={12}
            max={48}
            step={2}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Cor
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={previewDark}
            onChange={(e) => setPreviewDark(e.target.checked)}
          />
          Fundo escuro nos cartões
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {visibleNames.map((name) => (
          <div
            key={name}
            style={{
              border: "1px solid rgba(148,163,184,0.35)",
              borderRadius: 10,
              padding: 12,
              background: cardBg,
              color: cardFg,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              minHeight: 180,
            }}
          >
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: hex }}>
                <Icon name={name} size={size} color={hex} />
              </span>
            </div>
            <code style={{ fontSize: 11, wordBreak: "break-all" }}>{name}</code>
            <pre
              style={{
                margin: 0,
                fontSize: 10,
                textAlign: "left",
                width: "100%",
                overflow: "auto",
                background: previewDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.04)",
                padding: 8,
                borderRadius: 6,
              }}
            >
              {`<Icon\n  name="${name}"\n  size={${size}}\n/>`}
            </pre>
            <button
              type="button"
              onClick={() => handleCopy(name)}
              style={{
                padding: "6px 10px",
                fontSize: 11,
                cursor: "pointer",
                borderRadius: 6,
                border: "1px solid rgba(148,163,184,0.5)",
                background: "transparent",
                color: cardFg,
              }}
            >
              {copied === name ? "Copiado!" : "Copiar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
