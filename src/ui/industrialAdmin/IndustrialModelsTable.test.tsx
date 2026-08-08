import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { INDUSTRIAL_MODELS } from "../../core/industrialAdmin/industrialModelsRegistry";
import { IndustrialModelsTable } from "./components/IndustrialModelsTable";

describe("IndustrialModelsTable Fase F", () => {
  it("renderiza tabela com 4 linhas e colunas obrigatórias", () => {
    expect(INDUSTRIAL_MODELS).toHaveLength(4);
    const html = renderToStaticMarkup(<IndustrialModelsTable models={INDUSTRIAL_MODELS} />);
    expect(html).toContain("industrial-models-table");
    expect(html).toContain("Modelo");
    expect(html).toContain("Fase");
    expect(html).toContain("Peças industriais");
    expect(html).toContain("Regras");
    expect(html).toContain("Adapters");
    expect(html).toContain("Dependências");
    expect(html).toContain("Sync/Adapter order");
    for (const m of INDUSTRIAL_MODELS) {
      expect(html).toContain(`industrial-model-row-${m.id}`);
    }
  });
});
