interface HeaderProps {
  onTogglePainelReferencia: () => void;
  painelReferenciaOpen: boolean;
  onToggleProjectProgress?: () => void;
  projectProgressOpen?: boolean;
}

export default function Header({
  onTogglePainelReferencia,
  painelReferenciaOpen,
  onToggleProjectProgress,
  projectProgressOpen,
}: HeaderProps) {
  return (
    <header
      style={{
        height: "56px",
        background: `linear-gradient(90deg, var(--black), var(--navy))`,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
      }}
    >
      {/* Logótipo */}
      <div 
        style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
        onClick={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background:
              "radial-gradient(circle at 20% 20%, var(--blue-light), var(--black) 70%)",
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
          onClick={onToggleProjectProgress}
          style={{
            background: projectProgressOpen ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-main)",
            padding: "6px 10px",
            borderRadius: "var(--radius)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {projectProgressOpen ? "Voltar ao App" : "Progresso do Projeto"}
        </button>
        <button
          onClick={onTogglePainelReferencia}
          style={{
            background: painelReferenciaOpen ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-main)",
            padding: "6px 10px",
            borderRadius: "var(--radius)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {painelReferenciaOpen ? "Voltar ao App" : "Painel de Referência"}
        </button>
      </div>
    </header>
  );
}
