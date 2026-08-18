import { describe, expect, it, vi } from "vitest";
import { ViewerTools } from "./ViewerTools";
import type { IViewerToolsEngine } from "./ToolsEngineTypes";

function createMeshStub() {
  return {
    uuid: "mesh-1",
    matrixAutoUpdate: true,
    updateMatrixWorld: vi.fn(),
  };
}

function createEngine(overrides: Partial<IViewerToolsEngine> & { cadOnly?: boolean }) {
  const mesh = createMeshStub();
  const controls = {
    attach: vi.fn(),
    detach: vi.fn(),
    setMode: vi.fn(),
    setSize: vi.fn(),
    setSpace: vi.fn(),
    showX: true,
    showY: true,
    showZ: true,
  };
  const cadOnly = overrides.cadOnly ?? false;
  const engine: IViewerToolsEngine = {
    getTransformControls: () => controls,
    getTransformControlsHelper: () => null,
    getCurrentTool: () => "scale",
    getSelectedBoxId: () => "box-1",
    getSelectedHematiId: () => null,
    getSelectedRodapeId: () => null,
    getSelectedRemateId: () => null,
    getSelectedDivSep: () => null,
    getDivSepMesh: () => null,
    getHematiMesh: () => null,
    getRodapeMesh: () => null,
    getRemateMesh: () => null,
    getBoxEntry: () => ({
      mesh: mesh as never,
      width: 0.6,
      height: 0.8,
      depth: 0.4,
      cadOnly,
    }),
    getSelectedWallIndex: () => null,
    getRoomBoxWalls: () => [],
    getSelectedRoomElementId: () => null,
    getRoomElementById: () => null,
    getSelectedRoomUtilityId: () => null,
    getRoomUtilityById: () => null,
    getTransformGizmoSizeForBox: () => 0.4,
    setTransformHelperVisible: vi.fn(),
    applyTransformControlsMouseGuard: vi.fn(),
    logTransformDiagnostic: vi.fn(),
    getSelectionOutline: () => null,
    getSelectionOutlineMaterial: () => null,
    getHoveredBoxId: () => null,
    getHoveredRemateId: () => null,
    getBoxesIntersectingWalls: () => new Set(),
    setOutlineTarget: vi.fn(),
    clampTransform: vi.fn(),
    getGroupGizmo: () =>
      ({
        isActive: () => false,
        end: vi.fn(),
        begin: vi.fn(),
      }) as never,
    getGroupTransformMemberIds: () => [],
    resolveMemberMesh: () => null,
    applyGroupPivotTransform: vi.fn(),
    notifyGroupTransform: vi.fn(),
    clampGroupTransform: vi.fn(),
    ...overrides,
  };
  return { engine, controls };
}

describe("ViewerTools scale attachment (Z-02.2)", () => {
  it("anexa gizmo scale em caixa cadOnly (GLB)", () => {
    const { engine, controls } = createEngine({ cadOnly: true });
    const tools = new ViewerTools(engine);
    tools.updateTransformControlsAttachment();
    expect(controls.setMode).toHaveBeenCalledWith("scale");
    expect(controls.attach).toHaveBeenCalled();
  });

  it("não anexa gizmo scale em caixa industrial", () => {
    const { engine, controls } = createEngine({ cadOnly: false });
    const tools = new ViewerTools(engine);
    tools.updateTransformControlsAttachment();
    expect(controls.setMode).not.toHaveBeenCalledWith("scale");
    expect(controls.attach).not.toHaveBeenCalled();
  });

  it("não anexa gizmo scale em remate", () => {
    const { engine, controls } = createEngine({
      cadOnly: true,
      getSelectedRemateId: () => "remate-1",
    });
    const tools = new ViewerTools(engine);
    tools.updateTransformControlsAttachment();
    expect(controls.setMode).not.toHaveBeenCalledWith("scale");
    expect(controls.attach).not.toHaveBeenCalled();
  });
});
