import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("../materials/MaterialEngine", () => ({
  applyMaterialToMesh: vi.fn(),
}));

import { createRematePieces } from "../../../core/remate/rematePieceFactory";
import { createRemateInputFromTampoPreset } from "../../../core/remate/tampoPresets";
import { TAMPO_MATERIAL_ID, TAMPO_THICKNESS_MM } from "../../../core/remate/tampoCozinhaRules";
import { TAMPO_ANGULAR_LAY_FLAT_X_RAD as LAY_FLAT } from "../../../core/remate/tampoAngle";
import { TampoPieceVisualizer } from "./TampoPieceVisualizer";
import { getRemateSavedPoseLocal } from "../../../core/remate/remateTransformStability";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import type { WorkspaceBox } from "../../../core/types";

function makeBox(): WorkspaceBox {
  return {
    id: "box-host",
    nome: "Modulo",
    dimensoes: { largura: 800, altura: 720, profundidade: 560 },
    espessura: 19,
  } as WorkspaceBox;
}

describe("TAMPO angular — pose livre (sem montagem CIMA)", () => {
  it("criar tampo angular → isolado, horizontal, frente≠trás", () => {
    const pieces = createRematePieces(
      {
        ...createRemateInputFromTampoPreset("tampo1"),
        parentBoxId: "box-host",
        followBox: true,
      },
      {
        box: makeBox(),
        materialPresetId: TAMPO_MATERIAL_ID,
        thicknessMm: TAMPO_THICKNESS_MM,
        boxDimsM: { widthM: 0.8, heightM: 0.72, depthM: 0.56 },
      }
    );
    const p = pieces[0]!;
    expect(p.followBox).toBe(false);
    expect(p.parentBoxId).toBeUndefined();
    expect(p.placementMode).toBe("FREE");
    expect(p.angleConfig!.frontLengthMm).toBe(1995);
    expect(p.angleConfig!.backLengthMm).toBe(2303);
    expect(p.rotation.xRad).toBeCloseTo(LAY_FLAT, 5);
  });

  it("tampo angular no viewer: pose guardada, não deriva da caixa", () => {
    const pieces = createRematePieces(createRemateInputFromTampoPreset("tampo2"), {
      materialPresetId: TAMPO_MATERIAL_ID,
      thicknessMm: TAMPO_THICKNESS_MM,
    });
    const piece = pieces[0]!;
    const viz = new TampoPieceVisualizer();
    viz.bindBridge({
      listRematePieces: () => [piece],
      getBoxConfig: () => ({
        boxId: "box-host",
        widthM: 0.8,
        heightM: 0.72,
        depthM: 0.56,
      }),
      getBoxWorldMatrix: () => new THREE.Matrix4().makeTranslation(10, 20, 30),
    });
    viz.syncAll();
    const mesh = viz.getMeshByRemateId(piece.id)!;
    expect(mesh.rotation.x).toBeCloseTo(LAY_FLAT, 5);
    expect(mesh.position.x).not.toBeCloseTo(10, 1);
    viz.dispose();
  });

  it("rodar tampo angular → mesh mantém a rotação guardada", () => {
    const pieces = createRematePieces(createRemateInputFromTampoPreset("tampo1"), {
      materialPresetId: TAMPO_MATERIAL_ID,
      thicknessMm: TAMPO_THICKNESS_MM,
    });
    const piece: RematePiece = {
      ...pieces[0]!,
      rotation: { xRad: LAY_FLAT, yRad: Math.PI / 6, zRad: 0 },
      transform: {
        xMm: pieces[0]!.position.xMm,
        yMm: pieces[0]!.position.yMm,
        zMm: pieces[0]!.position.zMm,
        rotacaoXRad: LAY_FLAT,
        rotacaoYRad: Math.PI / 6,
        rotacaoZRad: 0,
      },
      isInitialPlacement: false,
      placementMode: "FREE",
    };
    const viz = new TampoPieceVisualizer();
    viz.bindBridge({
      listRematePieces: () => [piece],
      getBoxConfig: () => null,
      getBoxWorldMatrix: () => null,
    });
    viz.syncAll();
    const mesh = viz.getMeshByRemateId(piece.id)!;
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 6, 5);
    const pose = getRemateSavedPoseLocal(piece);
    expect(pose.rotation.yRad).toBeCloseTo(Math.PI / 6, 5);
    viz.syncAll();
    expect(viz.getMeshByRemateId(piece.id)!.rotation.y).toBeCloseTo(Math.PI / 6, 5);
    viz.dispose();
  });

  it("tampo retangular com caixa → continua followBox / parentBoxId", () => {
    const pieces = createRematePieces(
      {
        productType: "TAMPO_COZINHA",
        parentBoxId: "box-host",
        followBox: true,
      },
      {
        box: makeBox(),
        materialPresetId: TAMPO_MATERIAL_ID,
        thicknessMm: TAMPO_THICKNESS_MM,
        boxDimsM: { widthM: 0.8, heightM: 0.72, depthM: 0.56 },
      }
    );
    const p = pieces[0]!;
    expect(p.angleConfig == null || p.angleConfig === null).toBe(true);
    expect(p.parentBoxId).toBe("box-host");
    expect(p.followBox).toBe(true);
  });
});
