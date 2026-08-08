/**
 * Página ADMIN — Industrial Models (somente leitura).
 * Lê INDUSTRIAL_MODELS; não altera runtime / SSOT / cutlist.
 */

import { INDUSTRIAL_MODELS } from "../../core/industrialAdmin/industrialModelsRegistry";
import { IndustrialModelsTable } from "./components/IndustrialModelsTable";

export function IndustrialModelsPage() {
  const models = INDUSTRIAL_MODELS;

  return (
    <div
      data-testid="industrial-models-page"
      style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}
    >
      <header>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Industrial Models</h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          Registo somente leitura dos modos industriais (Fases A–D). Sem edição nesta fase.
        </p>
      </header>

      <section aria-label="Lista de modos industriais">
        <IndustrialModelsTable models={models} />
      </section>

      <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
        {models.length} modo(s) registado(s)
      </p>
    </div>
  );
}

export default IndustrialModelsPage;
