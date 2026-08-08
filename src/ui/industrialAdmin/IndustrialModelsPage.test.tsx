import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { INDUSTRIAL_MODELS } from "../../core/industrialAdmin/industrialModelsRegistry";
import { IndustrialModelsPage } from "./IndustrialModelsPage";

describe("IndustrialModelsPage Fase F", () => {
  it("renderiza sem crash e exibe os 4 modos", () => {
    const html = renderToStaticMarkup(<IndustrialModelsPage />);
    expect(html).toContain("industrial-models-page");
    expect(INDUSTRIAL_MODELS).toHaveLength(4);
    for (const m of INDUSTRIAL_MODELS) {
      expect(html).toContain(m.nomeTecnico);
      expect(html).toContain(m.nomeIndustrial);
      expect(html).toContain(`>${m.phase}<`);
    }
  });

  it("exibe pieceTipos, adapters, regras e dependências", () => {
    const html = renderToStaticMarkup(<IndustrialModelsPage />);
    expect(html).toContain("cxGavCutlistAdapter");
    expect(html).toContain("a1CutlistAdapter");
    expect(html).toContain("naming_industrial");
    expect(html).toContain("profundidadeSsot");
    expect(html).toContain("cx_gav_lat_dir");
  });

  it("snapshot estável", () => {
    const html = renderToStaticMarkup(<IndustrialModelsPage />);
    expect(html).toMatchSnapshot();
  });
});
