import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("../../3d/viewer-engine/materials/MaterialEngine", () => ({
  applyMaterialToMesh: vi.fn(),
}));

import { createShowroomFinishVisuals } from "./showroomFinishVisuals";
import type { ProjectState } from "../../context/projectTypes";
import { createRematePieces } from "../../core/remate/rematePieceFactory";
import { createRemateInputFromTampoPreset } from "../../core/remate/tampoPresets";
import { TAMPO_MATERIAL_ID, TAMPO_THICKNESS_MM } from "../../core/remate/tampoCozinhaRules";

function emptyProject(remates: ProjectState["remates"] = []): ProjectState {
  return {
    workspaceBoxes: [],
    remates,
    rodapes: [],
    hematis: [],
  } as ProjectState;
}

describe("showroomFinishVisuals — TAMPO no PROJETOS", () => {
  it("TAMPO angular standalone aparece no tampoVisualizer (não no remateVisualizer)", () => {
    const pieces = createRematePieces(createRemateInputFromTampoPreset("tampo1"), {
      materialPresetId: TAMPO_MATERIAL_ID,
      thicknessMm: TAMPO_THICKNESS_MM,
    });
    const finish = createShowroomFinishVisuals(emptyProject(pieces), () => null);
    finish.syncAll();
    const id = pieces[0]!.id;
    expect(finish.tampoVisualizer.getMeshByRemateId(id)).toBeInstanceOf(THREE.Mesh);
    expect(finish.remateVisualizer.getMeshByRemateId(id)).toBeUndefined();
    const geom = finish.tampoVisualizer.getMeshByRemateId(id)!.geometry;
    expect(geom.boundingBox).not.toBeNull();
    expect(geom.boundingSphere).not.toBeNull();
    finish.dispose();
  });

  it("TAMPO retangular também aparece no tampoVisualizer", () => {
    const pieces = createRematePieces(
      {
        productType: "TAMPO_COZINHA",
        width: 1200,
        height: 630,
        depth: 30,
      },
      {
        materialPresetId: TAMPO_MATERIAL_ID,
        thicknessMm: TAMPO_THICKNESS_MM,
      }
    );
    const finish = createShowroomFinishVisuals(emptyProject(pieces), () => null);
    finish.syncAll();
    expect(finish.tampoVisualizer.getMeshByRemateId(pieces[0]!.id)).toBeInstanceOf(THREE.Mesh);
    finish.dispose();
  });
});
