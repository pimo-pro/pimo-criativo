import { describe, expect, it } from "vitest";
import type { ProjectState } from "../../../context/projectTypes";
import { ProjectLoader } from "./ProjectLoader";
import { detectFormat } from "./ProjectFormatAdapter";

function pimoState(overrides?: Partial<ProjectState>): ProjectState {
  return {
    projectName: "Cozinha teste",
    workspaceBoxes: [
      {
        id: "box-1",
        posicaoX_mm: 600,
        posicaoY_mm: 360,
        posicaoZ_mm: 300,
        dimensoes: { largura: 600, altura: 720, profundidade: 560 },
        models: [],
      } as ProjectState["workspaceBoxes"][number],
    ],
    ...overrides,
  } as ProjectState;
}

describe("ProjectLoader (Z-01.2.5)", () => {
  const loader = new ProjectLoader();

  it("identidade pimo-project: posições e dimensões ficam em mm (não metros)", () => {
    const state = pimoState();
    const result = loader.load({ json: state });

    expect(result.format).toBe("pimo-project");
    expect(result.validation.ok).toBe(true);
    expect(result.normalized?.units).toBe("mm");
    expect(result.normalized?.industrialReady).toBe(true);
    const box = result.normalized?.workspaceBoxes[0];
    expect(box?.posicaoX_mm).toBe(600);
    expect(box?.posicaoY_mm).toBe(360);
    expect(box?.posicaoZ_mm).toBe(300);
    expect(box?.dimensoes.largura).toBe(600);
    expect(box?.dimensoes.altura).toBe(720);
    expect(box?.dimensoes.profundidade).toBe(560);
    expect(result.normalized?.pimoProjectRef).toBe(state);
  });

  it("toProjectState identidade devolve o mesmo ProjectState (sem reescrever schema)", () => {
    const state = pimoState();
    const result = loader.load({ json: state });
    const adapterState = result.normalized?.pimoProjectRef;
    expect(adapterState).toBe(state);
    expect(adapterState?.workspaceBoxes[0]?.posicaoX_mm).toBe(600);
  });

  it("GLB: industrialReady false, caixa cad em mm, sem ProjectState fabricado", () => {
    const result = loader.load({ fileName: "modulo.glb", url: "/models/modulo.glb" });
    expect(result.format).toBe("glb");
    expect(result.validation.ok).toBe(true);
    expect(result.normalized?.industrialReady).toBe(false);
    expect(result.normalized?.units).toBe("mm");
    expect(result.normalized?.workspaceBoxes[0]?.dimensoes.largura).toBe(600);
    expect(result.normalized?.workspaceBoxes[0]?.posicaoY_mm).toBe(360);
    expect(result.normalized?.pimoProjectRef).toBeUndefined();
    expect(result.normalized?.assets[0]?.url).toBe("/models/modulo.glb");
  });

  it("DXF/IFC/STEP: detectados, sem parser, industrialReady false", () => {
    expect(detectFormat({ fileName: "planta.dxf" })).toBe("dxf");
    expect(detectFormat({ fileName: "sala.ifc" })).toBe("ifc");
    expect(detectFormat({ fileName: "solido.step" })).toBe("step");
    for (const fileName of ["planta.dxf", "sala.ifc", "solido.step"]) {
      const result = loader.load({ fileName });
      expect(result.normalized?.industrialReady).toBe(false);
      expect(result.normalized?.units).toBe("mm");
      expect(result.validation.ok).toBe(false);
      expect(result.normalized?.workspaceBoxes).toEqual([]);
    }
  });
});
