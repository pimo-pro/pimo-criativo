import { describe, expect, it } from "vitest";
import type { CutListItemComPreco } from "../types";
import type { ProjectState } from "../../context/projectTypes";
import { DRILLING_SSOT_VERSION } from "../../modules/drilling/drillingAdapter";
import {
  detectPersistedIndustrialCache,
  PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY,
  projectNeedsIndustrialDrillingPurge,
  purgeIndustrialDrillingIfStale,
  purgeStaleIndustrialProjectData,
} from "./industrialProjectDrillingPurge";

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

function itemWithHole(id: string): CutListItemComPreco {
  return {
    id,
    nome: id,
    dimensoes: { largura: 100, altura: 200, profundidade: 18 },
    drillHoles: [{ xLocal: 10, yLocal: 20, diametro: 5, profundidade: 10, tipo: "parafuso" }],
  } as CutListItemComPreco;
}

describe("industrialProjectDrillingPurge", () => {
  it("detecta cache industrial persistido (furos em extracted)", () => {
    const state = baseState({
      extractedPartsByBoxId: {
        b1: { m1: [itemWithHole("p1")] },
      },
    });
    expect(detectPersistedIndustrialCache(state)).toBe(true);
    expect(projectNeedsIndustrialDrillingPurge(state)).toBe(true);
  });

  it("purge completo remove furos, edits e marca SSOT", () => {
    const state = baseState({
      industrialPieceEdits: { p1: { largura: 500 } },
      extractedPartsByBoxId: { b1: { m1: [itemWithHole("p1")] } },
      boxes: [
        {
          id: "b1",
          nome: "Caixa",
          cutListComPreco: [itemWithHole("c1")],
        } as ProjectState["boxes"][number],
      ],
    });

    const { state: next, report } = purgeStaleIndustrialProjectData(state);
    expect(report.strippedDrillHolesFromExtracted).toBeGreaterThan(0);
    expect(report.clearedIndustrialPieceEdits).toBe(1);
    expect(next.industrialPieceEdits).toEqual({});
    expect(next.extractedPartsByBoxId?.b1?.m1?.[0]?.drillHoles).toBeUndefined();
    expect(next.boxes?.[0]?.cutListComPreco).toEqual([]);
    expect((next as Record<string, unknown>)[PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY]).toBe(
      DRILLING_SSOT_VERSION
    );
  });

  it("purgeIndustrialDrillingIfStale com SSOT atual faz cache-only (mantém piece edits)", () => {
    const state = baseState({
      [PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY]: DRILLING_SSOT_VERSION,
      industrialPieceEdits: { p1: { largura: 500 } },
      extractedPartsByBoxId: { b1: { m1: [itemWithHole("p1")] } },
    } as Partial<ProjectState>);

    const { state: next, purged, report } = purgeIndustrialDrillingIfStale(state);
    expect(purged).toBe(true);
    expect(report?.clearedIndustrialPieceEdits).toBe(0);
    expect(next.industrialPieceEdits).toEqual({ p1: { largura: 500 } });
    expect(next.extractedPartsByBoxId?.b1?.m1?.[0]?.drillHoles).toBeUndefined();
  });

  it("force purge limpa industrialPieceEdits mesmo com SSOT atual", () => {
    const state = baseState({
      [PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY]: DRILLING_SSOT_VERSION,
      industrialPieceEdits: { p1: { largura: 500 } },
    } as Partial<ProjectState>);

    const { state: next, purged } = purgeIndustrialDrillingIfStale(state, { force: true });
    expect(purged).toBe(true);
    expect(next.industrialPieceEdits).toEqual({});
  });
});
