import { describe, expect, it } from "vitest";
import type { ProjectState } from "../../context/projectTypes";
import {
  applyIndustrialLoadPurge,
  shouldForceIndustrialProductionPurge,
  shouldForceIndustrialProductionPurgeFromState,
} from "./industrialProductionPurge";
import { DRILLING_SSOT_VERSION } from "../../modules/drilling/drillingAdapter";
import { PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY } from "./industrialProjectDrillingPurge";

function baseState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    projectName: "Teste",
    boxes: [],
    workspaceBoxes: [],
    extractedPartsByBoxId: {},
    industrialPieceEdits: {},
    industrialOperacoes: {},
    ...overrides,
  } as ProjectState;
}

describe("industrialProductionPurge", () => {
  it("detecta Antunes como produção", () => {
    expect(shouldForceIndustrialProductionPurge("Cliente Antunes Cozinha")).toBe(true);
    expect(shouldForceIndustrialProductionPurge("NP261410")).toBe(false);
  });

  it("readyForProduction força purge completo", () => {
    const state = baseState({
      projectName: "Ordem fabrico",
      readyForProduction: true,
      industrialPieceEdits: { p1: { largura: 500 } },
      [PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY]: DRILLING_SSOT_VERSION,
    } as Partial<ProjectState>);

    expect(shouldForceIndustrialProductionPurgeFromState(state)).toBe(true);
    const { purged, state: next } = applyIndustrialLoadPurge(state);
    expect(purged).toBe(true);
    expect(next.industrialPieceEdits).toEqual({});
  });

  it("projeto com SSOT antigo purge sem force explícito", () => {
    const state = baseState({
      cutListComPreco: [{ id: "x", nome: "P", dimensoes: { largura: 1, altura: 1, profundidade: 18 } }],
    } as Partial<ProjectState>);

    const { purged, state: next } = applyIndustrialLoadPurge(state);
    expect(purged).toBe(true);
    expect(next.cutListComPreco).toBeNull();
    expect((next as Record<string, unknown>)[PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY]).toBe(
      DRILLING_SSOT_VERSION
    );
  });
});
