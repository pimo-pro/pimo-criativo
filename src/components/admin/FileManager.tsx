/**
 * Gestor de Ficheiros — exibe estrutura de pastas conforme fileManagerConfig.
 * Ocultar ficheiros ocultos por padrão; bloqueia uploads de .php e similares.
 */

import { useState } from "react";
import {
  FILE_MANAGER_VISIBLE_ITEMS,
  FILE_MANAGER_HIDDEN_BY_DEFAULT,
  isUploadBlocked,
} from "../../constants/fileManagerConfig";

export default function FileManager() {
  const [showHidden, setShowHidden] = useState(!FILE_MANAGER_HIDDEN_BY_DEFAULT);

  const items = FILE_MANAGER_VISIBLE_ITEMS.filter(
    (item) => showHidden || !("hidden" in item && item.hidden)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Mostrar ficheiros ocultos
        </label>
      </div>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 12,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Estrutura</div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
          {items.map((item) => (
            <li key={item.path}>
              {item.type === "folder" ? "📁" : "📄"}               {item.path}
              {("hidden" in item && item.hidden) ? (
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}> (oculto)</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Uploads bloqueados: .php, .phtml, .php3, .php4, .php5
        {isUploadBlocked("test.php") && " ✓"}
      </div>
    </div>
  );
}
