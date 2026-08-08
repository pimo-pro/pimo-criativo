import { describe, expect, it } from "vitest";
import { defaultState } from "../../context/projectState";
import { PiproDesignWorkspace } from "./PiproDesignWorkspace";
import {
  PIPRO_DESIGN_BOX_ID,
  applyPiproToProjectState,
  syncPiproFromProjectBox,
} from "./piproProjectBridge";

describe("piproProjectBridge", () => {
  it("aplica uma caixa pipro ao ProjectState", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({
      nome: "Teste bridge",
      featureIds: [],
      engineEnabled: true,
    });
    const next = applyPiproToProjectState(defaultState, ws);
    expect(next.workspaceBoxes).toHaveLength(1);
    expect(next.workspaceBoxes[0]?.id).toBe(PIPRO_DESIGN_BOX_ID);
    expect(next.projectName).toBe("Teste bridge");
    expect(next.selectedWorkspaceBoxId).toBe(PIPRO_DESIGN_BOX_ID);
  });

  it("sincroniza dims do projecto para o workspace pipro", () => {
    const ws = new PiproDesignWorkspace();
    ws.createBaseBox({ nome: "A", featureIds: [], engineEnabled: true });
    const next = applyPiproToProjectState(defaultState, ws);
    const box = {
      ...next.workspaceBoxes[0]!,
      nome: "B",
      dimensoes: { largura: 900, altura: 720, profundidade: 560 },
      espessura: 19,
    };
    expect(syncPiproFromProjectBox(ws, box)).toBe(true);
    expect(ws.state.nome).toBe("B");
    expect(ws.state.dimensions.largura).toBe(900);
    expect(ws.state.dimensions.altura).toBe(720);
  });
});
