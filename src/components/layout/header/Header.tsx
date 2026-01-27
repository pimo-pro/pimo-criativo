import { useTheme } from "../../../hooks/useTheme";
import { HEADER_THEME_IDS, THEMES } from "../../../theme/themes";
import type { ThemeId } from "../../../theme/themes";

interface HeaderProps {
  onToggleDocs: () => void;
  docsOpen: boolean;
  onShowRoadmap: () => void;
  roadmapOpen: boolean;
}

export default function Header({
  onToggleDocs,
  docsOpen,
  onShowRoadmap,
  roadmapOpen,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();

  const themes = THEMES.filter((item) => HEADER_THEME_IDS.includes(item.id));

  return (
    <header
      style={{
        height: "56px",
        background: "linear-gradient(90deg, #0b0f17, #0f172a)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
      }}
    >
      {/* Logótipo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background:
              "radial-gradient(circle at 20% 20%, #3b82f6, #0b0f17 70%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
            color: "white",
          }}
        >
          π
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>PIMO‑Criativo</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Configurador paramétrico
          </div>
        </div>
      </div>

      {/* Área Direita */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>🌐 Idioma: PT</span>
        <span style={{ color: "var(--text-main)" }}>📁 Projetos</span>
        <button
          onClick={onShowRoadmap}
          style={{
            background: roadmapOpen ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-main)",
            padding: "6px 10px",
            borderRadius: "var(--radius)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Roadmap
        </button>
        <button
          onClick={onToggleDocs}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-main)",
            padding: "6px 10px",
            borderRadius: "var(--radius)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {docsOpen ? "Voltar ao App" : "Documentação"}
        </button>

        {/* Alterar Tema */}
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeId)}
          style={{
            background: "var(--glass)",
            border: "1px solid var(--border)",
            color: "var(--text-main)",
            padding: "6px 10px",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            minWidth: 130,
          }}
        >
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
