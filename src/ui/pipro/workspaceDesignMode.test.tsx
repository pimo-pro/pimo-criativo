/**
 * Workspace Design Mode — PiproDesignWorkspace + página (markup estático).
 */

import { describe, expect, it, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PiproDesignWorkspace } from "../../core/pipro/PiproDesignWorkspace";
import {
  __resetPiproModelsForTests,
  loadPiproModel,
} from "../../core/pipro/piproModelsRegistry";
import { CX_GAV_PRODUCT_MODE_ID } from "../../core/cxGav/cxGavGeometry";
import { WorkspaceDesignModePage } from "./WorkspaceDesignModePage";

describe("PiproDesignWorkspace", () => {
  beforeEach(() => {
    __resetPiproModelsForTests();
  });

  it("createBaseBox gera cutlist clássica com motor activo e sem features", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ nome: "Modelo pipro vazio", featureIds: [], engineEnabled: true });
    expect(ws.state.engineEnabled).toBe(true);
    expect(ws.cutlist.length).toBeGreaterThan(0);
    expect(ws.pieces.every((p) => !String(p.tipo).startsWith("cx_gav_"))).toBe(true);
    expect(ws.pieces.every((p) => !String(p.tipo).startsWith("a1_cx"))).toBe(true);
  });

  it("modelo vazio + motor ON expõe canais industriais", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ nome: "Modelo pipro vazio", featureIds: [], engineEnabled: true });
    const p = ws.getIndustrialPanelData();
    expect(p.modelo.engineEnabled).toBe(true);
    expect(p.modelo.nome).toBe("Modelo pipro vazio");
    expect(p.cutlist.length).toBeGreaterThan(0);
    expect(p.tecnico.length).toBe(p.cutlist.length);
    expect(p.pecasIndustriais.length).toBe(p.cutlist.length);
    expect(p.metadata.engine).toBe("unified_industrial_box_engine");
    expect(p.cutlist.some((i) => String(i.tipo).startsWith("cx_gav"))).toBe(false);
  });

  it("setFeatures(cx_gav_cavita) → cutlist com cx_gav_*", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ featureIds: [], engineEnabled: true });
    ws.setFeatures([CX_GAV_PRODUCT_MODE_ID]);
    const cx = ws.pieces.filter((p) => String(p.tipo).startsWith("cx_gav_"));
    expect(cx.length).toBeGreaterThanOrEqual(4);
  });

  it("pieces têm machineTarget e orlaSides", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ featureIds: [CX_GAV_PRODUCT_MODE_ID], engineEnabled: true });
    expect(ws.pieces.some((p) => p.machineTarget === "drill" || p.machineTarget === "cnc")).toBe(
      true
    );
    expect(ws.pieces.some((p) => (p.orlaSides?.length ?? 0) > 0)).toBe(true);
  });

  it("save() → loadPiproModel(id) devolve record", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ nome: "pipro-save-test", featureIds: [], engineEnabled: true });
    const saved = ws.save();
    const loaded = loadPiproModel(saved.id);
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.metadata.engine).toBe("unified_industrial_box_engine");
    expect(loaded?.cutlist.length).toBeGreaterThan(0);
  });
});

describe("WorkspaceDesignModePage", () => {
  it("renderiza sem crash e expõe painel industrial completo", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WorkspaceDesignModePage />
      </MemoryRouter>
    );
    expect(html).toContain("workspace-design-mode-page");
    expect(html).toContain("pipro-industrial-right-panel");
    expect(html).toContain("Motor industrial unificado");
    expect(html).toContain("pipro-panel-cutlist");
    expect(html).toContain("pipro-panel-tecnico");
    expect(html).toContain("pipro-panel-drill");
    expect(html).toContain("pipro-panel-cnc");
    expect(html).toContain("pipro-panel-orla");
    expect(html).toContain("pipro-panel-pecas");
    expect(html).toContain("pipro-panel-labels");
    expect(html).toContain("pipro-panel-metadata");
    expect(html).toContain("Cutlist:");
    expect(html).toContain("DRILL:");
    expect(html).toContain("CNC:");
    expect(html).toContain("Orla:");
    expect(html).toContain("Metadata industrial");
  });
});
