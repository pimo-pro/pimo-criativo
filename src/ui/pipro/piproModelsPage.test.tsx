/**
 * Página pública `/moveis` + load/save id no Workspace.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PiproDesignWorkspace } from "../../core/pipro/PiproDesignWorkspace";
import {
  __resetPiproModelsForTests,
  listPiproModels,
  loadPiproModel,
  savePiproModel,
} from "../../core/pipro/piproModelsRegistry";
import { summarizePiproModel } from "../components/PiproModelCard";
import { PiproModelsPage } from "./PiproModelsPage";
import { PIPRO_MODELS_PUBLIC_PATH } from "../routes/piproRoutes";

describe("PiproModelsPage", () => {
  beforeEach(() => {
    __resetPiproModelsForTests();
  });

  it("página vazia mostra estado empty", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PiproModelsPage />
      </MemoryRouter>
    );
    expect(html).toContain("pipro-models-page");
    expect(html).toContain("pipro-models-empty");
    expect(html).toContain("pipro-create-new-model");
    expect(html).toContain(PIPRO_MODELS_PUBLIC_PATH);
  });

  it("lista modelo guardado no cartão", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ nome: "Armário demo", featureIds: [], engineEnabled: true });
    savePiproModel(ws.toPiproModel());

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PiproModelsPage />
      </MemoryRouter>
    );
    expect(html).toContain("pipro-model-card");
    expect(html).toContain("Armário demo");
    expect(html).toContain("Editar no Workspace");
    expect(html).toContain("pipro-create-new-model");
  });
});

describe("PiproModelCard / Workspace load-save", () => {
  beforeEach(() => {
    __resetPiproModelsForTests();
  });

  it("summarizePiproModel conta peças e furos", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ nome: "stats", featureIds: [], engineEnabled: true });
    const model = ws.toPiproModel();
    const stats = summarizePiproModel(model);
    expect(stats.pieceCount).toBe(model.pieces.length);
    expect(stats.holeCount).toBeGreaterThanOrEqual(0);
  });

  it("loadFromRecord + save preserva o mesmo id", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ nome: "original", featureIds: [], engineEnabled: true });
    const first = ws.save();
    expect(listPiproModels()).toHaveLength(1);

    const ws2 = new PiproDesignWorkspace();
    const loaded = loadPiproModel(first.id);
    expect(loaded).toBeTruthy();
    ws2.loadFromRecord(loaded!);
    ws2.state.nome = "editado";
    ws2.rebuild();
    const second = ws2.save();

    expect(second.id).toBe(first.id);
    expect(listPiproModels()).toHaveLength(1);
    expect(loadPiproModel(first.id)?.nome).toBe("editado");
  });
});
