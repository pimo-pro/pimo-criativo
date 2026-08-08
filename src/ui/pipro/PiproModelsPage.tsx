/**
 * Página pública — catálogo de modelos pipro (`/moveis`).
 */

import { useNavigate } from "react-router-dom";
import { listPiproModels } from "../../core/pipro/piproModelsRegistry";
import { PiproModelCard } from "../components/PiproModelCard";
import {
  PIPRO_MODELS_PUBLIC_PATH,
  PIPRO_WORKSPACE_NEW_PATH,
  piproWorkspaceEditPath,
} from "../routes/piproRoutes";

export function PiproModelsPage() {
  const navigate = useNavigate();
  const models = listPiproModels();

  return (
    <div
      data-testid="pipro-models-page"
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Móveis pipro</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Modelos industriais criados no Workspace Design Mode.
          </p>
        </div>
        <button
          type="button"
          data-testid="pipro-create-new-model"
          onClick={() => navigate(PIPRO_WORKSPACE_NEW_PATH)}
        >
          Criar novo modelo
        </button>
      </header>

      {models.length === 0 ? (
        <p data-testid="pipro-models-empty" style={{ color: "var(--text-muted)" }}>
          Ainda não há modelos guardados. Crie o primeiro no Workspace.
        </p>
      ) : (
        <section
          aria-label="Lista de modelos pipro"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {models.map((m) => (
            <PiproModelCard
              key={m.id}
              model={m}
              onEdit={(id) => navigate(piproWorkspaceEditPath(id))}
            />
          ))}
        </section>
      )}

      <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
        {models.length} modelo(s) · rota {PIPRO_MODELS_PUBLIC_PATH}
      </p>
    </div>
  );
}

export default PiproModelsPage;
