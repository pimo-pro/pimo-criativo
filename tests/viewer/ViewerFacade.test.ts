/**
 * Z-01.2.8 — fachada ViewerCore / ViewerFacade.
 * Sem instanciar o Viewer (sem WebGL / jsdom Three).
 */
import { describe, expect, it, vi } from "vitest";
import { ViewerCore } from "../../src/3d/viewer-engine/ViewerCore";
import { ViewerFacade } from "../../src/3d/viewer-engine/ViewerFacade";
import {
  BoxEngine,
  CameraEngine,
  ComposerEngine,
  DesignerEngine,
  GizmoEngine,
  LayoutEngine,
  LightingEngine,
  MeasurementEngine,
  ProjectLoader,
  SceneEngine,
  SelectionEngine,
  SnapEngine,
  ViewerFacade as EnginesViewerFacade,
  ViewerRoomEngine,
  ViewerRuntimeLoop,
  ViewerState,
  createFinishSyncFlags,
  requestFinishSync,
} from "../../src/3d/viewer-engine/engines";
import { clampGlobalLightIntensity } from "../../src/3d/viewer-engine/lighting/LightingEngine";
import { computeCameraPresetPosition } from "../../src/3d/viewer-engine/camera/CameraEngine";
import { roomConfigToDimensions } from "../../src/3d/viewer-engine/room/ViewerRoomEngine";

describe("ViewerFacade (Z-01.2.8)", () => {
  it("o nome público ViewerCore é o mesmo construtor que ViewerFacade", () => {
    expect(ViewerFacade).toBe(ViewerCore);
    expect(EnginesViewerFacade).toBe(ViewerCore);
  });

  it("o mapa A→E exporta os motores activos (sem duplicar SceneManager / Room 2.0)", () => {
    expect(SceneEngine).toBeTypeOf("function");
    expect(LightingEngine).toBeTypeOf("function");
    expect(ComposerEngine).toBeTypeOf("function");
    expect(CameraEngine).toBeTypeOf("function");
    expect(SelectionEngine).toBeTypeOf("function");
    expect(MeasurementEngine).toBeTypeOf("function");
    expect(GizmoEngine).toBeTypeOf("function");
    expect(BoxEngine).toBeTypeOf("function");
    expect(ViewerRoomEngine).toBeTypeOf("function");
    expect(DesignerEngine).toBeTypeOf("function");
    expect(SnapEngine).toBeTypeOf("function");
    expect(LayoutEngine).toBeTypeOf("function");
    expect(ViewerRuntimeLoop).toBeTypeOf("function");
    expect(ViewerState).toBeTypeOf("function");
    expect(ProjectLoader).toBeTypeOf("function");
  });

  it("a fachada delega luz, câmara, caixa, sala, finish e designer sem criar malha", () => {
    const applyGlobalIntensity = vi.fn((_v: number) => clampGlobalLightIntensity(_v));
    const addBox = vi.fn(() => true);
    const createRoom = vi.fn();
    const refreshAttachment = vi.fn();
    const designer = new DesignerEngine();

    const facade = {
      setGlobalLightIntensity: (value: number) => applyGlobalIntensity(value),
      addBox: (id: string) => addBox({ id }),
      createRoom: (config: Parameters<typeof roomConfigToDimensions>[0]) => {
        const dims = roomConfigToDimensions(config);
        if (!dims) return false;
        createRoom(dims.widthM, dims.depthM, dims.heightM, dims.numWalls);
        return true;
      },
      refreshGizmo: () => refreshAttachment(),
      ensureDesigner: () => designer.ensure({ getBridge: () => null }),
    };

    expect(facade.setGlobalLightIntensity(3)).toBe(1.4);
    expect(facade.addBox("box-1")).toBe(true);
    expect(addBox).toHaveBeenCalledWith({ id: "box-1" });

    expect(
      facade.createRoom({
        walls: [
          { lengthMm: 4000, heightMm: 2800 },
          { lengthMm: 3000, heightMm: 2800 },
          { lengthMm: 4000, heightMm: 2800 },
          { lengthMm: 3000, heightMm: 2800 },
        ],
        numWalls: 4,
      } as never)
    ).toBe(true);
    expect(createRoom).toHaveBeenCalledWith(4, 3, 2.8, 4);

    facade.refreshGizmo();
    expect(refreshAttachment).toHaveBeenCalledTimes(1);

    expect(designer.get()).toBeNull();
    const first = facade.ensureDesigner();
    expect(designer.get()).toBe(first);
    expect(facade.ensureDesigner()).toBe(first);
  });

  it("presets de câmara e finish sync mantêm contratos em mm / metros do Viewer", () => {
    const front = computeCameraPresetPosition({ x: 0, y: 0, z: 0 }, 2.5, "front");
    expect(front.z).toBeCloseTo(2.5);
    expect(front.z * 1000).toBeCloseTo(2500);

    const flags = createFinishSyncFlags();
    const run = vi.fn();
    requestFinishSync(flags, "orla", true, run);
    expect(run).not.toHaveBeenCalled();
    expect(flags.orla).toBe(true);
  });

  it("ViewerState arranca sem selecção e em modo performance", () => {
    const state = new ViewerState();
    expect(state.getSelectedBox()).toBeNull();
    expect(state.getCurrentMode()).toBe("performance");
    expect(state.getTransformControlsDragging()).toBe(false);
  });
});
